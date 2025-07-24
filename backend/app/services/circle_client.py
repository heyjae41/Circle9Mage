"""
Circle API 클라이언트 서비스
"""

import httpx
import json
from typing import Dict, Any, Optional, List
from app.core.config import get_settings
import asyncio
import uuid
from datetime import datetime

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
        
        async with httpx.AsyncClient() as client:
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
    
    async def create_wallet(self, user_id: str, blockchain: str = "ETH") -> Dict[str, Any]:
        """MPC 지갑 생성"""
        data = {
            "idempotencyKey": str(uuid.uuid4()),
            "count": 1,
            "blockchains": [blockchain],
            "entitySecretCipherText": "",  # 실제 구현에서는 암호화 필요
            "metadata": {
                "userId": user_id,
                "createdAt": datetime.utcnow().isoformat()
            }
        }
        
        # 개발 환경에서는 mock 응답 반환
        if self.settings.environment == "development":
            return {
                "data": {
                    "wallets": [{
                        "id": f"wallet_{uuid.uuid4()}",
                        "address": f"0x{uuid.uuid4().hex}",
                        "blockchain": blockchain,
                        "state": "LIVE"
                    }]
                }
            }
        
        return await self._make_request("POST", "/v1/w3s/wallets", data)
    
    async def get_wallet_balance(self, wallet_id: str) -> Dict[str, Any]:
        """지갑 잔액 조회"""
        # 개발 환경에서는 mock 응답 반환
        if self.settings.environment == "development":
            return {
                "data": {
                    "tokenBalances": [{
                        "token": {"symbol": "USDC"},
                        "amount": "1000.000000"
                    }]
                }
            }
        
        return await self._make_request("GET", f"/v1/w3s/wallets/{wallet_id}/balances")

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

# 서비스 인스턴스들
circle_wallet_service = CircleWalletService()
circle_cctp_service = CircleCCTPService()
circle_paymaster_service = CirclePaymasterService()
circle_compliance_service = CircleComplianceService() 