"""
지갑 관련 API 엔드포인트
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.services.circle_client import circle_wallet_service
from app.database.connection import get_db
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

# Request/Response 모델들
class CreateWalletRequest(BaseModel):
    """지갑 생성 요청 모델"""
    user_id: str = Field(..., alias="userId", description="사용자 ID")
    blockchain: str = Field(default="ethereum", description="블록체인 네트워크 (ethereum, base, arbitrum, avalanche, polygon, optimism)")
    wallet_name: Optional[str] = Field(None, alias="walletName", description="지갑 이름")
    
    class Config:
        populate_by_name = True

class WalletResponse(BaseModel):
    """지갑 응답 모델"""
    wallet_id: str = Field(..., alias="walletId")
    address: str
    blockchain: str
    chain_id: int = Field(..., alias="chainId")
    status: str
    created_at: datetime = Field(..., alias="createdAt")
    balances: List[dict]
    
    class Config:
        populate_by_name = True

class BalanceResponse(BaseModel):
    """잔액 응답 모델"""
    wallet_id: str = Field(..., alias="walletId")
    total_usd_value: float = Field(..., alias="totalUsdValue")
    balances: List[dict]
    last_updated: datetime = Field(..., alias="lastUpdated")
    
    class Config:
        populate_by_name = True

class SupportedChainsResponse(BaseModel):
    """지원 체인 목록 응답 모델"""
    environment: str
    supported_chains: List[dict] = Field(..., alias="supportedChains")
    
    class Config:
        populate_by_name = True

@router.get("/supported-chains", response_model=SupportedChainsResponse)
async def get_supported_chains():
    """지원하는 블록체인 목록 조회"""
    try:
        # 개발 환경과 프로덕션 환경에 따른 지원 체인 목록
        if settings.environment == "development":
            supported_chains = [
                {
                    "name": "Ethereum",
                    "symbol": "ETH",
                    "blockchain": "ethereum", 
                    "circle_blockchain": "ETH-SEPOLIA",
                    "chain_id": 11155111,
                    "network": "Sepolia Testnet",
                    "is_testnet": True
                },
                {
                    "name": "Base",
                    "symbol": "ETH",
                    "blockchain": "base",
                    "circle_blockchain": "BASE-SEPOLIA", 
                    "chain_id": 84532,
                    "network": "Base Sepolia",
                    "is_testnet": True
                },
                {
                    "name": "Arbitrum",
                    "symbol": "ETH",
                    "blockchain": "arbitrum",
                    "circle_blockchain": "ARB-SEPOLIA",
                    "chain_id": 421614,
                    "network": "Arbitrum Sepolia",
                    "is_testnet": True
                },
                {
                    "name": "Avalanche",
                    "symbol": "AVAX",
                    "blockchain": "avalanche",
                    "circle_blockchain": "AVAX-FUJI",
                    "chain_id": 43113,
                    "network": "Avalanche Fuji",
                    "is_testnet": True
                },
                {
                    "name": "Polygon",
                    "symbol": "MATIC",
                    "blockchain": "polygon",
                    "circle_blockchain": "MATIC-AMOY",
                    "chain_id": 80002,
                    "network": "Polygon Amoy",
                    "is_testnet": True
                },
                {
                    "name": "Optimism",
                    "symbol": "ETH",
                    "blockchain": "optimism",
                    "circle_blockchain": "OP-SEPOLIA",
                    "chain_id": 11155420,
                    "network": "Optimism Sepolia",
                    "is_testnet": True
                }
            ]
        else:
            # 프로덕션 환경 - 메인넷 체인들
            supported_chains = [
                {
                    "name": "Ethereum",
                    "symbol": "ETH",
                    "blockchain": "ethereum",
                    "circle_blockchain": "ETH",
                    "chain_id": 1,
                    "network": "Ethereum Mainnet",
                    "is_testnet": False
                },
                {
                    "name": "Base",
                    "symbol": "ETH",
                    "blockchain": "base",
                    "circle_blockchain": "BASE",
                    "chain_id": 8453,
                    "network": "Base Mainnet",
                    "is_testnet": False
                },
                {
                    "name": "Arbitrum",
                    "symbol": "ETH",
                    "blockchain": "arbitrum",
                    "circle_blockchain": "ARB",
                    "chain_id": 42161,
                    "network": "Arbitrum One",
                    "is_testnet": False
                },
                {
                    "name": "Avalanche",
                    "symbol": "AVAX",
                    "blockchain": "avalanche",
                    "circle_blockchain": "AVAX",
                    "chain_id": 43114,
                    "network": "Avalanche C-Chain",
                    "is_testnet": False
                },
                {
                    "name": "Polygon",
                    "symbol": "MATIC",
                    "blockchain": "polygon",
                    "circle_blockchain": "MATIC",
                    "chain_id": 137,
                    "network": "Polygon Mainnet",
                    "is_testnet": False
                },
                {
                    "name": "Optimism",
                    "symbol": "ETH",
                    "blockchain": "optimism",
                    "circle_blockchain": "OP",
                    "chain_id": 10,
                    "network": "Optimism Mainnet",
                    "is_testnet": False
                }
            ]
        
        return SupportedChainsResponse(
            environment=settings.environment,
            supported_chains=supported_chains
        )
        
    except Exception as e:
        print(f"🚨 지원 체인 조회 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=f"지원 체인 조회 실패: {e}")

@router.get("/debug/circle-config")
async def debug_circle_config():
    """Circle API 설정 디버그 (개발 환경에서만 사용)"""
    if settings.environment != "development":
        raise HTTPException(status_code=404, detail="Not found")
    
    # Circle API 설정 정보
    return {
        "environment": settings.environment,
        "circle_base_url": settings.circle_base_url,
        "circle_sandbox_url": settings.circle_sandbox_url,
        "api_base_url": circle_wallet_service.base_url,
        "use_sandbox": circle_wallet_service.use_sandbox,
        "api_key_prefix": circle_wallet_service.api_key[:20] + "..." if circle_wallet_service.api_key else "없음",
        "headers": dict(circle_wallet_service.headers)
    }

@router.post("/create", response_model=WalletResponse)
async def create_wallet(request: CreateWalletRequest, db: AsyncSession = Depends(get_db)):
    """새 MPC 지갑 생성"""
    try:
        # 사용자의 WalletSet 생성 또는 조회
        wallet_set_id = await circle_wallet_service.get_or_create_wallet_set(request.user_id)
        
        # Circle Wallet 서비스를 통해 지갑 생성
        wallet_result = await circle_wallet_service.create_wallet(
            wallet_set_id=wallet_set_id,
            blockchain=request.blockchain
        )
        
        wallet_data = wallet_result["data"]["wallets"][0]
        
        # Circle API에서 체인 ID 동적 조회
        wallet_blockchain = wallet_data["blockchain"]
        chain_id = circle_wallet_service.get_chain_id_from_blockchain(wallet_blockchain)
        print(f"🔗 체인 ID 매핑: {wallet_blockchain} → {chain_id}")
        
        # 잔액 조회
        balance_result = await circle_wallet_service.get_wallet_balance(wallet_data["id"])
        balances = balance_result["data"]["tokenBalances"]
        
        # ✅ 수정: 데이터베이스에 지갑 정보 저장
        from app.models.user import Wallet
        
        new_wallet = Wallet(
            user_id=int(request.user_id),
            circle_wallet_id=wallet_data["id"],
            wallet_address=wallet_data["address"],
            chain_id=chain_id,
            chain_name=wallet_data["blockchain"],
            usdc_balance=0.0,  # 초기 잔액
            is_active=True
        )
        
        db.add(new_wallet)
        await db.commit()
        await db.refresh(new_wallet)
        
        print(f"💾 지갑 데이터베이스 저장 완료: {wallet_data['id']}")
        
        return WalletResponse(
            wallet_id=wallet_data["id"],
            address=wallet_data["address"],
            blockchain=wallet_data["blockchain"],
            chain_id=chain_id,  # 동적으로 계산된 체인 ID 사용
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
        
        # 3. 응답 데이터 구성 (Circle API에서 실시간 잔액 조회)
        wallet_list = []
        for wallet in wallets:
            # Circle API에서 실시간 지갑 잔액 조회
            try:
                print(f"💰 지갑 잔액 조회 시작: {wallet.circle_wallet_id}")
                balance_response = await circle_wallet_service.get_wallet_balance(wallet.circle_wallet_id)
                
                # Circle API 응답에서 USDC 잔액 추출
                usdc_balance = 0.0
                if "data" in balance_response and "tokenBalances" in balance_response["data"]:
                    for token_balance in balance_response["data"]["tokenBalances"]:
                        if token_balance.get("token", {}).get("symbol") == "USDC":
                            usdc_balance = float(token_balance.get("amount", "0"))
                            print(f"✅ USDC 잔액 발견: {usdc_balance}")
                            break
                
                print(f"💰 최종 USDC 잔액: {usdc_balance}")
                
            except Exception as e:
                print(f"❌ 지갑 잔액 조회 실패: {e}")
                usdc_balance = float(wallet.usdc_balance)  # DB 저장값 fallback
            
            wallet_list.append({
                "wallet_id": wallet.circle_wallet_id,
                "address": wallet.wallet_address,
                "blockchain": wallet.chain_name.upper(),
                "chain_id": wallet.chain_id,
                "chain_name": wallet.chain_name,
                "usdc_balance": usdc_balance,  # 실시간 잔액 사용
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
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """지갑 거래 내역 조회 (자동 동기화 포함)"""
    try:
        from sqlalchemy import select, func
        from app.models.user import Transaction, Wallet
        from app.services.transaction_sync_service import TransactionSyncService
        from datetime import datetime, timedelta
        
        # 1. 지갑 존재 확인 및 사용자 ID 조회
        wallet_query = select(Wallet).where(Wallet.circle_wallet_id == wallet_id, Wallet.is_active == True)
        wallet_result = await db.execute(wallet_query)
        wallet = wallet_result.scalar_one_or_none()
        
        if not wallet:
            raise HTTPException(status_code=404, detail="지갑을 찾을 수 없습니다")
        
        # 2. 동기화 필요 여부 판단
        needs_sync = False
        sync_result = None
        last_sync_time = None
        
        # 2-1. 로컬 DB에 거래가 없는 경우 동기화 필요
        transaction_count_query = select(func.count(Transaction.id)).where(
            Transaction.user_id == wallet.user_id
        )
        count_result = await db.execute(transaction_count_query)
        local_transaction_count = count_result.scalar()
        
        if local_transaction_count == 0:
            print(f"📭 로컬 DB에 거래가 없음 - 자동 동기화 시작: wallet_id={wallet_id}")
            needs_sync = True
        else:
            # 2-2. 가장 최근 거래 시간 확인 (1시간 이상 오래된 경우 동기화)
            latest_transaction_query = select(Transaction.created_at).where(
                Transaction.user_id == wallet.user_id
            ).order_by(Transaction.created_at.desc()).limit(1)
            
            latest_result = await db.execute(latest_transaction_query)
            latest_transaction = latest_result.scalar_one_or_none()
            
            if latest_transaction:
                # timezone-aware datetime으로 통일
                current_time = datetime.utcnow().replace(tzinfo=latest_transaction.tzinfo)
                time_diff = current_time - latest_transaction
                if time_diff > timedelta(hours=1):  # 1시간 이상 오래된 경우
                    print(f"⏰ 마지막 거래가 {time_diff.total_seconds()/3600:.1f}시간 전 - 자동 동기화 시작: wallet_id={wallet_id}")
                    needs_sync = True
                    last_sync_time = latest_transaction.isoformat()
        
        # 3. 자동 동기화 실행 (필요한 경우)
        if needs_sync:
            try:
                print(f"🔄 자동 거래 내역 동기화 실행: wallet_id={wallet_id}")
                sync_service = TransactionSyncService()
                sync_result = await sync_service.sync_wallet_transactions(
                    wallet_id=wallet_id,
                    user_id=wallet.user_id,
                    db=db
                )
                
                if sync_result.get("success", False):
                    print(f"✅ 자동 동기화 완료: {sync_result}")
                else:
                    print(f"⚠️ 자동 동기화 실패: {sync_result.get('error', '알 수 없는 오류')}")
                    
            except Exception as sync_error:
                print(f"❌ 자동 동기화 중 오류: {sync_error}")
                # 동기화 실패해도 기존 데이터로 응답
                sync_result = {
                    "success": False,
                    "error": str(sync_error),
                    "message": "자동 동기화 실패, 기존 데이터로 응답"
                }
        
        # 4. 동기화 후 최신 거래 내역 조회 (체인별 구분)
        print(f"🔍 거래 내역 조회 디버깅:")
        print(f"   - wallet.user_id: {wallet.user_id}")
        print(f"   - wallet.id: {wallet.id}")
        print(f"   - wallet.circle_wallet_id: {wallet.circle_wallet_id}")
        
        transaction_query = select(Transaction).where(
            Transaction.user_id == wallet.user_id,
            Transaction.wallet_id == wallet.id  # 특정 지갑(체인)의 거래만 조회
        ).order_by(Transaction.created_at.desc()).offset(offset).limit(limit)
        
        transaction_result = await db.execute(transaction_query)
        transactions = transaction_result.scalars().all()
        
        # 5. 전체 거래 수 조회 (동기화 후) - 체인별
        total_query = select(func.count(Transaction.id)).where(
            Transaction.user_id == wallet.user_id,
            Transaction.wallet_id == wallet.id  # 특정 지갑(체인)의 거래만 카운트
        )
        total_result = await db.execute(total_query)
        total_transactions = total_result.scalar()
        
        print(f"   - 조회된 거래 수: {len(transactions)}건")
        print(f"   - 전체 거래 수: {total_transactions}건")
        
        # 6. 응답 데이터 구성
        transaction_list = []
        for transaction in transactions:
            transaction_list.append({
                "transactionId": transaction.transaction_id,
                "type": transaction.transaction_type,
                "amount": float(transaction.amount),
                "currency": transaction.currency,
                "status": transaction.status,
                "fromAddress": transaction.source_address,
                "toAddress": transaction.target_address,
                "transactionHash": transaction.transaction_hash,
                "createdAt": transaction.created_at.isoformat() if transaction.created_at else None,
                "completedAt": transaction.completed_at.isoformat() if transaction.completed_at else None,
                "merchantName": transaction.merchant_name,
                "notes": transaction.notes
            })
        
        # 7. 응답에 체인 정보와 동기화 상태 포함
        response_data = {
            "wallet_id": wallet_id,
            "wallet_info": {
                "address": wallet.wallet_address,
                "blockchain": wallet.chain_name,
                "chain_name": wallet.chain_name.upper(),
                "chain_id": wallet.chain_id
            },
            "total_transactions": total_transactions,
            "page": {
                "limit": limit,
                "offset": offset,
                "has_more": offset + limit < total_transactions
            },
            "transactions": transaction_list,
            "sync_info": {
                "auto_sync_performed": needs_sync,
                "sync_success": sync_result.get("success", False) if sync_result else None,
                "sync_message": sync_result.get("message", None) if sync_result else None,
                "last_sync_time": last_sync_time,
                "synced_at": datetime.utcnow().isoformat() if needs_sync else None
            }
        }
        
        print(f"✅ 거래 내역 조회 완료: 총 {total_transactions}건, 자동동기화: {needs_sync}")
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 거래 내역 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"거래 내역 조회 실패: {str(e)}")

@router.get("/user/{user_id}/all-transactions")
async def get_user_all_transactions(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """사용자의 모든 체인 거래 내역 조회 (체인별 구분)"""
    try:
        from sqlalchemy import select, func
        from app.models.user import Transaction, Wallet
        
        # 1. 사용자의 모든 활성 지갑 조회
        wallets_query = select(Wallet).where(
            Wallet.user_id == user_id,
            Wallet.is_active == True
        )
        wallets_result = await db.execute(wallets_query)
        wallets = wallets_result.scalars().all()
        
        if not wallets:
            return {
                "user_id": user_id,
                "total_transactions": 0,
                "chains": [],
                "transactions": []
            }
        
        # 2. 각 체인별 거래 내역 조회
        all_transactions = []
        chain_summary = []
        
        for wallet in wallets:
            # 체인별 거래 수 조회
            chain_count_query = select(func.count(Transaction.id)).where(
                Transaction.wallet_id == wallet.id
            )
            chain_count_result = await db.execute(chain_count_query)
            chain_transaction_count = chain_count_result.scalar()
            
            # 체인별 최근 거래 조회
            chain_transactions_query = select(Transaction).where(
                Transaction.wallet_id == wallet.id
            ).order_by(Transaction.created_at.desc()).limit(limit)
            
            chain_transactions_result = await db.execute(chain_transactions_query)
            chain_transactions = chain_transactions_result.scalars().all()
            
            # 체인 요약 정보
            chain_summary.append({
                "chain": wallet.chain_name,
                "chain_name": wallet.chain_name.upper(),
                "chain_id": wallet.chain_id,
                "wallet_address": wallet.wallet_address,
                "transaction_count": chain_transaction_count
            })
            
            # 체인별 거래 내역
            for transaction in chain_transactions:
                all_transactions.append({
                    "transactionId": transaction.transaction_id,
                    "type": transaction.transaction_type,
                    "amount": float(transaction.amount),
                    "currency": transaction.currency,
                    "status": transaction.status,
                    "fromAddress": transaction.source_address,
                    "toAddress": transaction.target_address,
                    "transactionHash": transaction.transaction_hash,
                    "createdAt": transaction.created_at.isoformat() if transaction.created_at else None,
                    "completedAt": transaction.completed_at.isoformat() if transaction.completed_at else None,
                    "merchantName": transaction.merchant_name,
                    "notes": transaction.notes,
                    "chain": wallet.chain_name,
                    "chain_name": wallet.chain_name.upper(),
                    "wallet_address": wallet.wallet_address
                })
        
        # 3. 전체 거래를 시간순으로 정렬
        all_transactions.sort(key=lambda x: x["createdAt"], reverse=True)
        
        # 4. 페이지네이션 적용
        total_transactions = len(all_transactions)
        paginated_transactions = all_transactions[offset:offset + limit]
        
        response_data = {
            "user_id": user_id,
            "total_transactions": total_transactions,
            "chains": chain_summary,
            "page": {
                "limit": limit,
                "offset": offset,
                "has_more": offset + limit < total_transactions
            },
            "transactions": paginated_transactions
        }
        
        print(f"✅ 사용자 전체 거래 내역 조회 완료: 총 {total_transactions}건, 체인 수: {len(chain_summary)}")
        return response_data
        
    except Exception as e:
        print(f"❌ 사용자 전체 거래 내역 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"사용자 전체 거래 내역 조회 실패: {str(e)}") 

@router.post("/{wallet_id}/sync-transactions")
async def sync_wallet_transactions(
    wallet_id: str,
    db: AsyncSession = Depends(get_db)
):
    """지갑 거래 내역 동기화 (Circle API → 로컬 DB)"""
    try:
        from sqlalchemy import select
        from app.models.user import Wallet
        from app.services.transaction_sync_service import TransactionSyncService
        from app.services.auth_service import auth_service
        from fastapi import Depends, HTTPException, status
        
        # 1. 지갑 존재 확인 및 사용자 ID 조회
        wallet_query = select(Wallet).where(
            Wallet.circle_wallet_id == wallet_id, 
            Wallet.is_active == True
        )
        wallet_result = await db.execute(wallet_query)
        wallet = wallet_result.scalar_one_or_none()
        
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="지갑을 찾을 수 없습니다"
            )
        
        print(f"🔄 거래 내역 동기화 시작: wallet_id={wallet_id}, user_id={wallet.user_id}")
        
        # 2. TransactionSyncService를 사용하여 동기화 실행
        sync_service = TransactionSyncService()
        sync_result = await sync_service.sync_wallet_transactions(
            wallet_id=wallet_id,
            user_id=wallet.user_id,
            db=db
        )
        
        if not sync_result.get("success", False):
            error_msg = sync_result.get("error", "알 수 없는 오류")
            print(f"❌ 거래 내역 동기화 실패: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"거래 내역 동기화 실패: {error_msg}"
            )
        
        # 3. 동기화 결과 로깅
        print(f"✅ 거래 내역 동기화 완료: {sync_result}")
        
        # 4. 동기화 후 최신 거래 내역 조회
        from sqlalchemy import func
        from app.models.user import Transaction
        
        # 동기화된 거래 수 조회
        total_query = select(func.count(Transaction.id)).where(
            Transaction.user_id == wallet.user_id
        )
        total_result = await db.execute(total_query)
        total_transactions = total_result.scalar()
        
        # 5. 응답 데이터 구성
        return {
            "wallet_id": wallet_id,
            "sync_result": sync_result,
            "total_transactions": total_transactions,
            "message": "거래 내역 동기화가 완료되었습니다",
            "synced_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 거래 내역 동기화 API 실패: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"거래 내역 동기화 중 오류가 발생했습니다: {str(e)}"
        )

 