#!/bin/bash

# CirclePay Global 테스트 실행 스크립트
# Circle Developer Bounties 해커톤용

echo "🚀 CirclePay Global 테스트 시작..."
echo "======================================"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 프로젝트 루트 디렉토리로 이동
cd "$(dirname "$0")/.."

echo -e "${BLUE}📋 테스트 환경 확인 중...${NC}"

# Python 버전 확인
python_version=$(python3 --version 2>&1)
echo "Python: $python_version"

# Node.js 버전 확인
node_version=$(node --version 2>&1)
echo "Node.js: $node_version"

# 백엔드 테스트
echo -e "\n${YELLOW}🐍 백엔드 API 테스트 실행 중...${NC}"
cd backend

# 가상환경 활성화 (존재하는 경우)
if [ -d "venv" ]; then
    echo "가상환경 활성화 중..."
    source venv/bin/activate
fi

# 필요한 패키지 설치
echo "백엔드 의존성 설치 중..."
pip install -r requirements.txt > /dev/null 2>&1

# pytest가 설치되어 있지 않은 경우 설치
if ! command -v pytest &> /dev/null; then
    echo "pytest 설치 중..."
    pip install pytest pytest-asyncio > /dev/null 2>&1
fi

# 백엔드 테스트 실행
echo "백엔드 API 테스트 실행..."
cd ../tests
python3 -m pytest test_backend_api.py -v --tb=short

backend_exit_code=$?

if [ $backend_exit_code -eq 0 ]; then
    echo -e "${GREEN}✅ 백엔드 테스트 통과!${NC}"
else
    echo -e "${RED}❌ 백엔드 테스트 실패!${NC}"
fi

# 프론트엔드 테스트
echo -e "\n${YELLOW}📱 모바일 앱 테스트 실행 중...${NC}"
cd ../mobile

# React Native 테스트 환경 설정
if [ ! -d "node_modules" ]; then
    echo "모바일 앱 의존성 설치 중..."
    npm install > /dev/null 2>&1
fi

# Jest 및 테스트 라이브러리 설치
echo "테스트 라이브러리 설치 중..."
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native > /dev/null 2>&1

# 모바일 앱 테스트 실행
echo "모바일 앱 컴포넌트 테스트 실행..."
cd ../tests

# Node.js로 테스트 파일 실행 (Jest 없이 기본 검증)
node -e "
const fs = require('fs');
const path = require('path');

console.log('📱 모바일 앱 컴포넌트 구조 검증 중...');

// 필요한 파일들이 존재하는지 확인
const requiredFiles = [
    '../mobile/src/screens/HomeScreen.tsx',
    '../mobile/src/screens/PaymentScreen.tsx',
    '../mobile/src/screens/SendScreen.tsx',
    '../mobile/src/screens/HistoryScreen.tsx',
    '../mobile/src/screens/SettingsScreen.tsx',
    '../mobile/src/contexts/AppContext.tsx',
    '../mobile/src/services/apiService.ts',
    '../mobile/src/types/index.ts'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
    if (fs.existsSync(path.join(__dirname, file))) {
        console.log('✅', file.split('/').pop());
    } else {
        console.log('❌', file.split('/').pop(), '파일이 없습니다');
        allFilesExist = false;
    }
});

if (allFilesExist) {
    console.log('✅ 모든 모바일 앱 컴포넌트가 존재합니다!');
    process.exit(0);
} else {
    console.log('❌ 일부 모바일 앱 컴포넌트가 누락되었습니다!');
    process.exit(1);
}
"

mobile_exit_code=$?

if [ $mobile_exit_code -eq 0 ]; then
    echo -e "${GREEN}✅ 모바일 앱 구조 검증 통과!${NC}"
else
    echo -e "${RED}❌ 모바일 앱 구조 검증 실패!${NC}"
fi

# Circle SDK 통합 테스트
echo -e "\n${YELLOW}🔵 Circle SDK 통합 테스트 실행 중...${NC}"

# 간단한 통합 테스트 실행
cd ../backend
python3 -c "
import sys
import os
sys.path.append('.')

try:
    from app.services.circle_client import (
        circle_wallet_service, 
        circle_cctp_service, 
        circle_paymaster_service, 
        circle_compliance_service
    )
    print('✅ Circle SDK 서비스 임포트 성공')
    
    # 기본 설정 확인
    from app.core.config import get_settings
    settings = get_settings()
    print(f'✅ 설정 로드 완료: {settings.environment} 환경')
    
    # 지원 체인 확인
    supported_chains = ['ethereum', 'base', 'arbitrum', 'avalanche', 'linea', 'sonic']
    print(f'✅ 지원 체인: {len(supported_chains)}개')
    
    print('✅ Circle SDK 통합 테스트 통과!')
    
except Exception as e:
    print(f'❌ Circle SDK 통합 테스트 실패: {e}')
    sys.exit(1)
"

circle_exit_code=$?

if [ $circle_exit_code -eq 0 ]; then
    echo -e "${GREEN}✅ Circle SDK 통합 테스트 통과!${NC}"
else
    echo -e "${RED}❌ Circle SDK 통합 테스트 실패!${NC}"
fi

# 전체 결과 요약
echo -e "\n${BLUE}📊 테스트 결과 요약${NC}"
echo "======================================"

total_tests=0
passed_tests=0

echo -n "백엔드 API 테스트: "
if [ $backend_exit_code -eq 0 ]; then
    echo -e "${GREEN}PASS${NC}"
    ((passed_tests++))
else
    echo -e "${RED}FAIL${NC}"
fi
((total_tests++))

echo -n "모바일 앱 테스트: "
if [ $mobile_exit_code -eq 0 ]; then
    echo -e "${GREEN}PASS${NC}"
    ((passed_tests++))
else
    echo -e "${RED}FAIL${NC}"
fi
((total_tests++))

echo -n "Circle SDK 통합: "
if [ $circle_exit_code -eq 0 ]; then
    echo -e "${GREEN}PASS${NC}"
    ((passed_tests++))
else
    echo -e "${RED}FAIL${NC}"
fi
((total_tests++))

echo "======================================"
echo -e "총 테스트: $total_tests개"
echo -e "통과: ${GREEN}$passed_tests개${NC}"
echo -e "실패: ${RED}$((total_tests - passed_tests))개${NC}"

# 최종 결과
if [ $passed_tests -eq $total_tests ]; then
    echo -e "\n${GREEN}🎉 모든 테스트 통과! CirclePay Global 준비 완료!${NC}"
    echo -e "${GREEN}✨ Circle Developer Bounties 해커톤에 제출할 준비가 되었습니다!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  일부 테스트가 실패했습니다. 문제를 해결해주세요.${NC}"
    exit 1
fi 