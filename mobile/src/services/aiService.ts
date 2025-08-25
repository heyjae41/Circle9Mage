/**
 * AI API 통신 서비스
 * 백엔드 AI API와 실시간 채팅 통신을 처리
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { retryManager } from './retryManager';
import { networkService } from './networkService';
import { offlineStorage } from './offlineStorage';
import { 
  AIChatRequest, 
  AIChatResponse, 
  AIChatSession, 
  AIHealthResponse, 
  ChatMessage 
} from '../types';

// 플랫폼별 AI API URL 설정
const getAIApiBaseUrl = () => {
  if (__DEV__) {
    // 개발 환경
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:8000/api/v1/ai';
    } else if (Platform.OS === 'ios') {
      return 'http://10.130.216.23:8000/api/v1/ai';
    } else {
      return 'http://localhost:8000/api/v1/ai';
    }
  } else {
    // 프로덕션 환경
    return 'https://your-production-api.com/api/v1/ai';
  }
};

class AIService {
  private baseUrl: string;
  private currentSessionId: string | null = null;
  private messageHistory: ChatMessage[] = [];
  private isTyping: boolean = false;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor() {
    this.baseUrl = getAIApiBaseUrl();
    console.log(`🤖 AI API Base URL: ${this.baseUrl}`);
    this.loadSessionFromStorage();
  }

  /**
   * AI 서비스 상태 확인
   */
  async checkHealth(): Promise<AIHealthResponse> {
    try {
      console.log('🏥 AI 서비스 상태 확인 중...');
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`AI Health Check 실패: ${response.status}`);
      }

      const healthData: AIHealthResponse = await response.json();
      console.log('✅ AI 서비스 상태:', healthData.status);
      
      return healthData;
    } catch (error) {
      console.error('❌ AI 서비스 상태 확인 실패:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      };
    }
  }

  /**
   * AI와 채팅하기 (메인 기능)
   */
  async sendMessage(
    message: string, 
    userId: string, 
    onTypingStart?: () => void,
    onTypingEnd?: () => void,
    onError?: (error: string) => void,
    currentLanguage?: string
  ): Promise<AIChatResponse | null> {
    try {
      // 네트워크 상태 확인
      const isConnected = networkService.isOnline();
      if (!isConnected) {
        const cachedResponse = await this.getCachedResponse(message);
        if (cachedResponse) {
          console.log('📱 오프라인 상태 - 캐시된 응답 사용');
          return cachedResponse;
        }
        throw new Error('네트워크 연결이 없습니다. 인터넷 연결을 확인해주세요.');
      }

      // 타이핑 상태 시작
      this.isTyping = true;
      onTypingStart?.();

      console.log(`💬 AI 메시지 전송: "${message.substring(0, 50)}..."`);

      // 요청 데이터 준비
      const requestData: AIChatRequest = {
        message: message.trim(),
        userId: userId,
        sessionId: this.currentSessionId || undefined,
        language: currentLanguage || 'ko'
      };

      // JWT 토큰 가져오기
      const accessToken = await AsyncStorage.getItem('access_token');
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다. 로그인이 필요합니다.');
      }

      // API 호출 (재시도 로직 포함)
      const response = await this.makeRequestWithRetry(requestData, accessToken);
      
      // 세션 ID 업데이트
      if (response.sessionId && response.sessionId !== this.currentSessionId) {
        this.currentSessionId = response.sessionId;
        await this.saveSessionToStorage();
      }

      // 메시지 히스토리 업데이트
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: message,
        timestamp: new Date()
      };

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: response.response,
        timestamp: new Date(response.timestamp),
        data: response.functionCalls
      };

      this.messageHistory.push(userMessage, aiMessage);
      await this.saveMessageHistory();

      // 응답 캐싱 (오프라인 대비)
      await this.cacheResponse(message, response);

      console.log('✅ AI 응답 수신 완료');
      return response;

    } catch (error) {
      console.error('❌ AI 메시지 전송 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      onError?.(errorMessage);
      return null;
    } finally {
      // 타이핑 상태 종료
      this.isTyping = false;
      onTypingEnd?.();
    }
  }

  /**
   * 재시도 로직이 포함된 API 요청
   */
  private async makeRequestWithRetry(
    requestData: AIChatRequest, 
    accessToken: string,
    retryCount: number = 0
  ): Promise<AIChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestData),
      });

      if (response.status === 401) {
        // 토큰 만료 - 토큰 갱신 시도
        const newToken = await this.refreshAccessToken();
        if (newToken && retryCount < this.maxRetries) {
          return this.makeRequestWithRetry(requestData, newToken, retryCount + 1);
        }
        throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
      }

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`AI API 오류 (${response.status}): ${errorData}`);
      }

      const responseData: AIChatResponse = await response.json();
      return responseData;

    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.log(`🔄 AI API 재시도 (${retryCount + 1}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
        return this.makeRequestWithRetry(requestData, accessToken, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * 액세스 토큰 갱신
   */
  private async refreshAccessToken(): Promise<string | null> {
    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      if (!refreshToken) {
        return null;
      }

      const response = await fetch(`${this.baseUrl.replace('/ai', '')}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const newAccessToken = data.accessToken;

      if (newAccessToken) {
        await AsyncStorage.setItem('access_token', newAccessToken);
        console.log('🔄 액세스 토큰 갱신 성공');
      }

      return newAccessToken;
    } catch (error) {
      console.error('❌ 토큰 갱신 실패:', error);
      return null;
    }
  }

  /**
   * 메시지 히스토리 관리
   */
  async getMessageHistory(): Promise<ChatMessage[]> {
    return [...this.messageHistory];
  }

  async clearMessageHistory(): Promise<void> {
    this.messageHistory = [];
    this.currentSessionId = null;
    await AsyncStorage.removeItem('ai_message_history');
    await AsyncStorage.removeItem('ai_session_id');
    console.log('🗑️ AI 메시지 히스토리 초기화');
  }

  private async saveMessageHistory(): Promise<void> {
    try {
      const historyData = {
        messages: this.messageHistory.map(msg => ({
          ...msg,
          timestamp: msg.timestamp.toISOString()
        })),
        sessionId: this.currentSessionId,
        lastUpdated: new Date().toISOString()
      };
      
      await AsyncStorage.setItem('ai_message_history', JSON.stringify(historyData));
    } catch (error) {
      console.error('❌ 메시지 히스토리 저장 실패:', error);
    }
  }

  private async loadSessionFromStorage(): Promise<void> {
    try {
      const historyData = await AsyncStorage.getItem('ai_message_history');
      if (historyData) {
        const parsed = JSON.parse(historyData);
        this.messageHistory = parsed.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        this.currentSessionId = parsed.sessionId;
        console.log(`📱 AI 세션 복원: ${this.messageHistory.length}개 메시지`);
      }
    } catch (error) {
      console.error('❌ AI 세션 로드 실패:', error);
    }
  }

  private async saveSessionToStorage(): Promise<void> {
    try {
      if (this.currentSessionId) {
        await AsyncStorage.setItem('ai_session_id', this.currentSessionId);
      }
    } catch (error) {
      console.error('❌ AI 세션 ID 저장 실패:', error);
    }
  }

  /**
   * 오프라인 캐싱
   */
  private async getCachedResponse(message: string): Promise<AIChatResponse | null> {
    try {
      const cacheKey = `ai_response_${message.replace(/[^a-zA-Z0-9가-힣]/g, '_').substring(0, 50)}`;
      return await offlineStorage.getCachedData<AIChatResponse>(cacheKey);
    } catch (error) {
      console.error('❌ AI 캐시 조회 실패:', error);
      return null;
    }
  }

  private async cacheResponse(message: string, response: AIChatResponse): Promise<void> {
    try {
      const cacheKey = `ai_response_${message.replace(/[^a-zA-Z0-9가-힣]/g, '_').substring(0, 50)}`;
      // AI 응답은 24시간 캐시
      await offlineStorage.cacheData(cacheKey, response, 24 * 60 * 60 * 1000);
    } catch (error) {
      console.error('❌ AI 응답 캐싱 실패:', error);
    }
  }

  /**
   * 채팅 세션 관리
   */
  async createNewSession(): Promise<string> {
    this.currentSessionId = null;
    this.messageHistory = [];
    await this.clearMessageHistory();
    console.log('🆕 새로운 AI 채팅 세션 생성');
    return 'new_session';
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  isCurrentlyTyping(): boolean {
    return this.isTyping;
  }

  /**
   * AI 채팅 세션 삭제 (백엔드)
   */
  async deleteSession(sessionId?: string): Promise<boolean> {
    try {
      const targetSessionId = sessionId || this.currentSessionId;
      if (!targetSessionId) {
        return false;
      }

      const accessToken = await AsyncStorage.getItem('access_token');
      if (!accessToken) {
        return false;
      }

      const response = await fetch(`${this.baseUrl}/session/${targetSessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        console.log(`🗑️ AI 세션 삭제 성공: ${targetSessionId}`);
        if (targetSessionId === this.currentSessionId) {
          await this.createNewSession();
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ AI 세션 삭제 실패:', error);
      return false;
    }
  }

  /**
   * 스트리밍 응답 처리 (향후 확장용)
   */
  async sendMessageWithStreaming(
    message: string,
    userId: string,
    onChunk?: (chunk: string) => void,
    onComplete?: (response: AIChatResponse) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    // TODO: Server-Sent Events 또는 WebSocket을 통한 스트리밍 구현
    // 현재는 일반 HTTP 요청으로 폴백
    const response = await this.sendMessage(message, userId, undefined, undefined, onError);
    if (response) {
      onChunk?.(response.response);
      onComplete?.(response);
    }
  }
}

// 전역 AI 서비스 인스턴스
export const aiService = new AIService();
export default aiService;
