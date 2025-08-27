"""
WebSocket 실시간 통신 API 엔드포인트
CCTP V2 Hooks 알림을 위한 WebSocket 서버
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.security import HTTPBearer
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
import asyncio
from app.services.cctp_hooks_service import cctp_hooks_service
from app.services.auth_service import AuthService

router = APIRouter()
security = HTTPBearer()

class CCTPHookRequest(BaseModel):
    """CCTP Hook 요청 모델 (테스트용)"""
    transfer_id: str
    sender_id: str
    recipient_id: Optional[str] = None
    amount: float
    source_chain: str = "ethereum"
    target_chain: str = "base"

@router.websocket("/cctp-notifications/{user_id}")
async def cctp_notifications_websocket(websocket: WebSocket, user_id: str, token: Optional[str] = None):
    """
    CCTP V2 실시간 알림을 위한 WebSocket 엔드포인트
    
    연결 URL: ws://localhost:8000/api/v1/ws/cctp-notifications/{user_id}?token={jwt_token}
    """
    try:
        # JWT 토큰 검증 (쿼리 파라미터로 전달)
        if token:
            try:
                # 토큰 검증
                auth_service = AuthService()
                user_data = auth_service.verify_token(token)
                if str(user_data.get("user_id")) != user_id:
                    await websocket.close(code=4001, reason="Unauthorized")
                    return
                print(f"🔐 WebSocket 토큰 검증 성공: user_id={user_id}")
            except Exception as e:
                print(f"❌ WebSocket 토큰 검증 실패: {e}")
                await websocket.close(code=4001, reason="Invalid token")
                return
        
        # WebSocket 연결 등록
        await cctp_hooks_service.register_websocket(user_id, websocket)
        
        # 오프라인 알림 조회 및 전송
        offline_notifications = await cctp_hooks_service.get_offline_notifications(user_id)
        for notification in offline_notifications:
            await websocket.send_json({
                **notification,
                "type": "offline_notification",
                "is_offline": True
            })
        
        # 연결 유지 및 메시지 처리
        try:
            while True:
                # 클라이언트로부터 메시지 수신 (ping/pong, 상태 확인 등)
                try:
                    # 타임아웃을 사용하여 안전하게 메시지 수신
                    data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                    message = json.loads(data)
                    
                    # 클라이언트 요청 처리
                    if message.get("type") == "ping":
                        await websocket.send_json({"type": "pong", "timestamp": message.get("timestamp")})
                    elif message.get("type") == "request_status":
                        await websocket.send_json({
                            "type": "status_response",
                            "connected": True,
                            "user_id": user_id,
                            "active_connections": len(cctp_hooks_service.active_connections)
                        })
                    
                except asyncio.TimeoutError:
                    # 타임아웃 시 heartbeat 전송하여 연결 확인
                    try:
                        await websocket.send_json({
                            "type": "heartbeat",
                            "timestamp": asyncio.get_event_loop().time()
                        })
                    except Exception:
                        # heartbeat 전송 실패 시 연결 종료
                        print(f"💔 WebSocket heartbeat 실패, 연결 종료: user_id={user_id}")
                        break
                        
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "error", "message": "Invalid JSON format"})
                except WebSocketDisconnect:
                    # 정상적인 연결 해제
                    print(f"🔌 WebSocket 정상 연결 해제: user_id={user_id}")
                    break
                except Exception as e:
                    print(f"⚠️ WebSocket 메시지 처리 오류: {e}")
                    # 심각한 오류 시 연결 종료
                    break
                    
        except WebSocketDisconnect:
            print(f"🔌 WebSocket 연결 해제: user_id={user_id}")
        except Exception as e:
            print(f"❌ WebSocket 연결 오류: {e}")
        finally:
            await cctp_hooks_service.unregister_websocket(user_id)
            
    except Exception as e:
        print(f"❌ WebSocket 초기화 실패: {e}")
        try:
            await websocket.close(code=4000, reason="Server error")
        except:
            pass

@router.post("/cctp-hooks/simulate")
async def simulate_cctp_hooks(request: CCTPHookRequest):
    """
    CCTP Hooks 시뮬레이션 (테스트 및 데모용)
    실제 Circle API에서 Webhook을 받기 전에 테스트할 수 있는 엔드포인트
    """
    try:
        print(f"🧪 CCTP Hooks 시뮬레이션 요청: {request.dict()}")
        
        # 비동기 태스크로 시뮬레이션 시작 (응답은 즉시 반환)
        asyncio.create_task(cctp_hooks_service.simulate_cctp_hooks({
            "id": request.transfer_id,
            "sender_id": request.sender_id,
            "recipient_id": request.recipient_id,
            "amount": request.amount,
            "source_chain": request.source_chain,
            "target_chain": request.target_chain
        }))
        
        return {
            "success": True,
            "message": "CCTP Hooks 시뮬레이션이 시작되었습니다",
            "transfer_id": request.transfer_id,
            "estimated_duration": "40초 (INITIATED -> PENDING -> FINALIZED)"
        }
        
    except Exception as e:
        print(f"❌ CCTP Hooks 시뮬레이션 실패: {e}")
        raise HTTPException(status_code=500, detail=f"시뮬레이션 실패: {str(e)}")

@router.post("/cctp-hooks/webhook")
async def cctp_webhook_handler(webhook_data: Dict[str, Any]):
    """
    실제 Circle CCTP V2 Webhook 엔드포인트
    Circle에서 CCTP 메시지 상태 변경 시 호출됩니다
    
    Circle Console에서 설정할 Webhook URL:
    https://your-api.com/api/v1/ws/cctp-hooks/webhook
    """
    try:
        print(f"📡 Circle CCTP Webhook 수신: {webhook_data}")
        
        # Circle CCTP V2 Webhook 데이터 파싱
        # 실제 Circle Webhook 구조에 맞춰 수정 필요
        message_data = {
            "id": webhook_data.get("id"),
            "state": webhook_data.get("state"),
            "sender_id": webhook_data.get("metadata", {}).get("sender_id"),
            "recipient_id": webhook_data.get("metadata", {}).get("recipient_id"),
            "amount": webhook_data.get("amount"),
            "source_chain": webhook_data.get("source_chain"),
            "target_chain": webhook_data.get("target_chain")
        }
        
        # CCTP Hooks 서비스로 전달
        await cctp_hooks_service.handle_cctp_message_state_change(message_data)
        
        return {"success": True, "message": "Webhook processed successfully"}
        
    except Exception as e:
        print(f"❌ CCTP Webhook 처리 실패: {e}")
        raise HTTPException(status_code=500, detail=f"Webhook 처리 실패: {str(e)}")

@router.get("/cctp-hooks/status")
async def get_cctp_hooks_status():
    """CCTP Hooks 서비스 상태 조회"""
    return {
        "service": "CCTP V2 Hooks",
        "status": "active",
        "active_connections": len(cctp_hooks_service.active_connections),
        "connected_users": list(cctp_hooks_service.active_connections.keys())
    }
