/**
 * 네트워크 상태 관리 서비스
 * - 네트워크 연결 상태 감지
 * - 연결 품질 모니터링
 * - 오프라인/온라인 상태 변화 감지
 * - 네트워크 복구 알림
 */

import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

export interface NetworkState {
  isConnected: boolean;
  isReachable: boolean;
  type: NetInfoStateType;
  isWifi: boolean;
  isCellular: boolean;
  isExpensive: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  lastConnectedAt: number | null;
  reconnectedAt: number | null;
}

export interface NetworkCallback {
  onOnline?: (state: NetworkState) => void;
  onOffline?: (state: NetworkState) => void;
  onReconnected?: (state: NetworkState, wasOfflineDuration: number) => void;
  onConnectionQualityChanged?: (quality: string, state: NetworkState) => void;
}

export class NetworkService {
  private currentState: NetworkState | null = null;
  private listeners: Set<(state: NetworkState) => void> = new Set();
  private callbacks: NetworkCallback = {};
  private unsubscribe: (() => void) | null = null;
  private offlineStartTime: number | null = null;
  private connectionQualityTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeNetworkMonitoring();
  }

  /**
   * 네트워크 모니터링 초기화
   */
  private async initializeNetworkMonitoring(): Promise<void> {
    try {
      // 초기 네트워크 상태 확인
      const initialState = await NetInfo.fetch();
      this.handleNetworkStateChange(initialState);

      // 네트워크 상태 변화 구독
      this.unsubscribe = NetInfo.addEventListener((state) => {
        this.handleNetworkStateChange(state);
      });

      // 연결 품질 모니터링 시작
      this.startConnectionQualityMonitoring();

      console.log('🌐 네트워크 모니터링 서비스 시작됨');
    } catch (error) {
      console.error('네트워크 모니터링 초기화 실패:', error);
    }
  }

  /**
   * 네트워크 상태 변화 처리
   */
  private handleNetworkStateChange(netInfoState: NetInfoState): void {
    const wasOffline = this.currentState ? !this.currentState.isConnected : false;
    
    // 개발 환경에서는 항상 온라인으로 처리 (iOS 시뮬레이터 네트워크 감지 문제 해결)
    const isDev = __DEV__;
    const isNowOnline = isDev ? true : (netInfoState.isConnected === true && netInfoState.isInternetReachable === true);
    const isNowOffline = !isNowOnline;

    const newState: NetworkState = {
      isConnected: isDev ? true : (netInfoState.isConnected === true),
      isReachable: isDev ? true : (netInfoState.isInternetReachable === true),
      type: netInfoState.type,
      isWifi: netInfoState.type === 'wifi',
      isCellular: netInfoState.type === 'cellular',
      isExpensive: netInfoState.details?.isConnectionExpensive === true,
      connectionQuality: this.assessConnectionQuality(netInfoState),
      lastConnectedAt: isNowOnline ? Date.now() : this.currentState?.lastConnectedAt || null,
      reconnectedAt: null
    };

    // 재연결 감지
    if (wasOffline && isNowOnline) {
      const offlineDuration = this.offlineStartTime ? Date.now() - this.offlineStartTime : 0;
      newState.reconnectedAt = Date.now();
      this.offlineStartTime = null;

      console.log(`🔄 네트워크 재연결됨 (오프라인 시간: ${Math.round(offlineDuration / 1000)}초)`);
      
      if (this.callbacks.onReconnected) {
        this.callbacks.onReconnected(newState, offlineDuration);
      }
    }

    // 오프라인 전환
    if (!wasOffline && isNowOffline) {
      this.offlineStartTime = Date.now();
      console.log('📵 네트워크 연결 끊어짐');
      
      if (this.callbacks.onOffline) {
        this.callbacks.onOffline(newState);
      }
    }

    // 온라인 전환 (첫 연결 포함)
    if (isNowOnline && (!this.currentState || !this.currentState.isConnected)) {
      console.log(`📶 네트워크 연결됨 (${newState.type})`);
      
      if (this.callbacks.onOnline) {
        this.callbacks.onOnline(newState);
      }
    }

    // 연결 품질 변화 감지
    if (this.currentState && this.currentState.connectionQuality !== newState.connectionQuality) {
      console.log(`📊 연결 품질 변화: ${this.currentState.connectionQuality} → ${newState.connectionQuality}`);
      
      if (this.callbacks.onConnectionQualityChanged) {
        this.callbacks.onConnectionQualityChanged(newState.connectionQuality, newState);
      }
    }

    this.currentState = newState;

    // 모든 리스너에게 상태 변화 알림
    this.listeners.forEach(listener => {
      try {
        listener(newState);
      } catch (error) {
        console.error('네트워크 상태 리스너 오류:', error);
      }
    });
  }

  /**
   * 연결 품질 평가
   */
  private assessConnectionQuality(netInfoState: NetInfoState): 'excellent' | 'good' | 'poor' | 'unknown' {
    if (!netInfoState.isConnected) return 'unknown';

    // WiFi 연결 품질 평가
    if (netInfoState.type === 'wifi') {
      const wifiDetails = netInfoState.details as any;
      if (wifiDetails?.strength !== undefined) {
        const strength = wifiDetails.strength;
        if (strength >= -50) return 'excellent';
        if (strength >= -70) return 'good';
        return 'poor';
      }
    }

    // 셀룰러 연결 품질 평가
    if (netInfoState.type === 'cellular') {
      const cellularDetails = netInfoState.details as any;
      if (cellularDetails?.cellularGeneration) {
        const generation = cellularDetails.cellularGeneration;
        if (generation === '5g') return 'excellent';
        if (generation === '4g') return 'good';
        if (generation === '3g') return 'poor';
      }
    }

    // 기본적으로 연결되어 있으면 good
    return netInfoState.isInternetReachable ? 'good' : 'poor';
  }

  /**
   * 연결 품질 지속적 모니터링
   */
  private startConnectionQualityMonitoring(): void {
    // 30초마다 연결 품질 재평가
    this.connectionQualityTimer = setInterval(async () => {
      if (this.currentState?.isConnected) {
        try {
          const currentNetInfo = await NetInfo.fetch();
          this.handleNetworkStateChange(currentNetInfo);
        } catch (error) {
          console.error('연결 품질 모니터링 오류:', error);
        }
      }
    }, 30000);
  }

  /**
   * 네트워크 상태 리스너 추가
   */
  addListener(listener: (state: NetworkState) => void): () => void {
    this.listeners.add(listener);
    
    // 현재 상태가 있으면 즉시 호출
    if (this.currentState) {
      listener(this.currentState);
    }

    // 구독 해제 함수 반환
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 네트워크 이벤트 콜백 설정
   */
  setCallbacks(callbacks: NetworkCallback): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 현재 네트워크 상태 조회
   */
  getCurrentState(): NetworkState | null {
    return this.currentState;
  }

  /**
   * 네트워크 연결 상태 확인
   */
  isOnline(): boolean {
    return this.currentState?.isConnected && this.currentState?.isReachable || false;
  }

  /**
   * WiFi 연결 여부 확인
   */
  isWifiConnected(): boolean {
    return this.currentState?.isWifi && this.currentState?.isConnected || false;
  }

  /**
   * 데이터 요금 발생 연결 여부 확인
   */
  isExpensiveConnection(): boolean {
    return this.currentState?.isExpensive || false;
  }

  /**
   * 네트워크 연결 테스트
   */
  async testConnection(url: string = 'https://www.google.com', timeout: number = 5000): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      return {
        success: response.ok,
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}`
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        responseTime,
        error: error.name === 'AbortError' ? 'Timeout' : error.message
      };
    }
  }

  /**
   * 오프라인 시간 조회
   */
  getOfflineDuration(): number {
    if (!this.offlineStartTime) return 0;
    return Date.now() - this.offlineStartTime;
  }

  /**
   * 네트워크 상태 정보 요약
   */
  getNetworkSummary(): {
    status: string;
    type: string;
    quality: string;
    isExpensive: boolean;
    offlineDuration: number;
  } {
    const state = this.currentState;
    
    if (!state) {
      return {
        status: '확인 중',
        type: 'unknown',
        quality: 'unknown',
        isExpensive: false,
        offlineDuration: 0
      };
    }

    const status = state.isConnected && state.isReachable ? '온라인' : '오프라인';
    const type = state.type === 'wifi' ? 'WiFi' : 
                 state.type === 'cellular' ? '모바일 데이터' : 
                 state.type || '알 수 없음';
    
    const qualityMap = {
      excellent: '우수',
      good: '양호',
      poor: '불량',
      unknown: '알 수 없음'
    };

    return {
      status,
      type,
      quality: qualityMap[state.connectionQuality],
      isExpensive: state.isExpensive,
      offlineDuration: this.getOfflineDuration()
    };
  }

  /**
   * 서비스 정리
   */
  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.connectionQualityTimer) {
      clearInterval(this.connectionQualityTimer);
      this.connectionQualityTimer = null;
    }

    this.listeners.clear();
    this.callbacks = {};
    
    console.log('🌐 네트워크 모니터링 서비스 정리 완료');
  }
}

// 전역 네트워크 서비스 인스턴스
export const networkService = new NetworkService();