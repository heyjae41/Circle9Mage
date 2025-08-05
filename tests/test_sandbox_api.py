import requests
import os
from dotenv import load_dotenv
from circle.web3 import utils

load_dotenv()

api_key = os.getenv("CIRCLE_SANDBOX_API_KEY")
# entity_secret = os.getenv("CIRCLE_ENTITY_SECRET")

def ping_circle_service():
    """
    Circle 서비스가 정상적으로 동작하는지 확인하는 함수.
    """
    # 환경변수에서 엔드포인트 URL을 가져옴 (없으면 기본값 사용)
    url = os.getenv("CIRCLE_BASE_URL") + "/ping"
    headers = {"Content-Type": "application/json"}

    try:
        response = requests.get(url, headers=headers, timeout=5, verify=False)
        print(f"[{url}] 응답 코드: {response.status_code}")
        print(response.text)
        return response.status_code == 200
    except Exception as e:
        print(f"Circle 서비스 연결 실패: {e}")
        return False
    

def get_wallet_set():
    """
    Get all wallet sets
    """

    url = os.getenv("CIRCLE_BASE_URL") + "/v1/w3s/walletSets"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    headers = {"Content-Type": "application/json"}

    response = requests.get(url, headers=headers, timeout=5, verify=False)

    print(response.text)

def generate_entity_secret():
    """
    Circle SDK를 사용하여 새로운 Entity Secret을 생성하는 함수.
    """
    # Entity Secret 생성 return type: None
    utils.generate_entity_secret()
    print("✅ Entity Secret 생성 성공:")
    # ================================================================
    # !!!! ENTITY SECRET: 0583ed95b308c414cb887abc21a521ea98830ad35bd91989840cb73534601348 !!!!
    # ================================================================
    return 


def generate_entity_secret_ciphertext(api_key: str, entity_secret: str):
    """
    Entity Secret을 RSA 공개키로 암호화하여 Ciphertext를 생성하는 함수.
    Circle 개발자 문서에 따라, API 키로부터 공개키를 조회한 뒤 entity_secret을 암호화합니다.
    """
    entity_secret_ciphertext = utils.generate_entity_secret_ciphertext(api_key, entity_secret)
    print("✅ Entity Secret Ciphertext 생성 성공:", entity_secret_ciphertext)
    return entity_secret_ciphertext

def register_entity_secret_with_sdk(api_key: str, entity_secret: str, recovery_dir: str = "."):
    """
    Circle SDK를 사용하여 Entity Secret을 등록하는 함수.
    """
    try:
        result = utils.register_entity_secret_ciphertext(
            api_key=api_key,
            entity_secret=entity_secret,
            recoveryFileDownloadPath=recovery_dir
        )
        print("✅ Entity Secret 등록 성공:", result)
        return result
    except Exception as e:
        print("❌ Entity Secret 등록 실패:", e)
        return None

if __name__ == "__main__":
    # ping_circle_service()
    
    # generate_entity_secret()
    # entity_secret_ciphertext = generate_entity_secret_ciphertext(api_key, "0583ed95b308c414cb887abc21a521ea98830ad35bd91989840cb73534601348")

    register_entity_secret_with_sdk(api_key, "0583ed95b308c414cb887abc21a521ea98830ad35bd91989840cb73534601348")