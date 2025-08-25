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
        
        # OpenAI API 호출을 위한 메시지 형식 변환
        openai_messages = [
            {
                "role": "system",
                "content": f"""당신은 CirclePay Global의 AI 어시스턴트입니다. 
사용자가 자연어로 USDC 송금, 잔액 조회, 거래내역 확인, 수수료 비교 등을 요청할 수 있도록 도와주세요.

현재 사용자 ID: {request.user_id}

사용 가능한 도구들:
1. get_balance: 사용자의 USDC 잔액 조회
2. get_transaction_history: 거래 내역 조회 (limit 옵션 가능)
3. send_usdc: USDC 송금 (고급 보안 검증 포함, 크로스체인 지원)
4. calculate_fees: 송금 수수료 계산 및 예상 시간 제공 (체인 비교 옵션)
5. compare_chains: 모든 지원 체인별 수수료, 시간, 보안성 비교 및 최적 체인 추천
6. get_wallet_info: 지갑 정보 조회
7. check_compliance: 거래 컴플라이언스 검사
8. get_help: AI 어시스턴트 사용법과 도움말 제공
9. get_security_tips: 보안 팁과 주의사항 제공

지원 블록체인: ethereum, base, arbitrum, avalanche, linea, sonic

사용자 요청에 따라 적절한 도구를 호출하세요:
- 잔액/지갑 정보 요청 → get_balance, get_wallet_info 호출
- 거래내역 요청 → get_transaction_history 호출
- 송금 요청 → send_usdc 호출 (자동 보안 검증 포함)
- 수수료 문의 → calculate_fees 호출
- 체인 비교/추천 요청 → compare_chains 호출
- 도움말/사용법 요청 → get_help 호출
- 보안 관련 질문 → get_security_tips 호출

**수수료 및 체인 비교 처리 규칙:**
1. "어떤 체인이 제일 저렴해?" → compare_chains(optimize_for="cost") 호출
2. "가장 빠른 체인은?" → compare_chains(optimize_for="speed") 호출  
3. "가장 안전한 체인은?" → compare_chains(optimize_for="security") 호출
4. "50달러 보내는데 수수료는?" → calculate_fees 호출
5. "다른 체인과 비교해줘" → calculate_fees(include_comparison=True) 또는 compare_chains 호출

**자연어 송금 처리 규칙:**
1. "10달러 송금해줘" 등의 요청 시 즉시 send_usdc 호출
2. 금액과 주소가 명확하면 자동 보안 검증 후 실행
3. 체인 미지정 시 기본값: source_chain="ethereum", target_chain="ethereum"
4. 송금 완료 후 결과와 트랜잭션 정보 안내

**보안 기능 활용 규칙:**
1. 고액 송금 (1,000 USDC 이상): 자동 경고 및 추가 확인 요구
2. 의심스러운 주소: 자동 감지하여 위험 알림
3. 보안 관련 질문: "안전해?", "보안 팁" → get_security_tips 호출
4. 사용법 문의: "어떻게 써?", "도움말" → get_help 호출
5. 컴플라이언스 실패: 거래 중단 및 안내

**사용자 친화적 응답 원칙:**
1. 한국어로 친근하고 이해하기 쉽게 설명
2. 보안 경고 시 구체적인 이유와 대응 방법 제시
3. 에러 발생 시 원인과 해결책을 명확히 안내
4. 복잡한 정보는 단계별로 나누어 설명

한국어로 친근하고 도움이 되는 방식으로 응답하세요."""
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
