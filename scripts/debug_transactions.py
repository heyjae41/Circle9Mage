#!/usr/bin/env python3
"""
거래 내역 디버깅 스크립트
CirclePay Global 프로젝트
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv()

async def debug_transactions():
    """거래 내역 디버깅"""
    
    # 데이터베이스 연결
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5433/circle9mage")
    
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        print("✅ 데이터베이스 연결 성공")
        
        # 1. 전체 거래 수 확인
        print("\n🔍 1. 전체 거래 수 확인:")
        result = await conn.fetchval("SELECT COUNT(*) FROM transactions")
        print(f"   총 거래 수: {result}건")
        
        # 2. 거래 샘플 확인
        print("\n🔍 2. 거래 샘플 확인:")
        transactions = await conn.fetch("""
            SELECT id, user_id, wallet_id, transaction_type, amount, status, created_at 
            FROM transactions 
            ORDER BY created_at DESC 
            LIMIT 5
        """)
        
        if transactions:
            for tx in transactions:
                print(f"   - ID: {tx['id']}, User: {tx['user_id']}, Wallet: {tx['wallet_id']}")
                print(f"     Type: {tx['transaction_type']}, Amount: {tx['amount']}, Status: {tx['status']}")
                print(f"     Created: {tx['created_at']}")
        else:
            print("   ❌ 거래가 없습니다")
        
        # 3. 지갑 정보 확인
        print("\n🔍 3. 지갑 정보 확인:")
        wallets = await conn.fetch("""
            SELECT id, user_id, circle_wallet_id, wallet_address, chain_name, chain_id
            FROM wallets 
            ORDER BY created_at DESC
        """)
        
        for wallet in wallets:
            print(f"   - ID: {wallet['id']}, User: {wallet['user_id']}")
            print(f"     Circle ID: {wallet['circle_wallet_id']}")
            print(f"     Address: {wallet['wallet_address']}")
            print(f"     Chain: {wallet['chain_name']} (ID: {wallet['chain_id']})")
        
        # 4. 특정 사용자의 거래 확인 (user_id=39)
        print("\n🔍 4. User ID 39의 거래 확인:")
        user_transactions = await conn.fetch("""
            SELECT t.id, t.wallet_id, t.transaction_type, t.amount, t.status,
                   w.chain_name, w.wallet_address
            FROM transactions t
            LEFT JOIN wallets w ON t.wallet_id = w.id
            WHERE t.user_id = 39
            ORDER BY t.created_at DESC
        """)
        
        if user_transactions:
            for tx in user_transactions:
                print(f"   - ID: {tx['id']}, Wallet: {tx['wallet_id']}")
                print(f"     Type: {tx['transaction_type']}, Amount: {tx['amount']}")
                print(f"     Chain: {tx['chain_name']}, Address: {tx['wallet_address']}")
        else:
            print("   ❌ User ID 39의 거래가 없습니다")
        
        # 5. wallet_id가 NULL인 거래 확인
        print("\n🔍 5. wallet_id가 NULL인 거래 확인:")
        null_wallet_txs = await conn.fetch("""
            SELECT id, user_id, transaction_type, amount, status, created_at
            FROM transactions 
            WHERE wallet_id IS NULL
        """)
        
        if null_wallet_txs:
            print(f"   ⚠️ wallet_id가 NULL인 거래: {len(null_wallet_txs)}건")
            for tx in null_wallet_txs[:3]:  # 처음 3개만
                print(f"     - ID: {tx['id']}, User: {tx['user_id']}, Type: {tx['transaction_type']}")
        else:
            print("   ✅ wallet_id가 NULL인 거래가 없습니다")
        
        await conn.close()
        print("\n✅ 디버깅 완료")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

if __name__ == "__main__":
    asyncio.run(debug_transactions())
