-- 기존 거래들의 wallet_id를 올바르게 설정하는 마이그레이션
-- CirclePay Global 프로젝트

-- 1. User ID 47의 Base 체인 지갑 (ID: 34)으로 거래 연결
UPDATE transactions t 
SET wallet_id = w.id 
FROM wallets w 
WHERE t.user_id = 47 
  AND w.user_id = 47 
  AND w.chain_name = 'base'
  AND t.wallet_id IS NULL;

-- 2. User ID 47의 Ethereum 체인 지갑 (ID: 33)으로 거래 연결
UPDATE transactions t 
SET wallet_id = w.id 
FROM wallets w 
WHERE t.user_id = 47 
  AND w.user_id = 47 
  AND w.chain_name = 'ethereum'
  AND t.wallet_id IS NULL;

-- 3. 다른 사용자들의 거래도 동일하게 연결
UPDATE transactions t 
SET wallet_id = w.id 
FROM wallets w 
WHERE t.user_id = w.user_id 
  AND t.wallet_id IS NULL
  AND w.is_active = true;

-- 4. 마이그레이션 결과 확인
SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as total_transactions,
    COUNT(wallet_id) as transactions_with_wallet_id,
    COUNT(CASE WHEN wallet_id IS NULL THEN 1 END) as transactions_without_wallet_id
FROM transactions;
