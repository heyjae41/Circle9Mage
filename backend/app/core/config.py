"""
애플리케이션 설정 관리
"""

from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    """애플리케이션 설정"""
    
    # 데이터베이스
    database_url: str = "postgresql://postgres:password@localhost:5432/circlepay_db"
    redis_url: str = "redis://localhost:6379"
    
    # Circle API
    circle_api_key: str = ""
    circle_sandbox_api_key: str = ""
    circle_base_url: str = "https://api.circle.com"
    circle_sandbox_url: str = "https://api-sandbox.circle.com"
    
    # JWT
    secret_key: str = "super-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # 앱 설정
    debug: bool = True
    environment: str = "development"
    api_version: str = "v1"
    
    # 블록체인 설정
    supported_chains: List[str] = ["ethereum", "base", "arbitrum", "avalanche", "linea", "sonic"]
    
    # 결제 설정
    default_currency: str = "USDC"
    transaction_timeout_seconds: int = 30
    max_payment_amount: float = 10000.0
    
    # 로깅
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# 전역 설정 인스턴스
_settings = None

def get_settings() -> Settings:
    """설정 인스턴스 반환 (싱글톤 패턴)"""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings 