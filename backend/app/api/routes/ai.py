"""
AI 채팅 API 엔드포인트
OpenAI GPT-4o-mini를 활용한 자연어 처리 및 Function Calling
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import json
import uuid
import asyncio
from datetime import datetime, timedelta

# OpenAI 클라이언트
import openai
from openai import AsyncOpenAI

# 로컬 임포트
from app.core.config import get_settings
from app.database.connection import get_redis
from app.services.ai_tools import ai_tools_manager, OPENAI_FUNCTION_SCHEMAS

router = APIRouter()

# Pydantic 모델 정의
class ChatMessage(BaseModel):
    role: str = Field(..., description="메시지 역할 (user, assistant, system)")
    content: str = Field(..., description="메시지 내용")
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)

class ChatRequest(BaseModel):
    message: str = Field(..., description="사용자 메시지", max_length=500)
    user_id: str = Field(..., alias="userId", description="사용자 ID")
    session_id: Optional[str] = Field(None, alias="sessionId", description="세션 ID (선택사항)")
    language: Optional[str] = Field("ko", description="사용자 언어 코드 (ko, en, zh, ar, fr, de, es, hi, ja)")
    
    class Config:
        populate_by_name = True

class ChatResponse(BaseModel):
    response: str = Field(..., description="AI 응답")
    session_id: str = Field(..., alias="sessionId", description="세션 ID")
    function_calls: Optional[List[Dict[str, Any]]] = Field(None, alias="functionCalls", description="실행된 함수 호출")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True

class ChatSession(BaseModel):
    session_id: str = Field(..., alias="sessionId")
    user_id: str = Field(..., alias="userId")
    messages: List[ChatMessage]
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    
    class Config:
        populate_by_name = True

# OpenAI 클라이언트 초기화
settings = get_settings()
openai_client = None

def get_openai_client() -> AsyncOpenAI:
    """OpenAI 클라이언트 인스턴스 반환"""
    global openai_client
    if openai_client is None:
        if not settings.openai_api_key:
            raise HTTPException(
                status_code=500, 
                detail="OpenAI API 키가 설정되지 않았습니다. OPENAI_API_KEY 환경변수를 확인하세요."
            )
        openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
        print(f"🤖 OpenAI 클라이언트 초기화 완료 - 모델: {settings.openai_model}")
    return openai_client

# Function Calling 도구 정의 (MCP 시스템에서 가져옴)
AVAILABLE_FUNCTIONS = OPENAI_FUNCTION_SCHEMAS

# 언어별 시스템 프롬프트 생성 함수
def get_system_prompt(user_id: str, language: str = "ko") -> str:
    """언어에 따른 동적 시스템 프롬프트 생성"""
    
    # 언어별 기본 지시사항
    language_instructions = {
        "ko": "한국어로 친근하고 도움이 되는 방식으로 응답하세요.",
        "en": "Respond in English in a friendly and helpful manner.",
        "zh": "请用中文以友好且有帮助的方式回应。",
        "ar": "يرجى الرد باللغة العربية بطريقة ودودة ومفيدة.",
        "fr": "Répondez en français de manière amicale et utile.",
        "de": "Antworten Sie auf Deutsch in einer freundlichen und hilfreichen Art.",
        "es": "Responde en español de manera amigable y útil.",
        "hi": "कृपया हिंदी में मित्रवत और सहायक तरीके से उत्तर दें।",
        "ja": "日本語で親しみやすく、役立つ方法で応答してください。"
    }
    
    base_instruction = language_instructions.get(language, language_instructions["en"])
    
    return f"""You are CirclePay Global's AI assistant. Help users with USDC transfers, balance inquiries, transaction history, fee comparisons, and more through natural language requests.

Current user ID: {user_id}

**CRITICAL: MULTI-LANGUAGE RESPONSE RULE**
- **ALWAYS respond in the SAME LANGUAGE that the user uses**
- Current user language: {language}
- {base_instruction}

Available tools:
1. get_balance: Check user's USDC balance
2. get_transaction_history: Get transaction history (with limit option)
3. send_usdc: Send USDC (with advanced security validation, cross-chain support)
4. calculate_fees: Calculate transfer fees and estimated time (with chain comparison option)
5. compare_chains: Compare all supported chains by fees, time, security and recommend optimal chain
6. get_wallet_info: Get wallet information
7. check_compliance: Check transaction compliance
8. get_help: Provide AI assistant usage guide and help
9. get_security_tips: Provide security tips and precautions

Supported blockchains: ethereum, base, arbitrum, avalanche, linea, sonic

Call appropriate tools based on user requests:
- Balance/wallet info → get_balance, get_wallet_info
- Transaction history → get_transaction_history  
- Transfer requests → send_usdc (with automatic security validation)
- Fee inquiries → calculate_fees
- Chain comparison/recommendation → compare_chains
- Help/usage questions → get_help
- Security questions → get_security_tips

**Fee and Chain Comparison Rules:**
1. "Which chain is cheapest?" → compare_chains(optimize_for="cost")
2. "What's the fastest chain?" → compare_chains(optimize_for="speed")
3. "Which chain is most secure?" → compare_chains(optimize_for="security")
4. "What's the fee for sending $50?" → calculate_fees
5. "Compare with other chains" → calculate_fees(include_comparison=True) or compare_chains

**Natural Language Transfer Rules:**
1. For requests like "send $10" → immediately call send_usdc
2. If amount and address are clear → auto security validation then execute
3. If chain not specified → default: source_chain="ethereum", target_chain="ethereum"
4. After transfer completion → provide result and transaction info

**Security Feature Rules:**
1. High amount transfers (1,000+ USDC): automatic warning and additional confirmation
2. Suspicious addresses: auto-detect and risk alert
3. Security questions: "Is it safe?", "security tips" → get_security_tips
4. Usage questions: "How to use?", "help" → get_help
5. Compliance failure: stop transaction and provide guidance

**User-Friendly Response Principles:**
1. Respond in the user's language in a friendly and understandable way
2. For security warnings: provide specific reasons and solutions
3. For errors: clearly explain cause and solutions
4. For complex information: explain step by step

REMEMBER: Always match the user's language exactly in your responses."""

# 세션 관리 함수들
async def get_chat_session(session_id: str, redis_client) -> Optional[ChatSession]:
    """Redis에서 채팅 세션 조회"""
    try:
        session_data = await redis_client.get(f"chat_session:{session_id}")
        if session_data:
            data = json.loads(session_data)
            return ChatSession(**data)
        return None
    except Exception as e:
        print(f"❌ 세션 조회 오류: {e}")
        return None

async def save_chat_session(session: ChatSession, redis_client):
    """Redis에 채팅 세션 저장"""
    try:
        session_data = session.model_dump_json()
        # 24시간 TTL 설정
        await redis_client.setex(f"chat_session:{session.session_id}", 86400, session_data)
        print(f"💾 세션 저장 완료: {session.session_id}")
    except Exception as e:
        print(f"❌ 세션 저장 오류: {e}")

# Function Calling 실행 함수 (MCP 시스템 사용)
async def execute_function_call(function_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Function Call 실행 - MCP 시스템을 통해 처리"""
    try:
        print(f"🔧 MCP 도구 실행: {function_name} - 인자: {arguments}")
        result = await ai_tools_manager.execute_tool(function_name, arguments)
        print(f"✅ MCP 도구 결과: {result.get('success', False)}")
        return result
    except Exception as e:
        print(f"❌ MCP 도구 실행 오류: {str(e)}")
        return {"success": False, "error": f"도구 실행 중 오류: {str(e)}"}

@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    redis_client = Depends(get_redis)
):
    """AI와 채팅하기"""
    try:
        # OpenAI 클라이언트 가져오기
        client = get_openai_client()
        
        # 세션 ID 생성 또는 기존 세션 사용
        session_id = request.session_id or str(uuid.uuid4())
        
        # 기존 세션 조회 또는 새 세션 생성
        session = await get_chat_session(session_id, redis_client)
        if not session:
            session = ChatSession(
                session_id=session_id,
                user_id=request.user_id,
                messages=[],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
        
        # 사용자 메시지 추가
        user_message = ChatMessage(role="user", content=request.message)
        session.messages.append(user_message)
        
        # OpenAI API 호출을 위한 메시지 형식 변환 (동적 시스템 프롬프트 사용)
        openai_messages = [
            {
                "role": "system",
                "content": get_system_prompt(request.user_id, request.language)
            }
        ]
        
        # 최근 10개 메시지만 포함 (토큰 제한 고려)
        recent_messages = session.messages[-10:]
        for msg in recent_messages:
            openai_messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        print(f"🤖 OpenAI API 호출 시작 - 사용자: {request.user_id}")
        
        # OpenAI API 호출 (응답 시간 최적화 및 에러 처리 강화)
        try:
            response = await client.chat.completions.create(
                model=settings.openai_model,
                messages=openai_messages,
                tools=AVAILABLE_FUNCTIONS,
                tool_choice="auto",
                max_tokens=settings.openai_max_tokens,
                temperature=settings.openai_temperature,
                timeout=30.0  # 30초 타임아웃 설정
            )
        except Exception as openai_error:
            print(f"❌ OpenAI API 호출 실패: {str(openai_error)}")
            error_message = "죄송합니다. AI 서비스에 일시적인 문제가 발생했습니다."
            
            # 에러 유형에 따른 친화적 메시지
            if "timeout" in str(openai_error).lower():
                error_message = "응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
            elif "rate_limit" in str(openai_error).lower():
                error_message = "현재 요청이 많습니다. 잠시 후 다시 시도해 주세요."
            elif "invalid" in str(openai_error).lower():
                error_message = "요청 형식에 문제가 있습니다. 다시 말씀해 주세요."
            
            return ChatResponse(
                response=error_message,
                sessionId=session_id,
                functionCalls=[],
                timestamp=datetime.utcnow()
            )
        
        assistant_message = response.choices[0].message
        function_calls = []
        
        # Function Calling 처리
        if assistant_message.tool_calls:
            print(f"🔧 Function Calls 감지: {len(assistant_message.tool_calls)}개")
            
            # Assistant 메시지를 먼저 추가 (tool_calls 포함)
            openai_messages.append({
                "role": "assistant",
                "content": assistant_message.content,
                "tool_calls": [
                    {
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_call.function.name,
                            "arguments": tool_call.function.arguments
                        }
                    } for tool_call in assistant_message.tool_calls
                ]
            })
            
            for tool_call in assistant_message.tool_calls:
                function_name = tool_call.function.name
                arguments = json.loads(tool_call.function.arguments)
                
                print(f"📞 함수 호출: {function_name} - 인자: {arguments}")
                
                # 함수 실행
                function_result = await execute_function_call(function_name, arguments)
                function_calls.append({
                    "function": function_name,
                    "arguments": arguments,
                    "result": function_result
                })
                
                # Function 결과를 메시지에 추가
                openai_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(function_result, ensure_ascii=False)
                })
            
            # Function 결과를 포함하여 다시 OpenAI 호출
            final_response = await client.chat.completions.create(
                model=settings.openai_model,
                messages=openai_messages,
                max_tokens=settings.openai_max_tokens,
                temperature=settings.openai_temperature
            )
            
            final_content = final_response.choices[0].message.content
        else:
            final_content = assistant_message.content
        
        # AI 응답 메시지 추가
        ai_message = ChatMessage(role="assistant", content=final_content)
        session.messages.append(ai_message)
        session.updated_at = datetime.utcnow()
        
        # 세션 저장 (백그라운드)
        background_tasks.add_task(save_chat_session, session, redis_client)
        
        print(f"✅ AI 응답 완료 - 세션: {session_id}")
        
        return ChatResponse(
            response=final_content,
            session_id=session_id,
            function_calls=function_calls if function_calls else None
        )
        
    except Exception as e:
        print(f"❌ AI 채팅 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI 채팅 처리 중 오류가 발생했습니다: {str(e)}")

@router.get("/health")
async def ai_health_check():
    """AI 서비스 상태 확인"""
    try:
        client = get_openai_client()
        return {
            "status": "healthy",
            "openai_model": settings.openai_model,
            "api_key_configured": bool(settings.openai_api_key),
            "timestamp": datetime.utcnow()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow()
        }

@router.delete("/session/{session_id}")
async def clear_chat_session(session_id: str, redis_client = Depends(get_redis)):
    """채팅 세션 삭제"""
    try:
        await redis_client.delete(f"chat_session:{session_id}")
        return {"message": "세션이 삭제되었습니다", "session_id": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"세션 삭제 실패: {str(e)}")
