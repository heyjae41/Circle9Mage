"""
인증 서비스 - JWT와 SECRET_KEY 분리 사용 실무 패턴
"""

import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, Request
from app.core.config import get_settings
import hashlib
import hmac

class AuthService:
    def __init__(self):
        self.settings = get_settings()
        self.security = HTTPBearer()
    
    # ====================================
    # 🔑 JWT 토큰 관리 (JWT_SECRET_KEY 사용)
    # ====================================
    
    def create_access_token(self, data: Dict[str, Any]) -> str:
        """JWT 액세스 토큰 생성 - JWT_SECRET_KEY 사용"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=self.settings.access_token_expire_minutes)
        to_encode.update({"exp": expire, "type": "access"})
        
        # JWT 전용 키 사용
        encoded_jwt = jwt.encode(
            to_encode, 
            self.settings.jwt_secret_key,  # JWT 전용 키
            algorithm=self.settings.algorithm
        )
        return encoded_jwt
    
    def create_refresh_token(self, data: Dict[str, Any]) -> str:
        """JWT 리프레시 토큰 생성 - JWT_SECRET_KEY 사용"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=7)  # 7일 만료
        to_encode.update({"exp": expire, "type": "refresh"})
        
        # JWT 전용 키 사용
        encoded_jwt = jwt.encode(
            to_encode,
            self.settings.jwt_secret_key,  # JWT 전용 키  
            algorithm=self.settings.algorithm
        )
        return encoded_jwt
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """JWT 토큰 검증 - JWT_SECRET_KEY 사용"""
        try:
            # JWT 전용 키로 검증
            payload = jwt.decode(
                token,
                self.settings.jwt_secret_key,  # JWT 전용 키
                algorithms=[self.settings.algorithm]
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired"
            )
        except jwt.JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    
    # ====================================
    # 🛡️ 앱 보안 기능 (SECRET_KEY 사용)
    # ====================================
    
    def create_session_id(self, user_id: str) -> str:
        """세션 ID 생성 - SECRET_KEY 사용"""
        timestamp = str(int(datetime.utcnow().timestamp()))
        data = f"{user_id}:{timestamp}"
        
        # 앱 전용 키로 HMAC 생성
        signature = hmac.new(
            self.settings.secret_key.encode(),  # 앱 전용 키
            data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return f"{data}:{signature}"
    
    def verify_session_id(self, session_id: str, user_id: str) -> bool:
        """세션 ID 검증 - SECRET_KEY 사용"""
        try:
            parts = session_id.split(':')
            if len(parts) != 3:
                return False
            
            stored_user_id, timestamp, signature = parts
            if stored_user_id != user_id:
                return False
            
            # 세션 만료 확인 (24시간)
            session_time = int(timestamp)
            current_time = int(datetime.utcnow().timestamp())
            if current_time - session_time > 86400:  # 24시간
                return False
            
            # 앱 전용 키로 서명 검증
            data = f"{stored_user_id}:{timestamp}"
            expected_signature = hmac.new(
                self.settings.secret_key.encode(),  # 앱 전용 키
                data.encode(),
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(signature, expected_signature)
        except:
            return False
    
    def create_csrf_token(self, session_id: str) -> str:
        """CSRF 토큰 생성 - SECRET_KEY 사용"""
        timestamp = str(int(datetime.utcnow().timestamp()))
        data = f"{session_id}:{timestamp}"
        
        # 앱 전용 키로 CSRF 토큰 생성
        token = hmac.new(
            self.settings.secret_key.encode(),  # 앱 전용 키
            data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return f"{timestamp}:{token}"
    
    def verify_csrf_token(self, csrf_token: str, session_id: str) -> bool:
        """CSRF 토큰 검증 - SECRET_KEY 사용"""
        try:
            parts = csrf_token.split(':')
            if len(parts) != 2:
                return False
            
            timestamp, token = parts
            
            # 토큰 만료 확인 (1시간)
            token_time = int(timestamp)
            current_time = int(datetime.utcnow().timestamp())
            if current_time - token_time > 3600:  # 1시간
                return False
            
            # 앱 전용 키로 토큰 검증
            data = f"{session_id}:{timestamp}"
            expected_token = hmac.new(
                self.settings.secret_key.encode(),  # 앱 전용 키
                data.encode(),
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(token, expected_token)
        except:
            return False
    
    # ====================================
    # 🚀 FastAPI 의존성 함수들
    # ====================================
    
    async def get_current_user(
        self, 
        credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())
    ) -> Dict[str, Any]:
        """현재 사용자 정보 추출 (JWT 토큰 기반)"""
        token = credentials.credentials
        payload = self.verify_token(token)
        
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        
        return payload
    
    async def verify_csrf(self, request: Request) -> bool:
        """CSRF 토큰 검증 미들웨어"""
        if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
            csrf_token = request.headers.get("X-CSRF-Token")
            session_id = request.cookies.get("session_id")
            
            if not csrf_token or not session_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="CSRF token required"
                )
            
            if not self.verify_csrf_token(csrf_token, session_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid CSRF token"
                )
        
        return True

# ====================================
# 🌍 글로벌 인스턴스
# ====================================
auth_service = AuthService()

# ====================================
# 📝 사용 예시
# ====================================

"""
실무에서 JWT와 SECRET_KEY를 분리해서 사용하는 방법:

1. JWT_SECRET_KEY 용도:
   - JWT 액세스 토큰 서명/검증
   - JWT 리프레시 토큰 서명/검증
   - OAuth 토큰 관련 작업

2. SECRET_KEY 용도:
   - 세션 ID 생성/검증
   - CSRF 토큰 생성/검증
   - 쿠키 암호화
   - CORS 서명
   - 내부 API 서명

3. 보안상 장점:
   - 키 타협 시 피해 범위 제한
   - 각 키의 로테이션 독립적 가능
   - 감사(audit) 추적 용이
   - 규제 준수 요구사항 충족

4. 실무 패턴:
   # 로그인 시
   access_token = auth_service.create_access_token({"user_id": "123", "role": "user"})
   session_id = auth_service.create_session_id("123")
   csrf_token = auth_service.create_csrf_token(session_id)
   
   # API 호출 시
   user = await auth_service.get_current_user(credentials)  # JWT로 인증
   csrf_valid = await auth_service.verify_csrf(request)     # SECRET_KEY로 CSRF 검증
""" 