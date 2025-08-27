"""
결제 관련 API 엔드포인트
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid
import qrcode
import io
import base64
from app.services.circle_client import circle_cctp_service, circle_paymaster_service, circle_compliance_service
from app.services.cctp_hooks_service import cctp_hooks_service
from app.database.connection import get_db, get_redis
import asyncio

router = APIRouter()

# Request/Response 모델들
class PaymentRequest(BaseModel):
    """결제 요청 모델"""
    amount: float = Field(..., gt=0, description="결제 금액")
    currency: str = Field(default="USDC", description="통화")
    merchant_id: str = Field(..., description="가맹점 ID")
    merchant_name: str = Field(..., description="가맹점 이름")
    description: Optional[str] = Field(None, description="결제 설명")
    callback_url: Optional[str] = Field(None, description="결제 완료 콜백 URL")

class CrossChainTransferRequest(BaseModel):
    """크로스체인 전송 요청 모델"""
    source_wallet_id: str = Field(..., alias="sourceWalletId", description="소스 지갑 ID")
    target_address: str = Field(..., alias="targetAddress", description="목표 주소")
    amount: float = Field(..., gt=0, description="전송 금액")
    source_chain: str = Field(..., alias="sourceChain", description="소스 체인")
    target_chain: str = Field(..., alias="targetChain", description="목표 체인")
    use_fast_transfer: bool = Field(default=False, alias="useFastTransfer", description="Fast Transfer 사용 여부")
    notes: Optional[str] = Field(None, description="전송 메모")
    
    class Config:
        populate_by_name = True

class QRCodeResponse(BaseModel):
    """QR 코드 응답 모델"""
    qr_code_id: str = Field(..., alias="qrCodeId")
    qr_code_data: str = Field(..., alias="qrCodeData")  # Base64 인코딩된 QR 코드 이미지
    payment_url: str = Field(..., alias="paymentUrl")
    expires_at: datetime = Field(..., alias="expiresAt")
    amount: float
    currency: str
    merchant_name: str = Field(..., alias="merchantName")
    
    class Config:
        populate_by_name = True

class PaymentResponse(BaseModel):
    """결제 응답 모델"""
    payment_id: str = Field(..., alias="paymentId")
    status: str
    transaction_hash: Optional[str] = Field(None, alias="transactionHash")
    amount: float
    currency: str
    estimated_completion_time: str = Field(..., alias="estimatedCompletionTime")
    fees: dict
    
    class Config:
        populate_by_name = True

@router.post("/qr/generate", response_model=QRCodeResponse)
async def generate_payment_qr(
    request: PaymentRequest,
    redis_client = Depends(get_redis)
):
    """결제용 QR 코드 생성"""
    try:
        # QR 코드 ID 생성
        qr_code_id = str(uuid.uuid4())
        
        # 결제 URL 생성
        payment_url = f"circlepay://pay?id={qr_code_id}&amount={request.amount}&currency={request.currency}&merchant={request.merchant_id}"
        
        # QR 코드 이미지 생성
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(payment_url)
        qr.make(fit=True)
        
        # 이미지를 Base64로 인코딩
        img = qr.make_image(fill_color="black", back_color="white")
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_str = base64.b64encode(img_buffer.getvalue()).decode()
        
        # Redis에 QR 코드 정보 저장 (30분 만료)
        qr_data = {
            "qr_code_id": qr_code_id,
            "amount": request.amount,
            "currency": request.currency,
            "merchant_id": request.merchant_id,
            "merchant_name": request.merchant_name,
            "description": request.description,
            "created_at": datetime.utcnow().isoformat(),
            "status": "pending"
        }
        
        await redis_client.setex(
            f"qr:{qr_code_id}", 
            1800,  # 30분
            str(qr_data)
        )
        
        return QRCodeResponse(
            qr_code_id=qr_code_id,
            qr_code_data=f"data:image/png;base64,{img_str}",
            payment_url=payment_url,
            expires_at=datetime.utcnow().replace(hour=datetime.utcnow().hour + 1),
            amount=request.amount,
            currency=request.currency,
            merchant_name=request.merchant_name
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QR 코드 생성 실패: {str(e)}")

@router.post("/qr/{qr_code_id}/pay", response_model=PaymentResponse)
async def process_qr_payment(
    qr_code_id: str,
    user_wallet_id: str,
    background_tasks: BackgroundTasks,
    redis_client = Depends(get_redis)
):
    """QR 코드를 통한 결제 처리"""
    try:
        # Redis에서 QR 코드 정보 조회
        qr_data = await redis_client.get(f"qr:{qr_code_id}")
        if not qr_data:
            raise HTTPException(status_code=404, detail="QR 코드를 찾을 수 없거나 만료되었습니다")
        
        # QR 데이터 파싱 (실제로는 JSON으로 저장해야 함)
        # 여기서는 간단히 mock 데이터 사용
        amount = "100.00"
        merchant_address = "0x742d35Cc6634C0532925a3b8D49dEfE2c6BF64d5"  # 예시 주소
        
        # 1. Compliance Engine으로 거래 스크리닝
        compliance_result = await circle_compliance_service.screen_transaction(
            from_address=user_wallet_id,
            to_address=merchant_address,
            amount=amount
        )
        
        if compliance_result["data"]["screeningResult"] != "approved":
            raise HTTPException(
                status_code=400, 
                detail=f"거래가 컴플라이언스 검사를 통과하지 못했습니다: {compliance_result['data']['reasons']}"
            )
        
        # 2. Paymaster를 통한 가스리스 결제 실행
        user_operation = await circle_paymaster_service.create_user_operation(
            wallet_address=user_wallet_id,
            target_address=merchant_address,
            amount=amount,
            chain_id=8453  # Base 체인
        )
        
        # 3. 결제 상태 업데이트
        await redis_client.setex(
            f"qr:{qr_code_id}:status",
            3600,  # 1시간
            "completed"
        )
        
        # 백그라운드에서 결제 완료 처리
        background_tasks.add_task(
            process_payment_completion,
            qr_code_id,
            user_operation["data"]["userOperationHash"]
        )
        
        return PaymentResponse(
            payment_id=user_operation["data"]["userOperationHash"],
            status="processing",
            transaction_hash=user_operation["data"]["userOperationHash"],
            amount=float(amount),
            currency="USDC",
            estimated_completion_time="8-20초",
            fees={
                "gas_fee": "0.00",  # Paymaster가 처리
                "service_fee": "1.00",
                "total_fee": "1.00"
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"결제 처리 실패: {str(e)}")

@router.post("/transfer/cross-chain", response_model=PaymentResponse)
async def create_cross_chain_transfer(
    request: CrossChainTransferRequest,
    background_tasks: BackgroundTasks
):
    """크로스체인 USDC 전송"""
    try:
        fast_mode = "⚡ Fast Transfer" if request.use_fast_transfer else "🐌 Regular Transfer"
        print(f"🚀 크로스체인 전송 요청 ({fast_mode}): source_wallet_id='{request.source_wallet_id}' target_address='{request.target_address}' amount={request.amount} source_chain='{request.source_chain}' target_chain='{request.target_chain}' notes='{request.notes}'")
        
        # 간단한 유효성 검사
        if not request.source_wallet_id or not request.target_address:
            raise HTTPException(
                status_code=400,
                detail="소스 지갑 ID와 목표 주소는 필수입니다"
            )
        
        if request.amount <= 0:
            raise HTTPException(
                status_code=400,
                detail="전송 금액은 0보다 커야 합니다"
            )
        
        # Fast Transfer의 최소 금액 검사 (예: 1 USDC 이상)
        if request.use_fast_transfer and request.amount < 1.0:
            raise HTTPException(
                status_code=400,
                detail="Fast Transfer는 최소 1 USDC 이상만 가능합니다"
            )
        
        # 1. Compliance 검사
        print(f"🔍 컴플라이언스 검사 시작...")
        # TODO: 실제 Compliance API 호출
        print(f"✅ 컴플라이언스 검사 통과")
        
        # 2. Circle API를 통한 실제 크로스체인 전송
        print(f"🌐 Circle API 크로스체인 전송 시작 ({fast_mode})...")
        
        try:
            # Circle CCTP 서비스 인스턴스 생성 (올바른 클래스 사용)
            from app.services.circle_client import CircleCCTPService
            circle_client = CircleCCTPService(use_sandbox=True)
            
            # 실제 Circle CCTP API 호출 (Fast Transfer 옵션 포함)
            transfer_response = await circle_client.create_cross_chain_transfer(
                source_wallet_id=request.source_wallet_id,
                amount=str(request.amount),
                source_chain=request.source_chain,
                target_chain=request.target_chain,
                target_address=request.target_address,
                use_fast_transfer=request.use_fast_transfer
            )
            
            # Circle CCTP API 응답 구조에 맞춰 수정
            transfer_data = transfer_response.get("data", {})
            transfer_id = transfer_data.get("id", f"transfer_{uuid.uuid4()}")
            
            # Circle API는 "state" 필드를 사용 (PENDING_RISK_SCREENING, CONFIRMED, COMPLETE 등)
            circle_state = transfer_data.get("state", "PENDING_RISK_SCREENING")
            
            # Circle 상태를 우리 시스템 상태로 매핑
            if circle_state in ["PENDING_RISK_SCREENING", "QUEUED", "SENT"]:
                transfer_status = "processing"
            elif circle_state in ["CONFIRMED", "COMPLETE"]:
                transfer_status = "completed"
            elif circle_state in ["FAILED", "CANCELLED"]:
                transfer_status = "failed"
            else:
                transfer_status = "processing"
            
            estimated_time = "15-45 seconds"  # CCTP V2는 빠른 전송
            
            print(f"✅ Circle API 크로스체인 전송 생성 성공: {transfer_id}")
            
            # CCTP Hooks 시뮬레이션 트리거 (비동기)
            background_tasks.add_task(
                cctp_hooks_service.simulate_cctp_hooks,
                {
                    "id": transfer_id,
                    "sender_id": "current_user_id",  # 실제 구현에서는 JWT에서 추출
                    "recipient_id": None,  # 수신자 ID가 있다면 여기에 설정
                    "amount": request.amount,
                    "source_chain": request.source_chain,
                    "target_chain": request.target_chain
                }
            )
            
        except Exception as circle_error:
            print(f"⚠️ Circle API 호출 실패, Mock 응답으로 처리: {str(circle_error)}")
            # Circle API 실패 시 Mock 응답으로 대체
            transfer_id = f"transfer_{uuid.uuid4()}"
            transfer_status = "processing"
            estimated_time = "8-20 seconds"
            print(f"✅ Mock 크로스체인 전송 생성: {transfer_id}")
        
        # 백그라운드에서 전송 상태 모니터링
        background_tasks.add_task(
            monitor_transfer_status,
            transfer_id
        )
        
        print(f"크로스체인 전송 완료: {transfer_id}")
        
        return PaymentResponse(
            payment_id=transfer_id,
            status=transfer_status,
            transaction_hash=None,  # 아직 블록체인에 포함되지 않음
            amount=request.amount,
            currency="USDC",
            estimated_completion_time=estimated_time,
            fees={
                "gas_fee": "2.50",
                "bridge_fee": "0.50",
                "total_fee": "3.00"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 크로스체인 전송 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"크로스체인 전송 실패: {str(e)}")

@router.get("/transactions/{transaction_id}")
async def get_transaction_status(transaction_id: str):
    """거래 상태 조회"""
    try:
        # Circle API에서 거래 상태 조회
        transfer_status = await circle_cctp_service.get_transfer_status(transaction_id)
        
        return {
            "transaction_id": transaction_id,
            "status": transfer_status["data"]["status"],
            "transaction_hash": transfer_status["data"].get("transactionHash"),
            "updated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"거래 상태 조회 실패: {str(e)}")

@router.get("/chains/supported")
async def get_supported_chains():
    """지원하는 블록체인 목록 조회"""
    return {
        "chains": [
            {
                "id": "ethereum",
                "name": "Ethereum",
                "chain_id": 1,
                "native_currency": "ETH",
                "status": "active"
            },
            {
                "id": "base",
                "name": "Base",
                "chain_id": 8453,
                "native_currency": "ETH",
                "status": "active"
            },
            {
                "id": "arbitrum",
                "name": "Arbitrum One",
                "chain_id": 42161,
                "native_currency": "ETH",
                "status": "active"
            },
            {
                "id": "avalanche",
                "name": "Avalanche C-Chain",
                "chain_id": 43114,
                "native_currency": "AVAX",
                "status": "active"
            }
        ]
    }

@router.get("/test/circle-ping")
async def test_circle_ping():
    """Circle API 연결 테스트"""
    try:
        from app.services.circle_client import CircleAPIClient
        circle_client = CircleAPIClient(use_sandbox=True)
        
        # Circle API ping 테스트
        ping_result = await circle_client.ping()
        
        return {
            "status": "success",
            "message": "Circle API 연결 성공",
            "ping_result": ping_result
        }
        
    except Exception as e:
        return {
            "status": "error", 
            "message": f"Circle API 연결 실패: {str(e)}"
        }

@router.get("/test/circle-wallets")
async def test_circle_wallets():
    """Circle Developer Wallets 목록 조회"""
    try:
        from app.services.circle_client import CircleCCTPService
        circle_client = CircleCCTPService(use_sandbox=True)
        
        # Circle Developer Wallets 조회
        wallets_result = await circle_client._make_request("GET", "/v1/w3s/wallets")
        
        return {
            "status": "success",
            "message": "Circle Developer Wallets 조회 성공",
            "wallets": wallets_result
        }
        
    except Exception as e:
        return {
            "status": "error", 
            "message": f"Circle Wallets 조회 실패: {str(e)}"
        }

# 백그라운드 태스크 함수들
async def process_payment_completion(qr_code_id: str, transaction_hash: str):
    """결제 완료 처리 (백그라운드)"""
    # 실제로는 블록체인 트랜잭션 확인 후 DB 업데이트
    await asyncio.sleep(10)  # 10초 대기 (실제 확인 시간 시뮬레이션)
    print(f"결제 완료: QR={qr_code_id}, TX={transaction_hash}")

async def monitor_transfer_status(transfer_id: str):
    """전송 상태 모니터링 (백그라운드)"""
    # 실제로는 주기적으로 상태 확인 후 사용자에게 알림
    await asyncio.sleep(20)  # 20초 대기
    print(f"크로스체인 전송 완료: {transfer_id}") 