"""
Circle API 클라이언트 서비스
"""

import httpx
import json
from typing import Dict, Any, Optional, List
from app.core.config import get_settings
import asyncio
import uuid
import re
from datetime import datetime
from web3 import Web3

class CircleAPIClient:
    """Circle API 클라이언트"""
    
    def __init__(self, use_sandbox: bool = True):
        self.settings = get_settings()
        self.use_sandbox = use_sandbox
        self.base_url = self.settings.circle_sandbox_url if use_sandbox else self.settings.circle_base_url
        self.api_key = self.settings.circle_sandbox_api_key if use_sandbox else self.settings.circle_api_key
        
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
        """HTTP 요청 실행"""
        url = f"{self.base_url}{endpoint}"
        
        # 개발 환경에서는 SSL 검증 비활성화
        verify_ssl = self.settings.environment == "production"
        
        async with httpx.AsyncClient(verify=verify_ssl) as client:
            response = await client.request(
                method=method,
                url=url,
                headers=self.headers,
                json=data,
                params=params,
                timeout=30.0
            )
            
            if response.status_code >= 400:
                raise Exception(f"Circle API Error: {response.status_code} - {response.text}")
            
            return response.json()

class CircleWalletService(CircleAPIClient):
    """Circle Wallet 서비스"""
    
    def __init__(self, use_sandbox: bool = None):
        # 환경에 따라 자동으로 sandbox 결정
        if use_sandbox is None:
            settings = get_settings()
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
    
    async def create_wallet_with_retry(self, user_id: str, blockchain: str = "ETH", retry_count: int = 0) -> Dict[str, Any]:
        """재시도 로직이 포함된 지갑 생성"""
        try:
            result = await self.create_wallet(user_id, blockchain)
            
            # 개발 환경이 아닌 경우 지갑 주소 검증
            if self.settings.environment != "development":
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
                return await self.create_wallet_with_retry(user_id, blockchain, retry_count + 1)
            else:
                raise Exception(f"지갑 생성 최종 실패 ({self.max_retries + 1}회 시도): {str(e)}")
    
    async def create_wallet(self, user_id: str, blockchain: str = "ETH-SEPOLIA") -> Dict[str, Any]:
        """MPC 지갑 생성"""
        # 블록체인 매핑 (백엔드 → Circle API)
        # 개발 환경에서는 모든 체인이 테스트넷을 사용
        if self.settings.environment == "development":
            blockchain_mapping = {
                "ETH": "ETH-SEPOLIA",
                "ETH-SEPOLIA": "ETH-SEPOLIA", 
                "ethereum": "ETH-SEPOLIA",
                "BASE": "BASE-SEPOLIA",
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
        print(f"🔄 지갑 생성: {blockchain} → {circle_blockchain}")
        
        data = {
            "idempotencyKey": str(uuid.uuid4()),
            "count": 1,
            "blockchains": [circle_blockchain],
            "entitySecretCipherText": "",  # 실제 구현에서는 암호화 필요
            "metadata": {
                "userId": user_id,
                "createdAt": datetime.utcnow().isoformat()
            }
        }
        
        # 개발 환경에서는 mock 응답 반환
        if self.settings.environment == "development":
            # 유효한 이더리움 주소 형식 생성
            import secrets
            random_address = "0x" + secrets.token_hex(20)  # 20바이트 = 40자리 hex
            
            return {
                "data": {
                    "wallets": [{
                        "id": f"wallet_{uuid.uuid4()}",
                        "address": random_address,
                        "blockchain": circle_blockchain,  # 매핑된 블록체인 사용
                        "state": "LIVE",
                        "entityId": f"entity_{uuid.uuid4()}",
                        "walletSetId": f"walletSet_{uuid.uuid4()}",
                        "custodyType": "DEVELOPER"
                    }]
                }
            }
        
        return await self._make_request("POST", "/v1/w3s/wallets", data)
    
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

class CircleCCTPService(CircleAPIClient):
    """Circle Cross-Chain Transfer Protocol 서비스"""
    
    async def create_cross_chain_transfer(
        self,
        source_wallet_id: str,
        amount: str,
        source_chain: str,
        target_chain: str,
        target_address: str
    ) -> Dict[str, Any]:
        """크로스체인 전송 생성"""
        data = {
            "idempotencyKey": str(uuid.uuid4()),
            "source": {
                "type": "wallet",
                "id": source_wallet_id
            },
            "destination": {
                "type": "address",
                "address": target_address,
                "chain": target_chain
            },
            "amount": {
                "amount": amount,
                "currency": "USD"
            },
            "fee": {
                "type": "level",
                "config": {
                    "feeLevel": "MEDIUM"
                }
            }
        }
        
        # 개발 환경에서는 mock 응답 반환
        if self.settings.environment == "development":
            return {
                "data": {
                    "id": f"transfer_{uuid.uuid4()}",
                    "status": "pending",
                    "estimatedTime": "8-20 seconds"
                }
            }
        
        return await self._make_request("POST", "/v1/transfers", data)
    
    async def get_transfer_status(self, transfer_id: str) -> Dict[str, Any]:
        """전송 상태 조회"""
        # 개발 환경에서는 mock 응답 반환
        if self.settings.environment == "development":
            return {
                "data": {
                    "id": transfer_id,
                    "status": "complete",
                    "transactionHash": f"0x{uuid.uuid4().hex}"
                }
            }
        
        return await self._make_request("GET", f"/v1/transfers/{transfer_id}")

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
        
        # 개발 환경에서는 mock 응답 반환
        if self.settings.environment == "development":
            return {
                "data": {
                    "userOperationHash": f"0x{uuid.uuid4().hex}",
                    "status": "confirmed"
                }
            }
        
        return await self._make_request("POST", "/v1/w3s/userOperations", data)

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
        
        # 개발 환경에서는 mock 응답 반환
        if self.settings.environment == "development":
            return {
                "data": {
                    "screeningResult": "approved",
                    "riskScore": 0.1,
                    "reasons": []
                }
            }
        
        return await self._make_request("POST", "/v1/compliance/screen", data)

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
        
        # 개발 환경에서는 mock 응답 반환
        if self.settings.environment == "development":
            return {
                "data": {
                    "id": str(uuid.uuid4()),
                    "status": "pending",
                    "description": f"MOCK BANK ****{account_number[-4:]}",
                    "trackingRef": f"CIR{uuid.uuid4().hex[:8].upper()}",
                    "fingerprint": str(uuid.uuid4()),
                    "virtualAccountEnabled": True,
                    "billingDetails": billing_details,
                    "bankAddress": bank_address,
                    "createDate": datetime.utcnow().isoformat(),
                    "updateDate": datetime.utcnow().isoformat()
                }
            }
        
        return await self._make_request("POST", "/v1/businessAccount/banks/wires", data)
    
    async def get_wire_instructions(
        self,
        bank_account_id: str,
        currency: str = "USD"
    ) -> Dict[str, Any]:
        """은행 송금 지침 조회"""
        params = {"currency": currency}
        
        # 개발 환경에서는 mock 응답 반환
        if self.settings.environment == "development":
            return {
                "data": {
                    "trackingRef": f"CIR{uuid.uuid4().hex[:8].upper()}",
                    "beneficiary": {
                        "name": "CIRCLE INTERNET FINANCIAL INC",
                        "address1": "1 MAIN STREET",
                        "address2": "SUITE 1"
                    },
                    "virtualAccountEnabled": True,
                    "beneficiaryBank": {
                        "name": "CIRCLE DEVELOPMENT BANK",
                        "address": "1 MONEY STREET",
                        "city": "NEW YORK",
                        "postalCode": "10001",
                        "country": "US",
                        "swiftCode": "CIRCDEV1",
                        "routingNumber": "999999999",
                        "accountNumber": f"12345{uuid.uuid4().hex[:8]}",
                        "currency": currency
                    }
                }
            }
        
        return await self._make_request("GET", f"/v1/businessAccount/banks/wires/{bank_account_id}/instructions", params=params)
    
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
        
        # 개발 환경에서는 mock 응답 반환
        if self.settings.environment == "development":
            # 유효한 이더리움 주소 생성
            mock_address = f"0x{uuid.uuid4().hex[:40]}"
            return {
                "data": {
                    "id": str(uuid.uuid4()),
                    "address": mock_address,
                    "currency": currency,
                    "chain": chain
                }
            }
        
        return await self._make_request("POST", "/v1/businessAccount/wallets/addresses/deposit", data)
    
    async def list_deposit_addresses(self) -> Dict[str, Any]:
        """모든 입금 주소 조회"""
        # 개발 환경에서는 mock 응답 반환
        if self.settings.environment == "development":
            chains = ["ETH", "BASE", "ARB", "MATIC", "AVAX"]
            addresses = []
            for chain in chains:
                addresses.append({
                    "id": str(uuid.uuid4()),
                    "address": f"0x{uuid.uuid4().hex[:40]}",
                    "currency": "USD",
                    "chain": chain
                })
            
            return {"data": addresses}
        
        return await self._make_request("GET", "/v1/businessAccount/wallets/addresses/deposit")
    
    async def get_account_balances(self) -> Dict[str, Any]:
        """계정 잔액 조회"""
        # 개발 환경에서는 mock 응답 반환
        if self.settings.environment == "development":
            return {
                "data": {
                    "available": [
                        {
                            "amount": "1000.00",
                            "currency": "USD"
                        }
                    ],
                    "unsettled": []
                }
            }
        
        return await self._make_request("GET", "/v1/businessAccount/balances")
    
    async def create_mock_wire_deposit(
        self,
        amount: str,
        currency: str,
        beneficiary_account_number: str
    ) -> Dict[str, Any]:
        """모의 은행 송금 (개발 환경용)"""
        data = {
            "amount": {
                "amount": amount,
                "currency": currency
            },
            "beneficiaryBank": {
                "accountNumber": beneficiary_account_number
            }
        }
        
        # 개발 환경에서만 사용 가능
        if self.settings.environment == "development":
            return {
                "data": {
                    "trackingRef": f"CIR{uuid.uuid4().hex[:8].upper()}",
                    "amount": {
                        "amount": amount,
                        "currency": currency
                    },
                    "beneficiaryBank": {
                        "accountNumber": beneficiary_account_number
                    },
                    "status": "pending"
                }
            }
        
        return await self._make_request("POST", "/v1/mocks/payments/wire", data)
    
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
        
        # 개발 환경에서는 mock 응답 반환
        if self.settings.environment == "development":
            return {
                "data": {
                    "id": str(uuid.uuid4()),
                    "amount": {
                        "amount": amount,
                        "currency": currency
                    },
                    "status": "pending",
                    "sourceWalletId": "1000000001",
                    "destination": {
                        "type": "wire",
                        "id": destination_id,
                        "name": "MOCK BANK ****0001"
                    },
                    "createDate": datetime.utcnow().isoformat(),
                    "updateDate": datetime.utcnow().isoformat()
                }
            }
        
        return await self._make_request("POST", "/v1/businessAccount/payouts", data)
    
    async def get_payout_status(self, payout_id: str) -> Dict[str, Any]:
        """송금 상태 조회"""
        # 개발 환경에서는 mock 응답 반환
        if self.settings.environment == "development":
            return {
                "data": {
                    "id": payout_id,
                    "status": "complete",
                    "updateDate": datetime.utcnow().isoformat()
                }
            }
        
        return await self._make_request("GET", f"/v1/businessAccount/payouts/{payout_id}")

# 서비스 인스턴스들
circle_wallet_service = CircleWalletService()
circle_cctp_service = CircleCCTPService()
circle_paymaster_service = CirclePaymasterService()
circle_compliance_service = CircleComplianceService()
circle_mint_service = CircleMintService() 