/**
 * 네트워크 재시도 관리자
 * - 지수 백오프 알고리즘
 * - 네트워크 상태 기반 재시도
 * - 우선순위별 큐 관리
 * - 실패 시 오프라인 큐잉
 */

import { networkService, NetworkState } from './networkService';
import { offlineStorage, PendingAction } from './offlineStorage';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
  jitter: boolean;
  retryCondition?: (error: any, attempt: number) => boolean;
  onRetry?: (error: any, attempt: number) => void;
  onFailure?: (error: any, attempts: number) => void;
}

export interface QueuedRequest {
  id: string;
  request: () => Promise<any>;
  config: RetryConfig;
  priority: 'high' | 'medium' | 'low';
  timestamp: number;
  attempts: number;
  lastError?: any;
}

export class RetryManager {
  private queue: Map<string, QueuedRequest> = new Map();
  private processing: Set<string> = new Set();
  private isOnline: boolean = false;
  private networkUnsubscribe?: () => void;

  private readonly DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    exponentialBase: 2,
    jitter: true,
    retryCondition: (error: any, attempt: number) => {
      // 네트워크 오류, 서버 오류(5xx), 타임아웃은 재시도
      if (error.name === 'NetworkError') return true;
      if (error.name === 'TimeoutError') return true;
      if (error.response?.status >= 500) return true;
      
      // 4xx 에러는 재시도하지 않음 (401 제외, 토큰 갱신 필요)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        return error.response?.status === 401;
      }
      
      return true;
    }
  };

  constructor() {
    this.initializeNetworkMonitoring();
  }

  /**
   * 네트워크 모니터링 초기화
   */
  private initializeNetworkMonitoring(): void {
    this.networkUnsubscribe = networkService.addListener((state: NetworkState) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected && state.isReachable;

      // 온라인 복귀 시 큐 처리
      if (wasOffline && this.isOnline) {
        console.log('🔄 네트워크 복구, 대기 중인 요청 처리 시작');
        this.processQueue();
      }
    });

    // 초기 상태 설정
    const currentState = networkService.getCurrentState();
    this.isOnline = currentState?.isConnected && currentState?.isReachable || false;
  }

  /**
   * 재시도와 함께 요청 실행
   */
  async executeWithRetry<T>(
    request: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<T> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    // 온라인 상태면 즉시 실행 시도
    if (this.isOnline) {
      try {
        return await this.attemptRequest(request, finalConfig);
      } catch (error) {
        // 재시도 가능한 오류가 아니면 즉시 실패
        if (!finalConfig.retryCondition?.(error, 0)) {
          throw error;
        }
        
        // 재시도 큐에 추가
        console.log('🔄 요청 실패, 재시도 큐에 추가');
      }
    } else {
      console.log('📵 오프라인 상태, 요청을 큐에 추가');
    }

    // 큐에 요청 추가
    return this.addToQueue(request, finalConfig, priority);
  }

  /**
   * 실제 요청 시도 (재시도 로직 포함)
   */
  private async attemptRequest<T>(
    request: () => Promise<T>,
    config: RetryConfig,
    attempt: number = 0
  ): Promise<T> {
    try {
      return await request();
    } catch (error: any) {
      // 재시도 조건 확인
      if (attempt >= config.maxRetries || !config.retryCondition?.(error, attempt)) {
        config.onFailure?.(error, attempt + 1);
        throw error;
      }

      // 재시도 콜백 호출
      config.onRetry?.(error, attempt + 1);

      // 지수 백오프 계산
      const delay = this.calculateDelay(config, attempt);
      
      console.log(`🔄 요청 재시도 ${attempt + 1}/${config.maxRetries} (${delay}ms 후)`);
      
      // 대기 후 재시도
      await this.delay(delay);
      
      return this.attemptRequest(request, config, attempt + 1);
    }
  }

  /**
   * 지수 백오프 지연 시간 계산
   */
  private calculateDelay(config: RetryConfig, attempt: number): number {
    const exponentialDelay = config.baseDelay * Math.pow(config.exponentialBase, attempt);
    let delay = Math.min(exponentialDelay, config.maxDelay);

    // 지터 추가 (랜덤성으로 thunder herd 방지)
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.round(delay);
  }

  /**
   * 요청을 큐에 추가
   */
  private async addToQueue<T>(
    request: () => Promise<T>,
    config: RetryConfig,
    priority: 'high' | 'medium' | 'low'
  ): Promise<T> {
    const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: requestId,
        request: async () => {
          try {
            const result = await this.attemptRequest(request, config);
            resolve(result);
            return result;
          } catch (error) {
            reject(error);
            throw error;
          }
        },
        config,
        priority,
        timestamp: Date.now(),
        attempts: 0
      };

      this.queue.set(requestId, queuedRequest);
      console.log(`📝 요청이 큐에 추가됨: ${requestId} (우선순위: ${priority})`);

      // 온라인 상태면 즉시 처리 시도
      if (this.isOnline) {
        setTimeout(() => this.processQueue(), 100);
      }
    });
  }

  /**
   * 큐 처리
   */
  private async processQueue(): Promise<void> {
    if (!this.isOnline) {
      console.log('📵 오프라인 상태, 큐 처리 중단');
      return;
    }

    // 우선순위 순으로 정렬
    const sortedRequests = Array.from(this.queue.values()).sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // 우선순위가 같으면 오래된 것부터
      return a.timestamp - b.timestamp;
    });

    console.log(`🔄 큐 처리 시작: ${sortedRequests.length}개 요청`);

    // 동시 처리 제한 (최대 3개)
    const concurrentLimit = 3;
    const processing = [];

    for (let i = 0; i < Math.min(sortedRequests.length, concurrentLimit); i++) {
      const request = sortedRequests[i];
      
      if (!this.processing.has(request.id)) {
        processing.push(this.processRequest(request));
      }
    }

    if (processing.length > 0) {
      await Promise.allSettled(processing);
      
      // 남은 요청이 있으면 재귀 호출
      if (this.queue.size > 0 && this.isOnline) {
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }

  /**
   * 개별 요청 처리
   */
  private async processRequest(queuedRequest: QueuedRequest): Promise<void> {
    const { id, request, config } = queuedRequest;
    
    this.processing.add(id);
    
    try {
      console.log(`⚡ 큐 요청 처리 시작: ${id}`);
      
      await request();
      
      // 성공 시 큐에서 제거
      this.queue.delete(id);
      console.log(`✅ 큐 요청 처리 완료: ${id}`);
      
    } catch (error: any) {
      console.log(`❌ 큐 요청 처리 실패: ${id}`, error.message);
      
      queuedRequest.attempts++;
      queuedRequest.lastError = error;
      
      // 최대 재시도 횟수 초과 시 큐에서 제거
      if (queuedRequest.attempts >= config.maxRetries) {
        this.queue.delete(id);
        console.log(`🚫 큐 요청 최대 재시도 초과로 제거: ${id}`);
        
        // 중요한 작업이면 오프라인 저장소에 저장
        if (queuedRequest.priority === 'high') {
          await this.saveToOfflineStorage(queuedRequest);
        }
      }
    } finally {
      this.processing.delete(id);
    }
  }

  /**
   * 중요한 작업을 오프라인 저장소에 저장
   */
  private async saveToOfflineStorage(queuedRequest: QueuedRequest): Promise<void> {
    try {
      // 요청을 직렬화 가능한 형태로 변환 (실제 구현에서는 요청 타입에 따라 처리)
      const pendingAction: Omit<PendingAction, 'id' | 'timestamp' | 'retryCount'> = {
        type: 'payment', // 실제로는 요청 타입을 분석해서 설정
        data: {
          requestId: queuedRequest.id,
          priority: queuedRequest.priority,
          attempts: queuedRequest.attempts,
          lastError: queuedRequest.lastError?.message
        },
        priority: queuedRequest.priority
      };

      await offlineStorage.addPendingAction(pendingAction);
      console.log(`💾 중요 작업 오프라인 저장: ${queuedRequest.id}`);
    } catch (error) {
      console.error('오프라인 저장 실패:', error);
    }
  }

  /**
   * 지연 함수
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 큐 상태 조회
   */
  getQueueStatus(): {
    totalRequests: number;
    processingRequests: number;
    requestsByPriority: Record<string, number>;
    oldestRequest?: {
      id: string;
      age: number;
      priority: string;
    };
  } {
    const requests = Array.from(this.queue.values());
    const requestsByPriority = requests.reduce((acc, req) => {
      acc[req.priority] = (acc[req.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let oldestRequest;
    if (requests.length > 0) {
      const oldest = requests.reduce((oldest, current) =>
        current.timestamp < oldest.timestamp ? current : oldest
      );
      
      oldestRequest = {
        id: oldest.id,
        age: Date.now() - oldest.timestamp,
        priority: oldest.priority
      };
    }

    return {
      totalRequests: this.queue.size,
      processingRequests: this.processing.size,
      requestsByPriority,
      oldestRequest
    };
  }

  /**
   * 특정 우선순위의 요청 제거
   */
  clearQueueByPriority(priority: 'high' | 'medium' | 'low'): number {
    let cleared = 0;
    
    for (const [id, request] of this.queue.entries()) {
      if (request.priority === priority) {
        this.queue.delete(id);
        cleared++;
      }
    }

    console.log(`🗑️ 우선순위 ${priority} 요청 ${cleared}개 제거`);
    return cleared;
  }

  /**
   * 모든 큐 정리
   */
  clearQueue(): void {
    const clearedCount = this.queue.size;
    this.queue.clear();
    this.processing.clear();
    
    console.log(`🗑️ 모든 큐 정리 완료: ${clearedCount}개 요청`);
  }

  /**
   * 서비스 정리
   */
  cleanup(): void {
    this.clearQueue();
    
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = undefined;
    }
    
    console.log('🔄 재시도 관리자 정리 완료');
  }
}

// 전역 재시도 관리자 인스턴스
export const retryManager = new RetryManager();