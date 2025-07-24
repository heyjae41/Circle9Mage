import Constants from 'expo-constants';

// API 기본 설정
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000/api/v1' 
  : 'https://your-production-api.com/api/v1';

interface ApiResponse<T> {
  data?: T;
  message?: string;
  detail?: string;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // 공통 HTTP 요청 함수
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || errorData.message || '요청 실패');
      }

      return await response.json();
    } catch (error) {
      console.error('API 요청 실패:', error);
      throw error;
    }
  }

  // GET 요청
  private get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  // POST 요청
  private post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT 요청
  private put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE 요청
  private delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // ===================
  // 지갑 관련 API
  // ===================

  async getUserWallets(userId: string) {
    return this.get<any>(`/wallets/user/${userId}/wallets`);
  }

  async getWalletBalance(walletId: string) {
    return this.get<any>(`/wallets/${walletId}/balance`);
  }

  async createWallet(request: {
    userId: string;
    blockchain: string;
    walletName?: string;
  }) {
    return this.post<any>('/wallets/create', request);
  }

  async getWalletTransactions(walletId: string, limit = 20, offset = 0) {
    return this.get<any>(`/wallets/${walletId}/transactions?limit=${limit}&offset=${offset}`);
  }

  // ===================
  // 결제 관련 API
  // ===================

  async generatePaymentQR(request: {
    amount: number;
    currency: string;
    merchantId: string;
    merchantName: string;
    description?: string;
  }) {
    return this.post<any>('/payments/qr/generate', request);
  }

  async processQRPayment(qrCodeId: string, userWalletId: string) {
    return this.post<any>(`/payments/qr/${qrCodeId}/pay`, { user_wallet_id: userWalletId });
  }

  async createCrossChainTransfer(request: {
    sourceWalletId: string;
    targetAddress: string;
    amount: number;
    sourceChain: string;
    targetChain: string;
    notes?: string;
  }) {
    return this.post<any>('/payments/transfer/cross-chain', request);
  }

  async getTransactionStatus(transactionId: string) {
    return this.get<any>(`/payments/transactions/${transactionId}`);
  }

  async getSupportedChains() {
    return this.get<any>('/payments/chains/supported');
  }

  // ===================
  // 컴플라이언스 관련 API
  // ===================

  async screenTransaction(request: {
    fromAddress: string;
    toAddress: string;
    amount: number;
    currency?: string;
  }) {
    return this.post<any>('/compliance/screen/transaction', request);
  }

  async screenAddress(address: string) {
    return this.post<any>('/compliance/screen/address', { address });
  }

  async checkWatchlist(address: string) {
    return this.get<any>(`/compliance/watchlist/check/${address}`);
  }

  // ===================
  // 사용자 관련 API (향후 구현)
  // ===================

  async createUser(userData: any) {
    // 향후 구현
    return this.post<any>('/users/register', userData);
  }

  async loginUser(credentials: any) {
    // 향후 구현
    return this.post<any>('/users/login', credentials);
  }

  async getUserProfile(userId: string) {
    // 향후 구현
    return this.get<any>(`/users/${userId}`);
  }

  // ===================
  // 유틸리티 함수
  // ===================

  async createPayment(request: any) {
    // QR 코드 생성 후 결제 처리까지 통합
    const qrResponse = await this.generatePaymentQR(request);
    
    // 실제 앱에서는 사용자가 QR을 스캔하거나 직접 결제를 진행
    // 여기서는 데모 목적으로 바로 결제 처리
    return {
      paymentId: qrResponse.qr_code_id,
      qrCodeData: qrResponse.qr_code_data,
      status: 'pending',
      estimatedCompletionTime: '8-20초',
    };
  }

  // 헬스 체크
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl.replace('/api/v1', '')}/health`);
      return await response.json();
    } catch (error) {
      throw new Error('서버에 연결할 수 없습니다');
    }
  }
}

// 싱글톤 인스턴스 생성
export const apiService = new ApiService();
export default apiService; 