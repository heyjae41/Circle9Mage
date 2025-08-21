#!/usr/bin/env python3

"""
Circle Sandbox USDC Faucet
테스트용 USDC를 지갑에 전송하는 스크립트
"""

import requests
import json

# 설정
FAUCET_URL = "https://api.circle.com/v1/faucet/drips"
WALLET_ADDRESS = "0xdb625015676ea1667f93219bb529732233134594"  # 테스트 지갑 주소
BLOCKCHAIN = "ETH-SEPOLIA"  # Sepolia 테스트넷
API_KEY = "TEST_API_KEY:3bbeb92f0d8d9b231e3bbe398931163b:9b962f9a9e4eb57f211c8492ff74e39a"

def request_usdc_faucet(address, blockchain="ETH-SEPOLIA"):
    """Circle USDC Faucet에서 테스트용 USDC 요청"""
    print("💰 Circle USDC Faucet 요청 시작...")
    print(f"📍 지갑 주소: {address}")
    print(f"🌐 블록체인: {blockchain}")
    print("-" * 50)

    payload = {
        "usdc": True,
        "blockchain": blockchain,
        "address": address
    }
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        print("🔄 Faucet API 호출 중...")
        response = requests.post(FAUCET_URL, json=payload, headers=headers, verify=False)
        
        print(f"📊 HTTP 상태 코드: {response.status_code}")
        print("📊 Faucet API 응답:")
        print(response.text)
        
        try:
            result = response.json()
        except json.JSONDecodeError:
            print("❌ JSON 파싱 실패 - 응답이 JSON 형식이 아닙니다")
            return None

        # Circle Faucet API 응답 형식: {"code": 0, "message": ""}
        if response.status_code == 200 and result.get("code") == 0:
            print("\n✅ USDC Faucet 요청 성공!")
            print("🎉 성공적으로 USDC Faucet 요청이 처리되었습니다!")
            
            if result.get("message"):
                print(f"   메시지: {result['message']}")
            else:
                print("   테스트용 USDC가 지갑으로 전송되었습니다.")
                
        else:
            print("\n❌ USDC Faucet 요청 실패")
            print(f"   HTTP 상태: {response.status_code}")
            print(f"   응답 코드: {result.get('code', 'N/A')}")
            print(f"   오류 메시지: {result.get('message', 'Unknown error')}")
            
            # 일반적인 오류 해결 방법 안내
            error_code = result.get('code')
            if error_code == 429 or response.status_code == 429:
                print("\n💡 해결 방법: 요청 제한에 걸렸습니다. 24시간 후 다시 시도해주세요.")
            elif error_code == 400 or response.status_code == 400:
                print("\n💡 해결 방법: 주소 또는 블록체인 형식을 확인해주세요.")
            elif error_code == 1:
                print("\n💡 해결 방법: API 호출에 문제가 있습니다. 요청 형식을 확인해주세요.")
            elif "already received" in result.get('message', '').lower():
                print("\n💡 해결 방법: 이미 USDC를 받은 주소입니다. 24시간 후 다시 시도하거나 다른 주소를 사용해주세요.")

        return result

    except requests.RequestException as e:
        print(f"❌ Faucet 요청 중 네트워크 오류: {e}")
        return None
    except Exception as e:
        print(f"❌ Faucet 요청 중 예상치 못한 오류: {e}")
        return None

def check_wallet_balance_etherscan(address):
    """Etherscan API를 통한 ETH 잔액 확인"""
    print("\n💰 지갑 ETH 잔액 확인 중...")
    
    try:
        etherscan_url = "https://api-sepolia.etherscan.io/api"
        params = {
            "module": "account",
            "action": "balance",
            "address": address,
            "tag": "latest",
            "apikey": "YourApiKeyToken"  # 실제 사용시 Etherscan API 키 필요
        }

        response = requests.get(etherscan_url, params=params, verify=False)
        result = response.json()

        if result.get("status") == "1":
            balance_wei = int(result["result"])
            balance_eth = balance_wei / (10 ** 18)
            print(f"✅ ETH 잔액: {balance_eth:.6f} ETH")
        else:
            print("⚠️ ETH 잔액 조회 실패 (Etherscan API 키 필요)")
            
    except Exception as e:
        print(f"⚠️ 잔액 조회 중 오류: {e}")

def main():
    """메인 함수"""
    print("🚀 Circle USDC Faucet 스크립트 시작")
    print("=" * 50)

    # 1. 현재 ETH 잔액 확인
    check_wallet_balance_etherscan(WALLET_ADDRESS)

    # 2. USDC Faucet 요청
    faucet_result = request_usdc_faucet(WALLET_ADDRESS, BLOCKCHAIN)

    # 3. 결과에 따른 안내
    if faucet_result and faucet_result.get("code") == 0:
        print("\n📋 다음 단계:")
        print("1. 몇 분 후 지갑 잔액을 다시 확인해보세요")
        print("2. 백엔드 API에서 거래 동기화가 자동으로 실행됩니다")
        print("3. 모바일 앱에서 새로운 USDC 잔액을 확인할 수 있습니다")
        
        print("\n🔧 테스트 명령어:")
        print('  백엔드 API: curl "http://localhost:8000/api/v1/wallets/34c3fc23-5a58-5390-982e-c5e94f8300c8/transactions" -H "Authorization: Bearer test-token"')
        print("  Circle API: python tests/faucet.py")
        
    print("\n" + "=" * 50)
    print("✨ USDC Faucet 스크립트 완료!")

if __name__ == "__main__":
    main()
