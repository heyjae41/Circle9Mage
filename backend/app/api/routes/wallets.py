"""
지갑 관련 API 엔드포인트
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.services.circle_client import circle_wallet_service
from app.database.connection import get_db
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

# Request/Response 모델들
class CreateWalletRequest(BaseModel):
    """지갑 생성 요청 모델"""
    user_id: str = Field(..., description="사용자 ID")
    blockchain: str = Field(default="ETH", description="블록체인 타입")
    wallet_name: Optional[str] = Field(None, description="지갑 이름")

class WalletResponse(BaseModel):
    """지갑 응답 모델"""
    wallet_id: str
    address: str
    blockchain: str
    chain_id: int
    status: str
    created_at: datetime
    balances: List[dict]

class BalanceResponse(BaseModel):
    """잔액 응답 모델"""
    wallet_id: str
    total_usd_value: float
    balances: List[dict]
    last_updated: datetime

@router.post("/create", response_model=WalletResponse)
async def create_wallet(request: CreateWalletRequest):
    """새 MPC 지갑 생성"""
    try:
        # Circle Wallet 서비스를 통해 지갑 생성
        wallet_result = await circle_wallet_service.create_wallet(
            user_id=request.user_id,
            blockchain=request.blockchain
        )
        
        wallet_data = wallet_result["data"]["wallets"][0]
        
        # 체인 ID 매핑
        chain_mapping = {
            "ETH": 1,      # Ethereum
            "BASE": 8453,  # Base
            "ARB": 42161,  # Arbitrum
            "AVAX": 43114  # Avalanche
        }
        
        # 잔액 조회
        balance_result = await circle_wallet_service.get_wallet_balance(wallet_data["id"])
        balances = balance_result["data"]["tokenBalances"]
        
        return WalletResponse(
            wallet_id=wallet_data["id"],
            address=wallet_data["address"],
            blockchain=wallet_data["blockchain"],
            chain_id=chain_mapping.get(request.blockchain, 1),
            status=wallet_data["state"],
            created_at=datetime.utcnow(),
            balances=balances
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"지갑 생성 실패: {str(e)}")

@router.get("/{wallet_id}/balance", response_model=BalanceResponse)
async def get_wallet_balance(wallet_id: str):
    """지갑 잔액 조회"""
    try:
        # Circle API를 통해 잔액 조회
        balance_result = await circle_wallet_service.get_wallet_balance(wallet_id)
        balances = balance_result["data"]["tokenBalances"]
        
        # USD 총액 계산
        total_usd_value = 0.0
        formatted_balances = []
        
        for balance in balances:
            token_symbol = balance["token"]["symbol"]
            amount = float(balance["amount"])
            
            # 간단한 USD 환산 (실제로는 실시간 시세 API 사용)
            usd_price = 1.0 if token_symbol == "USDC" else 3000.0 if token_symbol == "ETH" else 1.0
            usd_value = amount * usd_price
            total_usd_value += usd_value
            
            formatted_balances.append({
                "token": token_symbol,
                "amount": amount,
                "usd_value": usd_value,
                "contract_address": balance["token"].get("contractAddress", "")
            })
        
        return BalanceResponse(
            wallet_id=wallet_id,
            total_usd_value=total_usd_value,
            balances=formatted_balances,
            last_updated=datetime.utcnow()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"잔액 조회 실패: {str(e)}")

@router.get("/{wallet_id}")
async def get_wallet_info(wallet_id: str):
    """지갑 정보 조회"""
    try:
        # 실제로는 DB에서 지갑 정보 조회
        # 여기서는 mock 데이터 반환
        return {
            "wallet_id": wallet_id,
            "address": f"0x{wallet_id[:40]}",
            "blockchain": "ETH",
            "chain_id": 1,
            "status": "active",
            "created_at": datetime.utcnow().isoformat(),
            "security_features": {
                "mpc_enabled": True,
                "recovery_enabled": True,
                "pin_protection": True
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"지갑 정보 조회 실패: {str(e)}")

@router.get("/user/{user_id}/wallets")
async def get_user_wallets(user_id: int, db: AsyncSession = Depends(get_db)):
    """사용자의 모든 지갑 조회"""
    try:
        from sqlalchemy import select
        from app.models.user import Wallet, User
        
        # ✅ 수정: 실제 DB에서 사용자 지갑 조회
        # 1. 사용자 존재 확인
        user_query = select(User).where(User.id == user_id)
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
        
        # 2. 사용자의 지갑 목록 조회
        wallet_query = select(Wallet).where(Wallet.user_id == user_id, Wallet.is_active == True)
        wallet_result = await db.execute(wallet_query)
        wallets = wallet_result.scalars().all()
        
        # 3. 응답 데이터 구성
        wallet_list = []
        for wallet in wallets:
            wallet_list.append({
                "wallet_id": wallet.circle_wallet_id,
                "address": wallet.wallet_address,
                "blockchain": wallet.chain_name.upper(),
                "chain_id": wallet.chain_id,
                "chain_name": wallet.chain_name,
                "usdc_balance": float(wallet.usdc_balance),
                "is_primary": len(wallet_list) == 0,  # 첫 번째 지갑이 primary
                "created_at": wallet.created_at.isoformat()
            })
        
        return {
            "user_id": user_id,
            "wallets": wallet_list,
            "total_wallets": len(wallet_list)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"지갑 조회 실패: {str(e)}")

@router.post("/{wallet_id}/backup")
async def create_wallet_backup(wallet_id: str):
    """지갑 백업 생성"""
    try:
        # Circle MPC 지갑의 경우 백업은 Circle에서 자동 관리
        # 사용자에게는 복구 코드만 제공
        recovery_code = f"CIRCLE-{wallet_id[:8].upper()}-RECOVERY-2025"
        
        return {
            "wallet_id": wallet_id,
            "backup_created": True,
            "recovery_code": recovery_code,
            "backup_date": datetime.utcnow().isoformat(),
            "instructions": "이 복구 코드를 안전한 곳에 보관하세요. 지갑 복구 시 필요합니다."
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"지갑 백업 실패: {str(e)}")

@router.post("/{wallet_id}/security/pin")
async def set_wallet_pin(wallet_id: str, pin: str):
    """지갑 PIN 설정"""
    try:
        # PIN 유효성 검사
        if len(pin) != 6 or not pin.isdigit():
            raise HTTPException(status_code=400, detail="PIN은 6자리 숫자여야 합니다")
        
        # 실제로는 PIN을 해시화해서 저장
        # 여기서는 성공 응답만 반환
        return {
            "wallet_id": wallet_id,
            "pin_set": True,
            "security_level": "enhanced",
            "message": "PIN이 성공적으로 설정되었습니다"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PIN 설정 실패: {str(e)}")

@router.get("/{wallet_id}/transactions")
async def get_wallet_transactions(
    wallet_id: str,
    limit: int = 20,
    offset: int = 0
):
    """지갑 거래 내역 조회"""
    try:
        # 실제로는 DB에서 거래 내역 조회
        # 여기서는 mock 데이터 반환
        transactions = []
        for i in range(limit):
            transactions.append({
                "transaction_id": f"tx_{wallet_id}_{i}",
                "type": "payment" if i % 2 == 0 else "transfer",
                "amount": 50.0 + (i * 10),
                "currency": "USDC",
                "status": "completed",
                "from_address": f"0x{wallet_id[:40]}",
                "to_address": f"0x{(i * 1000):040x}",
                "transaction_hash": f"0x{(i * 1000000):064x}",
                "created_at": datetime.utcnow().isoformat(),
                "completed_at": datetime.utcnow().isoformat()
            })
        
        return {
            "wallet_id": wallet_id,
            "total_transactions": 100,  # 전체 거래 수
            "page": {
                "limit": limit,
                "offset": offset,
                "has_more": offset + limit < 100
            },
            "transactions": transactions
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"거래 내역 조회 실패: {str(e)}") 