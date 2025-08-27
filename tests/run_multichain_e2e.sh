#!/bin/bash

# 멀티체인 E2E 테스트 실행 스크립트
# CirclePay Global - Circle CCTP V2 E2E Test Suite

echo "🚀 CirclePay Global 멀티체인 E2E 테스트 시작"
echo "============================================================"

# 환경 변수 확인
if [ -z "$CIRCLE_API_KEY" ]; then
    echo "⚠️ CIRCLE_API_KEY 환경 변수가 설정되지 않았습니다"
    echo "   테스트는 Mock 모드로 실행됩니다"
fi

# 현재 디렉토리를 프로젝트 루트로 설정
cd "$(dirname "$0")/.."

echo "📋 테스트 준비사항 확인"
echo "------------------------------------------------------------"

# 1. 백엔드 서버 상태 확인
echo "🔍 백엔드 서버 상태 확인 중..."
if curl -f -s http://localhost:8000/api/v1/admin/system/status > /dev/null; then
    echo "✅ 백엔드 서버 정상 작동"
else
    echo "❌ 백엔드 서버에 연결할 수 없습니다"
    echo "   다음 명령어로 백엔드 서버를 시작하세요:"
    echo "   cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000"
    exit 1
fi

# 2. PostgreSQL 연결 확인
echo "🔍 PostgreSQL 데이터베이스 연결 확인 중..."
if pg_isready -h localhost -p 5433 -q; then
    echo "✅ PostgreSQL 데이터베이스 연결 정상"
else
    echo "❌ PostgreSQL 데이터베이스에 연결할 수 없습니다"
    echo "   다음 명령어로 데이터베이스를 시작하세요:"
    echo "   docker-compose up -d postgres"
    exit 1
fi

# 3. Redis 연결 확인
echo "🔍 Redis 연결 확인 중..."
if redis-cli -p 6379 ping > /dev/null 2>&1; then
    echo "✅ Redis 연결 정상"
else
    echo "❌ Redis에 연결할 수 없습니다"
    echo "   다음 명령어로 Redis를 시작하세요:"
    echo "   docker-compose up -d redis"
    exit 1
fi

# 4. Python 의존성 확인
echo "🔍 Python 의존성 확인 중..."
if python -c "import pytest, aiohttp, websockets" > /dev/null 2>&1; then
    echo "✅ Python 의존성 설치 완료"
else
    echo "❌ Python 의존성이 설치되지 않았습니다"
    echo "   다음 명령어로 의존성을 설치하세요:"
    echo "   cd backend && pip install -r requirements.txt"
    echo "   pip install pytest aiohttp websockets"
    exit 1
fi

echo ""
echo "🧪 E2E 테스트 실행"
echo "============================================================"

# 테스트 실행 옵션
PYTEST_ARGS="-v -s --tb=short"
TEST_FILE="tests/test_multichain_e2e.py"

# 상세 로그 모드 확인
if [ "$1" = "--verbose" ] || [ "$1" = "-v" ]; then
    PYTEST_ARGS="-v -s --tb=long --capture=no"
    echo "📝 상세 로그 모드 활성화"
fi

# 빠른 테스트 모드 확인
if [ "$1" = "--quick" ] || [ "$1" = "-q" ]; then
    echo "⚡ 빠른 테스트 모드 (타임아웃 단축)"
    export E2E_QUICK_MODE=true
fi

echo "🔬 테스트 파일: $TEST_FILE"
echo "🛠️ pytest 옵션: $PYTEST_ARGS"
echo ""

# E2E 테스트 실행
echo "📋 5단계 E2E 테스트 시나리오:"
echo "   1️⃣ 회원가입 및 멀티체인 지갑 생성"
echo "   2️⃣ 멀티체인 대시보드 데이터 로드"
echo "   3️⃣ Ethereum → Base 크로스체인 송금"
echo "   4️⃣ CCTP V2 상태 변경 확인"
echo "   5️⃣ 실시간 알림 수신 확인"
echo ""

# 테스트 시작 시간 기록
start_time=$(date +%s)

# pytest 실행
if python -m pytest $PYTEST_ARGS $TEST_FILE; then
    # 테스트 성공
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    echo ""
    echo "🎉 멀티체인 E2E 테스트 완료!"
    echo "============================================================"
    echo "✅ 모든 테스트 통과"
    echo "⏱️ 실행 시간: ${duration}초"
    echo ""
    echo "📊 테스트 결과 요약:"
    echo "   - 회원가입 및 지갑 생성: ✅"
    echo "   - 멀티체인 대시보드: ✅"
    echo "   - 크로스체인 송금: ✅"
    echo "   - CCTP V2 상태 추적: ✅"
    echo "   - 실시간 알림: ✅"
    echo ""
    echo "🏆 CirclePay Global 멀티체인 시스템이 완벽하게 작동합니다!"
    
else
    # 테스트 실패
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    echo ""
    echo "❌ 멀티체인 E2E 테스트 실패"
    echo "============================================================"
    echo "⏱️ 실행 시간: ${duration}초"
    echo ""
    echo "🔍 문제 해결 방법:"
    echo "   1. 백엔드 서버가 정상 작동하는지 확인"
    echo "   2. PostgreSQL 및 Redis 연결 상태 확인"
    echo "   3. Circle API 키 설정 확인"
    echo "   4. 네트워크 연결 상태 확인"
    echo ""
    echo "📋 다시 실행하려면:"
    echo "   ./tests/run_multichain_e2e.sh"
    echo ""
    
    exit 1
fi

echo "🔗 추가 정보:"
echo "   - 테스트 로그: tests/test_multichain_e2e.py"
echo "   - 백엔드 로그: backend/logs/"
echo "   - API 문서: http://localhost:8000/docs"
echo ""
echo "📞 문제 발생 시:"
echo "   - GitHub Issues: https://github.com/your-repo/issues"
echo "   - 개발팀 연락처: dev@circlepay.global"
echo ""

exit 0
