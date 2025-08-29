"""
거래 내역 동기화 서비스
Circle API와 로컬 DB 간의 거래 내역 동기화
"""

import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, or_
from sqlalchemy.dialects.postgresql import insert

from app.models.user import Transaction, Wallet
from app.services.circle_client import CircleWalletService

logger = logging.getLogger(__name__)

class TransactionSyncService:
    """거래 내역 동기화 서비스"""
    
    def __init__(self):
        self.circle_client = CircleWalletService()
    
    async def sync_wallet_transactions(
        self, 
        wallet_id: str, 
        user_id: int, 
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Circle API → 로컬 DB 거래 내역 동기화
        
        Args:
            wallet_id: Circle 지갑 ID
            user_id: 사용자 ID
            db: 데이터베이스 세션
            
        Returns:
            동기화 결과 정보
        """
        try:
            logger.info(f"🔄 거래 내역 동기화 시작: wallet_id={wallet_id}, user_id={user_id}")
            
            # 1. Circle API에서 거래 내역 조회
            circle_transactions = await self._fetch_circle_transactions(wallet_id)
            if not circle_transactions:
                logger.info("📭 Circle API에 거래 내역이 없습니다")
                return {
                    "success": True,
                    "synced_count": 0,
                    "new_transactions": 0,
                    "updated_transactions": 0,
                    "message": "동기화할 거래가 없습니다"
                }
            
            logger.info(f"📊 Circle API에서 {len(circle_transactions)}개 거래 발견")
            
            # 2. 로컬 DB와 동기화
            sync_result = await self._sync_transactions_to_db(
                circle_transactions, user_id, wallet_id, db
            )
            
            logger.info(f"✅ 거래 내역 동기화 완료: {sync_result}")
            return sync_result
            
        except Exception as e:
            logger.error(f"❌ 거래 내역 동기화 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "동기화 중 오류가 발생했습니다"
            }
    
    async def _fetch_circle_transactions(self, wallet_id: str) -> List[Dict[str, Any]]:
        """Circle API에서 거래 내역 조회"""
        try:
            print(f"🔍 Circle API 거래 내역 조회 시작: wallet_id={wallet_id}")
            response = await self.circle_client.get_wallet_transactions(wallet_id)
            print(f"📨 Circle API 응답 수신: {type(response)}")
            
            if "data" in response and "transactions" in response["data"]:
                transactions = response["data"]["transactions"]
                print(f"✅ Circle API에서 {len(transactions)}개 거래 발견")
                
                # 거래 데이터 샘플 로깅
                if transactions:
                    first_tx = transactions[0]
                    print(f"📋 첫 번째 거래 샘플:")
                    print(f"   - ID: {first_tx.get('id', 'N/A')}")
                    print(f"   - Type: {first_tx.get('transactionType', 'N/A')}")
                    print(f"   - State: {first_tx.get('state', 'N/A')}")
                    print(f"   - Amounts: {first_tx.get('amounts', 'N/A')}")
                    print(f"   - CreateDate: {first_tx.get('createDate', 'N/A')}")
                
                return transactions
            else:
                print(f"⚠️ Circle API 응답에 transactions 필드가 없습니다:")
                print(f"   응답 구조: {list(response.keys()) if isinstance(response, dict) else type(response)}")
                return []
                
        except Exception as e:
            error_msg = str(e)
            print(f"❌ Circle API 거래 내역 조회 실패: {error_msg}")
            logger.error(f"❌ Circle API 거래 내역 조회 실패: {error_msg}")
            
            # 특정 오류 타입에 대한 추가 정보
            if "Server disconnected" in error_msg:
                print("💡 해결 방법: Circle API 서버 연결 불안정. 잠시 후 다시 시도해주세요.")
            elif "timeout" in error_msg.lower():
                print("💡 해결 방법: 네트워크 타임아웃. 인터넷 연결을 확인해주세요.")
            elif "401" in error_msg or "Unauthorized" in error_msg:
                print("💡 해결 방법: API 키를 확인해주세요.")
                
            return []
    
    async def _sync_transactions_to_db(
        self, 
        circle_transactions: List[Dict[str, Any]], 
        user_id: int, 
        wallet_id: str, 
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Circle API 거래 내역을 로컬 DB와 동기화"""
        
        # 🔧 핵심 수정: Circle API wallet_id를 로컬 DB wallet.id로 변환
        local_wallet_id = await self._get_local_wallet_id(wallet_id, user_id, db)
        if not local_wallet_id:
            print(f"❌ 로컬 지갑 ID를 찾을 수 없습니다: Circle ID={wallet_id}, User ID={user_id}")
            return {
                "success": False,
                "error": f"로컬 지갑 ID를 찾을 수 없습니다: {wallet_id}",
                "message": "지갑 정보를 찾을 수 없습니다"
            }
        
        print(f"✅ wallet_id 매핑: Circle ID {wallet_id} → Local ID {local_wallet_id}")
        
        new_count = 0
        updated_count = 0
        
        for i, circle_tx in enumerate(circle_transactions):
            try:
                print(f"🔄 거래 {i+1}/{len(circle_transactions)} 처리 중: {circle_tx.get('id', 'unknown')}")
                
                # Circle API 응답을 로컬 DB 모델에 매핑
                mapped_transaction = self._map_circle_to_local_transaction(
                    circle_tx, user_id, local_wallet_id  # 🔧 수정: wallet_id → local_wallet_id
                )
                
                if not mapped_transaction:
                    print(f"⚠️ 거래 매핑 실패: {circle_tx.get('id', 'unknown')}")
                    logger.warning(f"⚠️ 거래 매핑 실패: {circle_tx.get('id', 'unknown')}")
                    continue
                
                print(f"✅ 거래 매핑 성공:")
                print(f"   - Type: {mapped_transaction.get('transaction_type')}")
                print(f"   - Amount: {mapped_transaction.get('amount')}")
                print(f"   - Status: {mapped_transaction.get('status')}")
                
                # 중복 거래 확인 및 저장/업데이트
                result = await self._upsert_transaction(mapped_transaction, db)
                print(f"💾 DB 저장 결과: {result}")
                
                if result == "new":
                    new_count += 1
                elif result == "updated":
                    updated_count += 1
                    
            except Exception as e:
                print(f"❌ 거래 동기화 실패: {circle_tx.get('id', 'unknown')} - {e}")
                logger.error(f"❌ 거래 동기화 실패: {circle_tx.get('id', 'unknown')} - {e}")
                continue
        
        return {
            "success": True,
            "synced_count": len(circle_transactions),
            "new_transactions": new_count,
            "updated_transactions": updated_count,
            "message": f"동기화 완료: {new_count}개 신규, {updated_count}개 업데이트"
        }
    
    async def _get_local_wallet_id(self, circle_wallet_id: str, user_id: int, db: AsyncSession) -> Optional[int]:
        """Circle API wallet_id를 로컬 DB wallet.id로 변환"""
        try:
            from sqlalchemy import select
            from app.models.user import Wallet
            
            # Circle wallet_id로 로컬 지갑 찾기
            wallet_query = select(Wallet.id).where(
                Wallet.circle_wallet_id == circle_wallet_id,
                Wallet.user_id == user_id,
                Wallet.is_active == True
            )
            wallet_result = await db.execute(wallet_query)
            local_wallet_id = wallet_result.scalar_one_or_none()
            
            if local_wallet_id:
                print(f"✅ 지갑 ID 매핑 성공: {circle_wallet_id} → {local_wallet_id}")
                return local_wallet_id
            else:
                print(f"❌ 지갑 ID 매핑 실패: {circle_wallet_id} (User: {user_id})")
                return None
                
        except Exception as e:
            print(f"❌ 지갑 ID 매핑 중 오류: {e}")
            return None
    
    def _map_circle_to_local_transaction(
        self, 
        circle_tx: Dict[str, Any], 
        user_id: int, 
        local_wallet_id: int  # 🔧 수정: wallet_id → local_wallet_id
    ) -> Optional[Dict[str, Any]]:
        """Circle API 응답을 로컬 DB 모델에 매핑"""
        try:
            # Circle API 새로운 응답 형식에 맞게 매핑
            # 금액 처리 (amounts 배열에서 첫 번째 값)
            amounts = circle_tx.get("amounts", [])
            amount = float(amounts[0]) if amounts and len(amounts) > 0 else 0.0
            
            # 거래 타입 매핑 (INBOUND/OUTBOUND 구분)
            circle_transaction_type = circle_tx.get("transactionType", "").upper()
            if circle_transaction_type == "INBOUND":
                transaction_type = "received"  # 받은 거래
            elif circle_transaction_type == "OUTBOUND":
                transaction_type = "sent"      # 보낸 거래
            else:
                transaction_type = "transfer"  # 기타
            
            mapped = {
                "user_id": user_id,
                "wallet_id": local_wallet_id,  # ✅ 지갑 ID 추가 (local_wallet_id 사용)
                "transaction_id": circle_tx.get("id"),  # Circle 거래 ID
                "transaction_hash": circle_tx.get("txHash"),  # 블록체인 해시
                "transaction_type": transaction_type,
                "status": self._map_transaction_status(circle_tx.get("state")),
                "amount": amount,
                "currency": "USDC",  # Circle USDC 거래
                "source_address": circle_tx.get("sourceAddress"),
                "target_address": circle_tx.get("destinationAddress"),
                "source_chain": circle_tx.get("blockchain"),
                "target_chain": circle_tx.get("blockchain"),
                "created_at": self._parse_datetime(circle_tx.get("createDate")),
                "completed_at": self._parse_datetime(circle_tx.get("firstConfirmDate")),
                "extra_metadata": json.dumps({
                    "circle_transaction_id": circle_tx.get("id"),
                    "circle_wallet_id": local_wallet_id,  # ✅ local_wallet_id 사용
                    "circle_status": circle_tx.get("state"),
                    "circle_type": circle_tx.get("transactionType"),
                    "circle_operation": circle_tx.get("operation"),
                    "circle_blockchain": circle_tx.get("blockchain"),
                    "circle_block_height": circle_tx.get("blockHeight"),
                    "circle_network_fee": circle_tx.get("networkFee"),
                    "circle_metadata": {}
                }),
                "notes": f"Circle API 동기화: {circle_tx.get('transactionType', 'unknown')} 거래"
            }
            
            # 필수 필드 검증
            if not mapped["transaction_id"]:
                logger.warning(f"⚠️ 거래 ID가 없습니다: {circle_tx}")
                return None
                
            return mapped
            
        except Exception as e:
            logger.error(f"❌ 거래 매핑 실패: {e}")
            return None
    
    def _map_transaction_type(self, circle_type: str) -> str:
        """Circle API 거래 타입을 로컬 DB 타입으로 매핑"""
        if not circle_type:
            return "transfer"
            
        type_mapping = {
            "received": "received",    # 받은 거래 (INBOUND)
            "sent": "sent",           # 보낸 거래 (OUTBOUND)
            "transfer": "transfer",   # 일반 전송
            "payment": "payment", 
            "withdrawal": "withdrawal",
            "deposit": "deposit",
            "mint": "deposit",
            "burn": "withdrawal"
        }
        return type_mapping.get(circle_type.lower(), "transfer")
    
    def _map_transaction_status(self, circle_status: str) -> str:
        """Circle API 거래 상태를 로컬 DB 상태로 매핑"""
        if not circle_status:
            return "pending"
            
        status = circle_status.upper()
        status_mapping = {
            "PENDING": "pending",
            "COMPLETE": "completed",
            "CONFIRMED": "completed", 
            "FAILED": "failed",
            "CANCELLED": "failed",
            "EXPIRED": "failed",
            "PROCESSING": "pending"
        }
        return status_mapping.get(status, "pending")
    
    def _parse_datetime(self, datetime_str: str) -> Optional[datetime]:
        """ISO 8601 날짜 문자열을 datetime 객체로 파싱"""
        if not datetime_str:
            return None
        
        try:
            # ISO 8601 형식 파싱 (예: "2024-01-01T00:00:00Z")
            return datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
        except Exception as e:
            logger.warning(f"⚠️ 날짜 파싱 실패: {datetime_str} - {e}")
            return None
    
    async def _upsert_transaction(
        self, 
        transaction_data: Dict[str, Any], 
        db: AsyncSession
    ) -> str:
        """거래 데이터를 DB에 저장하거나 업데이트 (중복 방지)"""
        try:
            # 🔧 핵심 수정: transaction_hash 기반으로도 중복 확인 (None이 아닌 경우만)
            transaction_hash = transaction_data.get("transaction_hash")
            if transaction_hash:
                existing_query = select(Transaction).where(
                    or_(
                        Transaction.transaction_id == transaction_data["transaction_id"],
                        Transaction.transaction_hash == transaction_hash
                    )
                )
            else:
                # transaction_hash가 없는 경우 transaction_id만으로 확인
                existing_query = select(Transaction).where(
                    Transaction.transaction_id == transaction_data["transaction_id"]
                )
            existing_result = await db.execute(existing_query)
            existing_transaction = existing_result.scalar_one_or_none()
            
            if existing_transaction:
                print(f"🔄 기존 거래 발견: ID={existing_transaction.transaction_id}, Hash={existing_transaction.transaction_hash}")
                # 기존 거래 업데이트
                await self._update_existing_transaction(
                    existing_transaction, transaction_data, db
                )
                return "updated"
            else:
                # 새 거래 저장
                hash_info = f", Hash={transaction_hash}" if transaction_hash else ""
                print(f"💾 새 거래 저장: ID={transaction_data['transaction_id']}{hash_info}")
                await self._insert_new_transaction(transaction_data, db)
                return "new"
                
        except Exception as e:
            logger.error(f"❌ 거래 upsert 실패: {e}")
            raise
    
    async def _update_existing_transaction(
        self, 
        existing: Transaction, 
        new_data: Dict[str, Any], 
        db: AsyncSession
    ):
        """기존 거래 정보 업데이트"""
        try:
            # 업데이트할 필드들
            update_fields = {
                "transaction_type": new_data["transaction_type"],
                "status": new_data["status"],
                "amount": new_data["amount"],
                "source_address": new_data["source_address"],
                "target_address": new_data["target_address"],
                "transaction_hash": new_data["transaction_hash"],
                "extra_metadata": new_data["extra_metadata"],
                "notes": new_data["notes"]
            }
            
            # completed_at이 있는 경우 업데이트
            if new_data.get("completed_at"):
                update_fields["completed_at"] = new_data["completed_at"]
            
            # 거래 업데이트
            update_query = update(Transaction).where(
                Transaction.id == existing.id
            ).values(**update_fields)
            
            await db.execute(update_query)
            logger.debug(f"🔄 거래 업데이트: {existing.transaction_id}")
            
        except Exception as e:
            logger.error(f"❌ 거래 업데이트 실패: {e}")
            raise
    
    async def _insert_new_transaction(
        self, 
        transaction_data: Dict[str, Any], 
        db: AsyncSession
    ):
        """새 거래 저장"""
        try:
            new_transaction = Transaction(**transaction_data)
            db.add(new_transaction)
            logger.debug(f"💾 새 거래 저장: {transaction_data['transaction_id']}")
            
        except Exception as e:
            logger.error(f"❌ 새 거래 저장 실패: {e}")
            raise
    
    async def get_sync_status(
        self, 
        wallet_id: str, 
        user_id: int, 
        db: AsyncSession
    ) -> Dict[str, Any]:
        """동기화 상태 조회"""
        try:
            # 로컬 DB 거래 수
            local_count_query = select(Transaction).where(
                Transaction.user_id == user_id
            )
            local_result = await db.execute(local_count_query)
            local_transactions = local_result.scalars().all()
            local_count = len(local_transactions)
            
            # Circle API 거래 수
            circle_transactions = await self._fetch_circle_transactions(wallet_id)
            circle_count = len(circle_transactions) if circle_transactions else 0
            
            # 마지막 동기화 시간 (가장 최근 거래의 created_at)
            last_sync = None
            if local_transactions:
                last_sync = max(tx.created_at for tx in local_transactions if tx.created_at)
            
            return {
                "local_transaction_count": local_count,
                "circle_transaction_count": circle_count,
                "sync_difference": circle_count - local_count,
                "last_sync_time": last_sync.isoformat() if last_sync else None,
                "needs_sync": circle_count > local_count
            }
            
        except Exception as e:
            logger.error(f"❌ 동기화 상태 조회 실패: {e}")
            return {
                "error": str(e),
                "needs_sync": True
            }
