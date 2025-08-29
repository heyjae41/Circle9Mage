#!/bin/bash

# 🏠 CirclePay Global - 집에서 환경 설정 스크립트
# 이 스크립트는 새로운 환경에서 CirclePay Global 프로젝트를 설정합니다.

set -e

echo "🚀 CirclePay Global - 집에서 환경 설정을 시작합니다..."

# 1. Docker 설치 확인
if ! command -v docker &> /dev/null; then
    echo "❌ Docker가 설치되지 않았습니다."
    echo "Docker Desktop (macOS/Windows) 또는 Docker Engine (Linux)을 설치해주세요."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose가 설치되지 않았습니다."
    echo "Docker Compose를 설치해주세요."
    exit 1
fi

echo "✅ Docker 및 Docker Compose 확인 완료"

# 2. 필요한 파일 확인
if [ ! -f "postgresql_schema.sql" ]; then
    echo "❌ postgresql_schema.sql 파일이 없습니다."
    exit 1
fi

if [ ! -f "postgresql_data.sql" ]; then
    echo "❌ postgresql_data.sql 파일이 없습니다."
    exit 1
fi

echo "✅ 마이그레이션 파일 확인 완료"

# 3. 기존 컨테이너 정리
echo "🧹 기존 컨테이너 정리 중..."
docker-compose down -v 2>/dev/null || true
docker rm -f circlepay-postgres circlepay-redis 2>/dev/null || true

# 4. 환경 시작
echo "🐳 데이터베이스 컨테이너 시작 중..."
docker-compose up -d

# 5. 데이터베이스 준비 대기
echo "⏳ 데이터베이스 준비 대기 중..."
sleep 10

# 6. 연결 테스트
echo "🔍 데이터베이스 연결 테스트 중..."

# PostgreSQL 테스트
if docker exec circlepay-postgres pg_isready -U postgres -d circle9mage; then
    echo "✅ PostgreSQL 연결 성공"
else
    echo "❌ PostgreSQL 연결 실패"
    exit 1
fi

# Redis 테스트
if docker exec circlepay-redis redis-cli ping | grep -q "PONG"; then
    echo "✅ Redis 연결 성공"
else
    echo "❌ Redis 연결 실패"
    exit 1
fi

# 7. 데이터 확인
echo "📊 데이터 확인 중..."

USER_COUNT=$(docker exec circlepay-postgres psql -U postgres -d circle9mage -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
WALLET_COUNT=$(docker exec circlepay-postgres psql -U postgres -d circle9mage -t -c "SELECT COUNT(*) FROM wallets;" | tr -d ' ')
TRANSACTION_COUNT=$(docker exec circlepay-postgres psql -U postgres -d circle9mage -t -c "SELECT COUNT(*) FROM transactions;" | tr -d ' ')

echo "📈 데이터 현황:"
echo "   - 사용자: ${USER_COUNT}명"
echo "   - 지갑: ${WALLET_COUNT}개"
echo "   - 거래: ${TRANSACTION_COUNT}건"

# 8. 환경 변수 파일 생성
echo "⚙️ 환경 변수 파일 생성 중..."

cat > .env.example << EOF
# CirclePay Global - 환경 변수 설정
# 이 파일을 .env로 복사하고 실제 값으로 수정하세요

# 데이터베이스 설정
DATABASE_URL=postgresql://postgres:password@localhost:5433/circle9mage
REDIS_URL=redis://localhost:6379

# Circle API 설정
CIRCLE_SANDBOX_API_KEY=your_sandbox_api_key_here
CIRCLE_API_KEY=your_production_api_key_here
CIRCLE_SANDBOX_URL=https://api-sandbox.circle.com
CIRCLE_PRODUCTION_URL=https://api.circle.com

# JWT 설정
SECRET_KEY=your_secret_key_here
JWT_SECRET_KEY=your_jwt_secret_key_here

# 환경 설정
ENVIRONMENT=development
DEBUG=true

# 서버 설정
HOST=0.0.0.0
PORT=8000
EOF

echo "✅ .env.example 파일 생성 완료"

# 9. 완료 메시지
echo ""
echo "🎉 CirclePay Global 환경 설정이 완료되었습니다!"
echo ""
echo "📋 다음 단계:"
echo "1. .env.example을 .env로 복사하고 실제 값으로 수정"
echo "2. 백엔드 실행: cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000"
echo "3. 모바일 앱 실행: cd mobile && npx expo start"
echo ""
echo "🔗 데이터베이스 정보:"
echo "   - PostgreSQL: localhost:5433 (postgres/password)"
echo "   - Redis: localhost:6379"
echo ""
echo "📚 자세한 내용은 README.md를 참조하세요."
echo ""
echo "🏠 집에서 즐거운 개발 되세요! 🚀"
