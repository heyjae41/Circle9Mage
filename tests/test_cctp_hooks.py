#!/usr/bin/env python3

"""
CCTP V2 Hooks 실시간 알림 시스템 테스트
"""

import asyncio
import aiohttp
import json
import websockets
from datetime import datetime

# 테스트 설정
API_BASE_URL = "http://localhost:8000/api/v1"
WS_BASE_URL = "ws://localhost:8000/api/v1/ws"
TEST_USER_ID = "39"  # 테스트용 사용자 ID

async def test_websocket_connection():
    """WebSocket 연결 테스트"""
    print("🔌 WebSocket 연결 테스트 시작")
    
    try:
        websocket_url = f"{WS_BASE_URL}/cctp-notifications/{TEST_USER_ID}"
        print(f"📡 연결 URL: {websocket_url}")
        
        async with websockets.connect(websocket_url) as websocket:
            print("✅ WebSocket 연결 성공")
            
            # 연결 상태 메시지 수신 대기
            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(message)
                print(f"📨 연결 메시지 수신: {data}")
            except asyncio.TimeoutError:
                print("⚠️ 연결 메시지 수신 타임아웃")
            
            # 상태 요청 전송
            await websocket.send(json.dumps({
                "type": "request_status"
            }))
            
            # 상태 응답 수신
            try:
                status_message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                status_data = json.loads(status_message)
                print(f"📊 상태 응답: {status_data}")
            except asyncio.TimeoutError:
                print("⚠️ 상태 응답 수신 타임아웃")
            
            print("🔌 WebSocket 연결 테스트 완료")
            return True
            
    except Exception as e:
        print(f"❌ WebSocket 연결 실패: {e}")
        return False

async def test_cctp_hooks_simulation():
    """CCTP Hooks 시뮬레이션 테스트"""
    print("🧪 CCTP Hooks 시뮬레이션 테스트 시작")
    
    # WebSocket 연결과 동시에 시뮬레이션 트리거
    websocket_url = f"{WS_BASE_URL}/cctp-notifications/{TEST_USER_ID}"
    
    try:
        async with websockets.connect(websocket_url) as websocket:
            print("✅ WebSocket 연결됨 - 알림 수신 대기 중")
            
            # 시뮬레이션 트리거
            simulation_data = {
                "transfer_id": f"test_transfer_{datetime.now().strftime('%H%M%S')}",
                "sender_id": TEST_USER_ID,
                "recipient_id": "40",  # 다른 사용자 ID
                "amount": 10.0,
                "source_chain": "ethereum",
                "target_chain": "base"
            }
            
            print(f"🚀 시뮬레이션 요청 전송: {simulation_data}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{API_BASE_URL}/ws/cctp-hooks/simulate",
                    json=simulation_data
                ) as response:
                    result = await response.json()
                    print(f"📬 시뮬레이션 응답: {result}")
            
            # 알림 수신 대기 (50초간)
            notifications_received = []
            start_time = datetime.now()
            
            print("📱 실시간 알림 수신 대기 중... (50초)")
            
            while (datetime.now() - start_time).seconds < 50:
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    data = json.loads(message)
                    
                    if data.get('type') not in ['connection_established', 'status_response', 'pong']:
                        notifications_received.append(data)
                        print(f"🔔 알림 수신: {data['type']} - {data.get('title', 'N/A')}")
                        
                        # 예상 알림 타입들
                        expected_types = ['transfer_initiated', 'transfer_pending', 'transfer_completed']
                        if data.get('type') in expected_types:
                            print(f"✅ 예상된 알림 타입: {data['type']}")
                    
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    print(f"⚠️ 메시지 처리 오류: {e}")
            
            print(f"📊 테스트 결과:")
            print(f"   - 수신된 알림 수: {len(notifications_received)}")
            print(f"   - 알림 타입들: {[n.get('type') for n in notifications_received]}")
            
            if len(notifications_received) >= 3:
                print("🎉 CCTP Hooks 시뮬레이션 성공!")
                return True
            else:
                print("⚠️ 예상보다 적은 알림 수신")
                return False
                
    except Exception as e:
        print(f"❌ 시뮬레이션 테스트 실패: {e}")
        return False

async def test_multiple_users():
    """여러 사용자 WebSocket 연결 테스트"""
    print("👥 멀티 사용자 WebSocket 테스트 시작")
    
    user_ids = ["39", "40", "41"]
    connections = []
    
    try:
        # 여러 사용자 동시 연결
        for user_id in user_ids:
            websocket_url = f"{WS_BASE_URL}/cctp-notifications/{user_id}"
            try:
                websocket = await websockets.connect(websocket_url)
                connections.append((user_id, websocket))
                print(f"✅ 사용자 {user_id} 연결 성공")
            except Exception as e:
                print(f"❌ 사용자 {user_id} 연결 실패: {e}")
        
        print(f"📊 총 연결된 사용자: {len(connections)}")
        
        # 서비스 상태 확인
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{API_BASE_URL}/ws/cctp-hooks/status") as response:
                status = await response.json()
                print(f"🔍 서비스 상태: {status}")
        
        # 연결 해제
        for user_id, websocket in connections:
            await websocket.close()
            print(f"🔌 사용자 {user_id} 연결 해제")
        
        return True
        
    except Exception as e:
        print(f"❌ 멀티 사용자 테스트 실패: {e}")
        return False

async def main():
    """메인 테스트 함수"""
    print("🚀 CCTP V2 Hooks 실시간 알림 시스템 종합 테스트")
    print("=" * 60)
    
    tests = [
        ("WebSocket 연결", test_websocket_connection),
        ("CCTP Hooks 시뮬레이션", test_cctp_hooks_simulation),
        ("멀티 사용자 연결", test_multiple_users),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n🔍 {test_name} 테스트 시작")
        print("-" * 40)
        
        try:
            result = await test_func()
            results.append((test_name, result))
            status = "✅ 성공" if result else "❌ 실패"
            print(f"📋 {test_name}: {status}")
        except Exception as e:
            results.append((test_name, False))
            print(f"📋 {test_name}: ❌ 예외 발생 - {e}")
    
    print("\n" + "=" * 60)
    print("📊 최종 테스트 결과")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅" if result else "❌"
        print(f"{status} {test_name}")
    
    print(f"\n🎯 전체 결과: {passed}/{total} 통과 ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 모든 테스트 통과! CCTP V2 Hooks 시스템이 정상 작동합니다.")
    else:
        print("⚠️ 일부 테스트 실패. 시스템 점검이 필요합니다.")

if __name__ == "__main__":
    print("📱 CCTP V2 Hooks 실시간 알림 시스템 테스트")
    print("⚠️  백엔드 서버가 실행 중인지 확인하세요: uvicorn main:app --reload")
    print()
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹️  테스트 중단됨")
    except Exception as e:
        print(f"\n❌ 테스트 실행 실패: {e}")
