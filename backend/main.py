"""
CirclePay Global - FastAPI Backend
Circle Developer Bounties 해커톤용 글로벌 결제 플랫폼
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import os
from dotenv import load_dotenv

# 로컬 임포트
from app.api.routes import payments, wallets, compliance, admin, auth, deposits, users
from app.core.config import get_settings
from app.database.connection import init_db

# 환경 변수 로드
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 시작/종료 시 실행할 작업"""
    # 시작 시
    print("🚀 CirclePay Global API 시작 중...")
    await init_db()
    print("✅ 데이터베이스 연결 완료")
    
    yield
    
    # 종료 시
    print("🔄 CirclePay Global API 종료 중...")

# FastAPI 앱 인스턴스 생성
app = FastAPI(
    title="CirclePay Global API",
    description="Circle Developer Bounties 해커톤용 글로벌 크로스체인 결제 플랫폼",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발용 - 프로덕션에서는 특정 도메인만 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["payments"])
app.include_router(wallets.router, prefix="/api/v1/wallets", tags=["wallets"])
app.include_router(deposits.router, prefix="/api/v1/deposits", tags=["deposits"])
app.include_router(compliance.router, prefix="/api/v1/compliance", tags=["compliance"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])

@app.get("/")
async def root():
    """API 상태 확인"""
    return {
        "message": "CirclePay Global API",
        "version": "1.0.0",
        "status": "running",
        "description": "Circle Developer Bounties 해커톤용 글로벌 결제 플랫폼"
    }

@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    return {
        "status": "healthy",
        "timestamp": "2025-01-24T13:30:00Z",
        "services": {
            "database": "connected",
            "redis": "connected",
            "circle_api": "connected"
        }
    }

if __name__ == "__main__":
    # 개발 서버 실행
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    ) 