"""
Circle API 클라이언트 서비스
"""

import httpx
import json
import base64
import binascii
from typing import Dict, Any, Optional, List
from app.core.config import get_settings
import asyncio
import uuid
import secrets
import re
from datetime import datetime
from web3 import Web3
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
 

class CircleAPIClient:
    """Circle API 클라이언트"""
    
    async def ping(self) -> Dict[str, Any]:
        """Circle API 연결 테스트"""
        try:
            print(f"🏓 Circle API 연결 테스트 시작: {self.base_url}/ping")
            response = await self._make_request("GET", "/ping")
            print(f"✅ Circle API 연결 성공: {response}")
            return response
        except Exception as e:
            print(f"❌ Circle API 연결 실패: {str(e)}")
            raise

    async def _encrypt_entity_secret(self, entity_secret: str) -> str:
        """Entity Secret을 Circle 공개키로 암호화 (사용자 제시 방식 적용)"""
        try:
            # Circle의 실제 공개키 (Circle API에서 가져온 공식 키)
            circle_public_key_pem = b"""-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAvBOH3rewehotHEsrj6Ui
9TQLP4xG2ba19MQmrWXkPxR4s+oO+h3DjvTq/vig2q7cZUZCdPf8un9TL1A+mL0k
EHK0rw2O0D/Xrb8pBOnTsEdGKZ6zoD37G8+0sXjb5P64UPn2DD/Os0UaM/nY7tk0
Mkt5vfgmpbfmdAfZaqRD4HmLjbFtDlIwdJ/Xy/67vq1vHxmaim6aaiuZLNgNRrxx
Un8TWpfOk3F1j6VSc18EyeZOKUkrRWpssdxKADeLEEX5PklwOgevAgbn+oehy4+C
v6ULAk/9xx8vHOSKo4FSFabHZM0F4gcAFKyL66/Dz4Rzn/SpPs89rINKyWSdyzNe
6JEWIIuhgldefxmalmOTmyI7BJdPVeeMSm0YlB1stK1zjWM/LvtA6e+Kjnkm+mWh
VsyiBgnlYPj7CcAYWv3tH4TtNV5rbhhmJG9TJBvG4hn7bbC0/q0TbyUjvdH5Pizi
b3knqMtca+TZXpZkUD9Af2snfEzOd02cREKlKJSOvQA9dbx14wj7P1A395IEGdPE
VihlFLYsOxv8Wb9uVVxR9UvFLLRaZByf3/EaEpDJ1Uh0PPxVW3BPTlHLHAKtdBPr
7hxAdk2gh0zum92+aLVap16zTey/gqQgdKXYSJc6fAgQdFII0tUGQToxFNgLqAMi
TsU/4r6JK9ivR7+2oD3X6lMCAwEAAQ==
-----END PUBLIC KEY-----"""
            
            # 1. Circle 공개키 PEM 문자열을 준비 (사용자 제시 방식)
            public_key = serialization.load_pem_public_key(circle_public_key_pem)
            
            # 2. Entity Secret (콘솔에서 받은 본인 Entity Secret)
            # 사용자 제시 방식: entity_secret.encode() 사용
            entity_secret_bytes = entity_secret.encode('utf-8') if isinstance(entity_secret, str) else entity_secret
            
            # Hex 형식일 경우 bytes로 변환 시도
            if isinstance(entity_secret, str) and len(entity_secret) == 64:  # 32 bytes = 64 hex chars
                try:
                    entity_secret_bytes = bytes.fromhex(entity_secret)
                    print(f"🔧 Entity Secret을 hex에서 bytes로 변환: {len(entity_secret_bytes)} bytes")
                except ValueError:
                    # hex가 아니라면 일반 문자열로 처리
                    entity_secret_bytes = entity_secret.encode('utf-8')
                    print(f"🔧 Entity Secret을 문자열로 처리: {len(entity_secret_bytes)} bytes")
            
            # 3. 암호화 실행 (사용자 제시 방식)
            ciphertext = public_key.encrypt(
                entity_secret_bytes,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )
            
            # 4. base64 인코딩 (사용자 제시 방식)
            entity_secret_ciphertext = base64.b64encode(ciphertext).decode('utf-8')
            
            print(f"🔐 새로운 Entity Secret Ciphertext 생성 성공:")
            print(f"   Original Length: {len(entity_secret)} chars")
            print(f"   Encrypted Length: {len(entity_secret_ciphertext)} chars")
            print(f"   Sample: {entity_secret_ciphertext[:50]}...")
            
            return entity_secret_ciphertext
            
        except Exception as e:
            print(f"❌ Entity Secret 암호화 실패: {str(e)}")
            print(f"   Entity Secret Type: {type(entity_secret)}")
            print(f"   Entity Secret Length: {len(entity_secret) if entity_secret else 0}")
            print(f"   Entity Secret Sample: {entity_secret[:20] if entity_secret else 'None'}...")
            
            # 실패 시 다른 대안 시도
            raise Exception(f"Entity Secret 암호화 실패: {str(e)}")
    
    def __init__(self, use_sandbox: bool = True):
        self.settings = get_settings()
        self.use_sandbox = use_sandbox
        self.base_url = self.settings.circle_sandbox_url if use_sandbox else self.settings.circle_base_url
        self.api_key = self.settings.circle_sandbox_api_key if use_sandbox else self.settings.circle_api_key
        
        # API 키 유효성 검증
        if not self.api_key:
            env_var = "CIRCLE_SANDBOX_API_KEY" if use_sandbox else "CIRCLE_API_KEY"
            raise Exception(f"{env_var} 환경변수가 설정되지 않았습니다.")
        
        print(f"🔧 Circle API 초기화:")
        print(f"   환경: {'Sandbox' if use_sandbox else 'Production'}")
        print(f"   Base URL: {self.base_url}")
        print(f"   API Key: {self.api_key[:20]}..." if self.api_key else "   API Key: None")
        
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    async def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """HTTP 요청 실행 (재시도 로직 포함)"""
        url = f"{self.base_url}{endpoint}"
        max_retries = 3
        retry_delay = 2
        
        # 개발 환경에서는 SSL 검증 비활성화
        verify_ssl = self.settings.environment == "production"
        
        for attempt in range(max_retries):
            try:
                print(f"🔄 Circle API 요청 ({attempt + 1}/{max_retries}): {method} {endpoint}")
                
                async with httpx.AsyncClient(
                    verify=verify_ssl,
                    timeout=httpx.Timeout(30.0, connect=10.0),
                    follow_redirects=True
                ) as client:
                    response = await client.request(
                        method=method,
                        url=url,
                        headers=self.headers,
                        json=data,
                        params=params
                    )
                    
                    print(f"✅ Circle API 응답: {response.status_code}")
                    
                    if response.status_code >= 400:
                        error_text = response.text
                        print(f"❌ Circle API 오류: {response.status_code} - {error_text}")
                        raise Exception(f"Circle API Error: {response.status_code} - {error_text}")
                    
                    return response.json()
                    
            except httpx.TimeoutException as e:
                print(f"⏰ Circle API 타임아웃 (시도 {attempt + 1}/{max_retries}): {e}")
                if attempt == max_retries - 1:
                    raise Exception(f"Circle API 타임아웃: 모든 재시도 실패")
                    
            except httpx.ConnectError as e:
                print(f"🔌 Circle API 연결 오류 (시도 {attempt + 1}/{max_retries}): {e}")
                if attempt == max_retries - 1:
                    raise Exception(f"Circle API 연결 실패: {e}")
                    
            except Exception as e:
                print(f"❌ Circle API 요청 오류 (시도 {attempt + 1}/{max_retries}): {e}")
                if attempt == max_retries - 1:
                    raise
            
            # 재시도 전 대기
            if attempt < max_retries - 1:
                print(f"⏳ {retry_delay}초 대기 후 재시도...")
                import asyncio
                await asyncio.sleep(retry_delay)
                retry_delay *= 2  # 지수 백오프

class CircleWalletService(CircleAPIClient):
    """Circle Wallet 서비스"""
    
    def __init__(self, use_sandbox: bool = None):
        # 환경에 따라 자동으로 sandbox 결정
        settings = get_settings()
        if use_sandbox is None:
            use_sandbox = settings.environment == "development"
        
        super().__init__(use_sandbox)
        self.max_retries = 3
        self.retry_delay = 2  # seconds
        
        print(f"🔧 Circle API 설정: {'Sandbox' if use_sandbox else 'Production'} 환경")
        print(f"🌍 환경모드: {settings.environment}")
        print(f"🌐 선택된 API URL: {self.base_url}")
        print(f"🌐 사용가능한 URLs - Sandbox: {self.settings.circle_sandbox_url}, Production: {self.settings.circle_base_url}")
        print(f"🔑 선택된 API Key: {self.api_key[:20]}..." if self.api_key else "❌ API Key 없음")
    
    def is_valid_ethereum_address(self, address: str) -> bool:
        """이더리움 주소 유효성 검증"""
        if not address:
            return False
        
        # 기본 형식 검증 (0x로 시작하고 40자리 hex)
        if not re.match(r'^0x[a-fA-F0-9]{40}$', address):
            return False
        
        try:
            # Web3 체크섬 검증
            return Web3.is_address(address)
        except Exception:
            return False
    
    def get_chain_id_from_blockchain(self, blockchain: str) -> int:
        """블록체인 이름에서 체인 ID 매핑"""
        # 메인넷 체인 ID 매핑
        mainnet_chain_ids = {
            "ETH": 1,              # Ethereum Mainnet
            "BASE": 8453,          # Base Mainnet
            "ARB": 42161,          # Arbitrum One
            "AVAX": 43114,         # Avalanche C-Chain
            "MATIC": 137,          # Polygon Mainnet
            "OP": 10               # Optimism Mainnet
        }
        
        # 테스트넷 체인 ID 매핑
        testnet_chain_ids = {
            "ETH-SEPOLIA": 11155111,   # Ethereum Sepolia
            "BASE-SEPOLIA": 84532,     # Base Sepolia
            "ARB-SEPOLIA": 421614,     # Arbitrum Sepolia
            "AVAX-FUJI": 43113,        # Avalanche Fuji
            "MATIC-AMOY": 80002,       # Polygon Amoy (최신 테스트넷)
            "MATIC-MUMBAI": 80001,     # Polygon Mumbai (구 테스트넷)
            "OP-SEPOLIA": 11155420     # Optimism Sepolia
        }
        
        # 통합 매핑
        all_chain_ids = {**mainnet_chain_ids, **testnet_chain_ids}
        
        # 개발 환경 기본값: Sepolia, 프로덕션 환경 기본값: Ethereum Mainnet
        default_chain_id = 11155111 if self.settings.environment == "development" else 1
        
        return all_chain_ids.get(blockchain, default_chain_id)
    
    async def create_wallet_with_retry(self, wallet_set_id: str, blockchain: str = "ETH-SEPOLIA", count: int = 1, retry_count: int = 0) -> Dict[str, Any]:
        """재시도 로직이 포함된 지갑 생성"""
        try:
            result = await self.create_wallet(wallet_set_id, blockchain, count)
            
            # 지갑 주소 검증
            if result.get("data") and result["data"].get("wallets"):
                wallet = result["data"]["wallets"][0]
                address = wallet.get("address")
                
                if not self.is_valid_ethereum_address(address):
                    raise ValueError(f"Invalid wallet address generated: {address}")
            
            return result
            
        except Exception as e:
            if retry_count < self.max_retries:
                print(f"⚠️ 지갑 생성 실패 (시도 {retry_count + 1}/{self.max_retries + 1}): {str(e)}")
                await asyncio.sleep(self.retry_delay * (retry_count + 1))  # 지수 백오프
                return await self.create_wallet_with_retry(wallet_set_id, blockchain, count, retry_count + 1)
            else:
                raise Exception(f"지갑 생성 최종 실패 ({self.max_retries + 1}회 시도): {str(e)}")
    
    async def get_entity_public_key(self) -> str:
        """Circle의 Entity 공개키 가져오기 (Entity Secret 암호화용)"""
        try:
            print("🔑 Circle API 공개키 요청 중...")
            response = await self._make_request("GET", "/v1/w3s/config/entity/publicKey")
            
            if response.get("data") and response["data"].get("publicKey"):
                public_key = response["data"]["publicKey"]
                print("✅ Circle API 공개키 수신 완료")
                return public_key
            else:
                raise Exception("Circle 공개키 조회 응답이 올바르지 않습니다")
                
        except Exception as e:
            print(f"❌ Circle API 공개키 요청 실패: {e}")
            raise

    @staticmethod
    def generate_entity_secret() -> str:
        """32바이트 Entity Secret 생성 (개발용)"""
        # 32바이트 = 64자 hex 문자열 생성
        entity_secret = secrets.token_hex(32)
        print(f"🔑 새 Entity Secret 생성됨: {entity_secret}")
        print("⚠️  이 값을 안전한 곳에 저장하고 환경변수 CIRCLE_ENTITY_SECRET에 설정하세요")
        return entity_secret



    def encrypt_entity_secret(self, entity_secret: str, public_key_pem: str) -> str:
        """Entity Secret을 Circle 공개키로 RSA 암호화"""
        try:
            # hex 문자열을 바이트로 변환
            entity_secret_bytes = binascii.unhexlify(entity_secret)
            
            # Circle API 공개키 형식 확인 및 처리
            public_key_data = public_key_pem.strip()
            
            print(f"🔑 Circle API 공개키 형식 감지: {public_key_data[:50]}...")
            
            # Circle API는 RSA PEM 형식을 반환하므로 직접 로드
            public_key = serialization.load_pem_public_key(public_key_data.encode())
            
            # RSA-OAEP 암호화
            encrypted_data = public_key.encrypt(
                entity_secret_bytes,
                padding.OAEP(
                    mgf=padding.MGF1(algorithm=hashes.SHA256()),
                    algorithm=hashes.SHA256(),
                    label=None
                )
            )
            
            # Base64 인코딩
            encrypted_base64 = base64.b64encode(encrypted_data).decode('utf-8')
            
            # 길이 검증 (684자여야 함)
            if len(encrypted_base64) != 684:
                print(f"⚠️  암호화된 Entity Secret 길이: {len(encrypted_base64)} (예상: 684)")
            
            return encrypted_base64
            
        except Exception as e:
            print(f"❌ Entity Secret 암호화 실패: {e}")
            raise

    async def get_or_create_entity_secret_ciphertext(self) -> str:
        """Entity Secret Ciphertext 매번 새로 생성 (Circle API 보안 요구사항)"""
        # 원본 Entity Secret이 있어야 함
        if not self.settings.circle_entity_secret:
            raise Exception(
                "CIRCLE_ENTITY_SECRET이 설정되지 않았습니다.\n"
                "Circle Console에서 Entity Secret을 등록하고 환경변수를 설정해주세요."
            )
        
        print("🔐 Entity Secret Ciphertext 새로 생성 중...")
        
        # Circle 공개키 가져오기
        public_key = await self.get_entity_public_key()
        
        # Entity Secret 암호화 (매번 새로 생성)
        ciphertext = self.encrypt_entity_secret(
            self.settings.circle_entity_secret, 
            public_key
        )
        
        print("✅ Entity Secret Ciphertext 생성 완료")
        return ciphertext

    async def get_or_create_wallet_set(self, user_id: str) -> str:
        """사용자의 WalletSet을 생성하고 ID 반환"""
        try:
            # WalletSet 생성
            result = await self.create_wallet_set(user_id)
            
            if result.get("data") and result["data"].get("walletSet"):
                wallet_set_id = result["data"]["walletSet"]["id"]
                print(f"✅ WalletSet 생성 완료: {wallet_set_id}")
                return wallet_set_id
            else:
                raise Exception(f"WalletSet 생성 응답이 올바르지 않습니다: {result}")
                
        except Exception as e:
            print(f"❌ WalletSet 생성 실패: {e}")
            raise

    async def create_multichain_wallets_parallel(self, user_id: str, wallet_set_id: str) -> dict:
        """멀티체인 지갑을 병렬로 생성 (Ethereum + Base)"""
        try:
            print(f"🚀 사용자 {user_id}의 멀티체인 지갑 생성 시작 (Ethereum + Base)...")
            
            # 병렬 처리로 동시에 두 체인 지갑 생성
            tasks = [
                self.create_wallet_with_retry(wallet_set_id, "ethereum"),
                self.create_wallet_with_retry(wallet_set_id, "base")
            ]
            
            # 예외 포함하여 모든 결과 수집
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 결과 처리
            created_wallets = []
            errors = []
            
            chain_names = ["ethereum", "base"]
            for i, result in enumerate(results):
                chain_name = chain_names[i]
                
                if isinstance(result, Exception):
                    error_msg = f"{chain_name} 체인 지갑 생성 실패: {str(result)}"
                    print(f"❌ {error_msg}")
                    errors.append({"chain": chain_name, "error": error_msg})
                else:
                    if result.get("data") and result["data"].get("wallets"):
                        wallet_data = result["data"]["wallets"][0]
                        wallet_data["chain_type"] = chain_name  # 체인 타입 추가
                        created_wallets.append(wallet_data)
                        print(f"✅ {chain_name} 체인 지갑 생성 성공: {wallet_data['address']}")
                    else:
                        error_msg = f"{chain_name} 체인 응답 형식 오류: {result}"
                        print(f"❌ {error_msg}")
                        errors.append({"chain": chain_name, "error": error_msg})
            
            # 결과 반환
            result_data = {
                "success_count": len(created_wallets),
                "total_count": len(tasks),
                "wallets": created_wallets,
                "errors": errors,
                "is_partial_success": len(created_wallets) > 0 and len(errors) > 0
            }
            
            if len(created_wallets) == 0:
                raise Exception(f"모든 체인 지갑 생성 실패: {errors}")
            
            print(f"🎉 멀티체인 지갑 생성 완료: {len(created_wallets)}/{len(tasks)} 성공")
            return result_data
            
        except Exception as e:
            print(f"❌ 멀티체인 지갑 생성 실패: {str(e)}")
            raise
    
    async def create_wallet_set(self, user_id: str, name: str = None) -> Dict[str, Any]:
        """
        WalletSet 생성 (사용자별로 하나)
        https://developers.circle.com/w3s/reference/createwalletset
        """
        if not name:
            name = f"User {user_id} WalletSet"
        
        # Entity Secret Ciphertext 가져오기 또는 생성
        entity_secret_ciphertext = await self.get_or_create_entity_secret_ciphertext()
        
        data = {
            "idempotencyKey": str(uuid.uuid4()),
            "name": name,
            "entitySecretCiphertext": entity_secret_ciphertext
        }
        
        print(f"📦 WalletSet 생성 요청: user_id={user_id}, name={name}")
        return await self._make_request("POST", "/v1/w3s/developer/walletSets", data)

    async def create_wallet(self, wallet_set_id: str, blockchain: str = "ETH-SEPOLIA", count: int = 1) -> Dict[str, Any]:
        """
        실제 Circle API로 지갑 생성
        https://developers.circle.com/w3s/reference/createwallets
        """
        # 블록체인 매핑 (백엔드 → Circle API)
        if self.settings.environment == "development":
            blockchain_mapping = {
                "ETH": "ETH-SEPOLIA",
                "ETH-SEPOLIA": "ETH-SEPOLIA", 
                "ethereum": "ETH-SEPOLIA",
                "BASE": "BASE-SEPOLIA",
                "BASE-SEPOLIA": "BASE-SEPOLIA",
                "base": "BASE-SEPOLIA",
                "ARBITRUM": "ARB-SEPOLIA", 
                "ARB": "ARB-SEPOLIA",
                "arbitrum": "ARB-SEPOLIA",
                "AVALANCHE": "AVAX-FUJI",
                "AVAX": "AVAX-FUJI", 
                "avalanche": "AVAX-FUJI",
                "POLYGON": "MATIC-AMOY",
                "MATIC": "MATIC-AMOY",
                "polygon": "MATIC-AMOY",
                "OPTIMISM": "OP-SEPOLIA",
                "OP": "OP-SEPOLIA",
                "optimism": "OP-SEPOLIA"
            }
        else:
            # 프로덕션 환경에서는 메인넷 사용
            blockchain_mapping = {
                "ETH": "ETH",
                "ETH-SEPOLIA": "ETH-SEPOLIA", 
                "ethereum": "ETH",
                "BASE": "BASE",
                "base": "BASE",
                "ARBITRUM": "ARB",
                "ARB": "ARB",
                "arbitrum": "ARB",
                "AVALANCHE": "AVAX",
                "AVAX": "AVAX",
                "avalanche": "AVAX",
                "POLYGON": "MATIC",
                "MATIC": "MATIC",
                "polygon": "MATIC",
                "OPTIMISM": "OP",
                "OP": "OP",
                "optimism": "OP"
            }
        
        circle_blockchain = blockchain_mapping.get(blockchain, "ETH-SEPOLIA")
        print(f"🔄 지갑 생성: {blockchain} → {circle_blockchain}, walletSetId={wallet_set_id}")
        
        # Entity Secret Ciphertext 가져오기 또는 생성
        entity_secret_ciphertext = await self.get_or_create_entity_secret_ciphertext()
        
        data = {
            "idempotencyKey": str(uuid.uuid4()),
            "accountType": "SCA",  # Smart Contract Account (Developer-Controlled)
            "blockchains": [circle_blockchain],
            "count": count,
            "walletSetId": wallet_set_id,
            "entitySecretCiphertext": entity_secret_ciphertext
        }
        
        print(f"🌐 Circle API 지갑 생성 요청: {data}")
        return await self._make_request("POST", "/v1/w3s/developer/wallets", data)
    
    async def get_wallet_balance(self, wallet_id: str) -> Dict[str, Any]:
        """지갑 잔액 조회 (실제 Circle API 호출)"""
        try:
            print(f"🔍 Circle API 지갑 잔액 조회: {wallet_id}")
            response = await self._make_request("GET", f"/v1/w3s/wallets/{wallet_id}/balances")
            print(f"✅ Circle API 잔액 응답: {response}")
            return response
        except Exception as e:
            print(f"❌ Circle API 잔액 조회 실패: {e}")
            # API 호출 실패시 기본값 반환
            return {
                "data": {
                    "tokenBalances": [{
                        "token": {"symbol": "USDC"},
                        "amount": "0.000000"
                    }]
                }
            }

    async def get_wallet_transactions(self, wallet_id: str) -> Dict[str, Any]:
        """지갑 거래 내역 조회 (실제 Circle API 호출)"""
        try:
            print(f"🔍 Circle API 지갑 거래 내역 조회: {wallet_id}")
            # Circle API의 올바른 엔드포인트 사용
            response = await self._make_request("GET", "/v1/w3s/transactions", params={"walletIds": wallet_id})
            print(f"✅ Circle API 거래 내역 응답: {response}")
            
            # 응답에서 해당 지갑의 거래만 필터링
            if "data" in response and "transactions" in response["data"]:
                wallet_transactions = [
                    tx for tx in response["data"]["transactions"]
                    if tx.get("walletId") == wallet_id
                ]
                return {
                    "data": {
                        "transactions": wallet_transactions
                    }
                }
            
            return response
        except Exception as e:
            print(f"❌ Circle API 거래 내역 조회 실패: {e}")
            # API 호출 실패시 기본값 반환
            return {
                "data": {
                    "transactions": []
                }
            }

class CircleCCTPService(CircleAPIClient):
    """Circle Cross-Chain Transfer Protocol 서비스"""
    
    def _get_usdc_token_id(self, chain: str) -> str:
        """체인별 USDC 토큰 ID 반환 (Circle 공식 문서 기준)"""
        
        # 🧪 테스트 환경 (Sandbox) - Sepolia/Testnet
        testnet_token_mapping = {
            "ethereum": "5797fbd6-3795-519d-84ca-ec4c5f80c3b1",  # ETH-SEPOLIA USDC
            "base": "bdf128b4-827b-5267-8f9e-243694989b5f",     # BASE-SEPOLIA USDC (수정됨)
            "arbitrum": "4b8daacc-5f47-5909-a3ba-30d171ebad98",  # ARB-SEPOLIA USDC
            "avalanche": "ff47a560-9795-5b7c-adfc-8f47dad9e06a", # AVAX-FUJI USDC
            "polygon": "36b6931a-873a-56a8-8a27-b706b17104ee",   # MATIC-AMOY USDC
            "solana": "8fb3cadb-0ef4-573d-8fcd-e194f961c728"     # SOL-DEVNET USDC
        }
        
        # 🚀 운영 환경 (Production) - Mainnet
        mainnet_token_mapping = {
            "ethereum": "b037d751-fb22-5f0d-bae6-47373e7ae3e3",  # ETH Mainnet USDC
            "base": "915ce944-32df-5df5-a6b1-daa9b5069f96",     # BASE Mainnet USDC
            "arbitrum": "c87ffcb4-e2cf-5e67-84c6-388c965d2a66",  # ARB Mainnet USDC
            "avalanche": "7efdfdbf-1799-5089-a588-31beb97ba755", # AVAX Mainnet USDC
            "polygon": "db6905b9-8bcd-5537-8b08-f5548bdf7925",   # MATIC Mainnet USDC
            "solana": "33ca4ef6-2500-5d79-82bf-e3036139cc29"     # SOL Mainnet USDC
        }
        
        # 환경에 따라 적절한 매핑 선택 (기본값: 테스트 환경)
        current_mapping = testnet_token_mapping
        
        # 운영 환경 감지 (환경변수로 제어 가능)
        if hasattr(self, 'settings') and hasattr(self.settings, 'environment'):
            if self.settings.environment == 'production':
                current_mapping = mainnet_token_mapping
                print(f"🚀 운영 환경 Token ID 사용: {chain}")
            else:
                print(f"🧪 테스트 환경 Token ID 사용: {chain}")
        
        return current_mapping.get(chain.lower(), current_mapping["ethereum"])
    
    def _extract_error_code(self, error_str: str) -> str:
        """오류 문자열에서 HTTP 상태 코드 추출"""
        import re
        # HTTP 상태 코드 패턴 매칭 (예: 404, 401, 500 등)
        status_match = re.search(r'(\d{3})', error_str)
        if status_match:
            return status_match.group(1)
        return "UNKNOWN"
    
    def _get_error_suggestions(self, error_str: str) -> List[str]:
        """오류 코드에 따른 해결 제안사항 반환"""
        suggestions = []
        
        if "404" in error_str:
            suggestions.extend([
                "Circle API 엔드포인트 경로를 확인하세요",
                "토큰 ID가 올바른지 확인하세요",
                "지갑 ID가 유효한지 확인하세요"
            ])
        elif "401" in error_str:
            suggestions.extend([
                "Circle API 키가 유효한지 확인하세요",
                "API 키가 만료되지 않았는지 확인하세요",
                "Sandbox/Production 환경 설정을 확인하세요"
            ])
        elif "400" in error_str:
            suggestions.extend([
                "요청 파라미터가 올바른지 확인하세요",
                "Entity Secret이 올바르게 암호화되었는지 확인하세요",
                "송금 금액이 최소/최대 제한을 벗어나지 않았는지 확인하세요"
            ])
        elif "403" in error_str:
            suggestions.extend([
                "Circle 개발자 계정 권한을 확인하세요",
                "API 키에 적절한 권한이 부여되었는지 확인하세요"
            ])
        else:
            suggestions.append("Circle 개발자 콘솔에서 API 상태를 확인하세요")
        
        return suggestions
    
    async def create_cross_chain_transfer(
        self,
        source_wallet_id: str,
        amount: str,
        source_chain: str,
        target_chain: str,
        target_address: str,
        use_fast_transfer: bool = False
    ) -> Dict[str, Any]:
        """CCTP V2를 통한 크로스체인 USDC 전송"""
        # Circle Developer Controlled Wallets API 구조 (공식 문서 기준)
        data = {
            "idempotencyKey": str(uuid.uuid4()),  # UUID v4 (중복 처리 방지)
            "walletId": source_wallet_id,         # 보내는 지갑의 ID
            "destinationAddress": target_address,  # 받는 블록체인 주소
            "tokenId": self._get_usdc_token_id(source_chain),  # 소스 체인의 USDC 토큰 ID
            "amounts": [amount],                  # 송금 금액 (배열 형태)
            "feeLevel": "MEDIUM",                # LOW, MEDIUM, HIGH 중 선택
            "nftTokenIds": [],                   # NFT 토큰 ID (빈 배열로 설정)
        }
        
        # Fast Transfer 옵션 추가
        if use_fast_transfer:
            data["minFinalityThreshold"] = 1000  # Fast Transfer - 1000 블록 확인
            print("⚡ Fast Transfer 모드 활성화 - 15-45초 내 완료 예상")
        
        print(f"🔄 크로스체인 전송: {source_chain.upper()} → {target_chain.upper()}")
        print(f"💰 송금 금액: {amount} USDC")
        
        # Entity Secret을 매번 새로 암호화 (사용자 제시 방식 적용)
        if self.settings.circle_entity_secret:
            # 실시간 암호화를 통한 새로운 entitySecretCiphertext 생성
            entity_secret_ciphertext = await self._encrypt_entity_secret(self.settings.circle_entity_secret)
            # 사용자 제시 방식: 반드시 포함!
            data["entitySecretCiphertext"] = entity_secret_ciphertext
            print("🔑 Entity Secret을 실시간 암호화하여 새로운 Ciphertext 생성 완료")
        else:
            print("❌ CIRCLE_ENTITY_SECRET 환경변수가 설정되지 않음")
            raise Exception("Circle Entity Secret이 설정되지 않았습니다. .env 파일을 확인하세요.")
        
        print(f"🌐 Circle API 크로스체인 전송 요청: {data}")
        
        try:
            # Circle Developer Controlled Wallets API - CCTP 엔드포인트 (정확한 엔드포인트)
            response = await self._make_request(
                "POST", 
                "/v1/w3s/developer/transactions/transfer", 
                data
            )
            print(f"✅ Circle CCTP V2 전송 응답: {response}")
            return response
            
        except Exception as api_error:
            print(f"⚠️ Circle CCTP API 호출 실패: {str(api_error)}")
            print(f"🔍 API 요청 상세 정보:")
            print(f"   URL: {self.base_url}/v1/w3s/developer/transactions/transfer")
            print(f"   Headers: {self.headers}")
            print(f"   Data: {data}")
            
            # API 호출 실패 시 상세 정보 로깅
            error_str = str(api_error)
            if "401" in error_str:
                print("❌ API 키 인증 실패 - Circle 개발자 콘솔에서 API 키 확인 필요")
            elif "400" in error_str:
                print("❌ 요청 파라미터 오류 - walletId, entitySecretCiphertext 확인 필요")
                print("💡 확인사항:")
                print(f"   - walletId '{data['walletId']}'가 실제 Circle Developer Wallet인가?")
                print(f"   - entitySecretCiphertext가 올바른 암호화 형식인가?")
            elif "403" in error_str:
                print("❌ 권한 없음 - Circle 개발자 계정 설정 확인 필요")
            elif "404" in error_str:
                print("❌ 엔드포인트 없음 - API 경로 확인 필요")
            else:
                print(f"❌ 기타 오류: {error_str}")
            
            # API 실패 시 상세 오류 정보와 함께 예외 발생
            error_detail = {
                "error_type": "CCTP_API_FAILED",
                "error_code": self._extract_error_code(error_str),
                "error_message": str(api_error),
                "request_details": {
                    "source_chain": source_chain,
                    "target_chain": target_chain,
                    "amount": amount,
                    "wallet_id": source_wallet_id,
                    "target_address": target_address
                },
                "suggestions": self._get_error_suggestions(error_str)
            }
            
            print(f"❌ CCTP API 실패 - 상세 오류: {error_detail}")
            raise Exception(f"CCTP API 호출 실패: {str(api_error)}")
    
    async def get_transfer_status(self, transfer_id: str) -> Dict[str, Any]:
        """전송 상태 조회"""
        try:
            return await self._make_request("GET", f"/v1/transfers/{transfer_id}")
        except Exception as e:
            print(f"❌ 전송 상태 조회 실패: {str(e)}")
            raise Exception(f"전송 상태 조회 실패: {str(e)}")

class CirclePaymasterService(CircleAPIClient):
    """Circle Paymaster 서비스"""
    
    async def create_user_operation(
        self,
        wallet_address: str,
        target_address: str,
        amount: str,
        chain_id: int
    ) -> Dict[str, Any]:
        """User Operation 생성 (ERC-4337)"""
        data = {
            "idempotencyKey": str(uuid.uuid4()),
            "userOperation": {
                "sender": wallet_address,
                "callData": f"0x{uuid.uuid4().hex}",  # 실제로는 스마트 컨트랙트 호출 데이터
                "callGasLimit": "100000",
                "verificationGasLimit": "100000",
                "preVerificationGas": "21000"
            },
            "chainId": chain_id,
            "sponsorshipPolicy": {
                "type": "developer_sponsored"
            }
        }
        
        try:
            return await self._make_request("POST", "/v1/w3s/userOperations", data)
        except Exception as e:
            print(f"❌ User Operation 생성 실패: {str(e)}")
            raise Exception(f"User Operation 생성 실패: {str(e)}")

class CircleComplianceService(CircleAPIClient):
    """Circle Compliance Engine 서비스"""
    
    async def screen_transaction(
        self,
        from_address: str,
        to_address: str,
        amount: str,
        currency: str = "USDC"
    ) -> Dict[str, Any]:
        """거래 스크리닝"""
        data = {
            "idempotencyKey": str(uuid.uuid4()),
            "transaction": {
                "fromAddress": from_address,
                "toAddress": to_address,
                "amount": amount,
                "currency": currency,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        try:
            return await self._make_request("POST", "/v1/compliance/screen", data)
        except Exception as e:
            print(f"❌ 거래 스크리닝 실패: {str(e)}")
            raise Exception(f"거래 스크리닝 실패: {str(e)}")

class CircleMintService(CircleAPIClient):
    """Circle Mint 서비스 - USDC 충전 및 출금"""
    
    async def create_wire_bank_account(
        self,
        billing_details: Dict[str, Any],
        bank_address: Dict[str, Any],
        account_number: str,
        routing_number: str,
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """은행 계좌 연결"""
        data = {
            "billingDetails": billing_details,
            "bankAddress": bank_address,
            "accountNumber": account_number,
            "routingNumber": routing_number,
            "idempotencyKey": idempotency_key or str(uuid.uuid4())
        }
        
        try:
            return await self._make_request("POST", "/v1/businessAccount/banks/wires", data)
        except Exception as e:
            print(f"❌ 은행 계좌 연결 실패: {str(e)}")
            raise Exception(f"은행 계좌 연결 실패: {str(e)}")
    
    async def get_wire_instructions(
        self,
        bank_account_id: str,
        currency: str = "USD"
    ) -> Dict[str, Any]:
        """은행 송금 지침 조회"""
        params = {"currency": currency}
        
        try:
            return await self._make_request("GET", f"/v1/businessAccount/banks/wires/{bank_account_id}/instructions", params=params)
        except Exception as e:
            print(f"❌ 은행 송금 지침 조회 실패: {str(e)}")
            raise Exception(f"은행 송금 지침 조회 실패: {str(e)}")
    
    async def create_deposit_address(
        self,
        currency: str = "USD",
        chain: str = "ETH"
    ) -> Dict[str, Any]:
        """블록체인 입금 주소 생성"""
        data = {
            "currency": currency,
            "chain": chain
        }
        
        try:
            return await self._make_request("POST", "/v1/businessAccount/wallets/addresses/deposit", data)
        except Exception as e:
            print(f"❌ 블록체인 입금 주소 생성 실패: {str(e)}")
            raise Exception(f"블록체인 입금 주소 생성 실패: {str(e)}")
    
    async def list_deposit_addresses(self) -> Dict[str, Any]:
        """모든 입금 주소 조회"""
        try:
            return await self._make_request("GET", "/v1/businessAccount/wallets/addresses/deposit")
        except Exception as e:
            print(f"❌ 입금 주소 목록 조회 실패: {str(e)}")
            raise Exception(f"입금 주소 목록 조회 실패: {str(e)}")
    
    async def get_account_balances(self) -> Dict[str, Any]:
        """계정 잔액 조회"""
        try:
            return await self._make_request("GET", "/v1/businessAccount/balances")
        except Exception as e:
            print(f"❌ 계정 잔액 조회 실패: {str(e)}")
            raise Exception(f"계정 잔액 조회 실패: {str(e)}")
    
    async def create_wire_deposit(
        self,
        amount: str,
        currency: str,
        beneficiary_account_number: str
    ) -> Dict[str, Any]:
        """은행 송금 생성"""
        data = {
            "amount": {
                "amount": amount,
                "currency": currency
            },
            "beneficiaryBank": {
                "accountNumber": beneficiary_account_number
            }
        }
        
        try:
            return await self._make_request("POST", "/v1/businessAccount/payments/wire", data)
        except Exception as e:
            print(f"❌ 은행 송금 생성 실패: {str(e)}")
            raise Exception(f"은행 송금 생성 실패: {str(e)}")
    
    async def create_payout(
        self,
        destination_id: str,
        amount: str,
        currency: str = "USD",
        idempotency_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """외부 송금 (출금)"""
        data = {
            "destination": {
                "type": "wire",
                "id": destination_id
            },
            "amount": {
                "currency": currency,
                "amount": amount
            },
            "idempotencyKey": idempotency_key or str(uuid.uuid4())
        }
        
        try:
            return await self._make_request("POST", "/v1/businessAccount/payouts", data)
        except Exception as e:
            print(f"❌ 외부 송금 생성 실패: {str(e)}")
            raise Exception(f"외부 송금 생성 실패: {str(e)}")
    
    async def get_payout_status(self, payout_id: str) -> Dict[str, Any]:
        """송금 상태 조회"""
        try:
            return await self._make_request("GET", f"/v1/businessAccount/payouts/{payout_id}")
        except Exception as e:
            print(f"❌ 송금 상태 조회 실패: {str(e)}")
            raise Exception(f"송금 상태 조회 실패: {str(e)}")

# 서비스 인스턴스들
circle_wallet_service = CircleWalletService()
circle_cctp_service = CircleCCTPService()
circle_paymaster_service = CirclePaymasterService()
circle_compliance_service = CircleComplianceService() 
circle_mint_service = CircleMintService() 