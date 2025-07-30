"""
USDC 충전 기능 API 엔드포인트
"""

from fastapi import APIRouter, Depends, HTTPException, status, Path, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import Dict, Any, Optional
from datetime import datetime
import uuid
import json

from app.database.connection import get_db
from app.models.user import User, Wallet, Transaction
from app.services.auth_service import AuthService
from app.services.circle_client import (
    circle_mint_service,
    circle_paymaster_service, 
    circle_compliance_service
)
from pydantic import BaseModel, Field

# 라우터 초기화
router = APIRouter()
auth_service = AuthService()

# Pydantic 모델들
class BankAccountData(BaseModel):
    """은행 계좌 정보"""
    account_holder_name: str = Field(..., description="계좌 소유자 이름")
    bank_name: str = Field(..., description="은행명")
    account_number: str = Field(..., description="계좌번호") 
    routing_number: str = Field(..., description="라우팅 번호 (미국) 또는 SWIFT 코드")
    address_line1: str = Field(..., description="주소 1")
    address_line2: Optional[str] = Field(None, description="주소 2")
    city: str = Field(..., description="도시")
    state: str = Field(..., description="주/도")
    postal_code: str = Field(..., description="우편번호")
    country: str = Field(..., description="국가 코드 (예: US, KR)")

class WireDepositRequest(BaseModel):
    """은행 송금 충전 요청"""
    bank_account: BankAccountData
    amount: str = Field(..., description="충전 금액")
    currency: str = Field(default="USD", description="통화")

class CryptoDepositRequest(BaseModel):
    """암호화폐 충전 요청"""
    chain: str = Field(..., description="블록체인 (ETH, BASE, ARB, MATIC, AVAX)")
    amount: str = Field(..., description="충전 금액")
    currency: str = Field(default="USD", description="통화")

class DepositResponse(BaseModel):
    """충전 응답"""
    deposit_id: str
    status: str
    message: str
    tracking_ref: Optional[str] = None
    deposit_address: Optional[str] = None
    wire_instructions: Optional[Dict[str, Any]] = None
    estimated_completion: Optional[str] = None

@router.post(
    "/wallets/{wallet_id}/deposit/wire",
    response_model=DepositResponse,
    summary="은행 송금으로 USDC 충전",
    description="은행 계좌에서 Circle Mint로 송금하여 USDC를 충전합니다."
)
async def create_wire_deposit(
    wallet_id: str = Path(..., description="Circle 지갑 ID"),  # ✅ 수정: int → str
    deposit_request: WireDepositRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    """은행 송금을 통한 USDC 충전"""
    
    try:
        # ✅ 수정: Circle wallet ID로 지갑 조회
        wallet_query = select(Wallet).where(
            Wallet.circle_wallet_id == wallet_id,  # circle_wallet_id로 조회
            Wallet.user_id == current_user["user_id"]
        )
        wallet_result = await db.execute(wallet_query)
        wallet = wallet_result.scalar_one_or_none()
        
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="지갑을 찾을 수 없습니다."
            )
        
        # 2. Compliance Engine으로 거래 사전 스크리닝
        print(f"🔍 거래 스크리닝 시작 - 사용자: {current_user['email']}, 금액: {deposit_request.amount}")
        
        compliance_result = await circle_compliance_service.screen_transaction(
            from_address=deposit_request.bank_account.account_number,
            to_address=wallet.wallet_address,
            amount=deposit_request.amount,
            currency=deposit_request.currency
        )
        
        screening_result = compliance_result.get("data", {}).get("screeningResult", "pending")
        if screening_result != "approved":
            print(f"❌ 컴플라이언스 검사 실패: {screening_result}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="거래가 컴플라이언스 검사를 통과하지 못했습니다."
            )
        
        print(f"✅ 컴플라이언스 검사 통과")
        
        # 3. Circle Mint로 은행 계좌 연결
        billing_details = {
            "name": deposit_request.bank_account.account_holder_name,
            "line1": deposit_request.bank_account.address_line1,
            "line2": deposit_request.bank_account.address_line2,
            "city": deposit_request.bank_account.city,
            "district": deposit_request.bank_account.state,
            "postalCode": deposit_request.bank_account.postal_code,
            "country": deposit_request.bank_account.country
        }
        
        bank_address = {
            "bankName": deposit_request.bank_account.bank_name,
            "city": deposit_request.bank_account.city,
            "country": deposit_request.bank_account.country,
            "line1": deposit_request.bank_account.address_line1,
            "district": deposit_request.bank_account.state
        }
        
        bank_account_result = await circle_mint_service.create_wire_bank_account(
            billing_details=billing_details,
            bank_address=bank_address,
            account_number=deposit_request.bank_account.account_number,
            routing_number=deposit_request.bank_account.routing_number
        )
        
        bank_account_id = bank_account_result["data"]["id"]
        tracking_ref = bank_account_result["data"]["trackingRef"]
        
        print(f"🏦 은행 계좌 연결 성공: {bank_account_id}")
        
        # 4. 송금 지침 조회
        wire_instructions = await circle_mint_service.get_wire_instructions(
            bank_account_id=bank_account_id,
            currency=deposit_request.currency
        )
        
        # 5. 거래 기록 생성
        transaction_id = str(uuid.uuid4())
        
        new_transaction = Transaction(
            user_id=current_user["user_id"],
            transaction_id=transaction_id,
            transaction_type="deposit",
            status="pending",
            amount=float(deposit_request.amount),
            currency=deposit_request.currency,
            target_address=wallet.wallet_address,
            target_chain=wallet.chain_name,
            extra_metadata=json.dumps({
                "deposit_method": "wire_transfer",
                "bank_account_id": bank_account_id,
                "tracking_ref": tracking_ref,
                "compliance_result": compliance_result["data"],
                "wire_instructions": wire_instructions["data"]
            }),
            notes=f"은행 송금을 통한 USDC 충전 - {deposit_request.bank_account.bank_name}"
        )
        
        db.add(new_transaction)
        await db.commit()
        await db.refresh(new_transaction)
        
        print(f"💾 거래 기록 저장 완료: {transaction_id}")
        
        # 6. 개발 환경에서 모의 송금 실행
        if circle_mint_service.settings.environment == "development":
            beneficiary_account = wire_instructions["data"]["beneficiaryBank"]["accountNumber"]
            mock_deposit = await circle_mint_service.create_mock_wire_deposit(
                amount=deposit_request.amount,
                currency=deposit_request.currency,
                beneficiary_account_number=beneficiary_account
            )
            print(f"🧪 개발 환경 모의 송금 실행: {mock_deposit['data']['trackingRef']}")
        
        return DepositResponse(
            deposit_id=transaction_id,
            status="pending",
            message="은행 송금 충전 요청이 성공적으로 처리되었습니다. 송금 지침에 따라 은행에서 송금을 진행해주세요.",
            tracking_ref=tracking_ref,
            wire_instructions=wire_instructions["data"],
            estimated_completion="1-3 영업일"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 은행 송금 충전 오류: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"충전 처리 중 오류가 발생했습니다: {str(e)}"
        )

@router.post(
    "/wallets/{wallet_id}/deposit/crypto",
    response_model=DepositResponse,
    summary="암호화폐로 USDC 충전",
    description="외부 지갑에서 Circle Mint로 USDC를 직접 송금하여 충전합니다."
)
async def create_crypto_deposit(
    wallet_id: str = Path(..., description="Circle 지갑 ID"),  # ✅ 수정: int → str
    deposit_request: CryptoDepositRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    """암호화폐를 통한 USDC 충전"""
    
    try:
        # ✅ 수정: Circle wallet ID로 지갑 조회
        wallet_query = select(Wallet).where(
            Wallet.circle_wallet_id == wallet_id,  # circle_wallet_id로 조회
            Wallet.user_id == current_user["user_id"]
        )
        wallet_result = await db.execute(wallet_query)
        wallet = wallet_result.scalar_one_or_none()
        
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="지갑을 찾을 수 없습니다."
            )
        
        # 2. Circle Mint에서 입금 주소 생성
        deposit_address_result = await circle_mint_service.create_deposit_address(
            currency=deposit_request.currency,
            chain=deposit_request.chain
        )
        
        deposit_address = deposit_address_result["data"]["address"]
        deposit_id = deposit_address_result["data"]["id"]
        
        print(f"🎯 입금 주소 생성: {deposit_address} (체인: {deposit_request.chain})")
        
        # 3. Compliance Engine으로 거래 사전 스크리닝
        compliance_result = await circle_compliance_service.screen_transaction(
            from_address="external_wallet",  # 외부 지갑 (실제로는 사용자가 제공)
            to_address=deposit_address,
            amount=deposit_request.amount,
            currency=deposit_request.currency
        )
        
        screening_result = compliance_result.get("data", {}).get("screeningResult", "pending")
        if screening_result != "approved":
            print(f"❌ 컴플라이언스 검사 실패: {screening_result}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="거래가 컴플라이언스 검사를 통과하지 못했습니다."
            )
        
        print(f"✅ 컴플라이언스 검사 통과")
        
        # 4. Circle Paymaster로 가스리스 설정 준비
        if deposit_request.chain.upper() in ["ETH", "BASE", "ARB", "MATIC"]:
            try:
                paymaster_operation = await circle_paymaster_service.create_user_operation(
                    wallet_address=wallet.wallet_address,
                    target_address=deposit_address,
                    amount=deposit_request.amount,
                    chain_id=wallet.chain_id
                )
                print(f"⛽ Paymaster 가스리스 설정 완료: {paymaster_operation['data']['userOperationHash']}")
            except Exception as e:
                print(f"⚠️ Paymaster 설정 실패 (계속 진행): {str(e)}")
        
        # 5. 거래 기록 생성
        transaction_id = str(uuid.uuid4())
        
        new_transaction = Transaction(
            user_id=current_user["user_id"],
            transaction_id=transaction_id,
            transaction_type="deposit",
            status="pending",
            amount=float(deposit_request.amount),
            currency=deposit_request.currency,
            target_address=deposit_address,
            target_chain=deposit_request.chain,
            extra_metadata=json.dumps({
                "deposit_method": "crypto_transfer",
                "deposit_address_id": deposit_id,
                "chain": deposit_request.chain,
                "compliance_result": compliance_result["data"],
                "paymaster_enabled": True
            }),
            notes=f"암호화폐를 통한 USDC 충전 - {deposit_request.chain} 체인"
        )
        
        db.add(new_transaction)
        await db.commit()
        await db.refresh(new_transaction)
        
        print(f"💾 거래 기록 저장 완료: {transaction_id}")
        
        return DepositResponse(
            deposit_id=transaction_id,
            status="pending",
            message=f"암호화폐 충전 주소가 생성되었습니다. {deposit_request.chain} 네트워크에서 {deposit_request.amount} {deposit_request.currency}를 아래 주소로 송금해주세요.",
            deposit_address=deposit_address,
            estimated_completion="10-30분 (블록 확인 시간에 따라)"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 암호화폐 충전 오류: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"충전 처리 중 오류가 발생했습니다: {str(e)}"
        )

@router.get(
    "/wallets/{wallet_id}/deposit/addresses",
    summary="충전 주소 목록 조회",
    description="사용자 지갑의 모든 체인별 충전 주소를 조회합니다."
)
async def get_deposit_addresses(
    wallet_id: int = Path(..., description="지갑 ID"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    """모든 체인의 충전 주소 조회"""
    
    try:
        # 지갑 소유권 확인
        wallet_query = select(Wallet).where(
            Wallet.id == wallet_id,
            Wallet.user_id == current_user["user_id"]
        )
        wallet_result = await db.execute(wallet_query)
        wallet = wallet_result.scalar_one_or_none()
        
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="지갑을 찾을 수 없습니다."
            )
        
        # Circle Mint에서 모든 입금 주소 조회
        addresses_result = await circle_mint_service.list_deposit_addresses()
        addresses_data = addresses_result["data"]
        
        return {
            "wallet_id": wallet_id,
            "deposit_addresses": addresses_data,
            "message": "지원되는 모든 체인의 충전 주소입니다."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 충전 주소 조회 오류: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"충전 주소 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.get(
    "/deposits/{deposit_id}/status",
    summary="충전 상태 조회",
    description="충전 요청의 현재 상태와 진행 상황을 조회합니다."
)
async def get_deposit_status(
    deposit_id: str = Path(..., description="충전 ID"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    """충전 상태 조회"""
    
    try:
        # 거래 기록 조회
        transaction_query = select(Transaction).where(
            Transaction.transaction_id == deposit_id,
            Transaction.user_id == current_user["user_id"],
            Transaction.transaction_type == "deposit"
        )
        transaction_result = await db.execute(transaction_query)
        transaction = transaction_result.scalar_one_or_none()
        
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="충전 기록을 찾을 수 없습니다."
            )
        
        # 메타데이터 파싱
        metadata = json.loads(transaction.extra_metadata) if transaction.extra_metadata else {}
        
        # 충전 방법에 따른 상세 상태 조회
        detailed_status = None
        if metadata.get("deposit_method") == "wire_transfer":
            # 은행 송금의 경우 Circle Mint 잔액 확인
            balances = await circle_mint_service.get_account_balances()
            detailed_status = {
                "method": "wire_transfer",
                "tracking_ref": metadata.get("tracking_ref"),
                "account_balances": balances["data"]
            }
        elif metadata.get("deposit_method") == "crypto_transfer":
            # 암호화폐 충전의 경우 블록체인 상태 확인
            detailed_status = {
                "method": "crypto_transfer",
                "deposit_address": metadata.get("deposit_address"),
                "chain": metadata.get("chain"),
                "confirmations": "pending"  # 실제로는 블록체인 조회 필요
            }
        
        return {
            "deposit_id": deposit_id,
            "status": transaction.status,
            "amount": float(transaction.amount),
            "currency": transaction.currency,
            "created_at": transaction.created_at.isoformat(),
            "completed_at": transaction.completed_at.isoformat() if transaction.completed_at else None,
            "detailed_status": detailed_status,
            "notes": transaction.notes
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 충전 상태 조회 오류: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"충전 상태 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.get(
    "/deposits/history",
    summary="충전 내역 조회",
    description="사용자의 모든 충전 내역을 조회합니다."
)
async def get_deposit_history(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    """충전 내역 조회"""
    
    try:
        # 충전 거래 내역 조회
        transactions_query = select(Transaction).where(
            Transaction.user_id == current_user["user_id"],
            Transaction.transaction_type == "deposit"
        ).order_by(Transaction.created_at.desc()).limit(limit).offset(offset)
        
        transactions_result = await db.execute(transactions_query)
        transactions = transactions_result.scalars().all()
        
        # 응답 데이터 구성
        deposit_history = []
        for transaction in transactions:
            metadata = json.loads(transaction.extra_metadata) if transaction.extra_metadata else {}
            
            deposit_history.append({
                "deposit_id": transaction.transaction_id,
                "status": transaction.status,
                "amount": float(transaction.amount),
                "currency": transaction.currency,
                "method": metadata.get("deposit_method"),
                "chain": metadata.get("chain"),
                "created_at": transaction.created_at.isoformat(),
                "completed_at": transaction.completed_at.isoformat() if transaction.completed_at else None,
                "notes": transaction.notes
            })
        
        return {
            "deposits": deposit_history,
            "total": len(deposit_history),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        print(f"❌ 충전 내역 조회 오류: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"충전 내역 조회 중 오류가 발생했습니다: {str(e)}"
        ) 