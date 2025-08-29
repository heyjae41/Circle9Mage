#!/usr/bin/env python3
"""
지갑 ID 매핑 상태 확인 스크립트
CirclePay Global 프로젝트
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv()

async def check_wallet_mapping():
    """지갑 ID 매핑 상태 확인"""
    
    # 데이터베이스 연결
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5433/circle9mage")
    
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        print("✅ 데이터베이스 연결 성공")
        
        # 1. 특정 Circle wallet_id에 대한 거래 확인
        target_circle_wallet_id = "486f0b5d-cc6a-5d27-8db0-36a9220bb591"  # Base Sepolia
        
        print(f"\n🔍 1. Circle Wallet ID '{target_circle_wallet_id}' 관련 정보:")
        
        # 해당 Circle wallet_id를 가진 지갑 정보
        wallet_info = await conn.fetchrow("""
            SELECT id, user_id, circle_wallet_id, wallet_address, chain_name, chain_id
            FROM wallets 
            WHERE circle_wallet_id = $1
        """, target_circle_wallet_id)
        
        if wallet_info:
            print(f"   ✅ 지갑 정보 발견:")
            print(f"      - Local ID: {wallet_info['id']}")
            print(f"      - User ID: {wallet_info['user_id']}")
            print(f"      - Circle ID: {wallet_info['circle_wallet_id']}")
            print(f"      - Address: {wallet_info['wallet_address']}")
            print(f"      - Chain: {wallet_info['chain_name']} (ID: {wallet_info['chain_id']})")
            
            local_wallet_id = wallet_info['id']
            user_id = wallet_info['user_id']
            
            # 2. 해당 지갑의 거래 수 확인
            print(f"\n🔍 2. Local Wallet ID {local_wallet_id}의 거래 수:")
            
            # wallet_id가 정확히 매칭되는 거래
            exact_match_count = await conn.fetchval("""
                SELECT COUNT(*) FROM transactions 
                WHERE wallet_id = $1
            """, local_wallet_id)
            print(f"   - wallet_id = {local_wallet_id}: {exact_match_count}건")
            
            # user_id만 매칭되는 거래 (wallet_id가 NULL이거나 다른 값)
            user_only_count = await conn.fetchval("""
                SELECT COUNT(*) FROM transactions 
                WHERE user_id = $1 AND (wallet_id IS NULL OR wallet_id != $2)
            """, user_id, local_wallet_id)
            print(f"   - user_id = {user_id} (wallet_id != {local_wallet_id}): {user_only_count}건")
            
            # 3. 실제 거래 샘플 확인
            print(f"\n🔍 3. Local Wallet ID {local_wallet_id}의 거래 샘플:")
            transactions = await conn.fetch("""
                SELECT id, transaction_type, amount, status, created_at, wallet_id
                FROM transactions 
                WHERE wallet_id = $1
                ORDER BY created_at DESC 
                LIMIT 5
            """, local_wallet_id)
            
            if transactions:
                for tx in transactions:
                    print(f"   - ID: {tx['id']}, Type: {tx['transaction_type']}, Amount: {tx['amount']}")
                    print(f"     Status: {tx['status']}, Wallet ID: {tx['wallet_id']}, Created: {tx['created_at']}")
            else:
                print("   ❌ 해당 wallet_id로 저장된 거래가 없습니다")
            
            # 4. wallet_id가 NULL인 거래 확인
            print(f"\n🔍 4. User ID {user_id}의 wallet_id가 NULL인 거래:")
            null_wallet_txs = await conn.fetch("""
                SELECT id, transaction_type, amount, status, created_at
                FROM transactions 
                WHERE user_id = $1 AND wallet_id IS NULL
                ORDER BY created_at DESC 
                LIMIT 5
            """, user_id)
            
            if null_wallet_txs:
                print(f"   ⚠️ wallet_id가 NULL인 거래: {len(null_wallet_txs)}건")
                for tx in null_wallet_txs:
                    print(f"     - ID: {tx['id']}, Type: {tx['transaction_type']}, Amount: {tx['amount']}")
            else:
                print("   ✅ wallet_id가 NULL인 거래가 없습니다")
                
        else:
            print(f"   ❌ Circle Wallet ID '{target_circle_wallet_id}'를 가진 지갑을 찾을 수 없습니다")
        
        await conn.close()
        print("\n✅ 지갑 ID 매핑 확인 완료")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

if __name__ == "__main__":
    asyncio.run(check_wallet_mapping())
