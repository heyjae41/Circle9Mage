"""
사용자 프로필 및 KYC 관리 API 엔드포인트
"""

from fastapi import APIRouter, Depends, HTTPException, status, Path, Body, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import uuid
import json
import os
import shutil

from app.database.connection import get_db
from app.models.user import User, KYCDocument
from app.services.auth_service import AuthService
from app.services.circle_client import circle_compliance_service
from pydantic import BaseModel, Field

# 라우터 초기화
router = APIRouter()
auth_service = AuthService()

# Pydantic 모델들
class UserProfileResponse(BaseModel):
    """사용자 프로필 응답"""
    id: int
    email: str
    first_name: str = Field(..., alias="firstName")
    last_name: str = Field(..., alias="lastName")
    country_code: str = Field(..., alias="countryCode")
    preferred_currency: str = Field(..., alias="preferredCurrency")
    phone: Optional[str] = None
    is_verified: bool = Field(..., alias="isVerified")
    kyc_status: str = Field(..., alias="kycStatus")
    kyc_level: int = Field(..., alias="kycLevel")
    created_at: str = Field(..., alias="createdAt")
    last_login_at: Optional[str] = Field(None, alias="lastLoginAt")
    
    class Config:
        populate_by_name = True

class UserProfileUpdateRequest(BaseModel):
    """사용자 프로필 업데이트 요청"""
    first_name: Optional[str] = Field(None, alias="firstName", description="이름")
    last_name: Optional[str] = Field(None, alias="lastName", description="성")
    phone: Optional[str] = Field(None, description="전화번호")
    preferred_currency: Optional[str] = Field(None, alias="preferredCurrency", description="선호 통화")
    
    class Config:
        populate_by_name = True

class KYCDocumentRequest(BaseModel):
    """KYC 문서 제출 요청"""
    document_type: str = Field(..., alias="documentType", description="문서 타입 (passport, driver_license, national_id, utility_bill)")
    document_number: Optional[str] = Field(None, alias="documentNumber", description="문서 번호")
    
    # 개인 정보 (Level 1)
    full_name: str = Field(..., alias="fullName", description="전체 이름")
    date_of_birth: str = Field(..., alias="dateOfBirth", description="생년월일 (YYYY-MM-DD)")
    nationality: str = Field(..., description="국적 (ISO 국가 코드)")
    gender: Optional[str] = Field(None, description="성별")
    
    # 주소 정보 (Level 2)
    address_line1: Optional[str] = Field(None, alias="addressLine1", description="주소 1")
    address_line2: Optional[str] = Field(None, alias="addressLine2", description="주소 2")
    city: Optional[str] = Field(None, description="도시")
    state_province: Optional[str] = Field(None, alias="stateProvince", description="주/도")
    postal_code: Optional[str] = Field(None, alias="postalCode", description="우편번호")
    country: Optional[str] = Field(None, description="국가 (ISO 코드)")
    
    # 직업 정보 (Level 2)
    occupation: Optional[str] = Field(None, description="직업")
    employer: Optional[str] = Field(None, description="고용주")
    income_range: Optional[str] = Field(None, alias="incomeRange", description="소득 범위")
    source_of_funds: Optional[str] = Field(None, alias="sourceOfFunds", description="자금 출처")
    
    class Config:
        populate_by_name = True

class KYCStatusResponse(BaseModel):
    """KYC 상태 응답"""
    user_id: int = Field(..., alias="userId")
    kyc_status: str = Field(..., alias="kycStatus")
    kyc_level: int = Field(..., alias="kycLevel")
    documents: List[Dict[str, Any]]
    last_updated: Optional[str] = Field(None, alias="lastUpdated")
    next_steps: List[str] = Field(..., alias="nextSteps")
    
    class Config:
        populate_by_name = True

@router.get(
    "/profile",
    response_model=UserProfileResponse,
    summary="사용자 프로필 조회",
    description="현재 로그인한 사용자의 프로필 정보를 조회합니다."
)
async def get_user_profile(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    """사용자 프로필 조회"""
    
    try:
        # 사용자 정보 조회
        user_query = select(User).where(User.id == current_user["user_id"])
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="사용자를 찾을 수 없습니다."
            )
        
        return UserProfileResponse(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            country_code=user.country_code,
            preferred_currency=user.preferred_currency,
            phone=user.phone,
            is_verified=user.is_verified,
            kyc_status=user.kyc_status,
            kyc_level=user.kyc_level,
            created_at=user.created_at.isoformat(),
            last_login_at=user.last_login_at.isoformat() if user.last_login_at else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 프로필 조회 오류: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"프로필 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.put(
    "/profile",
    response_model=UserProfileResponse,
    summary="사용자 프로필 업데이트",
    description="현재 로그인한 사용자의 프로필 정보를 업데이트합니다."
)
async def update_user_profile(
    profile_data: UserProfileUpdateRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    """사용자 프로필 업데이트"""
    
    try:
        # 사용자 정보 조회
        user_query = select(User).where(User.id == current_user["user_id"])
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="사용자를 찾을 수 없습니다."
            )
        
        # 업데이트할 필드들 적용
        update_data = {}
        if profile_data.first_name is not None:
            update_data["first_name"] = profile_data.first_name
        if profile_data.last_name is not None:
            update_data["last_name"] = profile_data.last_name
        if profile_data.phone is not None:
            update_data["phone"] = profile_data.phone
        if profile_data.preferred_currency is not None:
            update_data["preferred_currency"] = profile_data.preferred_currency
        
        # 업데이트 실행
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            update_query = update(User).where(User.id == current_user["user_id"]).values(**update_data)
            await db.execute(update_query)
            await db.commit()
            
            # 업데이트된 사용자 정보 다시 조회
            await db.refresh(user)
        
        print(f"✅ 사용자 프로필 업데이트 완료: {current_user['email']}")
        
        return UserProfileResponse(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            country_code=user.country_code,
            preferred_currency=user.preferred_currency,
            phone=user.phone,
            is_verified=user.is_verified,
            kyc_status=user.kyc_status,
            kyc_level=user.kyc_level,
            created_at=user.created_at.isoformat(),
            last_login_at=user.last_login_at.isoformat() if user.last_login_at else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 프로필 업데이트 오류: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"프로필 업데이트 중 오류가 발생했습니다: {str(e)}"
        )

@router.post(
    "/kyc/submit",
    summary="KYC 문서 제출",
    description="KYC 인증을 위한 개인정보 및 문서를 제출합니다."
)
async def submit_kyc_document(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(auth_service.get_current_user),
    # ✅ 수정: Form 데이터로 변경하여 multipart/form-data 지원
    kyc_data: str = Form(..., description="JSON 형태의 KYC 데이터"),
    document_file: Optional[UploadFile] = File(None)
):
    """KYC 문서 제출"""
    
    try:
        import json
        
        # ✅ 수정: JSON 문자열을 파싱하여 KYC 데이터 추출
        try:
            kyc_dict = json.loads(kyc_data)
            # Pydantic 모델로 검증
            kyc_request = KYCDocumentRequest(**kyc_dict)
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"KYC 데이터 형식이 올바르지 않습니다: {str(e)}"
            )
        
        # 1. 사용자 조회
        user_query = select(User).where(User.id == current_user["user_id"])
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="사용자를 찾을 수 없습니다."
            )
        
        # 2. 문서 파일 처리 (있는 경우)
        file_info = {}
        if document_file:
            # 파일 검증
            if document_file.size > 10 * 1024 * 1024:  # 10MB 제한
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="파일 크기는 10MB 이하여야 합니다."
                )
            
            allowed_types = ["image/jpeg", "image/png", "application/pdf"]
            if document_file.content_type not in allowed_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="지원되는 파일 형식: JPEG, PNG, PDF"
                )
            
            # 파일 저장 (실제로는 S3, GCP Storage 등 사용)
            upload_dir = "uploads/kyc"
            os.makedirs(upload_dir, exist_ok=True)
            
            file_ext = document_file.filename.split('.')[-1] if document_file.filename else "bin"
            file_name = f"{current_user['user_id']}_{uuid.uuid4()}.{file_ext}"
            file_path = os.path.join(upload_dir, file_name)
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(document_file.file, buffer)
            
            file_info = {
                "file_url": file_path,
                "file_type": document_file.content_type,
                "file_size": document_file.size
            }
        
        # 3. Circle Compliance Engine으로 사전 검사
        print(f"🔍 KYC 컴플라이언스 검사 시작 - 사용자: {current_user['email']}")
        
        compliance_result = await circle_compliance_service.screen_transaction(
            from_address=current_user["email"],
            to_address="kyc_verification",
            amount="0",
            currency="VERIFICATION"
        )
        
        compliance_data = compliance_result.get("data", {})
        risk_score = compliance_data.get("riskScore", 0.0)
        
        print(f"✅ 컴플라이언스 검사 완료 - 위험 점수: {risk_score}")
        
        # 4. KYC 문서 레코드 생성
        kyc_document = KYCDocument(
            user_id=current_user["user_id"],
            document_type=kyc_request.document_type,
            document_number=kyc_request.document_number,
            
            # 개인 정보
            full_name=kyc_request.full_name,
            date_of_birth=kyc_request.date_of_birth,
            nationality=kyc_request.nationality,
            gender=kyc_request.gender,
            
            # 주소 정보
            address_line1=kyc_request.address_line1,
            address_line2=kyc_request.address_line2,
            city=kyc_request.city,
            state_province=kyc_request.state_province,
            postal_code=kyc_request.postal_code,
            country=kyc_request.country,
            
            # 직업 정보
            occupation=kyc_request.occupation,
            employer=kyc_request.employer,
            income_range=kyc_request.income_range,
            source_of_funds=kyc_request.source_of_funds,
            
            # 파일 정보
            **file_info,
            
            # 컴플라이언스 정보
            compliance_check_id=str(uuid.uuid4()),
            risk_score=risk_score,
            risk_factors=json.dumps(compliance_data.get("reasons", [])),
            
            # 검증 정보
            verification_status="pending",
            verification_method="automated",
            expires_at=datetime.utcnow() + timedelta(days=365)  # 1년 유효
        )
        
        db.add(kyc_document)
        
        # 5. 사용자 KYC 상태 업데이트
        new_kyc_level = 1
        if kyc_request.address_line1 and kyc_request.occupation:
            new_kyc_level = 2  # 주소 + 직업 정보가 있으면 Level 2
        
        # 위험 점수에 따른 자동 승인/거절
        new_status = "pending"
        if risk_score < 0.3:
            new_status = "approved"
            kyc_document.verification_status = "verified"
            kyc_document.verified_at = datetime.utcnow()
            kyc_document.verified_by = "auto_system"
        elif risk_score > 0.8:
            new_status = "rejected"
            kyc_document.verification_status = "rejected"
            kyc_document.verification_notes = "High risk score detected"
        
        # 사용자 상태 업데이트
        user.kyc_status = new_status
        user.kyc_level = new_kyc_level
        user.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(kyc_document)
        
        print(f"💾 KYC 문서 제출 완료 - 문서 ID: {kyc_document.id}, 상태: {new_status}")
        
        return {
            "kyc_document_id": kyc_document.id,
            "status": new_status,
            "kyc_level": new_kyc_level,
            "risk_score": risk_score,
            "message": f"KYC 문서가 성공적으로 제출되었습니다. 현재 상태: {new_status}",
            "estimated_review_time": "1-3 영업일" if new_status == "pending" else "즉시 처리됨"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ KYC 문서 제출 오류: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"KYC 문서 제출 중 오류가 발생했습니다: {str(e)}"
        )

@router.get(
    "/kyc/status",
    response_model=KYCStatusResponse,
    summary="KYC 상태 조회",
    description="사용자의 KYC 인증 상태와 제출된 문서들을 조회합니다."
)
async def get_kyc_status(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    """KYC 상태 조회"""
    
    try:
        # 사용자 정보 조회
        user_query = select(User).where(User.id == current_user["user_id"])
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="사용자를 찾을 수 없습니다."
            )
        
        # KYC 문서들 조회
        documents_query = select(KYCDocument).where(
            KYCDocument.user_id == current_user["user_id"]
        ).order_by(KYCDocument.created_at.desc())
        
        documents_result = await db.execute(documents_query)
        documents = documents_result.scalars().all()
        
        # 문서 목록 구성
        document_list = []
        last_updated = None
        
        for doc in documents:
            document_list.append({
                "id": doc.id,
                "document_type": doc.document_type,
                "verification_status": doc.verification_status,
                "risk_score": float(doc.risk_score) if doc.risk_score else None,
                "created_at": doc.created_at.isoformat(),
                "verified_at": doc.verified_at.isoformat() if doc.verified_at else None,
                "expires_at": doc.expires_at.isoformat() if doc.expires_at else None
            })
            
            if not last_updated or doc.updated_at > last_updated:
                last_updated = doc.updated_at
        
        # 다음 단계 안내
        next_steps = []
        if user.kyc_status == "pending":
            next_steps.append("문서 검토 대기 중입니다")
            if user.kyc_level == 1:
                next_steps.append("고급 인증을 위해 주소 및 직업 정보를 추가 제출할 수 있습니다")
        elif user.kyc_status == "rejected":
            next_steps.append("거절 사유를 확인하고 올바른 문서를 다시 제출해주세요")
        elif user.kyc_status == "approved":
            if user.kyc_level == 1:
                next_steps.append("고급 인증(Level 2)을 통해 더 높은 한도를 이용할 수 있습니다")
            else:
                next_steps.append("KYC 인증이 완료되었습니다")
        
        return KYCStatusResponse(
            user_id=user.id,
            kyc_status=user.kyc_status,
            kyc_level=user.kyc_level,
            documents=document_list,
            last_updated=last_updated.isoformat() if last_updated else None,
            next_steps=next_steps
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ KYC 상태 조회 오류: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"KYC 상태 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.post(
    "/kyc/resubmit/{document_id}",
    summary="KYC 문서 재제출",
    description="거절된 KYC 문서를 수정하여 재제출합니다."
)
async def resubmit_kyc_document(
    document_id: int = Path(..., description="재제출할 문서 ID"),
    kyc_data: KYCDocumentRequest = Body(...),
    document_file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    """KYC 문서 재제출"""
    
    try:
        # 기존 문서 조회
        document_query = select(KYCDocument).where(
            KYCDocument.id == document_id,
            KYCDocument.user_id == current_user["user_id"]
        )
        document_result = await db.execute(document_query)
        existing_doc = document_result.scalar_one_or_none()
        
        if not existing_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="문서를 찾을 수 없습니다."
            )
        
        if existing_doc.verification_status not in ["rejected", "pending"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 승인된 문서는 재제출할 수 없습니다."
            )
        
        # 새 파일 처리 (있는 경우)
        file_info = {}
        if document_file:
            # 기존과 동일한 파일 처리 로직
            if document_file.size > 10 * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="파일 크기는 10MB 이하여야 합니다."
                )
            
            allowed_types = ["image/jpeg", "image/png", "application/pdf"]
            if document_file.content_type not in allowed_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="지원되는 파일 형식: JPEG, PNG, PDF"
                )
            
            upload_dir = "uploads/kyc"
            os.makedirs(upload_dir, exist_ok=True)
            
            file_ext = document_file.filename.split('.')[-1] if document_file.filename else "bin"
            file_name = f"{current_user['user_id']}_{uuid.uuid4()}.{file_ext}"
            file_path = os.path.join(upload_dir, file_name)
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(document_file.file, buffer)
            
            file_info = {
                "file_url": file_path,
                "file_type": document_file.content_type,
                "file_size": document_file.size
            }
        
        # 문서 정보 업데이트
        update_data = {
            "document_type": kyc_data.document_type,
            "document_number": kyc_data.document_number,
            "full_name": kyc_data.full_name,
            "date_of_birth": kyc_data.date_of_birth,
            "nationality": kyc_data.nationality,
            "gender": kyc_data.gender,
            "address_line1": kyc_data.address_line1,
            "address_line2": kyc_data.address_line2,
            "city": kyc_data.city,
            "state_province": kyc_data.state_province,
            "postal_code": kyc_data.postal_code,
            "country": kyc_data.country,
            "occupation": kyc_data.occupation,
            "employer": kyc_data.employer,
            "income_range": kyc_data.income_range,
            "source_of_funds": kyc_data.source_of_funds,
            "verification_status": "pending",
            "verification_notes": "재제출됨",
            "updated_at": datetime.utcnow(),
            **file_info
        }
        
        update_query = update(KYCDocument).where(KYCDocument.id == document_id).values(**update_data)
        await db.execute(update_query)
        
        # 사용자 상태를 pending으로 변경
        user_update = update(User).where(User.id == current_user["user_id"]).values(
            kyc_status="pending",
            updated_at=datetime.utcnow()
        )
        await db.execute(user_update)
        
        await db.commit()
        
        print(f"✅ KYC 문서 재제출 완료 - 문서 ID: {document_id}")
        
        return {
            "message": "KYC 문서가 성공적으로 재제출되었습니다.",
            "document_id": document_id,
            "status": "pending",
            "estimated_review_time": "1-3 영업일"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ KYC 문서 재제출 오류: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"KYC 문서 재제출 중 오류가 발생했습니다: {str(e)}"
        ) 