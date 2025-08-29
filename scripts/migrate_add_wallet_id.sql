-- Transaction 테이블에 wallet_id 컬럼 추가 마이그레이션
-- CirclePay Global 프로젝트

-- 1. wallet_id 컬럼 추가
ALTER TABLE transactions 
ADD COLUMN wallet_id INTEGER;

-- 2. 외래키 제약 조건 추가
ALTER TABLE transactions 
ADD CONSTRAINT fk_transactions_wallet_id 
FOREIGN KEY (wallet_id) REFERENCES wallets(id);

-- 3. 인덱스 생성 (성능 향상)
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);

-- 4. 기존 데이터에 대한 wallet_id 업데이트 (선택사항)
-- source_chain과 chain_name을 기반으로 적절한 wallet_id 설정
UPDATE transactions t 
SET wallet_id = w.id 
FROM wallets w 
WHERE t.source_chain = w.chain_name 
AND t.user_id = w.user_id;

-- 5. 마이그레이션 완료 확인
SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as total_transactions,
    COUNT(wallet_id) as transactions_with_wallet_id
FROM transactions;
