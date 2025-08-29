-- 중복된 transaction_hash를 가진 거래 내역 정리
-- 1. 중복된 transaction_hash 확인
SELECT 
    transaction_hash,
    COUNT(*) as duplicate_count,
    array_agg(id) as transaction_ids
FROM transactions 
WHERE transaction_hash IS NOT NULL 
GROUP BY transaction_hash 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. 중복된 거래 중 가장 오래된 것만 남기고 나머지 삭제
WITH duplicates AS (
    SELECT 
        id,
        transaction_hash,
        ROW_NUMBER() OVER (
            PARTITION BY transaction_hash 
            ORDER BY created_at ASC
        ) as rn
    FROM transactions 
    WHERE transaction_hash IS NOT NULL
)
DELETE FROM transactions 
WHERE id IN (
    SELECT id 
    FROM duplicates 
    WHERE rn > 1
);

-- 3. 정리 후 결과 확인
SELECT 
    '정리 완료' as status,
    COUNT(*) as total_transactions,
    COUNT(DISTINCT transaction_hash) as unique_hashes
FROM transactions 
WHERE transaction_hash IS NOT NULL;

-- 4. 거래 내역 테이블 상태 확인
SELECT 
    '테이블 상태' as info,
    COUNT(*) as total_rows,
    COUNT(DISTINCT transaction_hash) as unique_hashes,
    COUNT(CASE WHEN transaction_hash IS NULL THEN 1 END) as null_hashes
FROM transactions;
