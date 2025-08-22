#!/usr/bin/env python3
"""
API 호환성 종합 테스트 스크립트
React Native 프론트엔드와 FastAPI 백엔드 간의 camelCase 네이밍 컨벤션 호환성을 검증합니다.
"""

import asyncio
import httpx
import json
from typing import Dict, Any, List, Optional
import sys
import os

# API 기본 URL
API_BASE_URL = "http://localhost:8000/api/v1"

class APICompatibilityTester:
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url
        self.access_token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.wallet_id: Optional[str] = None
        
    async def make_request(self, method: str, endpoint: str, data: Dict[str, Any] = None, headers: Dict[str, str] = None) -> Dict[str, Any]:
        """HTTP 요청 수행"""
        url = f"{self.base_url}{endpoint}"
        default_headers = {"Content-Type": "application/json"}
        
        if self.access_token:
            default_headers["Authorization"] = f"Bearer {self.access_token}"
            
        if headers:
            default_headers.update(headers)
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                if method.upper() == "GET":
                    response = await client.get(url, headers=default_headers)
                elif method.upper() == "POST":
                    response = await client.post(url, json=data, headers=default_headers)
                elif method.upper() == "PUT":
                    response = await client.put(url, json=data, headers=default_headers)
                else:
                    raise ValueError(f"Unsupported method: {method}")
                
                return {
                    "status_code": response.status_code,
                    "data": response.json() if response.text else {},
                    "success": 200 <= response.status_code < 300
                }
            except Exception as e:
                return {
                    "status_code": 0,
                    "data": {"error": str(e)},
                    "success": False
                }

    def check_camel_case_response(self, data: Dict[str, Any], expected_fields: List[str]) -> Dict[str, bool]:
        """응답이 camelCase 필드를 포함하는지 확인"""
        results = {}
        
        for field in expected_fields:
            if isinstance(data, dict):
                results[field] = field in data
            else:
                results[field] = False
                
        return results

    async def test_auth_apis(self) -> Dict[str, Any]:
        """인증 관련 API 테스트"""
        print("🔐 인증 API 테스트 시작...")
        results = {}
        
        # 1. 로그인 테스트 (기존 사용자)
        login_data = {
            "email": "test@example.com",
            "pin": "123456"
        }
        
        response = await self.make_request("POST", "/auth/login", login_data)
        results["login"] = {
            "success": response["success"],
            "status_code": response["status_code"],
            "camel_case_fields": {}
        }
        
        if response["success"]:
            # camelCase 필드 확인
            expected_fields = ["accessToken", "refreshToken", "tokenType", "expiresIn"]
            results["login"]["camel_case_fields"] = self.check_camel_case_response(
                response["data"], expected_fields
            )
            
            # 사용자 정보의 camelCase 필드 확인
            if "user" in response["data"]:
                user_fields = ["firstName", "lastName", "countryCode", "isVerified", "kycStatus"]
                results["login"]["user_camel_case_fields"] = self.check_camel_case_response(
                    response["data"]["user"], user_fields
                )
            
            # 액세스 토큰 저장
            self.access_token = response["data"].get("accessToken")
            if "user" in response["data"]:
                self.user_id = str(response["data"]["user"].get("id"))
        
        return results

    async def test_user_apis(self) -> Dict[str, Any]:
        """사용자 관련 API 테스트"""
        print("👤 사용자 API 테스트 시작...")
        results = {}
        
        # 1. 프로필 조회 테스트
        response = await self.make_request("GET", "/users/profile")
        results["profile"] = {
            "success": response["success"],
            "status_code": response["status_code"],
            "camel_case_fields": {}
        }
        
        if response["success"]:
            expected_fields = ["firstName", "lastName", "countryCode", "preferredCurrency", 
                             "isVerified", "kycStatus", "kycLevel", "createdAt", "lastLoginAt"]
            results["profile"]["camel_case_fields"] = self.check_camel_case_response(
                response["data"], expected_fields
            )
        
        return results

    async def test_wallet_apis(self) -> Dict[str, Any]:
        """지갑 관련 API 테스트"""
        print("💰 지갑 API 테스트 시작...")
        results = {}
        
        # 1. 지원 체인 목록 조회
        response = await self.make_request("GET", "/wallets/supported-chains")
        results["supported_chains"] = {
            "success": response["success"],
            "status_code": response["status_code"],
            "camel_case_fields": {}
        }
        
        if response["success"]:
            expected_fields = ["supportedChains"]
            results["supported_chains"]["camel_case_fields"] = self.check_camel_case_response(
                response["data"], expected_fields
            )
        
        # 2. 사용자 지갑 목록 조회
        if self.user_id:
            response = await self.make_request("GET", f"/wallets/user/{self.user_id}/wallets")
            results["user_wallets"] = {
                "success": response["success"],
                "status_code": response["status_code"],
                "data": response["data"]
            }
            
            # 첫 번째 지갑 ID 저장
            if response["success"] and response["data"]:
                wallets = response["data"]
                if isinstance(wallets, list) and len(wallets) > 0:
                    self.wallet_id = wallets[0].get("circle_wallet_id") or wallets[0].get("walletId")
        
        return results

    async def test_payment_apis(self) -> Dict[str, Any]:
        """결제 관련 API 테스트"""
        print("💳 결제 API 테스트 시작...")
        results = {}
        
        # 1. 크로스체인 전송 테스트 (실제 전송 없이 요청 형식만 확인)
        if self.wallet_id:
            transfer_data = {
                "sourceWalletId": self.wallet_id,
                "targetAddress": "0x1234567890123456789012345678901234567890",
                "amount": 1.0,
                "sourceChain": "ETH-SEPOLIA",
                "targetChain": "BASE-SEPOLIA",
                "notes": "테스트 전송"
            }
            
            response = await self.make_request("POST", "/payments/transfer/cross-chain", transfer_data)
            results["cross_chain_transfer"] = {
                "success": response["success"],
                "status_code": response["status_code"],
                "data": response["data"]
            }
            
            # 응답에서 camelCase 필드 확인 (성공한 경우)
            if response["success"]:
                expected_fields = ["paymentId", "transactionHash", "estimatedCompletionTime"]
                results["cross_chain_transfer"]["camel_case_fields"] = self.check_camel_case_response(
                    response["data"], expected_fields
                )
        
        return results

    async def test_admin_apis(self) -> Dict[str, Any]:
        """관리자 API 테스트"""
        print("⚙️ 관리자 API 테스트 시작...")
        results = {}
        
        # 1. 시스템 상태 조회
        response = await self.make_request("GET", "/admin/system/status")
        results["system_status"] = {
            "success": response["success"],
            "status_code": response["status_code"],
            "camel_case_fields": {}
        }
        
        if response["success"]:
            expected_fields = ["performanceMetrics"]
            results["system_status"]["camel_case_fields"] = self.check_camel_case_response(
                response["data"], expected_fields
            )
        
        return results

    def print_test_results(self, results: Dict[str, Any]):
        """테스트 결과 출력"""
        print("\n" + "="*60)
        print("🧪 API 호환성 테스트 결과")
        print("="*60)
        
        total_tests = 0
        passed_tests = 0
        
        for category, tests in results.items():
            print(f"\n📋 {category.upper()} 카테고리:")
            
            for test_name, test_result in tests.items():
                total_tests += 1
                
                if test_result.get("success", False):
                    passed_tests += 1
                    status = "✅ PASS"
                else:
                    status = "❌ FAIL"
                
                print(f"  {status} {test_name}: Status {test_result.get('status_code', 'N/A')}")
                
                # camelCase 필드 확인 결과
                if "camel_case_fields" in test_result:
                    camel_results = test_result["camel_case_fields"]
                    if camel_results:
                        print(f"    📝 camelCase 필드:")
                        for field, found in camel_results.items():
                            field_status = "✅" if found else "❌"
                            print(f"      {field_status} {field}")
                
                # 사용자 정보 camelCase 필드 (로그인 전용)
                if "user_camel_case_fields" in test_result:
                    user_results = test_result["user_camel_case_fields"]
                    if user_results:
                        print(f"    👤 User camelCase 필드:")
                        for field, found in user_results.items():
                            field_status = "✅" if found else "❌"
                            print(f"      {field_status} {field}")
                
                # 에러 정보 출력 (실패한 경우)
                if not test_result.get("success", False) and "data" in test_result:
                    error_data = test_result["data"]
                    if "error" in error_data:
                        print(f"    ⚠️ Error: {error_data['error']}")
                    elif "detail" in error_data:
                        print(f"    ⚠️ Detail: {error_data['detail']}")
        
        print(f"\n📊 전체 테스트 결과: {passed_tests}/{total_tests} 통과")
        
        if passed_tests == total_tests:
            print("🎉 모든 테스트가 성공했습니다!")
            return True
        else:
            print("⚠️ 일부 테스트가 실패했습니다.")
            return False

    async def run_all_tests(self):
        """모든 테스트 실행"""
        print("🚀 API 호환성 종합 테스트 시작...")
        
        all_results = {}
        
        try:
            # 인증 테스트
            all_results["auth"] = await self.test_auth_apis()
            
            # 인증 성공한 경우에만 다른 테스트 실행
            if self.access_token:
                all_results["user"] = await self.test_user_apis()
                all_results["wallet"] = await self.test_wallet_apis()
                all_results["payment"] = await self.test_payment_apis()
            
            # 관리자 API (인증 불필요)
            all_results["admin"] = await self.test_admin_apis()
            
            # 결과 출력
            success = self.print_test_results(all_results)
            
            return success
            
        except Exception as e:
            print(f"❌ 테스트 실행 중 오류 발생: {e}")
            return False

async def main():
    """메인 실행 함수"""
    tester = APICompatibilityTester()
    success = await tester.run_all_tests()
    
    # 종료 코드 설정
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())
