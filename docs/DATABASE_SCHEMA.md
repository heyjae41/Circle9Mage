# 🗄️ CirclePay Global - 데이터베이스 스키마 및 설정

## 📋 개요

CirclePay Global 프로젝트의 데이터베이스 스키마와 Redis 설정을 정리한 문서입니다. 
다른 서버로 이관하거나 새로운 환경에서 데이터베이스를 구축할 때 참고하세요.

## 🐘 PostgreSQL 데이터베이스

### 1. 데이터베이스 생성

```sql
-- PostgreSQL 데이터베이스 생성
CREATE DATABASE circlepay_db
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

-- 데이터베이스 연결
\c circlepay_db;
```

### 2. 테이블 스키마 (DDL)

#### 2.1 사용자 테이블 (users)

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    preferred_currency VARCHAR(10) DEFAULT 'USDC',
    
    -- Circle Wallet 정보
    circle_wallet_id VARCHAR(255) UNIQUE,
    circle_entity_id VARCHAR(255) UNIQUE,
    circle_wallet_set_id VARCHAR(255) UNIQUE,
    primary_wallet_id VARCHAR(255),
    
    -- 인증 정보
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    pin_hash VARCHAR(255),
    
    -- KYC 정보
    kyc_status VARCHAR(20) DEFAULT 'pending',
    kyc_level INTEGER DEFAULT 1,
    
    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- 인덱스 생성
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_circle_wallet_id ON users(circle_wallet_id);
CREATE INDEX idx_users_circle_entity_id ON users(circle_entity_id);
CREATE INDEX idx_users_circle_wallet_set_id ON users(circle_wallet_set_id);
CREATE INDEX idx_users_primary_wallet_id ON users(primary_wallet_id);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
```

#### 2.2 지갑 테이블 (wallets)

```sql
CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Circle Wallet 정보
    circle_wallet_id VARCHAR(255) UNIQUE NOT NULL,
    wallet_address VARCHAR(42),
    chain_id INTEGER NOT NULL,
    chain_name VARCHAR(50) NOT NULL,
    
    -- 잔액 정보 (캐시용)
    usdc_balance NUMERIC(18, 6) DEFAULT 0,
    last_balance_update TIMESTAMP WITH TIME ZONE,
    
    -- 상태
    is_active BOOLEAN DEFAULT TRUE,
    
    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_circle_wallet_id ON wallets(circle_wallet_id);
CREATE INDEX idx_wallets_wallet_address ON wallets(wallet_address);
CREATE INDEX idx_wallets_chain_id ON wallets(chain_id);
CREATE INDEX idx_wallets_chain_name ON wallets(chain_name);

-- 제약 조건: 사용자별 체인당 하나의 지갑만 허용
ALTER TABLE wallets ADD CONSTRAINT uq_user_chain UNIQUE (user_id, chain_id);
```

#### 2.3 거래 테이블 (transactions)

```sql
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 거래 기본 정보
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    transaction_hash VARCHAR(66) UNIQUE,
    transaction_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    
    -- 금액 정보
    amount NUMERIC(18, 6) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USDC',
    usd_amount NUMERIC(18, 6),
    local_amount NUMERIC(18, 6),
    local_currency VARCHAR(3),
    
    -- 체인 정보
    source_chain VARCHAR(50),
    target_chain VARCHAR(50),
    source_address VARCHAR(42),
    target_address VARCHAR(42),
    
    -- 수수료 정보
    gas_fee NUMERIC(18, 6),
    service_fee NUMERIC(18, 6),
    total_fee NUMERIC(18, 6),
    
    -- 결제 관련 (QR 코드 결제인 경우)
    merchant_id VARCHAR(255),
    merchant_name VARCHAR(255),
    qr_code_id VARCHAR(255),
    
    -- 메타데이터
    extra_metadata TEXT,
    notes TEXT,
    
    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 인덱스 생성
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_transaction_id ON transactions(transaction_id);
CREATE INDEX idx_transactions_transaction_hash ON transactions(transaction_hash);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_transaction_type ON transactions(transaction_type);
```

#### 2.4 KYC 문서 테이블 (kyc_documents)

```sql
CREATE TABLE kyc_documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 문서 타입
    document_type VARCHAR(50) NOT NULL,
    document_number VARCHAR(100),
    
    -- 개인 정보 (KYC Level 1)
    full_name VARCHAR(200),
    date_of_birth VARCHAR(10),
    nationality VARCHAR(2),
    gender VARCHAR(10),
    
    -- 주소 정보 (KYC Level 2)
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2),
    
    -- 직업 정보 (KYC Level 2)
    occupation VARCHAR(100),
    employer VARCHAR(200),
    income_range VARCHAR(50),
    source_of_funds VARCHAR(100),
    
    -- 문서 파일 정보
    file_url VARCHAR(500),
    file_type VARCHAR(20),
    file_size INTEGER,
    
    -- 검증 정보
    verification_status VARCHAR(20) DEFAULT 'pending',
    verification_method VARCHAR(50),
    verification_notes TEXT,
    verified_by VARCHAR(100),
    verified_at TIMESTAMP WITH TIME ZONE,
    
    -- 컴플라이언스 검사
    compliance_check_id VARCHAR(255),
    risk_score NUMERIC(3, 2),
    risk_factors TEXT,
    
    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 인덱스 생성
CREATE INDEX idx_kyc_documents_user_id ON kyc_documents(user_id);
CREATE INDEX idx_kyc_documents_document_type ON kyc_documents(document_type);
CREATE INDEX idx_kyc_documents_verification_status ON kyc_documents(verification_status);
CREATE INDEX idx_kyc_documents_created_at ON kyc_documents(created_at);
```

### 3. 시퀀스 및 시퀀스 함수

```sql
-- 자동 업데이트를 위한 함수 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kyc_documents_updated_at BEFORE UPDATE ON kyc_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 4. 데이터베이스 권한 설정

```sql
-- 데이터베이스 사용자 생성 (선택사항)
CREATE USER circlepay_user WITH PASSWORD 'your_secure_password';

-- 권한 부여
GRANT CONNECT ON DATABASE circlepay_db TO circlepay_user;
GRANT USAGE ON SCHEMA public TO circlepay_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO circlepay_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO circlepay_user;

-- 향후 생성될 테이블에 대한 권한
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO circlepay_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO circlepay_user;
```

## 🔴 Redis 설정

### 1. Redis 설치 및 실행

#### Ubuntu/Debian
```bash
# Redis 설치
sudo apt update
sudo apt install redis-server

# Redis 서비스 시작
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Redis 상태 확인
sudo systemctl status redis-server
```

#### macOS
```bash
# Homebrew로 Redis 설치
brew install redis

# Redis 서비스 시작
brew services start redis

# Redis 상태 확인
brew services list | grep redis
```

#### Docker
```bash
# Redis 컨테이너 실행
docker run -d \
  --name redis-circlepay \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:7-alpine

# Redis 컨테이너 상태 확인
docker ps | grep redis
```

### 2. Redis 설정 파일 (redis.conf)

```conf
# 기본 설정
port 6379
bind 127.0.0.1
timeout 0
tcp-keepalive 300

# 메모리 관리
maxmemory 256mb
maxmemory-policy allkeys-lru

# 지속성 설정
save 900 1
save 300 10
save 60 10000

# 로그 설정
loglevel notice
logfile /var/log/redis/redis-server.log

# 보안 설정 (프로덕션 환경)
# requirepass your_redis_password_here
```

### 3. Redis 연결 테스트

```bash
# Redis CLI로 연결 테스트
redis-cli ping
# 응답: PONG

# Redis 정보 확인
redis-cli info server
redis-cli info memory
redis-cli info clients
```

## 🚀 환경 변수 설정

### 1. .env 파일 예시

```bash
# 데이터베이스 설정
DATABASE_URL=postgresql://postgres:password@localhost:5432/circlepay_db
REDIS_URL=redis://localhost:6379

# 보안 키
SECRET_KEY=your_super_secret_key_here
JWT_SECRET_KEY=your_jwt_secret_key_here

# Circle API 설정
CIRCLE_SANDBOX_API_KEY=your_circle_sandbox_api_key
CIRCLE_ENTITY_SECRET=your_32_byte_entity_secret
```

### 2. 환경별 설정

#### 개발 환경
```bash
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG
```

#### 프로덕션 환경
```bash
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
```

## 📊 데이터베이스 모니터링

### 1. PostgreSQL 모니터링

```sql
-- 활성 연결 수 확인
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- 테이블 크기 확인
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 인덱스 사용률 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### 2. Redis 모니터링

```bash
# Redis 메모리 사용량
redis-cli info memory

# Redis 키 개수
redis-cli dbsize

# Redis 명령어 통계
redis-cli info stats

# Redis 클라이언트 연결 정보
redis-cli client list
```

## 🔧 문제 해결

### 1. PostgreSQL 연결 문제

```bash
# PostgreSQL 서비스 상태 확인
sudo systemctl status postgresql

# PostgreSQL 로그 확인
sudo tail -f /var/log/postgresql/postgresql-*.log

# PostgreSQL 재시작
sudo systemctl restart postgresql
```

### 2. Redis 연결 문제

```bash
# Redis 서비스 상태 확인
sudo systemctl status redis-server

# Redis 로그 확인
sudo tail -f /var/log/redis/redis-server.log

# Redis 재시작
sudo systemctl restart redis-server
```

## 📝 참고 사항

1. **데이터베이스 백업**: 정기적인 백업을 권장합니다
2. **보안**: 프로덕션 환경에서는 강력한 비밀번호와 방화벽 설정을 필수로 합니다
3. **성능**: 대용량 데이터의 경우 인덱스 최적화를 고려하세요
4. **확장성**: 필요에 따라 읽기 전용 복제본을 구성할 수 있습니다

## 🔗 관련 링크

- [PostgreSQL 공식 문서](https://www.postgresql.org/docs/)
- [Redis 공식 문서](https://redis.io/documentation)
- [SQLAlchemy 문서](https://docs.sqlalchemy.org/)
- [Circle API 문서](https://developers.circle.com/)
