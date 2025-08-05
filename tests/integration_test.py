#!/usr/bin/env python3
"""
CirclePay Global 통합 테스트 스크립트 (수정됨)
전체 사용자 여정 테스트: 회원가입 → 로그인 → 지갑 생성 → KYC → 충전 → 결제
"""

import requests
import json
import time
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
import random

# 테스트 설정 (수정됨)
BASE_URL = "http://localhost:8000/api/v1"
# ✅ 수정: 테스트마다 고유한 이메일과 전화번호 생성
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@example.com"
TEST_PHONE = f"+82-10-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}"
TEST_PASSWORD = "TestPass123!"
TEST_PIN = "123456"

class CirclePayTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.access_token: Optional[str] = None
        self.user_id: Optional[int] = None
        self.wallet_id: Optional[str] = None
        self.results = []
        
    def log_test(self, test_name: str, success: bool, message: str, data: Any = None):
        """테스트 결과 로깅"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        self.results.append(result)
        
        status = "✅" if success else "❌"
        print(f"{status} {test_name}: {message}")
        if data and not success:
            print(f"   Details: {json.dumps(data, indent=2)}")
    
    def set_auth_header(self):
        """인증 헤더 설정"""
        if self.access_token:
            self.session.headers.update({
                "Authorization": f"Bearer {self.access_token}"
            })
    
    def test_1_health_check(self):
        """1. 서버 헬스 체크"""
        try:
            response = self.session.get(f"{self.base_url.replace('/api/v1', '')}/health")
            if response.status_code == 200:
                self.log_test("Health Check", True, "서버가 정상 작동 중입니다")
                return True
            else:
                self.log_test("Health Check", False, f"서버 응답 오류: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Health Check", False, f"서버 연결 실패: {str(e)}")
            return False
    
    def test_2_user_registration(self):
        """2. 사용자 회원가입"""
        try:
            user_data = {
                "email": TEST_EMAIL,
                "phone": TEST_PHONE,
                "first_name": "CirclePay",
                "last_name": "Tester",
                "country_code": "KR",
                "pin": TEST_PIN,
                "preferred_currency": "USDC"
            }
            
            response = self.session.post(f"{self.base_url}/auth/register", json=user_data)
            
            if response.status_code == 200:
                data = response.json()
                # ✅ 수정: 올바른 JSON 경로로 user_id 추출
                self.user_id = data.get("user", {}).get("id")
                self.log_test("사용자 회원가입", True, f"회원가입 성공 - User ID: {self.user_id}", data)
                return True
            else:
                self.log_test("사용자 회원가입", False, f"회원가입 실패: {response.status_code}", response.json())
                return False
        except Exception as e:
            self.log_test("사용자 회원가입", False, f"회원가입 오류: {str(e)}")
            return False
    
    def test_3_user_login(self):
        """3. 사용자 로그인"""
        try:
            login_data = {
                "email": TEST_EMAIL,
                "pin": TEST_PIN
            }
            
            response = self.session.post(f"{self.base_url}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access_token")
                self.set_auth_header()
                self.log_test("사용자 로그인", True, "로그인 성공", {"token_type": data.get("token_type")})
                return True
            else:
                self.log_test("사용자 로그인", False, f"로그인 실패: {response.status_code}", response.json())
                return False
        except Exception as e:
            self.log_test("사용자 로그인", False, f"로그인 오류: {str(e)}")
            return False
    
    def test_4_get_user_profile(self):
        """4. 사용자 프로필 조회"""
        try:
            response = self.session.get(f"{self.base_url}/users/profile")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("프로필 조회", True, f"프로필 조회 성공 - KYC 상태: {data.get('kyc_status')}", data)
                return True
            else:
                self.log_test("프로필 조회", False, f"프로필 조회 실패: {response.status_code}", response.json())
                return False
        except Exception as e:
            self.log_test("프로필 조회", False, f"프로필 조회 오류: {str(e)}")
            return False
    
    def test_5_get_wallets(self):
        """5. 사용자 지갑 조회 및 자동 생성"""
        try:
            # 1단계: 기존 지갑 조회
            response = self.session.get(f"{self.base_url}/wallets/user/{self.user_id}/wallets")
            
            if response.status_code == 200:
                data = response.json()
                wallets = data.get("wallets", [])
                
                if wallets:
                    # 기존 지갑이 있으면 사용
                    self.wallet_id = wallets[0].get("wallet_id")
                    self.log_test("지갑 조회", True, f"지갑 조회 성공 - {len(wallets)}개 지갑 발견", 
                                {"wallet_count": len(wallets), "primary_wallet": self.wallet_id})
                    return True
                else:
                    # 지갑이 없으면 자동 생성
                    self.log_test("지갑 조회", True, "지갑이 없어서 자동 생성 시작", data)
                    
                    # 2단계: 지갑 생성
                    wallet_data = {
                        "user_id": str(self.user_id),
                        "blockchain": "ethereum"
                    }
                    
                    create_response = self.session.post(
                        f"{self.base_url}/wallets/create",
                        json=wallet_data
                    )
                    
                    if create_response.status_code == 200:
                        wallet_result = create_response.json()
                        self.wallet_id = wallet_result.get("wallet_id")
                        self.log_test("지갑 생성", True, f"지갑 자동 생성 성공 - Wallet ID: {self.wallet_id}", wallet_result)
                        return True
                    else:
                        self.log_test("지갑 생성", False, f"지갑 생성 실패: {create_response.status_code}", create_response.json())
                        return False

            else:
                self.log_test("지갑 조회", False, f"지갑 조회 실패: {response.status_code}", response.json())
                return False
        except Exception as e:
            self.log_test("지갑 조회", False, f"지갑 조회/생성 오류: {str(e)}")
            return False
    
    def test_6_kyc_submission(self):
        """6. KYC 문서 제출"""
        try:
            import json
            
            kyc_data = {
                "document_type": "national_id",
                "document_number": "123456-1234567",
                "full_name": "CirclePay Tester",
                "date_of_birth": "1990-01-01",
                "nationality": "KR",
                "gender": "남성",
                "address_line1": "서울시 강남구 테헤란로 123",
                "city": "서울",
                "postal_code": "12345",
                "country": "KR",
                "occupation": "소프트웨어 엔지니어",
                "employer": "CirclePay",
                "income_range": "50000-100000",
                "source_of_funds": "salary"
            }
            
            # ✅ 수정: 올바른 multipart/form-data 요청
            data = {"kyc_data": json.dumps(kyc_data)}
            files = {"document_file": (None, None)}  # 빈 파일 (Optional)
            
            response = self.session.post(f"{self.base_url}/users/kyc/submit", data=data, files=files)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("KYC 문서 제출", True, 
                            f"KYC 제출 성공 - 상태: {data.get('status')}, 위험점수: {data.get('risk_score')}", data)
                return True
            else:
                self.log_test("KYC 문서 제출", False, f"KYC 제출 실패: {response.status_code}", response.json())
                return False
        except Exception as e:
            self.log_test("KYC 문서 제출", False, f"KYC 제출 오류: {str(e)}")
            return False
    
    def test_7_kyc_status_check(self):
        """7. KYC 상태 확인"""
        try:
            response = self.session.get(f"{self.base_url}/users/kyc/status")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("KYC 상태 확인", True, 
                            f"KYC 상태: {data.get('kyc_status')}, 레벨: {data.get('kyc_level')}", data)
                return True
            else:
                self.log_test("KYC 상태 확인", False, f"KYC 상태 확인 실패: {response.status_code}", response.json())
                return False
        except Exception as e:
            self.log_test("KYC 상태 확인", False, f"KYC 상태 확인 오류: {str(e)}")
            return False
    
    def test_8_wire_deposit(self):
        """8. 은행 송금 충전 테스트"""
        try:
            if not self.wallet_id:
                self.log_test("은행 송금 충전", False, "지갑 ID가 없습니다")
                return False
            
            deposit_data = {
                "bank_account": {
                    "account_holder_name": "CirclePay Tester",
                    "bank_name": "Test Bank",
                    "account_number": "1234567890",
                    "routing_number": "121000248",
                    "address_line1": "123 Test Street",
                    "city": "Seoul",
                    "state": "Seoul",
                    "postal_code": "12345",
                    "country": "KR"
                },
                "amount": "100.00",
                "currency": "USD"
            }
            
            response = self.session.post(f"{self.base_url}/deposits/wallets/{self.wallet_id}/deposit/wire", 
                                       json=deposit_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("은행 송금 충전", True, 
                            f"충전 요청 성공 - 상태: {data.get('status')}, 추적번호: {data.get('tracking_ref')}", data)
                return True
            else:
                self.log_test("은행 송금 충전", False, f"충전 실패: {response.status_code}", response.json())
                return False
        except Exception as e:
            self.log_test("은행 송금 충전", False, f"충전 오류: {str(e)}")
            return False
    
    def test_9_crypto_deposit(self):
        """9. 암호화폐 충전 테스트"""
        try:
            if not self.wallet_id:
                self.log_test("암호화폐 충전", False, "지갑 ID가 없습니다")
                return False
            
            deposit_data = {
                "chain": "ETH",
                "amount": "50.00",
                "currency": "USD"
            }
            
            response = self.session.post(f"{self.base_url}/deposits/wallets/{self.wallet_id}/deposit/crypto", 
                                       json=deposit_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("암호화폐 충전", True, 
                            f"충전 주소 생성 성공 - 주소: {data.get('deposit_address')}", data)
                return True
            else:
                self.log_test("암호화폐 충전", False, f"충전 실패: {response.status_code}", response.json())
                return False
        except Exception as e:
            self.log_test("암호화폐 충전", False, f"충전 오류: {str(e)}")
            return False
    
    def test_10_payment_qr_generation(self):
        """10. QR 결제 생성 테스트"""
        try:
            # ✅ 수정: camelCase → snake_case
            payment_data = {
                "amount": 25.99,
                "currency": "USDC",
                "merchant_id": "test_merchant_001",        # ✅ 수정
                "merchant_name": "CirclePay 테스트 매장",   # ✅ 수정
                "description": "통합 테스트 결제"
            }
            
            response = self.session.post(f"{self.base_url}/payments/qr/generate", json=payment_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("QR 결제 생성", True, 
                            f"QR 생성 성공 - QR ID: {data.get('qr_code_id')}", data)
                return True
            else:
                self.log_test("QR 결제 생성", False, f"QR 생성 실패: {response.status_code}", response.json())
                return False
        except Exception as e:
            self.log_test("QR 결제 생성", False, f"QR 생성 오류: {str(e)}")
            return False
    
    def test_11_cross_chain_transfer(self):
        """11. 크로스체인 전송 테스트"""
        try:
            if not self.wallet_id:
                self.log_test("크로스체인 전송", False, "지갑 ID가 없습니다")
                return False
            
            # ✅ 수정: camelCase → snake_case
            transfer_data = {
                "source_wallet_id": self.wallet_id,                               # ✅ 수정
                "target_address": "0x742d35Cc6634C0532925a3b8D45D15a4c3a1Ad47",   # ✅ 수정
                "amount": 10.00,
                "source_chain": "eth",      # ✅ 수정
                "target_chain": "base",     # ✅ 수정
                "notes": "통합 테스트 크로스체인 전송"
            }
            
            response = self.session.post(f"{self.base_url}/payments/transfer/cross-chain", json=transfer_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("크로스체인 전송", True, 
                            f"전송 요청 성공 - 예상 완료: {data.get('estimated_completion_time')}", data)
                return True
            else:
                self.log_test("크로스체인 전송", False, f"전송 실패: {response.status_code}", response.json())
                return False
        except Exception as e:
            self.log_test("크로스체인 전송", False, f"전송 오류: {str(e)}")
            return False
    
    def test_12_compliance_screening(self):
        """12. 컴플라이언스 스크리닝 테스트"""
        try:
            # ✅ 수정: camelCase → snake_case, .test → .com
            screening_data = {
                "from_address": f"user_{self.user_id}@example.com",               # ✅ 수정
                "to_address": "0x742d35Cc6634C0532925a3b8D45D15a4c3a1Ad47",       # ✅ 수정
                "amount": 50,
                "currency": "USDC"
            }
            
            response = self.session.post(f"{self.base_url}/compliance/screen/transaction", json=screening_data)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("컴플라이언스 스크리닝", True, 
                            f"스크리닝 완료 - 위험점수: {data.get('risk_score', 'N/A')}", data)
                return True
            else:
                self.log_test("컴플라이언스 스크리닝", False, f"스크리닝 실패: {response.status_code}", response.json())
                return False
        except Exception as e:
            self.log_test("컴플라이언스 스크리닝", False, f"스크리닝 오류: {str(e)}")
            return False
    
    def run_all_tests(self):
        """모든 테스트 실행"""
        print("🚀 CirclePay Global 통합 테스트 시작 (수정된 버전)")
        print("=" * 60)
        
        tests = [
            self.test_1_health_check,
            self.test_2_user_registration,
            self.test_3_user_login,
            self.test_4_get_user_profile,
            self.test_5_get_wallets,
            self.test_6_kyc_submission,
            self.test_7_kyc_status_check,
            self.test_8_wire_deposit,
            self.test_9_crypto_deposit,
            self.test_10_payment_qr_generation,
            self.test_11_cross_chain_transfer,
            self.test_12_compliance_screening,
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            try:
                if test():
                    passed += 1
                time.sleep(1)  # 테스트 간 간격
            except Exception as e:
                print(f"❌ 테스트 실행 오류: {str(e)}")
        
        print("\n" + "=" * 60)
        print(f"📊 테스트 결과: {passed}/{total} 통과")
        
        if passed == total:
            print("🎉 모든 테스트가 성공했습니다!")
        else:
            print(f"⚠️  {total - passed}개 테스트가 실패했습니다.")
        
        # 결과를 JSON 파일로 저장
        with open(f"integration_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w", encoding="utf-8") as f:
            json.dump({
                "summary": {
                    "total_tests": total,
                    "passed": passed,
                    "failed": total - passed,
                    "success_rate": f"{(passed/total)*100:.1f}%",
                    "test_email": TEST_EMAIL,
                    "timestamp": datetime.now().isoformat()
                },
                "results": self.results
            }, f, indent=2, ensure_ascii=False)
        
        return passed == total

if __name__ == "__main__":
    tester = CirclePayTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)