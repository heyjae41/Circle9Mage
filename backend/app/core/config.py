"""
애플리케이션 설정 관리
"""

try:
    from pydantic_settings import BaseSettings
    from pydantic import ConfigDict
except ImportError:
    # pydantic v1 호환성
    from pydantic import BaseSettings, ConfigDict
from typing import List
import os
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    """애플리케이션 설정"""
    
    # 데이터베이스
    database_url: str = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5433/circle9mage")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # Redis 개별 설정 (세션 관리용)
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str = ""  # 로컬 Redis는 비밀번호 없음
    
    # Circle API (환경변수 우선, 기본값 제공)
    circle_api_key: str = os.getenv("CIRCLE_API_KEY")
    circle_sandbox_api_key: str = os.getenv("CIRCLE_SANDBOX_API_KEY")
    circle_base_url: str = os.getenv("CIRCLE_BASE_URL")
    circle_sandbox_url: str = os.getenv("CIRCLE_SANDBOX_URL")
    # Entity Secret 관리 (Circle API 보안 요구사항)
    circle_entity_secret: str = os.getenv("CIRCLE_ENTITY_SECRET")  # 32-byte 원본 (로컬 보관용, API 전송 절대 금지)
    circle_entity_secret_ciphertext: str = os.getenv("CIRCLE_ENTITY_SECRET_CIPHERTEXT")  # RSA 암호화된 값 (API 호출용)
    circle_environment: str = "sandbox"
    
    # Security Keys (분리된 보안 키 - 실무 권장 패턴)
    secret_key: str = "btPOSbhqUxMh3h16MoUKdt9IUrm1zGoMtaZ7MZUcScs"  # FastAPI 앱, CORS, 세션용
    jwt_secret_key: str = "bdaZPpTQAvCu07vBTTc9NvkpI-aIBLz3zVepKIKIB0c"  # JWT 토큰 전용
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # 앱 설정
    debug: bool = True
    environment: str = "development"
    api_version: str = "v1"
    
    # 블록체인 설정
    supported_chains: str = "ethereum,base,arbitrum,avalanche,linea,sonic"
    
    @property
    def chain_list(self) -> List[str]:
        """지원되는 체인 리스트 반환"""
        return [chain.strip() for chain in self.supported_chains.split(",")]
    
    # 결제 설정
    default_currency: str = "USDC"
    transaction_timeout_seconds: int = 30
    max_payment_amount: float = 10000.0
    
    # 로깅
    log_level: str = "INFO"
    
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"  # 추가 필드를 무시하도록 설정
    )

# 전역 설정 인스턴스
_settings = None

def get_settings() -> Settings:
    """설정 인스턴스 반환 (싱글톤 패턴)"""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings

# 직접 접근용 인스턴스 (호환성을 위해)
settings = Settings() 