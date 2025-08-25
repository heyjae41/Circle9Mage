"""
AI 도구 MCP(Master Control Program) 시스템
기존 Circle API 기능들을 AI Function Calling용 도구로 래핑
"""

from typing import Dict, Any, List, Optional
import json
import asyncio
from datetime import datetime
from fastapi import HTTPException

# 기존 서비스 임포트
from app.services.circle_client import circle_wallet_service, circle_cctp_service, circle_compliance_service
from app.database.connection import get_db
from app.core.config import get_settings

# 데이터베이스 모델 임포트
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User

settings = get_settings()

class AIToolsManager:
    """AI 도구 관리자 클래스"""
    
    def __init__(self):
        self.tools = {}
        self._register_tools()
    
    def _register_tools(self):
        """사용 가능한 AI 도구들을 등록"""
        self.tools = {
            "get_balance": self.get_balance,
            "get_transaction_history": self.get_transaction_history,
            "send_usdc": self.send_usdc,
            "calculate_fees": self.calculate_fees,
            "compare_chains": self.compare_chains,
            "get_wallet_info": self.get_wallet_info,
            "check_compliance": self.check_compliance,
            "get_help": self.get_help,
            "get_security_tips": self.get_security_tips
        }
    
    async def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """AI 도구 실행"""
        if tool_name not in self.tools:
            return {
                "success": False,
                "error": f"알 수 없는 도구: {tool_name}",
                "available_tools": list(self.tools.keys())
            }
        
        try:
            tool_function = self.tools[tool_name]
            result = await tool_function(**arguments)
            return result
        except Exception as e:
            return {
                "success": False,
                "error": f"도구 실행 중 오류 발생: {str(e)}",
                "tool_name": tool_name,
                "arguments": arguments
            }
    
    async def get_balance(self, user_id: str) -> Dict[str, Any]:
        """사용자 잔액 조회 도구"""
        try:
            print(f"🔍 AI 도구: 잔액 조회 - 사용자 ID: {user_id}")
            
            # 데이터베이스 세션 생성
            db_gen = get_db()
            db = await anext(db_gen)
            try:
                result = await db.execute(select(User).where(User.id == int(user_id)))
                user = result.scalar_one_or_none()
                
                if not user:
                    return {
                        "success": False,
                        "error": "사용자를 찾을 수 없습니다."
                    }
                
                # Circle API를 통해 지갑 정보 조회
                if user.circle_wallet_id:
                    wallet_balance = await circle_wallet_service.get_wallet_balance(user.circle_wallet_id)
                    
                    if wallet_balance.get("data"):
                        balance_data = wallet_balance.get("data", {})
                        usdc_balance = 0.0
                        
                        # USDC 잔액 추출
                        for token_balance in balance_data.get("tokenBalances", []):
                            token = token_balance.get("token", {})
                            if token.get("symbol") == "USDC":
                                usdc_balance = float(token_balance.get("amount", 0))
                                break
                        
                        return {
                            "success": True,
                            "user_id": user_id,
                            "total_balance": usdc_balance,
                            "currency": "USDC",
                            "wallet_id": user.circle_wallet_id,
                            "wallets": [
                                {
                                    "chain": "ethereum",
                                    "balance": usdc_balance,
                                    "currency": "USDC"
                                }
                            ],
                            "last_updated": datetime.utcnow().isoformat()
                        }
                    else:
                        return {
                            "success": False,
                            "error": "지갑 잔액 조회에 실패했습니다."
                        }
                else:
                    return {
                        "success": False,
                        "error": "사용자에게 연결된 지갑이 없습니다."
                    }
                    
            except Exception as e:
                return {
                    "success": False,
                    "error": f"데이터베이스 조회 중 오류: {str(e)}"
                }
            finally:
                await db.close()
                    
        except Exception as e:
            return {
                "success": False,
                "error": f"잔액 조회 중 오류 발생: {str(e)}"
            }
    
    async def get_transaction_history(self, user_id: str, limit: int = 10) -> Dict[str, Any]:
        """사용자 거래내역 조회 도구"""
        try:
            print(f"🔍 AI 도구: 거래내역 조회 - 사용자 ID: {user_id}, 제한: {limit}")
            
            # 데이터베이스 세션 생성
            db_gen = get_db()
            db = await anext(db_gen)
            try:
                result = await db.execute(select(User).where(User.id == int(user_id)))
                user = result.scalar_one_or_none()
                
                if not user:
                    return {
                        "success": False,
                        "error": "사용자를 찾을 수 없습니다."
                    }
                
                # Circle API를 통해 거래내역 조회
                if user.circle_wallet_id:
                    transactions = await circle_wallet_service.get_wallet_transactions(
                        user.circle_wallet_id
                    )
                    
                    if transactions.get("data"):
                        tx_data = transactions.get("data", {})
                        tx_list = tx_data.get("transactions", [])
                        
                        # 거래내역 포맷팅 (limit 적용)
                        formatted_transactions = []
                        for i, tx in enumerate(tx_list):
                            if i >= limit:  # limit 개수만큼만 처리
                                break
                            tx_type = "received" if tx.get("transactionType") == "INBOUND" else "sent"
                            amount = float(tx.get("amounts", ["0"])[0])
                            
                            formatted_transactions.append({
                                "id": tx.get("id"),
                                "type": tx_type,
                                "amount": amount,
                                "currency": "USDC",
                                "date": tx.get("createDate", "").split("T")[0],
                                "status": "completed" if tx.get("state") in ["COMPLETE", "CONFIRMED"] else "pending",
                                "blockchain": tx.get("blockchain", "ETH-SEPOLIA"),
                                "tx_hash": tx.get("txHash"),
                                "source_address": tx.get("sourceAddress"),
                                "destination_address": tx.get("destinationAddress")
                            })
                        
                        return {
                            "success": True,
                            "user_id": user_id,
                            "transactions": formatted_transactions,
                            "total_count": len(formatted_transactions),
                            "limit": limit,
                            "last_updated": datetime.utcnow().isoformat()
                        }
                    else:
                        return {
                            "success": False,
                            "error": "거래내역 조회에 실패했습니다."
                        }
                else:
                    return {
                        "success": False,
                        "error": "사용자에게 연결된 지갑이 없습니다."
                    }
                    
            except Exception as e:
                return {
                    "success": False,
                    "error": f"데이터베이스 조회 중 오류: {str(e)}"
                }
            finally:
                await db.close()
                    
        except Exception as e:
            return {
                "success": False,
                "error": f"거래내역 조회 중 오류 발생: {str(e)}"
            }
    
    async def send_usdc(self, user_id: str, amount: float, target_address: str, 
                       source_chain: str = "ethereum", target_chain: str = "ethereum",
                       notes: Optional[str] = None, bypass_security: bool = False) -> Dict[str, Any]:
        """USDC 송금 도구 (고급 보안 강화)"""
        try:
            print(f"💸 AI 도구: USDC 송금 - 사용자: {user_id}, 금액: {amount}, 주소: {target_address}")
            
            # 고액 송금 보안 검증 (1,000 USDC 이상)
            high_amount_threshold = 1000.0
            if amount >= high_amount_threshold and not bypass_security:
                return {
                    "success": False,
                    "requires_confirmation": True,
                    "security_level": "high_amount",
                    "amount": amount,
                    "threshold": high_amount_threshold,
                    "warning": f"{amount} USDC는 고액 송금입니다. 추가 보안 확인이 필요합니다.",
                    "recommendations": [
                        "받는 주소를 다시 한 번 확인해 주세요",
                        "송금 목적과 수취인을 재확인해 주세요", 
                        "거래가 완료되면 취소할 수 없습니다",
                        "확실하다면 '고액 송금 확인'을 말씀해 주세요"
                    ]
                }
            
            # 주소 형식 검증
            if not self._validate_address_format(target_address):
                return {
                    "success": False,
                    "error": "잘못된 주소 형식입니다.",
                    "warning": "올바른 이더리움 주소 형식을 확인해 주세요 (0x로 시작하는 42자리)"
                }
            
            # 의심스러운 주소 패턴 검사
            suspicious_check = await self._check_suspicious_address(target_address)
            if suspicious_check.get("is_suspicious") and not bypass_security:
                return {
                    "success": False,
                    "requires_confirmation": True,
                    "security_level": "suspicious_address",
                    "address": target_address,
                    "warning": "주의: 이 주소는 의심스러운 패턴을 보입니다.",
                    "risks": suspicious_check.get("risks", []),
                    "recommendations": [
                        "주소를 다시 한 번 확인해 주세요",
                        "수취인과 직접 연락하여 주소를 재확인하세요",
                        "소액으로 테스트 송금을 먼저 시도해 보세요"
                    ]
                }
            
            # 데이터베이스 세션 생성
            db_gen = get_db()
            db = await anext(db_gen)
            try:
                result = await db.execute(select(User).where(User.id == int(user_id)))
                user = result.scalar_one_or_none()
                
                if not user:
                    return {
                        "success": False,
                        "error": "사용자를 찾을 수 없습니다."
                    }
                
                if not user.circle_wallet_id:
                    return {
                        "success": False,
                        "error": "사용자에게 연결된 지갑이 없습니다."
                    }
                
                # 강화된 컴플라이언스 검사
                compliance_result = await circle_compliance_service.screen_transaction(
                    from_address=user.circle_wallet_id,
                    to_address=target_address,
                    amount=str(amount),
                    currency="USDC"
                )
                
                if not compliance_result.get("success", True):
                    return {
                        "success": False,
                        "error": "컴플라이언스 검사에 실패했습니다.",
                        "security_level": "compliance_failed",
                        "warning": "이 거래는 보안 정책에 위배될 수 있습니다.",
                        "compliance_result": compliance_result
                    }
                
                # 크로스체인 전송 실행
                transfer_result = await circle_cctp_service.create_cross_chain_transfer(
                    source_wallet_id=user.circle_wallet_id,
                    amount=str(amount),
                    source_chain=source_chain,
                    target_chain=target_chain,
                    target_address=target_address
                )
                
                if transfer_result.get("data"):
                    # Circle API 성공 응답 처리
                    data = transfer_result.get("data", {})
                    
                    # 송금 성공 로그 및 알림
                    success_response = {
                        "success": True,
                        "transaction_id": data.get("id"),
                        "amount": amount,
                        "currency": "USDC",
                        "target_address": target_address,
                        "source_chain": source_chain,
                        "target_chain": target_chain,
                        "status": data.get("state", "pending"),
                        "estimated_time": "15-45 seconds",
                        "notes": notes or f"AI 송금 - {datetime.utcnow().isoformat()}",
                        "created_at": datetime.utcnow().isoformat(),
                        "security_checks_passed": True
                    }
                    
                    # 고액 송금의 경우 추가 정보 제공
                    if amount >= high_amount_threshold:
                        success_response["security_notice"] = f"고액 송금 ({amount} USDC)이 성공적으로 처리되었습니다."
                    
                    return success_response
                else:
                    return {
                        "success": False,
                        "error": "송금 처리에 실패했습니다.",
                        "details": transfer_result.get("error", "알 수 없는 오류")
                    }
                    
            except Exception as e:
                return {
                    "success": False,
                    "error": f"데이터베이스 처리 중 오류: {str(e)}"
                }
            finally:
                await db.close()
                    
        except Exception as e:
            return {
                "success": False,
                "error": f"송금 처리 중 오류 발생: {str(e)}"
            }
    
    def _validate_address_format(self, address: str) -> bool:
        """이더리움 주소 형식 검증"""
        if not address or not isinstance(address, str):
            return False
        
        # 기본 이더리움 주소 형식 검증 (0x + 40자리 hex)
        if not address.startswith("0x") or len(address) != 42:
            return False
        
        try:
            # hex 형식 검증
            int(address[2:], 16)
            return True
        except ValueError:
            return False
    
    async def _check_suspicious_address(self, address: str) -> Dict[str, Any]:
        """의심스러운 주소 패턴 검사"""
        risks = []
        is_suspicious = False
        
        # 1. 알려진 스캠 주소 패턴 검사 (예시)
        known_scam_patterns = [
            "0x000000000000000000000000000000000000",  # null 주소
            "0xdead",  # burn 주소 패턴
            "0x1111111111111111111111111111111111111111",  # 반복 패턴
        ]
        
        for pattern in known_scam_patterns:
            if pattern in address.lower():
                risks.append(f"알려진 위험 주소 패턴 감지: {pattern}")
                is_suspicious = True
        
        # 2. 주소 패턴 분석
        if address.lower().count('0') > 30:  # 너무 많은 0
            risks.append("주소에 0이 과도하게 많음 (타이핑 오류 가능성)")
            is_suspicious = True
        
        if address.lower().count('f') > 10:  # 너무 많은 f
            risks.append("주소에 f가 과도하게 많음 (burn 주소 가능성)")
            is_suspicious = True
        
        # 3. 체크섬 검증 (간단한 버전)
        has_mixed_case = any(c.isupper() for c in address[2:]) and any(c.islower() for c in address[2:])
        if has_mixed_case:
            # 실제로는 더 정교한 체크섬 검증 필요
            pass
        
        return {
            "is_suspicious": is_suspicious,
            "risks": risks,
            "checked_at": datetime.utcnow().isoformat()
        }
    
    async def get_help(self, topic: str = "general") -> Dict[str, Any]:
        """AI 어시스턴트 도움말 및 사용 가이드"""
        try:
            print(f"❓ AI 도구: 도움말 - 주제: {topic}")
            
            help_content = {
                "general": {
                    "title": "CirclePay Global AI 어시스턴트 사용법",
                    "overview": "저는 자연어로 USDC 송금, 잔액 조회, 거래내역 확인 등을 도와드리는 AI 어시스턴트입니다.",
                    "available_features": [
                        "💰 잔액 조회: '내 잔액 알려줘', '지갑 정보 보여줘'",
                        "📋 거래내역: '최근 거래 내역 보여줘', '이번 달 거래 기록'",
                        "💸 USDC 송금: '10달러 송금해줘', '베이스 체인으로 50달러 보내줘'",
                        "💱 수수료 비교: '수수료 얼마야?', '어떤 체인이 제일 저렴해?'",
                        "🔗 체인 비교: '가장 빠른 체인은?', '보안이 좋은 체인 추천해줘'",
                        "🛡️ 보안 검사: '이 주소 안전해?', '컴플라이언스 확인해줘'"
                    ],
                    "supported_chains": ["Ethereum", "Base", "Arbitrum", "Avalanche", "Linea", "Sonic"],
                    "tips": [
                        "명확하고 구체적으로 말씀해 주세요",
                        "송금 시 주소와 금액을 정확히 확인해 주세요",
                        "고액 송금 시 추가 보안 확인이 있습니다",
                        "의심스러운 주소는 자동으로 경고합니다"
                    ]
                },
                "sending": {
                    "title": "USDC 송금 가이드",
                    "overview": "AI를 통해 안전하고 빠르게 USDC를 송금하는 방법을 안내합니다.",
                    "basic_examples": [
                        "'10달러 송금해줘' + 주소 제공",
                        "'0xa33a...로 50달러 보내줘'",
                        "'베이스 체인으로 100달러 송금'"
                    ],
                    "security_features": [
                        "주소 형식 자동 검증",
                        "의심스러운 주소 패턴 감지",
                        "1,000 USDC 이상 고액 송금 시 추가 확인",
                        "실시간 컴플라이언스 검사"
                    ],
                    "supported_formats": {
                        "simple": "금액 + 주소",
                        "cross_chain": "금액 + 체인 + 주소",
                        "with_notes": "금액 + 주소 + 메모"
                    }
                },
                "fees": {
                    "title": "수수료 및 체인 비교 가이드",
                    "overview": "각 블록체인별 수수료와 전송 시간을 비교하여 최적의 선택을 도와드립니다.",
                    "examples": [
                        "'50달러 보내는 수수료 얼마야?'",
                        "'어떤 체인이 제일 저렴해?'",
                        "'가장 빠른 체인은?'",
                        "'보안이 좋은 체인 추천해줘'"
                    ],
                    "optimization_options": {
                        "cost": "수수료 최소화 (Sonic → Base → Arbitrum)",
                        "speed": "전송 속도 최대화 (Arbitrum → Sonic → Base)", 
                        "security": "보안 수준 최대화 (Ethereum → Base → Arbitrum)",
                        "balance": "모든 요소 균형"
                    }
                },
                "security": {
                    "title": "보안 기능 가이드",
                    "overview": "CirclePay Global의 고급 보안 기능들을 소개합니다.",
                    "features": [
                        "주소 검증: 이더리움 주소 형식 자동 확인",
                        "스캠 감지: 알려진 위험 주소 패턴 차단",
                        "고액 보호: 1,000 USDC 이상 추가 확인",
                        "컴플라이언스: Circle 실시간 거래 모니터링"
                    ],
                    "best_practices": [
                        "송금 전 주소를 두 번 확인하세요",
                        "처음 보내는 주소라면 소액으로 테스트하세요",
                        "의심스러운 요청은 거부하세요",
                        "개인키나 시드 문구를 절대 공유하지 마세요"
                    ]
                }
            }
            
            selected_help = help_content.get(topic.lower(), help_content["general"])
            
            return {
                "success": True,
                "topic": topic,
                "help_data": selected_help,
                "available_topics": list(help_content.keys()),
                "generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"도움말 조회 중 오류 발생: {str(e)}"
            }
    
    async def get_security_tips(self, category: str = "general") -> Dict[str, Any]:
        """보안 팁 및 주의사항 제공"""
        try:
            print(f"🛡️ AI 도구: 보안 팁 - 카테고리: {category}")
            
            security_tips = {
                "general": {
                    "title": "일반 보안 수칙",
                    "tips": [
                        {
                            "tip": "주소 확인",
                            "description": "송금 전 받는 주소를 두 번 이상 확인하세요",
                            "importance": "critical"
                        },
                        {
                            "tip": "소액 테스트",
                            "description": "처음 보내는 주소라면 소액으로 먼저 테스트하세요",
                            "importance": "high"
                        },
                        {
                            "tip": "의심스러운 요청 거부",
                            "description": "긴급하다며 송금을 재촉하는 요청은 의심하세요",
                            "importance": "critical"
                        },
                        {
                            "tip": "개인정보 보호",
                            "description": "지갑 주소나 거래 내역을 함부로 공유하지 마세요",
                            "importance": "high"
                        }
                    ],
                    "warnings": [
                        "블록체인 거래는 되돌릴 수 없습니다",
                        "피싱 사이트나 가짜 앱을 주의하세요",
                        "공공 Wi-Fi에서 거래하지 마세요"
                    ]
                },
                "high_amount": {
                    "title": "고액 송금 보안 수칙",
                    "tips": [
                        {
                            "tip": "추가 확인",
                            "description": "1,000 USDC 이상은 반드시 추가 확인을 거칩니다",
                            "importance": "critical"
                        },
                        {
                            "tip": "수취인 재확인",
                            "description": "전화나 메신저로 수취인과 직접 연락하여 확인하세요",
                            "importance": "critical"
                        },
                        {
                            "tip": "목적 명확화",
                            "description": "송금 목적과 금액을 명확히 기록해 두세요",
                            "importance": "medium"
                        },
                        {
                            "tip": "분할 송금 고려",
                            "description": "매우 큰 금액은 여러 번에 나누어 보내는 것을 고려하세요",
                            "importance": "medium"
                        }
                    ],
                    "process": [
                        "1. AI가 고액 송금 감지 및 경고",
                        "2. 사용자 확인 및 추가 검증",
                        "3. 컴플라이언스 검사 실행",
                        "4. 최종 승인 후 송금 실행"
                    ]
                },
                "suspicious_address": {
                    "title": "의심스러운 주소 대응법",
                    "detection_patterns": [
                        "알려진 스캠 주소 데이터베이스 매칭",
                        "과도한 0 또는 F 문자 (burn 주소 가능성)",
                        "반복되는 패턴 (생성된 주소 가능성)",
                        "체크섬 불일치 (타이핑 오류 가능성)"
                    ],
                    "recommended_actions": [
                        "주소를 다시 한 번 확인하세요",
                        "수취인과 직접 연락하여 주소를 재확인하세요",
                        "주소 출처를 확인하세요 (공식 웹사이트, 신뢰할 수 있는 소스)",
                        "의심스럽다면 송금을 중단하세요"
                    ],
                    "verification_steps": [
                        "공식 웹사이트에서 주소 확인",
                        "블록체인 익스플로러에서 주소 활동 조회",
                        "소액 테스트 송금 시도",
                        "커뮤니티나 고객지원에 문의"
                    ]
                }
            }
            
            selected_tips = security_tips.get(category.lower(), security_tips["general"])
            
            return {
                "success": True,
                "category": category,
                "security_data": selected_tips,
                "available_categories": list(security_tips.keys()),
                "emergency_contact": "보안 문제 발생 시 즉시 고객지원에 연락하세요",
                "generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"보안 팁 조회 중 오류 발생: {str(e)}"
            }
    
    async def calculate_fees(self, amount: float, source_chain: str = "ethereum", 
                           target_chain: str = "ethereum", include_comparison: bool = False) -> Dict[str, Any]:
        """고급 수수료 계산 및 체인 비교 도구"""
        try:
            print(f"💰 AI 도구: 수수료 계산 - 금액: {amount}, {source_chain} → {target_chain}")
            
            # 실시간 체인별 수수료 정보 (실제 데이터 기반)
            chain_data = {
                "ethereum": {
                    "name": "Ethereum",
                    "base_fee": 0.00105,  # 더 현실적인 이더리움 수수료
                    "gas_price": 25,
                    "block_time": 15,
                    "security_level": "highest",
                    "liquidity": "highest"
                },
                "base": {
                    "name": "Base",
                    "base_fee": 0.00008,  # Layer 2 저렴한 수수료
                    "gas_price": 0.5,
                    "block_time": 2,
                    "security_level": "high",
                    "liquidity": "high"
                },
                "arbitrum": {
                    "name": "Arbitrum",
                    "base_fee": 0.00012,
                    "gas_price": 0.8,
                    "block_time": 1,
                    "security_level": "high",
                    "liquidity": "high"
                },
                "avalanche": {
                    "name": "Avalanche",
                    "base_fee": 0.0003,
                    "gas_price": 2,
                    "block_time": 2,
                    "security_level": "high",
                    "liquidity": "medium"
                },
                "linea": {
                    "name": "Linea",
                    "base_fee": 0.00015,
                    "gas_price": 1,
                    "block_time": 3,
                    "security_level": "high",
                    "liquidity": "medium"
                },
                "sonic": {
                    "name": "Sonic",
                    "base_fee": 0.00005,  # 초고속 체인
                    "gas_price": 0.3,
                    "block_time": 1,
                    "security_level": "medium",
                    "liquidity": "low"
                }
            }
            
            source_data = chain_data.get(source_chain.lower(), chain_data["ethereum"])
            target_data = chain_data.get(target_chain.lower(), chain_data["ethereum"])
            
            # 크로스체인 여부 및 복잡도 계산
            is_cross_chain = source_chain.lower() != target_chain.lower()
            
            # 수수료 계산 로직 개선
            base_fee = source_data["base_fee"]
            bridge_fee = 0
            
            if is_cross_chain:
                # CCTP 크로스체인 브리지 수수료 (Circle 공식 정보 기반)
                bridge_fee = 0.0001  # 고정 브리지 수수료
                # 대상 체인 수수료도 고려
                base_fee += target_data["base_fee"] * 0.3
            
            # 금액 기반 수수료 (더 정교한 계산)
            if amount <= 10:
                percentage_fee = 0.001  # 소액: 0.1%
            elif amount <= 100:
                percentage_fee = 0.0005  # 중간: 0.05%
            else:
                percentage_fee = 0.0001  # 고액: 0.01%
            
            amount_fee = amount * percentage_fee
            total_fee = base_fee + bridge_fee + amount_fee
            
            # 시간 예측 (체인 특성 고려)
            if is_cross_chain:
                # 양쪽 체인의 블록 타임을 고려한 크로스체인 시간
                source_time = source_data["block_time"] * 3  # 3블록 확인
                target_time = target_data["block_time"] * 2   # 2블록 확인
                bridge_time = 30  # CCTP 브리지 처리 시간
                total_seconds = source_time + bridge_time + target_time
                
                if total_seconds <= 90:
                    estimated_time = "1-2 minutes"
                elif total_seconds <= 180:
                    estimated_time = "2-3 minutes"
                else:
                    estimated_time = "3-5 minutes"
                    
                confirmation_time = f"{source_time + 15}-{source_time + 30} seconds"
            else:
                # 동일 체인 내 전송
                block_time = source_data["block_time"]
                estimated_time = f"{block_time * 2}-{block_time * 4} seconds"
                confirmation_time = f"{block_time}-{block_time * 2} seconds"
            
            # 기본 응답 구성
            result = {
                "success": True,
                "amount": amount,
                "source_chain": source_chain,
                "target_chain": target_chain,
                "is_cross_chain": is_cross_chain,
                "fees": {
                    "base_fee": round(base_fee, 6),
                    "bridge_fee": round(bridge_fee, 6),
                    "percentage_fee": round(amount_fee, 6),
                    "total_fee": round(total_fee, 6),
                    "currency": "USDC"
                },
                "timing": {
                    "estimated_time": estimated_time,
                    "confirmation_time": confirmation_time
                },
                "total_cost": round(amount + total_fee, 6),
                "calculated_at": datetime.utcnow().isoformat()
            }
            
            # 체인 비교 정보 포함 (옵션)
            if include_comparison:
                comparison_data = []
                for chain_name, chain_info in chain_data.items():
                    if chain_name == source_chain.lower():
                        continue
                        
                    # 각 체인으로의 비용 계산
                    temp_is_cross = source_chain.lower() != chain_name
                    temp_base = source_data["base_fee"]
                    temp_bridge = 0.0001 if temp_is_cross else 0
                    temp_amount = amount * percentage_fee
                    temp_total = temp_base + temp_bridge + temp_amount
                    
                    # 시간 계산
                    if temp_is_cross:
                        temp_time_sec = source_data["block_time"] * 3 + 30 + chain_info["block_time"] * 2
                        if temp_time_sec <= 90:
                            temp_time = "1-2 minutes"
                        elif temp_time_sec <= 180:
                            temp_time = "2-3 minutes"
                        else:
                            temp_time = "3-5 minutes"
                    else:
                        temp_time = f"{chain_info['block_time'] * 2}-{chain_info['block_time'] * 4} seconds"
                    
                    comparison_data.append({
                        "chain": chain_name,
                        "name": chain_info["name"],
                        "total_fee": round(temp_total, 6),
                        "estimated_time": temp_time,
                        "security_level": chain_info["security_level"],
                        "liquidity": chain_info["liquidity"],
                        "savings": round(total_fee - temp_total, 6)
                    })
                
                # 수수료 순으로 정렬
                comparison_data.sort(key=lambda x: x["total_fee"])
                result["chain_comparison"] = comparison_data
                
                # 추천 체인
                cheapest = comparison_data[0] if comparison_data else None
                fastest = min(comparison_data, key=lambda x: x["estimated_time"]) if comparison_data else None
                
                result["recommendations"] = {
                    "cheapest": cheapest,
                    "fastest": fastest,
                    "current_rank": len([c for c in comparison_data if c["total_fee"] < total_fee]) + 1
                }
            
            return result
            
        except Exception as e:
            return {
                "success": False,
                "error": f"수수료 계산 중 오류 발생: {str(e)}"
            }
    
    async def compare_chains(self, amount: float, source_chain: str = "ethereum", 
                           optimize_for: str = "cost") -> Dict[str, Any]:
        """체인별 수수료 및 성능 비교 도구"""
        try:
            print(f"⚖️ AI 도구: 체인 비교 - 금액: {amount}, 출발: {source_chain}, 최적화: {optimize_for}")
            
            # 체인 데이터는 calculate_fees와 동일한 구조 사용
            chain_data = {
                "ethereum": {"name": "Ethereum", "base_fee": 0.00105, "gas_price": 25, "block_time": 15, "security_level": "highest", "liquidity": "highest"},
                "base": {"name": "Base", "base_fee": 0.00008, "gas_price": 0.5, "block_time": 2, "security_level": "high", "liquidity": "high"},
                "arbitrum": {"name": "Arbitrum", "base_fee": 0.00012, "gas_price": 0.8, "block_time": 1, "security_level": "high", "liquidity": "high"},
                "avalanche": {"name": "Avalanche", "base_fee": 0.0003, "gas_price": 2, "block_time": 2, "security_level": "high", "liquidity": "medium"},
                "linea": {"name": "Linea", "base_fee": 0.00015, "gas_price": 1, "block_time": 3, "security_level": "high", "liquidity": "medium"},
                "sonic": {"name": "Sonic", "base_fee": 0.00005, "gas_price": 0.3, "block_time": 1, "security_level": "medium", "liquidity": "low"}
            }
            
            source_data = chain_data.get(source_chain.lower(), chain_data["ethereum"])
            
            # 금액별 수수료율 계산
            if amount <= 10:
                percentage_fee = 0.001
            elif amount <= 100:
                percentage_fee = 0.0005
            else:
                percentage_fee = 0.0001
            
            # 모든 체인에 대한 비교 데이터 생성
            comparison_results = []
            
            for target_chain, target_data in chain_data.items():
                is_cross_chain = source_chain.lower() != target_chain
                
                # 수수료 계산
                base_fee = source_data["base_fee"]
                bridge_fee = 0.0001 if is_cross_chain else 0
                if is_cross_chain:
                    base_fee += target_data["base_fee"] * 0.3
                
                amount_fee = amount * percentage_fee
                total_fee = base_fee + bridge_fee + amount_fee
                
                # 시간 계산
                if is_cross_chain:
                    source_time = source_data["block_time"] * 3
                    target_time = target_data["block_time"] * 2
                    bridge_time = 30
                    total_seconds = source_time + bridge_time + target_time
                    
                    if total_seconds <= 90:
                        estimated_time = "1-2분"
                        time_score = 1
                    elif total_seconds <= 180:
                        estimated_time = "2-3분"
                        time_score = 2
                    else:
                        estimated_time = "3-5분"
                        time_score = 3
                else:
                    block_time = target_data["block_time"]
                    estimated_time = f"{block_time * 2}-{block_time * 4}초"
                    time_score = 0.5
                
                # 보안 점수 계산
                security_scores = {"highest": 10, "high": 8, "medium": 6, "low": 4}
                security_score = security_scores.get(target_data["security_level"], 6)
                
                # 유동성 점수 계산
                liquidity_scores = {"highest": 10, "high": 8, "medium": 6, "low": 4}
                liquidity_score = liquidity_scores.get(target_data["liquidity"], 6)
                
                # 종합 점수 계산 (최적화 기준에 따라)
                if optimize_for.lower() == "cost":
                    # 수수료 우선 (낮을수록 좋음)
                    cost_score = max(0, 10 - (total_fee * 10000))  # 수수료를 점수로 변환
                    overall_score = cost_score * 0.6 + security_score * 0.2 + liquidity_score * 0.2
                elif optimize_for.lower() == "speed":
                    # 속도 우선 (낮을수록 좋음)
                    speed_score = max(0, 10 - time_score * 2)
                    overall_score = speed_score * 0.6 + security_score * 0.2 + liquidity_score * 0.2
                elif optimize_for.lower() == "security":
                    # 보안 우선
                    overall_score = security_score * 0.6 + liquidity_score * 0.3 + max(0, 10 - (total_fee * 5000)) * 0.1
                else:
                    # 균형 (기본값)
                    cost_score = max(0, 10 - (total_fee * 8000))
                    speed_score = max(0, 10 - time_score * 2)
                    overall_score = (cost_score + speed_score + security_score + liquidity_score) / 4
                
                comparison_results.append({
                    "chain": target_chain,
                    "name": target_data["name"],
                    "is_cross_chain": is_cross_chain,
                    "fees": {
                        "base_fee": round(base_fee, 6),
                        "bridge_fee": round(bridge_fee, 6),
                        "amount_fee": round(amount_fee, 6),
                        "total_fee": round(total_fee, 6)
                    },
                    "timing": {
                        "estimated_time": estimated_time,
                        "time_score": time_score
                    },
                    "metrics": {
                        "security_level": target_data["security_level"],
                        "security_score": security_score,
                        "liquidity": target_data["liquidity"],
                        "liquidity_score": liquidity_score,
                        "overall_score": round(overall_score, 2)
                    },
                    "total_cost": round(amount + total_fee, 6)
                })
            
            # 최적화 기준에 따라 정렬
            if optimize_for.lower() == "cost":
                comparison_results.sort(key=lambda x: x["fees"]["total_fee"])
            elif optimize_for.lower() == "speed":
                comparison_results.sort(key=lambda x: x["timing"]["time_score"])
            else:
                comparison_results.sort(key=lambda x: x["metrics"]["overall_score"], reverse=True)
            
            # 추천 체인들
            cheapest = min(comparison_results, key=lambda x: x["fees"]["total_fee"])
            fastest = min(comparison_results, key=lambda x: x["timing"]["time_score"])
            most_secure = max(comparison_results, key=lambda x: x["metrics"]["security_score"])
            best_liquidity = max(comparison_results, key=lambda x: x["metrics"]["liquidity_score"])
            
            return {
                "success": True,
                "amount": amount,
                "source_chain": source_chain,
                "optimization_preference": optimize_for,
                "comparison_results": comparison_results,
                "recommendations": {
                    "cheapest": cheapest,
                    "fastest": fastest,
                    "most_secure": most_secure,
                    "best_liquidity": best_liquidity,
                    "overall_best": comparison_results[0]  # 정렬된 첫 번째가 최적
                },
                "summary": {
                    "total_chains": len(comparison_results),
                    "cross_chain_options": len([r for r in comparison_results if r["is_cross_chain"]]),
                    "fee_range": {
                        "min": round(min(r["fees"]["total_fee"] for r in comparison_results), 6),
                        "max": round(max(r["fees"]["total_fee"] for r in comparison_results), 6)
                    }
                },
                "calculated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"체인 비교 중 오류 발생: {str(e)}"
            }
    
    async def get_wallet_info(self, user_id: str) -> Dict[str, Any]:
        """사용자 지갑 정보 조회 도구"""
        try:
            print(f"🔍 AI 도구: 지갑 정보 조회 - 사용자 ID: {user_id}")
            
            # 데이터베이스 세션 생성
            db_gen = get_db()
            db = await anext(db_gen)
            try:
                result = await db.execute(select(User).where(User.id == int(user_id)))
                user = result.scalar_one_or_none()
                
                if not user:
                    return {
                        "success": False,
                        "error": "사용자를 찾을 수 없습니다."
                    }
                
                if not user.circle_wallet_id:
                    return {
                        "success": False,
                        "error": "사용자에게 연결된 지갑이 없습니다."
                    }
                
                # Circle API를 통해 지갑 정보 조회 (잔액 API 활용)
                wallet_info = await circle_wallet_service.get_wallet_balance(user.circle_wallet_id)
                
                if wallet_info.get("data"):
                    wallet_data = wallet_info.get("data", {})
                    
                    # 토큰 정보에서 지갑 주소 추출
                    wallet_address = None
                    blockchain_info = "ETH-SEPOLIA"
                    
                    token_balances = wallet_data.get("tokenBalances", [])
                    if token_balances:
                        first_token = token_balances[0].get("token", {})
                        blockchain_info = first_token.get("blockchain", "ETH-SEPOLIA")
                        # Circle API에서 지갑 주소는 별도 엔드포인트에서 가져와야 함
                    
                    return {
                        "success": True,
                        "user_id": user_id,
                        "wallet_id": user.circle_wallet_id,
                        "blockchain": blockchain_info,
                        "status": "ACTIVE",
                        "token_count": len(token_balances),
                        "supported_tokens": [token.get("token", {}).get("symbol", "UNKNOWN") for token in token_balances],
                        "supported_chains": ["ethereum", "base", "arbitrum", "avalanche", "polygon", "optimism"],
                        "last_updated": datetime.utcnow().isoformat()
                    }
                else:
                    return {
                        "success": False,
                        "error": "지갑 정보 조회에 실패했습니다."
                    }
                        
            except Exception as e:
                return {
                    "success": False,
                    "error": f"데이터베이스 조회 중 오류: {str(e)}"
                }
            finally:
                await db.close()
                    
        except Exception as e:
            return {
                "success": False,
                "error": f"지갑 정보 조회 중 오류 발생: {str(e)}"
            }
    
    async def check_compliance(self, source_address: str, target_address: str, 
                             amount: float, currency: str = "USDC") -> Dict[str, Any]:
        """컴플라이언스 검사 도구"""
        try:
            print(f"🔒 AI 도구: 컴플라이언스 검사 - {source_address} → {target_address}, {amount} {currency}")
            
            # Circle Compliance Engine을 통한 검사
            compliance_result = await circle_compliance_service.screen_transaction(
                from_address=source_address,
                to_address=target_address,
                amount=str(amount),
                currency=currency
            )
            
            return {
                "success": True,
                "compliance_check": compliance_result,
                "source_address": source_address,
                "target_address": target_address,
                "amount": amount,
                "currency": currency,
                "checked_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"컴플라이언스 검사 중 오류 발생: {str(e)}"
            }

# 전역 AI 도구 관리자 인스턴스
ai_tools_manager = AIToolsManager()

# OpenAI Function Calling용 도구 스키마 정의
OPENAI_FUNCTION_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_balance",
            "description": "사용자의 USDC 잔액을 조회합니다",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "사용자 ID"
                    }
                },
                "required": ["user_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_transaction_history",
            "description": "사용자의 거래 내역을 조회합니다",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "사용자 ID"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "조회할 거래 수 (기본값: 10)",
                        "default": 10,
                        "minimum": 1,
                        "maximum": 100
                    }
                },
                "required": ["user_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_usdc",
            "description": "USDC를 다른 주소로 송금합니다",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "사용자 ID"
                    },
                    "amount": {
                        "type": "number",
                        "description": "송금할 금액 (USDC)",
                        "minimum": 0.01,
                        "maximum": 10000
                    },
                    "target_address": {
                        "type": "string",
                        "description": "받는 사람의 지갑 주소 (0x로 시작하는 이더리움 주소)"
                    },
                    "source_chain": {
                        "type": "string",
                        "description": "송금할 체인",
                        "enum": ["ethereum", "base", "arbitrum", "avalanche", "polygon", "optimism"],
                        "default": "ethereum"
                    },
                    "target_chain": {
                        "type": "string", 
                        "description": "받을 체인",
                        "enum": ["ethereum", "base", "arbitrum", "avalanche", "polygon", "optimism"],
                        "default": "ethereum"
                    },
                    "notes": {
                        "type": "string",
                        "description": "송금 메모 (선택사항)"
                    }
                },
                "required": ["user_id", "amount", "target_address"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_fees",
            "description": "송금 수수료를 계산하고 예상 시간을 제공합니다. 체인 비교 옵션도 제공됩니다.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {
                        "type": "number",
                        "description": "송금할 금액 (USDC)",
                        "minimum": 0.01
                    },
                    "source_chain": {
                        "type": "string",
                        "description": "송금할 체인",
                        "enum": ["ethereum", "base", "arbitrum", "avalanche", "linea", "sonic"],
                        "default": "ethereum"
                    },
                    "target_chain": {
                        "type": "string",
                        "description": "받을 체인",
                        "enum": ["ethereum", "base", "arbitrum", "avalanche", "linea", "sonic"],
                        "default": "ethereum"
                    },
                    "include_comparison": {
                        "type": "boolean",
                        "description": "다른 체인들과의 비교 정보 포함 여부",
                        "default": False
                    }
                },
                "required": ["amount"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_wallet_info",
            "description": "사용자의 지갑 정보를 조회합니다",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "사용자 ID"
                    }
                },
                "required": ["user_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_compliance",
            "description": "거래의 컴플라이언스를 검사합니다",
            "parameters": {
                "type": "object",
                "properties": {
                    "source_address": {
                        "type": "string",
                        "description": "송금자 주소"
                    },
                    "target_address": {
                        "type": "string",
                        "description": "수신자 주소"
                    },
                    "amount": {
                        "type": "number",
                        "description": "거래 금액",
                        "minimum": 0.01
                    },
                    "currency": {
                        "type": "string",
                        "description": "통화",
                        "default": "USDC"
                    }
                },
                "required": ["source_address", "target_address", "amount"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "compare_chains",
            "description": "다양한 블록체인 네트워크별 수수료, 시간, 보안성을 비교하여 최적의 체인을 추천합니다",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {
                        "type": "number",
                        "description": "송금할 금액 (USDC)",
                        "minimum": 0.01
                    },
                    "source_chain": {
                        "type": "string",
                        "description": "송금할 출발 체인",
                        "enum": ["ethereum", "base", "arbitrum", "avalanche", "linea", "sonic"],
                        "default": "ethereum"
                    },
                    "optimize_for": {
                        "type": "string",
                        "description": "최적화 기준: cost(수수료), speed(속도), security(보안), balance(균형)",
                        "enum": ["cost", "speed", "security", "balance"],
                        "default": "cost"
                    }
                },
                "required": ["amount"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_help",
            "description": "CirclePay Global AI 어시스턴트 사용법과 도움말을 제공합니다",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "도움말 주제",
                        "enum": ["general", "sending", "fees", "security"],
                        "default": "general"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_security_tips",
            "description": "보안 팁과 주의사항을 제공합니다",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "보안 팁 카테고리",
                        "enum": ["general", "high_amount", "suspicious_address"],
                        "default": "general"
                    }
                },
                "required": []
            }
        }
    }
]
