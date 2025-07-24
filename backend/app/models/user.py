"""
사용자 관련 데이터 모델
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Numeric, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database.connection import Base

class User(Base):
    """사용자 모델"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20), unique=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    country_code = Column(String(2), nullable=False)  # KR, TH, US 등
    preferred_currency = Column(String(3), default="USDC")  # USD, KRW, THB 등
    
    # Circle Wallet 정보
    circle_wallet_id = Column(String(255), unique=True, index=True)
    circle_entity_id = Column(String(255), unique=True, index=True)
    
    # 인증 정보
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    pin_hash = Column(String(255))  # 6자리 PIN 해시
    
    # KYC 정보
    kyc_status = Column(String(20), default="pending")  # pending, approved, rejected
    kyc_level = Column(Integer, default=1)  # 1: 기본, 2: 고급
    
    # 타임스탬프
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True))
    
    # 관계
    transactions = relationship("Transaction", back_populates="user")
    wallets = relationship("Wallet", back_populates="user")

class Wallet(Base):
    """지갑 모델"""
    __tablename__ = "wallets"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    
    # Circle Wallet 정보
    circle_wallet_id = Column(String(255), unique=True, nullable=False)
    wallet_address = Column(String(42), unique=True, index=True)  # Ethereum 주소
    chain_id = Column(Integer, nullable=False)  # 1: Ethereum, 8453: Base 등
    chain_name = Column(String(50), nullable=False)  # ethereum, base, arbitrum 등
    
    # 잔액 정보 (캐시용)
    usdc_balance = Column(Numeric(18, 6), default=0)
    last_balance_update = Column(DateTime(timezone=True))
    
    # 상태
    is_active = Column(Boolean, default=True)
    
    # 타임스탬프
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계
    user = relationship("User", back_populates="wallets")

class Transaction(Base):
    """거래 모델"""
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    
    # 거래 기본 정보
    transaction_id = Column(String(255), unique=True, nullable=False)  # Circle 거래 ID
    transaction_hash = Column(String(66), unique=True, index=True)  # 블록체인 해시
    transaction_type = Column(String(20), nullable=False)  # payment, transfer, withdrawal
    status = Column(String(20), default="pending")  # pending, completed, failed
    
    # 금액 정보
    amount = Column(Numeric(18, 6), nullable=False)
    currency = Column(String(3), default="USDC")
    usd_amount = Column(Numeric(18, 6))  # USD 환산 금액
    local_amount = Column(Numeric(18, 6))  # 현지 통화 환산 금액
    local_currency = Column(String(3))  # KRW, THB 등
    
    # 체인 정보
    source_chain = Column(String(50))
    target_chain = Column(String(50))
    source_address = Column(String(42))
    target_address = Column(String(42))
    
    # 수수료 정보
    gas_fee = Column(Numeric(18, 6))
    service_fee = Column(Numeric(18, 6))
    total_fee = Column(Numeric(18, 6))
    
    # 결제 관련 (QR 코드 결제인 경우)
    merchant_id = Column(String(255))
    merchant_name = Column(String(255))
    qr_code_id = Column(String(255))
    
    # 메타데이터
    metadata = Column(Text)  # JSON 형태로 추가 정보 저장
    notes = Column(Text)
    
    # 타임스탬프
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    # 관계
    user = relationship("User", back_populates="transactions") 