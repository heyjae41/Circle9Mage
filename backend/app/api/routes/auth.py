"""
사용자 인증 관련 API 엔드포인트
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import hashlib
import random
import string

from app.services.auth_service import auth_service
from app.services.circle_client import circle_wallet_service
from app.database.connection import get_db, get_redis
from app.models.user import User, Wallet
from app.core.config import get_settings

router = APIRouter()
settings = get_settings()

# Request/Response 모델들
class RegisterRequest(BaseModel):
    """회원가입 요청 모델"""
    email: EmailStr = Field(..., description="이메일 주소")
    phone: str = Field(..., min_length=10, max_length=20, description="전화번호 (국가코드 포함)")
    first_name: str = Field(..., min_length=1, max_length=100, description="이름")
    last_name: str = Field(..., min_length=1, max_length=100, description="성")
    country_code: str = Field(..., min_length=2, max_length=2, description="국가 코드 (KR, US 등)")
    pin: str = Field(..., min_length=6, max_length=6, description="6자리 PIN 번호")

class LoginRequest(BaseModel):
    """로그인 요청 모델"""
    email: EmailStr = Field(..., description="이메일 주소")
    pin: str = Field(..., min_length=6, max_length=6, description="6자리 PIN 번호")

class VerifyEmailRequest(BaseModel):
    """이메일 인증 요청 모델"""
    email: EmailStr = Field(..., description="이메일 주소")
    verification_code: str = Field(..., min_length=6, max_length=6, description="6자리 인증 코드")

class VerifyPhoneRequest(BaseModel):
    """SMS 인증 요청 모델"""
    phone: str = Field(..., description="전화번호")
    verification_code: str = Field(..., min_length=6, max_length=6, description="6자리 인증 코드")

class AuthResponse(BaseModel):
    """인증 응답 모델"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict

class UserResponse(BaseModel):
    """사용자 정보 응답 모델"""
    id: int
    email: str
    first_name: str
    last_name: str
    country_code: str
    is_verified: bool
    kyc_status: str
    created_at: datetime

def hash_pin(pin: str) -> str:
    """PIN을 해시화"""
    return hashlib.sha256(pin.encode()).hexdigest()

def generate_verification_code() -> str:
    """6자리 인증 코드 생성"""
    return ''.join(random.choices(string.digits, k=6))

async def send_email_verification(email: str, code: str):
    """이메일 인증 코드 발송 (개발 환경에서는 로그만 출력)"""
    print(f"📧 이메일 인증 코드 발송 - {email}: {code}")
    # 실제 구현에서는 이메일 서비스 (SendGrid, AWS SES 등) 연동

async def send_sms_verification(phone: str, code: str):
    """SMS 인증 코드 발송 (개발 환경에서는 로그만 출력)"""
    print(f"📱 SMS 인증 코드 발송 - {phone}: {code}")
    # 실제 구현에서는 SMS 서비스 (Twilio, AWS SNS 등) 연동

@router.post("/register", response_model=AuthResponse)
async def register_user(
    request: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    redis = Depends(get_redis)
):
    """사용자 회원가입"""
    try:
        # 1. 이미 존재하는 이메일인지 확인
        result = await db.execute(
            select(User).where(User.email == request.email)
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="이미 등록된 이메일 주소입니다"
            )
        
        # 2. 이미 존재하는 전화번호인지 확인
        result = await db.execute(
            select(User).where(User.phone == request.phone)
        )
        existing_phone = result.scalar_one_or_none()
        
        if existing_phone:
            raise HTTPException(
                status_code=400,
                detail="이미 등록된 전화번호입니다"
            )
        
        # 3. 새 사용자 생성
        new_user = User(
            email=request.email,
            phone=request.phone,
            first_name=request.first_name,
            last_name=request.last_name,
            country_code=request.country_code.upper(),
            pin_hash=hash_pin(request.pin),
            is_verified=False,
            kyc_status="pending"
        )
        
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        # 4. Circle Wallets로 ETH 지갑 자동 생성 (재시도 로직 포함)
        wallet_creation_success = False
        wallet_error_msg = None
        
        try:
            print(f"🔄 사용자 {new_user.id}의 ETH 지갑 생성 시작...")
            
            # 재시도 로직이 포함된 지갑 생성 호출
            wallet_response = await circle_wallet_service.create_wallet_with_retry(
                user_id=str(new_user.id),
                blockchain="ETH"
            )
            
            # 지갑 정보 저장
            if wallet_response.get("data") and wallet_response["data"].get("wallets"):
                wallet_data = wallet_response["data"]["wallets"][0]
                
                # 지갑 주소 유효성 재검증
                wallet_address = wallet_data["address"]
                if not circle_wallet_service.is_valid_ethereum_address(wallet_address):
                    raise ValueError(f"생성된 지갑 주소가 유효하지 않습니다: {wallet_address}")
                
                # User 모델에 Circle 정보 업데이트
                new_user.circle_wallet_id = wallet_data["id"]
                new_user.circle_entity_id = wallet_data.get("entityId", "")
                
                # Wallet 모델에 지갑 정보 저장
                new_wallet = Wallet(
                    user_id=new_user.id,
                    circle_wallet_id=wallet_data["id"],
                    wallet_address=wallet_address,
                    chain_id=1,  # Ethereum mainnet
                    chain_name="ethereum",
                    usdc_balance=0.0
                )
                
                db.add(new_wallet)
                await db.commit()
                
                wallet_creation_success = True
                print(f"✅ ETH 지갑 생성 성공: {wallet_address}")
                
            else:
                raise ValueError("Circle API 응답에서 지갑 데이터를 찾을 수 없습니다")
                
        except Exception as wallet_error:
            wallet_error_msg = str(wallet_error)
            print(f"❌ 지갑 생성 실패: {wallet_error_msg}")
            
            # 사용자 메타데이터에 지갑 생성 실패 정보 저장
            import json
            new_user.extra_metadata = json.dumps({
                "wallet_creation_failed": True,
                "wallet_error": wallet_error_msg,
                "failed_at": datetime.utcnow().isoformat()
            })
            await db.commit()
        
        # 5. 이메일 및 SMS 인증 코드 생성 및 발송
        email_code = generate_verification_code()
        phone_code = generate_verification_code()
        
        # Redis에 인증 코드 저장 (5분 만료)
        await redis.setex(f"email_verify:{request.email}", 300, email_code)
        await redis.setex(f"phone_verify:{request.phone}", 300, phone_code)
        
        # 백그라운드에서 인증 코드 발송
        background_tasks.add_task(send_email_verification, request.email, email_code)
        background_tasks.add_task(send_sms_verification, request.phone, phone_code)
        
        # 6. JWT 토큰 생성
        access_token = auth_service.create_access_token({
            "user_id": str(new_user.id),
            "email": new_user.email,
            "role": "user"
        })
        
        refresh_token = auth_service.create_refresh_token({
            "user_id": str(new_user.id),
            "email": new_user.email
        })
        
        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.access_token_expire_minutes * 60,
            user={
                "id": new_user.id,
                "email": new_user.email,
                "first_name": new_user.first_name,
                "last_name": new_user.last_name,
                "country_code": new_user.country_code,
                "is_verified": new_user.is_verified,
                "kyc_status": new_user.kyc_status,
                "wallet_creation_status": "success" if wallet_creation_success else "failed",
                "wallet_error": wallet_error_msg if not wallet_creation_success else None
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"회원가입 처리 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/login", response_model=AuthResponse)
async def login_user(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """사용자 로그인"""
    try:
        # 1. 사용자 확인
        result = await db.execute(
            select(User).where(User.email == request.email)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=401,
                detail="이메일 또는 PIN이 올바르지 않습니다"
            )
        
        # 2. PIN 확인
        if user.pin_hash != hash_pin(request.pin):
            raise HTTPException(
                status_code=401,
                detail="이메일 또는 PIN이 올바르지 않습니다"
            )
        
        # 3. 계정 활성 상태 확인
        if not user.is_active:
            raise HTTPException(
                status_code=401,
                detail="비활성화된 계정입니다"
            )
        
        # 4. 마지막 로그인 시간 업데이트
        user.last_login_at = datetime.utcnow()
        await db.commit()
        
        # 5. JWT 토큰 생성
        access_token = auth_service.create_access_token({
            "user_id": str(user.id),
            "email": user.email,
            "role": "user"
        })
        
        refresh_token = auth_service.create_refresh_token({
            "user_id": str(user.id),
            "email": user.email
        })
        
        # 6. Redis 세션 저장
        auth_service.store_session(
            user_id=str(user.id),
            access_token=access_token,
            refresh_token=refresh_token
        )
        
        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.access_token_expire_minutes * 60,
            user={
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "country_code": user.country_code,
                "is_verified": user.is_verified,
                "kyc_status": user.kyc_status
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"로그인 처리 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/verify-email")
async def verify_email(
    request: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
    redis = Depends(get_redis)
):
    """이메일 인증"""
    try:
        # 1. Redis에서 인증 코드 확인
        stored_code = await redis.get(f"email_verify:{request.email}")
        
        if not stored_code or stored_code.decode() != request.verification_code:
            raise HTTPException(
                status_code=400,
                detail="인증 코드가 올바르지 않거나 만료되었습니다"
            )
        
        # 2. 사용자 이메일 인증 상태 업데이트
        result = await db.execute(
            select(User).where(User.email == request.email)
        )
        user = result.scalar_one_or_none()
        
        if user:
            # 인증 코드 삭제
            await redis.delete(f"email_verify:{request.email}")
            
            # 이메일과 전화번호가 모두 인증되었는지 확인
            phone_verified = await redis.get(f"phone_verified:{user.phone}")
            if phone_verified:
                user.is_verified = True
                await db.commit()
                
                return {"message": "이메일 인증이 완료되었습니다", "verified": True}
            else:
                # 이메일만 인증된 상태 표시
                await redis.setex(f"email_verified:{request.email}", 3600, "true")
                return {"message": "이메일 인증이 완료되었습니다. SMS 인증을 진행해주세요", "verified": False}
        
        return {"message": "이메일 인증이 완료되었습니다", "verified": False}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"이메일 인증 처리 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/verify-phone")
async def verify_phone(
    request: VerifyPhoneRequest,
    db: AsyncSession = Depends(get_db),
    redis = Depends(get_redis)
):
    """SMS 인증"""
    try:
        # 1. Redis에서 인증 코드 확인
        stored_code = await redis.get(f"phone_verify:{request.phone}")
        
        if not stored_code or stored_code.decode() != request.verification_code:
            raise HTTPException(
                status_code=400,
                detail="인증 코드가 올바르지 않거나 만료되었습니다"
            )
        
        # 2. 사용자 전화번호 인증 상태 업데이트
        result = await db.execute(
            select(User).where(User.phone == request.phone)
        )
        user = result.scalar_one_or_none()
        
        if user:
            # 인증 코드 삭제
            await redis.delete(f"phone_verify:{request.phone}")
            
            # 이메일과 전화번호가 모두 인증되었는지 확인
            email_verified = await redis.get(f"email_verified:{user.email}")
            if email_verified:
                user.is_verified = True
                await db.commit()
                
                # 인증 완료 표시 삭제
                await redis.delete(f"email_verified:{user.email}")
                
                return {"message": "SMS 인증이 완료되었습니다", "verified": True}
            else:
                # 전화번호만 인증된 상태 표시
                await redis.setex(f"phone_verified:{request.phone}", 3600, "true")
                return {"message": "SMS 인증이 완료되었습니다. 이메일 인증을 진행해주세요", "verified": False}
        
        return {"message": "SMS 인증이 완료되었습니다", "verified": False}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"SMS 인증 처리 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/refresh")
async def refresh_token(
    credentials: HTTPAuthorizationCredentials = Depends(auth_service.security)
):
    """리프레시 토큰으로 새 액세스 토큰 발급"""
    try:
        # 토큰 검증
        payload = auth_service.verify_token(credentials.credentials)
        
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=401,
                detail="Invalid token type"
            )
        
        # 새 액세스 토큰 생성
        access_token = auth_service.create_access_token({
            "user_id": payload["user_id"],
            "email": payload["email"],
            "role": "user"
        })
        
        # Redis 세션 업데이트 (새로운 access_token으로)
        auth_service.store_session(
            user_id=payload["user_id"],
            access_token=access_token,
            refresh_token=credentials.credentials  # 기존 refresh_token 유지
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"토큰 갱신 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user = Depends(auth_service.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """현재 로그인한 사용자 정보 조회"""
    try:
        result = await db.execute(
            select(User).where(User.id == int(current_user["user_id"]))
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=404,
                detail="사용자를 찾을 수 없습니다"
            )
        
        return UserResponse(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            country_code=user.country_code,
            is_verified=user.is_verified,
            kyc_status=user.kyc_status,
            created_at=user.created_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"사용자 정보 조회 중 오류가 발생했습니다: {str(e)}"
        )

# 개발 환경 전용 엔드포인트들
@router.get("/dev/verification-codes/{identifier}")
async def get_verification_codes_dev(
    identifier: str,
    redis = Depends(get_redis)
):
    """개발 환경 전용: 인증 코드 확인"""
    if not settings.debug:
        raise HTTPException(
            status_code=404,
            detail="개발 환경에서만 사용 가능합니다"
        )
    
    if not redis:
        raise HTTPException(
            status_code=503,
            detail="Redis 연결이 필요합니다"
        )
    
    try:
        email_code = await redis.get(f"email_verify:{identifier}")
        phone_code = await redis.get(f"phone_verify:{identifier}")
        
        return {
            "identifier": identifier,
            "email_code": email_code,
            "phone_code": phone_code,
            "note": "개발 환경 전용 - 프로덕션에서는 사용 불가"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"인증 코드 조회 실패: {str(e)}"
        )

@router.post("/create-wallet")
async def create_user_wallet(
    current_user = Depends(auth_service.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """사용자의 지갑을 생성하거나 재생성"""
    try:
        user_id = int(current_user["user_id"])
        
        # 기존 사용자 확인
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=404,
                detail="사용자를 찾을 수 없습니다"
            )
        
        # 이미 지갑이 있는지 확인
        existing_wallet_result = await db.execute(
            select(Wallet).where(Wallet.user_id == user_id)
        )
        existing_wallet = existing_wallet_result.scalar_one_or_none()
        
        if existing_wallet and existing_wallet.is_active:
            return {
                "status": "already_exists",
                "message": "이미 활성화된 지갑이 있습니다",
                "wallet": {
                    "address": existing_wallet.wallet_address,
                    "circle_wallet_id": existing_wallet.circle_wallet_id,
                    "chain_name": existing_wallet.chain_name
                }
            }
        
        # 지갑 생성 시도
        print(f"🔄 사용자 {user_id}의 지갑 재생성 시작...")
        
        wallet_response = await circle_wallet_service.create_wallet_with_retry(
            user_id=str(user_id),
            blockchain="ETH"
        )
        
        if wallet_response.get("data") and wallet_response["data"].get("wallets"):
            wallet_data = wallet_response["data"]["wallets"][0]
            wallet_address = wallet_data["address"]
            
            # 지갑 주소 유효성 검증
            if not circle_wallet_service.is_valid_ethereum_address(wallet_address):
                raise ValueError(f"생성된 지갑 주소가 유효하지 않습니다: {wallet_address}")
            
            # 기존 지갑이 있으면 비활성화
            if existing_wallet:
                existing_wallet.is_active = False
                
            # 새 지갑 정보 저장
            new_wallet = Wallet(
                user_id=user_id,
                circle_wallet_id=wallet_data["id"],
                wallet_address=wallet_address,
                chain_id=1,  # Ethereum mainnet
                chain_name="ethereum",
                usdc_balance=0.0,
                is_active=True
            )
            
            # User 모델 업데이트
            user.circle_wallet_id = wallet_data["id"]
            user.circle_entity_id = wallet_data.get("entityId", "")
            user.extra_metadata = None  # 이전 실패 기록 제거
            
            db.add(new_wallet)
            await db.commit()
            
            print(f"✅ 지갑 재생성 성공: {wallet_address}")
            
            return {
                "status": "success",
                "message": "지갑이 성공적으로 생성되었습니다",
                "wallet": {
                    "address": wallet_address,
                    "circle_wallet_id": wallet_data["id"],
                    "chain_name": "ethereum",
                    "created_at": datetime.utcnow().isoformat()
                }
            }
        else:
            raise ValueError("Circle API 응답에서 지갑 데이터를 찾을 수 없습니다")
            
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"❌ 지갑 생성 실패: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"지갑 생성 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/logout")
async def logout_user(
    current_user = Depends(auth_service.get_current_user)
):
    """사용자 로그아웃 - Redis 세션 무효화"""
    try:
        # Redis에서 사용자 세션 무효화
        auth_service.invalidate_session(current_user["user_id"])
        
        return {
            "message": "로그아웃이 완료되었습니다",
            "status": "success"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"로그아웃 처리 중 오류가 발생했습니다: {str(e)}"
        ) 