#!/usr/bin/env python3

"""
Circle Sandbox USDC Faucet - 멀티체인 지원
테스트용 USDC를 이더리움 Sepolia와 Base Sepolia 체인에 전송하는 스크립트
"""

import requests
import json

# 설정
FAUCET_URL = "https://api.circle.com/v1/faucet/drips"
WALLET_ADDRESS = "0x3bfced9e16f500ddd56fc58cc73dd3c5cee8dee6"  # 테스트 지갑 주소
BLOCKCHAIN = "ETH-SEPOLIA"  # Sepolia 테스트넷
BASE_BLOCKCHAIN = "BASE-SEPOLIA"  # Base Sepolia 테스트넷
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

        # Circle Faucet API 응답 형식: {"code": 0, "message": ""} 또는 204 No Content
        if response.status_code == 200 and result and result.get("code") == 0:
            print("\n✅ USDC Faucet 요청 성공!")
            print("🎉 성공적으로 USDC Faucet 요청이 처리되었습니다!")
            
            if result.get("message"):
                print(f"   메시지: {result['message']}")
            else:
                print("   테스트용 USDC가 지갑으로 전송되었습니다.")
                
        elif response.status_code == 204:
            print("\n✅ USDC Faucet 요청 성공!")
            print("🎉 성공적으로 USDC Faucet 요청이 처리되었습니다!")
            print("   (204 No Content - 요청이 성공적으로 처리됨)")
                
        else:
            print("\n❌ USDC Faucet 요청 실패")
            print(f"   HTTP 상태: {response.status_code}")
            if result:
                print(f"   응답 코드: {result.get('code', 'N/A')}")
                print(f"   오류 메시지: {result.get('message', 'Unknown error')}")
            else:
                print("   응답 본문이 없습니다")
            
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
        elif result.get("message") and "rate limit" in result.get("message", "").lower():
            print("⚠️ ETH 잔액 조회 실패 (API 요청 제한)")
        elif result.get("message") and "invalid api key" in result.get("message", "").lower():
            print("⚠️ ETH 잔액 조회 실패 (유효하지 않은 API 키)")
        else:
            print("⚠️ ETH 잔액 조회 실패")
            if result.get("message"):
                print(f"   오류: {result['message']}")
            print("   💡 Etherscan API 키가 필요할 수 있습니다")
            
    except Exception as e:
        print(f"⚠️ 잔액 조회 중 오류: {e}")

def check_wallet_balance_basescan(address):
    """Basescan API를 통한 Base ETH 잔액 확인"""
    print("\n💰 지갑 Base ETH 잔액 확인 중...")
    
    try:
        basescan_url = "https://api-sepolia.basescan.org/api"
        params = {
            "module": "account",
            "action": "balance",
            "address": address,
            "tag": "latest",
            "apikey": "YourApiKeyToken"  # 실제 사용시 Basescan API 키 필요
        }

        response = requests.get(basescan_url, params=params, verify=False)
        result = response.json()

        if result.get("status") == "1":
            balance_wei = int(result["result"])
            balance_eth = balance_wei / (10 ** 18)
            print(f"✅ Base ETH 잔액: {balance_eth:.6f} ETH")
        elif result.get("message") and "rate limit" in result.get("message", "").lower():
            print("⚠️ Base ETH 잔액 조회 실패 (API 요청 제한)")
        elif result.get("message") and "invalid api key" in result.get("message", "").lower():
            print("⚠️ Base ETH 잔액 조회 실패 (유효하지 않은 API 키)")
        else:
            print("⚠️ Base ETH 잔액 조회 실패")
            if result.get("message"):
                print(f"   오류: {result['message']}")
            print("   💡 Basescan API 키가 필요할 수 있습니다")
            
    except Exception as e:
        print(f"⚠️ Base 잔액 조회 중 오류: {e}")

def main():
    """메인 함수"""
    print("🚀 Circle USDC Faucet 스크립트 시작")
    print("=" * 50)

    # 1. 이더리움 체인 테스트
    print("\n🌐 이더리움 Sepolia 체인 테스트")
    print("-" * 30)
    check_wallet_balance_etherscan(WALLET_ADDRESS)
    eth_faucet_result = request_usdc_faucet(WALLET_ADDRESS, BLOCKCHAIN)

    # 2. Base 체인 테스트
    print("\n🌐 Base Sepolia 체인 테스트")
    print("-" * 30)
    check_wallet_balance_basescan(WALLET_ADDRESS)
    base_faucet_result = request_usdc_faucet(WALLET_ADDRESS, BASE_BLOCKCHAIN)

    # 3. 결과에 따른 안내
    print("\n📋 멀티체인 테스트 결과:")
    print("=" * 50)
    
    # 이더리움 Sepolia 결과 확인
    if eth_faucet_result:
        if eth_faucet_result.get("code") == 0:
            print("✅ 이더리움 Sepolia: USDC Faucet 성공")
        else:
            print("❌ 이더리움 Sepolia: USDC Faucet 실패")
    else:
        print("✅ 이더리움 Sepolia: USDC Faucet 성공 (204 응답)")
        
    # Base Sepolia 결과 확인
    if base_faucet_result:
        if base_faucet_result.get("code") == 0:
            print("✅ Base Sepolia: USDC Faucet 성공")
        else:
            print("❌ Base Sepolia: USDC Faucet 실패")
    else:
        print("✅ Base Sepolia: USDC Faucet 성공 (204 응답)")

    print("\n📋 다음 단계:")
    print("1. 몇 분 후 각 체인 지갑 잔액을 다시 확인해보세요")
    print("2. 백엔드 API에서 거래 동기화가 자동으로 실행됩니다")
    print("3. 모바일 앱에서 새로운 USDC 잔액을 확인할 수 있습니다")
    
    print("\n🔧 멀티체인 테스트 명령어:")
    print("이더리움 Sepolia:")
    print('  curl "http://localhost:8000/api/v1/wallets/77e69e83-6160-5c96-9bbf-3a4a24b70332/transactions" -H "Authorization: Bearer test-token"')
    print("\nBase Sepolia:")
    print('  curl "http://localhost:8000/api/v1/wallets/f887d887-4b9a-5107-843d-e321321bfdb0/transactions" -H "Authorization: Bearer test-token"')
        
    print("\n" + "=" * 50)
    print("✨ 멀티체인 USDC Faucet 스크립트 완료!")

if __name__ == "__main__":
    main()
