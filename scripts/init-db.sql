-- 🗄️ CirclePay Global - 데이터베이스 초기화 스크립트
-- PostgreSQL 데이터베이스 생성 및 테이블 스키마 설정

-- 데이터베이스 생성 (이미 존재하는 경우 무시)
SELECT 'CREATE DATABASE circlepay_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'circlepay_db')\gexec

-- 데이터베이스 연결
\c circlepay_db;

-- ====================================
-- 📊 테이블 생성
-- ====================================

-- 1. 사용자 테이블 (users)
CREATE TABLE IF NOT EXISTS users (
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

-- 2. 지갑 테이블 (wallets)
CREATE TABLE IF NOT EXISTS wallets (
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

-- 3. 거래 테이블 (transactions)
CREATE TABLE IF NOT EXISTS transactions (
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

-- 4. KYC 문서 테이블 (kyc_documents)
CREATE TABLE IF NOT EXISTS kyc_documents (
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

-- ====================================
-- 🔍 인덱스 생성
-- ====================================

-- users 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_circle_wallet_id ON users(circle_wallet_id);
CREATE INDEX IF NOT EXISTS idx_users_circle_entity_id ON users(circle_entity_id);
CREATE INDEX IF NOT EXISTS idx_users_circle_wallet_set_id ON users(circle_wallet_set_id);
CREATE INDEX IF NOT EXISTS idx_users_primary_wallet_id ON users(primary_wallet_id);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);

-- wallets 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_circle_wallet_id ON wallets(circle_wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallets_wallet_address ON wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallets_chain_id ON wallets(chain_id);
CREATE INDEX IF NOT EXISTS idx_wallets_chain_name ON wallets(chain_name);

-- transactions 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id ON transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_hash ON transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_type ON transactions(transaction_type);

-- kyc_documents 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_id ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_document_type ON kyc_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_verification_status ON kyc_documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_created_at ON kyc_documents(created_at);

-- ====================================
-- 🔒 제약 조건 설정
-- ====================================

-- wallets 테이블: 사용자별 체인당 하나의 지갑만 허용
ALTER TABLE wallets ADD CONSTRAINT IF NOT EXISTS uq_user_chain UNIQUE (user_id, chain_id);

-- ====================================
-- ⚡ 트리거 및 함수 생성
-- ====================================

-- 자동 업데이트를 위한 함수 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at 
    BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kyc_documents_updated_at ON kyc_documents;
CREATE TRIGGER update_kyc_documents_updated_at 
    BEFORE UPDATE ON kyc_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================
-- 📊 샘플 데이터 (개발용)
-- ====================================

-- 개발 환경에서만 샘플 데이터 삽입
DO $$
BEGIN
    -- 샘플 사용자 (테스트용)
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'test@circlepay.com') THEN
        INSERT INTO users (email, phone, first_name, last_name, country_code, preferred_currency, is_verified, is_active)
        VALUES ('test@circlepay.com', '+821012345678', 'Test', 'User', 'KR', 'USDC', true, true);
    END IF;
    
    -- 샘플 지갑 (테스트용)
    IF NOT EXISTS (SELECT 1 FROM wallets WHERE circle_wallet_id = 'test_wallet_1') THEN
        INSERT INTO wallets (user_id, circle_wallet_id, wallet_address, chain_id, chain_name, usdc_balance, is_active)
        VALUES (
            (SELECT id FROM users WHERE email = 'test@circlepay.com'),
            'test_wallet_1',
            '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
            1,
            'ethereum',
            100.00,
            true
        );
    END IF;
END $$;

-- ====================================
-- ✅ 완료 메시지
-- ====================================
SELECT 'CirclePay Global 데이터베이스 초기화 완료!' as status;
