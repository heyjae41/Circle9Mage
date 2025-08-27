/**
 * WebSocket 클라이언트 서비스
 * CCTP V2 Hooks 실시간 알림을 위한 WebSocket 연결 관리
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CCTPNotification {
  type: string;
  title: string;
  message: string;
  details?: string;
  amount?: number;
  status: string;
  icon: string;
  timestamp: string;
  user_id?: string;
  is_offline?: boolean;
}

type NotificationHandler = (notification: CCTPNotification) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private userId: string | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000; // 5초
  private reconnectTimer: NodeJS.Timeout | null = null;
  private notificationHandlers: NotificationHandler[] = [];
  private isConnecting = false;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * WebSocket 연결 설정
   */
  async connect(userId: string): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      console.log('🔌 WebSocket 이미 연결되어 있거나 연결 중입니다');
      return;
    }

    try {
      this.isConnecting = true;
      this.userId = userId;
      this.token = await AsyncStorage.getItem('access_token');

      const baseUrl = this.getWebSocketUrl();
      const wsUrl = `${baseUrl}/api/v1/ws/cctp-notifications/${userId}${this.token ? `?token=${this.token}` : ''}`;

      console.log('🔌 WebSocket 연결 시도:', wsUrl);

      this.ws = new WebSocket(wsUrl);
      this.setupWebSocketEventListeners();

    } catch (error) {
      console.error('❌ WebSocket 연결 실패:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * WebSocket 연결 해제
   */
  disconnect(): void {
    console.log('🔌 WebSocket 연결 해제');
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.userId = null;
    this.token = null;
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  /**
   * 알림 핸들러 등록
   */
  addNotificationHandler(handler: NotificationHandler): void {
    this.notificationHandlers.push(handler);
  }

  /**
   * 알림 핸들러 제거
   */
  removeNotificationHandler(handler: NotificationHandler): void {
    const index = this.notificationHandlers.indexOf(handler);
    if (index > -1) {
      this.notificationHandlers.splice(index, 1);
    }
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 수동 재연결
   */
  async reconnect(): Promise<void> {
    if (this.userId) {
      console.log('🔄 WebSocket 수동 재연결 시도');
      this.disconnect();
      await this.connect(this.userId);
    }
  }

  /**
   * Ping 메시지 전송 (연결 상태 확인)
   */
  sendPing(): void {
    if (this.isConnected()) {
      this.ws?.send(JSON.stringify({
        type: 'ping',
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * 상태 요청
   */
  requestStatus(): void {
    if (this.isConnected()) {
      this.ws?.send(JSON.stringify({
        type: 'request_status'
      }));
    }
  }

  /**
   * WebSocket URL 결정
   */
  private getWebSocketUrl(): string {
    if (__DEV__) {
      // 개발 환경
      if (Platform.OS === 'android') {
        return 'ws://10.0.2.2:8000'; // Android 에뮬레이터
      }
      return 'ws://localhost:8000'; // iOS 시뮬레이터
    }
    // 프로덕션 환경
    return 'wss://your-api.com'; // 실제 프로덕션 URL로 변경
  }

  /**
   * WebSocket 이벤트 리스너 설정
   */
  private setupWebSocketEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('✅ WebSocket 연결 성공');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      // 연결 후 상태 요청
      this.requestStatus();
    };

    this.ws.onmessage = (event) => {
      try {
        const data: CCTPNotification = JSON.parse(event.data);
        console.log('📱 WebSocket 메시지 수신:', data);
        
        // 알림 핸들러들에게 전달
        this.notificationHandlers.forEach(handler => {
          try {
            handler(data);
          } catch (error) {
            console.error('❌ 알림 핸들러 오류:', error);
          }
        });
        
      } catch (error) {
        console.error('❌ WebSocket 메시지 파싱 오류:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket 오류:', error);
    };

    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket 연결 종료:', event.code, event.reason);
      this.isConnecting = false;
      
      // 비정상 종료인 경우 재연결 시도
      if (event.code !== 1000 && this.userId) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * 재연결 스케줄링
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ WebSocket 최대 재연결 시도 횟수 초과');
      return;
    }

    const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    console.log(`🔄 WebSocket 재연결 예정 (${this.reconnectAttempts}/${this.maxReconnectAttempts}) - ${delay}ms 후`);
    
    this.reconnectTimer = setTimeout(() => {
      if (this.userId) {
        this.connect(this.userId);
      }
    }, delay);
  }

  /**
   * 앱 생명주기 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    // 앱이 포그라운드로 돌아올 때 재연결
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.userId && !this.isConnected()) {
          console.log('🔄 앱 포그라운드 복귀 - WebSocket 재연결');
          this.connect(this.userId);
        }
      });
    }
  }
}

// 싱글톤 인스턴스
export const webSocketService = new WebSocketService();
export type { CCTPNotification };
