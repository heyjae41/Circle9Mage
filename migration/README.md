# 🏠 CirclePay Global - 집에서 앱 개발을 위한 데이터베이스 마이그레이션 가이드

## 📋 개요
이 문서는 CirclePay Global 프로젝트를 집에서 개발하기 위해 현재 개발 환경의 데이터베이스를 새로운 환경으로 마이그레이션하는 방법을 설명합니다.

## 🗄️ 데이터베이스 정보

### PostgreSQL
- **데이터베이스명**: circle9mage
- **사용자**: postgres
- **비밀번호**: password
- **포트**: 5433 (로컬 개발용)

### Redis
- **포트**: 6379
- **데이터베이스**: 0

## 📁 마이그레이션 파일들

### 1. PostgreSQL 스키마
- **파일**: `postgresql_schema.sql`
- **내용**: 테이블 구조, 인덱스, 제약조건 등

### 2. PostgreSQL 데이터
- **파일**: `postgresql_data.sql`
- **내용**: 실제 데이터 (사용자, 지갑, 거래 내역 등)

### 3. Redis 데이터
- **파일**: `redis_*.rdb`
- **내용**: Redis 키-값 데이터

## 🚀 집에서 환경 설정

### 1. Docker 설치
```bash
# Docker Desktop 설치 (macOS/Windows)
# 또는 Docker Engine 설치 (Linux)
```

### 2. 프로젝트 클론
```bash
git clone <your-repo-url>
cd circle9mage
```

### 3. 환경 변수 설정
```bash
# .env 파일 생성
cp .env.example .env

# 필요한 환경 변수 설정
DATABASE_URL=postgresql://postgres:password@localhost:5433/circle9mage
REDIS_URL=redis://localhost:6379
```

## 🔄 데이터베이스 복원

### 1. PostgreSQL 컨테이너 실행
```bash
docker run --name circlepay-postgres \
  -e POSTGRES_DB=circle9mage \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5433:5432 \
  -d postgres:15
```

### 2. Redis 컨테이너 실행
```bash
docker run --name circlepay-redis \
  -p 6379:6379 \
  -d redis:7-alpine
```

### 3. PostgreSQL 스키마 복원
```bash
# 데이터베이스 생성
docker exec -i circlepay-postgres psql -U postgres -c "CREATE DATABASE circle9mage;"

# 스키마 복원
docker exec -i circlepay-postgres psql -U postgres -d circle9mage < migration/postgresql_schema.sql
```

### 4. PostgreSQL 데이터 복원
```bash
# 데이터 복원
docker exec -i circlepay-postgres psql -U postgres -d circle9mage < migration/postgresql_data.sql
```

### 5. Redis 데이터 복원
```bash
# Redis 데이터 복원 (필요시)
docker exec -i circlepay-redis redis-cli restore circlepay:test 0 "$(cat migration/redis_circlepay_test.rdb)"
```

## 🧪 테스트

### 1. 백엔드 실행
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 모바일 앱 실행
```bash
cd mobile
npx expo start
```

### 3. 연결 테스트
```bash
# PostgreSQL 연결 테스트
docker exec -i circlepay-postgres psql -U postgres -d circle9mage -c "SELECT COUNT(*) FROM users;"

# Redis 연결 테스트
docker exec -i circlepay-redis redis-cli ping
```

## 📊 현재 데이터 현황

### 테이블별 레코드 수
- **users**: 사용자 정보
- **wallets**: 멀티체인 지갑
- **transactions**: 거래 내역
- **kyc_documents**: KYC 문서
- **circlepay_connection_test**: 연결 테스트

### 주요 데이터
- 사용자 계정 (회원가입 완료)
- Circle API 연동 정보
- 멀티체인 지갑 (Ethereum, Base)
- USDC 거래 내역
- KYC 인증 상태

## ⚠️ 주의사항

1. **환경 변수**: `.env` 파일의 API 키와 비밀번호를 새 환경에 맞게 수정
2. **포트 충돌**: 5433, 6379, 8000 포트가 사용 가능한지 확인
3. **Circle API**: 새로운 환경에서 Circle API 키 재설정 필요
4. **데이터 백업**: 마이그레이션 전 현재 데이터 백업 권장

## 🆘 문제 해결

### PostgreSQL 연결 오류
```bash
# 컨테이너 상태 확인
docker ps -a

# 로그 확인
docker logs circlepay-postgres

# 컨테이너 재시작
docker restart circlepay-postgres
```

### Redis 연결 오류
```bash
# Redis 상태 확인
docker exec -i circlepay-redis redis-cli ping

# 컨테이너 재시작
docker restart circlepay-redis
```

## 📞 지원
마이그레이션 중 문제가 발생하면 프로젝트 이슈를 확인하거나 개발팀에 문의하세요.

---
**마지막 업데이트**: 2025년 8월 28일
**버전**: 1.0.0
