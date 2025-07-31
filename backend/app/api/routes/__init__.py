"""
CirclePay Global - API Routes Package
Circle Developer Bounties 해커톤용 API 라우트 모듈
"""

# 주요 라우터들을 여기서 import할 수 있도록 설정
from . import auth
from . import users  
from . import payments
from . import wallets
from . import deposits
from . import compliance
from . import admin

__all__ = [
    "auth",
    "users", 
    "payments",
    "wallets", 
    "deposits",
    "compliance",
    "admin"
]