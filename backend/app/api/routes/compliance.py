"""
컴플라이언스 관련 API 엔드포인트
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.services.circle_client import circle_compliance_service

router = APIRouter()

# Request/Response 모델들
class TransactionScreeningRequest(BaseModel):
    """거래 스크리닝 요청 모델"""
    from_address: str = Field(..., description="송신자 주소")
    to_address: str = Field(..., description="수신자 주소")
    amount: float = Field(..., gt=0, description="거래 금액")
    currency: str = Field(default="USDC", description="통화")
    transaction_type: str = Field(default="transfer", description="거래 유형")

class AddressScreeningRequest(BaseModel):
    """주소 스크리닝 요청 모델"""
    address: str = Field(..., description="스크리닝할 주소")
    screening_type: str = Field(default="comprehensive", description="스크리닝 유형")

class ScreeningResult(BaseModel):
    """스크리닝 결과 모델"""
    screening_id: str
    result: str  # approved, rejected, pending
    risk_score: float
    risk_level: str  # low, medium, high
    reasons: List[str]
    sanctions_match: bool
    screening_date: datetime
    recommendations: List[str]

class ComplianceReport(BaseModel):
    """컴플라이언스 리포트 모델"""
    report_id: str
    period: str
    total_transactions: int
    approved_transactions: int
    rejected_transactions: int
    pending_transactions: int
    high_risk_transactions: int
    sanctions_matches: int
    compliance_score: float

@router.post("/screen/transaction", response_model=ScreeningResult)
async def screen_transaction(request: TransactionScreeningRequest):
    """거래 스크리닝 실행"""
    try:
        # Circle Compliance Engine으로 거래 스크리닝
        screening_result = await circle_compliance_service.screen_transaction(
            from_address=request.from_address,
            to_address=request.to_address,
            amount=str(request.amount),
            currency=request.currency
        )
        
        data = screening_result["data"]
        
        # 위험도 레벨 계산
        risk_score = data["riskScore"]
        if risk_score < 0.3:
            risk_level = "low"
        elif risk_score < 0.7:
            risk_level = "medium"
        else:
            risk_level = "high"
        
        # 추천사항 생성
        recommendations = []
        if risk_score > 0.5:
            recommendations.append("추가 고객 확인(EDD) 수행을 권장합니다")
        if risk_score > 0.8:
            recommendations.append("거래 승인 전 수동 검토가 필요합니다")
        
        return ScreeningResult(
            screening_id=f"screen_{int(datetime.utcnow().timestamp())}",
            result=data["screeningResult"],
            risk_score=risk_score,
            risk_level=risk_level,
            reasons=data.get("reasons", []),
            sanctions_match=risk_score > 0.9,
            screening_date=datetime.utcnow(),
            recommendations=recommendations
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"거래 스크리닝 실패: {str(e)}")

@router.post("/screen/address", response_model=ScreeningResult)
async def screen_address(request: AddressScreeningRequest):
    """주소 스크리닝 실행"""
    try:
        # 주소 기반 스크리닝 (실제로는 다양한 제재 리스트와 비교)
        # 여기서는 mock 결과 반환
        
        # 간단한 위험도 계산 (실제로는 복잡한 알고리즘 사용)
        risk_score = 0.1  # 기본값
        
        # 특정 패턴의 주소는 높은 위험도로 설정 (데모용)
        if "dead" in request.address.lower() or "null" in request.address.lower():
            risk_score = 0.9
        elif request.address.startswith("0x000"):
            risk_score = 0.6
        
        result = "approved" if risk_score < 0.5 else "rejected" if risk_score > 0.8 else "pending"
        risk_level = "low" if risk_score < 0.3 else "medium" if risk_score < 0.7 else "high"
        
        reasons = []
        if risk_score > 0.5:
            reasons.append("의심스러운 주소 패턴 감지")
        if risk_score > 0.8:
            reasons.append("제재 대상 주소와 유사성 발견")
        
        return ScreeningResult(
            screening_id=f"addr_screen_{int(datetime.utcnow().timestamp())}",
            result=result,
            risk_score=risk_score,
            risk_level=risk_level,
            reasons=reasons,
            sanctions_match=risk_score > 0.9,
            screening_date=datetime.utcnow(),
            recommendations=["정기적인 주소 재검토 권장"] if risk_score > 0.3 else []
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"주소 스크리닝 실패: {str(e)}")

@router.get("/screening/{screening_id}")
async def get_screening_result(screening_id: str):
    """스크리닝 결과 조회"""
    try:
        # 실제로는 DB에서 스크리닝 결과 조회
        # 여기서는 mock 데이터 반환
        return {
            "screening_id": screening_id,
            "status": "completed",
            "result": "approved",
            "risk_score": 0.2,
            "risk_level": "low",
            "created_at": datetime.utcnow().isoformat(),
            "completed_at": datetime.utcnow().isoformat(),
            "details": {
                "sanctions_check": "passed",
                "aml_check": "passed",
                "pep_check": "passed",
                "adverse_media": "none_found"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"스크리닝 결과 조회 실패: {str(e)}")

@router.get("/reports/compliance", response_model=ComplianceReport)
async def get_compliance_report(
    start_date: str,
    end_date: str,
    report_type: str = "summary"
):
    """컴플라이언스 리포트 생성"""
    try:
        # 실제로는 DB에서 기간별 통계 집계
        # 여기서는 mock 데이터 반환
        
        total_transactions = 1500
        approved_transactions = 1350
        rejected_transactions = 50
        pending_transactions = 100
        high_risk_transactions = 75
        sanctions_matches = 5
        
        compliance_score = (approved_transactions / total_transactions) * 100
        
        return ComplianceReport(
            report_id=f"report_{int(datetime.utcnow().timestamp())}",
            period=f"{start_date} ~ {end_date}",
            total_transactions=total_transactions,
            approved_transactions=approved_transactions,
            rejected_transactions=rejected_transactions,
            pending_transactions=pending_transactions,
            high_risk_transactions=high_risk_transactions,
            sanctions_matches=sanctions_matches,
            compliance_score=compliance_score
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"컴플라이언스 리포트 생성 실패: {str(e)}")

@router.get("/watchlist/check/{address}")
async def check_watchlist(address: str):
    """워치리스트 확인"""
    try:
        # 실제로는 다양한 제재 리스트 DB와 비교
        # OFAC, EU Sanctions, UN Sanctions 등
        
        watchlist_matches = []
        
        # 간단한 패턴 매칭 (데모용)
        if "suspicious" in address.lower():
            watchlist_matches.append({
                "list_name": "Internal Watchlist",
                "match_type": "exact",
                "confidence": 0.95,
                "added_date": "2024-01-15"
            })
        
        return {
            "address": address,
            "is_listed": len(watchlist_matches) > 0,
            "matches": watchlist_matches,
            "last_checked": datetime.utcnow().isoformat(),
            "recommendations": [
                "즉시 거래 중단",
                "법무팀에 에스컬레이션"
            ] if watchlist_matches else ["정상 거래 가능"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"워치리스트 확인 실패: {str(e)}")

@router.post("/alerts/configure")
async def configure_compliance_alerts(
    risk_threshold: float = Query(..., ge=0.0, le=1.0),
    alert_types: List[str] = Query(...),
    notification_channels: List[str] = Query(...)
):
    """컴플라이언스 알림 설정"""
    try:
        alert_config = {
            "risk_threshold": risk_threshold,
            "alert_types": alert_types,
            "notification_channels": notification_channels,
            "configured_at": datetime.utcnow().isoformat(),
            "config_id": f"alert_config_{int(datetime.utcnow().timestamp())}"
        }
        
        return {
            "status": "configured",
            "config": alert_config,
            "message": "컴플라이언스 알림이 성공적으로 설정되었습니다"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"알림 설정 실패: {str(e)}")

@router.get("/statistics/risk-analysis")
async def get_risk_analysis_statistics():
    """위험 분석 통계"""
    try:
        return {
            "period": "last_30_days",
            "total_screenings": 5000,
            "risk_distribution": {
                "low": 4200,
                "medium": 650,
                "high": 150
            },
            "top_risk_factors": [
                {"factor": "High value transactions", "count": 230},
                {"factor": "New address interactions", "count": 180},
                {"factor": "Cross-border transfers", "count": 120}
            ],
            "compliance_trends": {
                "approval_rate": 92.5,
                "average_screening_time": "2.3 seconds",
                "false_positive_rate": 3.2
            },
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"위험 분석 통계 조회 실패: {str(e)}") 