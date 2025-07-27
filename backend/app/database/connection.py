"""
데이터베이스 연결 관리
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import redis.asyncio as redis
from app.core.config import get_settings

# SQLAlchemy 기본 클래스
Base = declarative_base()

# 전역 변수
engine = None
async_session_maker = None
redis_client = None

async def init_db():
    """데이터베이스 초기화"""
    global engine, async_session_maker, redis_client
    
    settings = get_settings()
    
    # 데이터베이스 연결 (SQLite 또는 PostgreSQL)
    if "sqlite" in settings.database_url:
        # SQLite 연결 (connection pooling 미지원)
        engine = create_async_engine(
            settings.database_url,
            echo=settings.debug
        )
    else:
        # PostgreSQL 연결 (connection pooling 지원)
        engine = create_async_engine(
            settings.database_url.replace("postgresql://", "postgresql+asyncpg://"),
            echo=settings.debug,
            pool_size=20,
            max_overflow=30
        )
    
    # 세션 메이커
    async_session_maker = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    # Redis 연결 (개발 환경에서는 optional)
    try:
        redis_client = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True
        )
        # Redis 연결 테스트
        await redis_client.ping()
        print("✅ Redis 연결 성공")
    except Exception as e:
        print(f"⚠️  Redis 연결 실패 (개발 환경에서는 무시): {e}")
        redis_client = None
    
    # 테이블 생성 (개발 환경에서만)
    if settings.environment == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

async def get_db() -> AsyncSession:
    """데이터베이스 세션 의존성"""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def get_redis():
    """Redis 클라이언트 반환 (None일 수 있음)"""
    if redis_client is None:
        print("⚠️  Redis 사용 불가 - 캐싱 기능 비활성화")
    return redis_client

async def close_db():
    """데이터베이스 연결 종료"""
    global engine, redis_client
    
    if engine:
        await engine.dispose()
    
    if redis_client:
        await redis_client.close() 