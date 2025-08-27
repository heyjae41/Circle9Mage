"""
CCTP V2 Message Passing Hooks 서비스
Circle CCTP V2의 Message Passing 기능을 활용한 실시간 알림 시스템
"""

import asyncio
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
from fastapi import WebSocket
from app.core.config import get_settings
from app.database.connection import get_redis


class CCTPHooksService:
    """CCTP V2 Message Passing Hooks 처리 서비스"""
    
    def __init__(self):
        self.settings = get_settings()
        self.active_connections: Dict[str, WebSocket] = {}  # user_id -> websocket
        self.message_handlers: Dict[str, callable] = {}
        
    async def register_websocket(self, user_id: str, websocket: WebSocket):
        """WebSocket 연결 등록"""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        print(f"🔌 WebSocket 연결 등록: user_id={user_id}, 활성 연결 수={len(self.active_connections)}")
        
        # 연결 상태 유지를 위한 핑 메시지 전송
        try:
            await websocket.send_json({
                "type": "connection_established",
                "message": "CCTP 실시간 알림 서비스에 연결되었습니다",
                "timestamp": datetime.now().isoformat()
            })
        except Exception as e:
            print(f"❌ WebSocket 초기 메시지 전송 실패: {e}")
    
    async def unregister_websocket(self, user_id: str):
        """WebSocket 연결 해제"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            print(f"🔌 WebSocket 연결 해제: user_id={user_id}, 활성 연결 수={len(self.active_connections)}")
    
    async def handle_cctp_message_state_change(self, message_data: Dict[str, Any]):
        """CCTP V2 Message 상태 변경 처리"""
        try:
            message_id = message_data.get("id")
            state = message_data.get("state")  # INITIATED, PENDING, FINALIZED
            sender_id = message_data.get("sender_id")
            recipient_id = message_data.get("recipient_id") 
            amount = message_data.get("amount", 0)
            source_chain = message_data.get("source_chain", "unknown")
            target_chain = message_data.get("target_chain", "unknown")
            
            print(f"📨 CCTP Message 상태 변경 감지: {message_id} -> {state}")
            
            # 상태별 알림 처리
            if state == "INITIATED":
                await self._notify_transfer_initiated(sender_id, recipient_id, amount, source_chain, target_chain)
            elif state == "PENDING":
                await self._notify_transfer_pending(sender_id, recipient_id, amount, source_chain, target_chain)
            elif state == "FINALIZED":
                await self._notify_transfer_completed(sender_id, recipient_id, amount, source_chain, target_chain)
            
            # Redis에 상태 저장 (백업 및 재연결 시 복구용)
            redis_client = await get_redis()
            await redis_client.setex(
                f"cctp_message:{message_id}",
                3600,  # 1시간 TTL
                json.dumps({
                    "state": state,
                    "timestamp": datetime.now().isoformat(),
                    "amount": amount,
                    "source_chain": source_chain,
                    "target_chain": target_chain
                })
            )
            
        except Exception as e:
            print(f"❌ CCTP Message 상태 변경 처리 실패: {e}")
    
    async def _notify_transfer_initiated(self, sender_id: str, recipient_id: str, amount: float, source_chain: str, target_chain: str):
        """송금 시작 알림"""
        # 송신자에게 알림
        if sender_id:
            await self._send_notification(sender_id, {
                "type": "transfer_initiated",
                "title": "크로스체인 송금 시작",
                "message": f"{amount} USDC 송금이 시작되었습니다",
                "details": f"{source_chain.upper()} → {target_chain.upper()}",
                "amount": amount,
                "status": "initiated",
                "icon": "🚀"
            })
        
        # 수신자에게 알림 (수신자 ID가 있는 경우)
        if recipient_id and recipient_id != sender_id:
            await self._send_notification(recipient_id, {
                "type": "transfer_incoming",
                "title": "크로스체인 송금 도착 예정",
                "message": f"{amount} USDC 송금이 도착 예정입니다",
                "details": f"{source_chain.upper()}에서 전송됨",
                "amount": amount,
                "status": "incoming",
                "icon": "📥"
            })
    
    async def _notify_transfer_pending(self, sender_id: str, recipient_id: str, amount: float, source_chain: str, target_chain: str):
        """송금 진행 중 알림"""
        # 송신자에게 알림
        if sender_id:
            await self._send_notification(sender_id, {
                "type": "transfer_pending",
                "title": "크로스체인 송금 처리 중",
                "message": f"{amount} USDC 송금이 블록체인에서 처리되고 있습니다",
                "details": "잠시만 기다려주세요 (15-45초 예상)",
                "amount": amount,
                "status": "pending",
                "icon": "⏳"
            })
    
    async def _notify_transfer_completed(self, sender_id: str, recipient_id: str, amount: float, source_chain: str, target_chain: str):
        """송금 완료 알림"""
        # 송신자에게 알림
        if sender_id:
            await self._send_notification(sender_id, {
                "type": "transfer_completed",
                "title": "크로스체인 송금 완료",
                "message": f"{amount} USDC 송금이 성공적으로 완료되었습니다",
                "details": f"{source_chain.upper()} → {target_chain.upper()}",
                "amount": amount,
                "status": "completed",
                "icon": "✅"
            })
        
        # 수신자에게 알림
        if recipient_id and recipient_id != sender_id:
            await self._send_notification(recipient_id, {
                "type": "transfer_received",
                "title": "크로스체인 송금 수신 완료",
                "message": f"{amount} USDC를 성공적으로 받았습니다",
                "details": f"{source_chain.upper()}에서 도착",
                "amount": amount,
                "status": "received",
                "icon": "💰"
            })
    
    async def _send_notification(self, user_id: str, notification_data: Dict[str, Any]):
        """사용자에게 WebSocket 알림 전송"""
        try:
            if user_id in self.active_connections:
                websocket = self.active_connections[user_id]
                
                # 알림 데이터에 타임스탬프 추가
                notification_data["timestamp"] = datetime.now().isoformat()
                notification_data["user_id"] = user_id
                
                try:
                    await websocket.send_json(notification_data)
                    print(f"📱 WebSocket 알림 전송 성공: {user_id} -> {notification_data['type']}")
                except Exception as send_error:
                    print(f"❌ WebSocket 전송 오류: user_id={user_id}, error={send_error}")
                    # 전송 실패 시 연결 제거 및 오프라인 저장
                    await self.unregister_websocket(user_id)
                    await self._store_offline_notification(user_id, notification_data)
            else:
                print(f"⚠️ WebSocket 연결 없음: user_id={user_id}, 오프라인 알림 저장")
                # 오프라인 사용자를 위한 알림 저장
                await self._store_offline_notification(user_id, notification_data)
                
        except Exception as e:
            print(f"❌ WebSocket 알림 전송 실패: user_id={user_id}, error={e}")
            # 연결이 끊어진 경우 등록 해제
            await self.unregister_websocket(user_id)
    
    async def _store_offline_notification(self, user_id: str, notification_data: Dict[str, Any]):
        """오프라인 사용자를 위한 알림 저장"""
        try:
            redis_client = await get_redis()
            notification_key = f"offline_notifications:{user_id}"
            
            # 최대 10개까지만 저장
            current_count = await redis_client.llen(notification_key)
            if current_count >= 10:
                await redis_client.rpop(notification_key)  # 가장 오래된 알림 제거
            
            await redis_client.lpush(notification_key, json.dumps(notification_data))
            await redis_client.expire(notification_key, 86400)  # 24시간 TTL
            
            print(f"💾 오프라인 알림 저장: user_id={user_id}")
            
        except Exception as e:
            print(f"❌ 오프라인 알림 저장 실패: {e}")
    
    async def get_offline_notifications(self, user_id: str) -> List[Dict[str, Any]]:
        """오프라인 알림 조회"""
        try:
            redis_client = await get_redis()
            notification_key = f"offline_notifications:{user_id}"
            
            notifications = await redis_client.lrange(notification_key, 0, -1)
            result = []
            
            for notification_json in notifications:
                try:
                    notification = json.loads(notification_json)
                    result.append(notification)
                except json.JSONDecodeError:
                    continue
            
            # 조회 후 삭제
            if notifications:
                await redis_client.delete(notification_key)
                print(f"📱 오프라인 알림 조회 및 삭제: user_id={user_id}, count={len(result)}")
            
            return result
            
        except Exception as e:
            print(f"❌ 오프라인 알림 조회 실패: {e}")
            return []
    
    async def simulate_cctp_hooks(self, transfer_data: Dict[str, Any]):
        """CCTP Hooks 시뮬레이션 (테스트용)"""
        print("🧪 CCTP Hooks 시뮬레이션 시작")
        
        # 1. INITIATED 상태
        await self.handle_cctp_message_state_change({
            **transfer_data,
            "state": "INITIATED"
        })
        
        # 2. 10초 후 PENDING 상태 
        await asyncio.sleep(10)
        await self.handle_cctp_message_state_change({
            **transfer_data,
            "state": "PENDING"
        })
        
        # 3. 30초 후 FINALIZED 상태
        await asyncio.sleep(30)
        await self.handle_cctp_message_state_change({
            **transfer_data,
            "state": "FINALIZED"
        })
        
        print("🎉 CCTP Hooks 시뮬레이션 완료")


# 글로벌 인스턴스
cctp_hooks_service = CCTPHooksService()
