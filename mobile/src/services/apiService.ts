import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { retryManager } from './retryManager';
import { networkService } from './networkService';
import { offlineStorage } from './offlineStorage';

// 플랫폼별 API URL 설정
const getApiBaseUrl = () => {
  if (__DEV__) {
    // 개발 환경
    if (Platform.OS === 'android') {
      // Android 에뮬레이터에서는 10.0.2.2를 사용
      return 'http://10.0.2.2:8000/api/v1';
    } else if (Platform.OS === 'ios') {
      // iOS 시뮬레이터에서는 개발 머신의 실제 IP 사용
      return 'http://10.130.216.23:8000/api/v1';
    } else {
      // 웹에서는 localhost 사용
      return 'http://localhost:8000/api/v1';
    }
  } else {
    // 프로덕션 환경
    return 'https://your-production-api.com/api/v1';
  }
};

const API_BASE_URL = getApiBaseUrl();

interface ApiResponse<T> {
  data?: T;
  message?: string;
  detail?: string;
}

class ApiService {
  private baseUrl: string;
  private isRefreshing: boolean = false;
  private failedQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
    config: RequestInit & { url: string };
  }> = [];

  constructor() {
    this.baseUrl = API_BASE_URL;
    console.log(`🌐 API Base URL: ${this.baseUrl}`);
  }

  // 캐시된 응답 조회
  private async getCachedResponse<T>(endpoint: string): Promise<T | null> {
    try {
      const cacheKey = `api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
      return await offlineStorage.getCachedData<T>(cacheKey);
    } catch (error) {
      console.error('캐시 응답 조회 실패:', error);
      return null;
    }
  }

  // 응답 캐싱
  private async cacheResponse<T>(endpoint: string, data: T, cacheDuration?: number): Promise<void> {
    try {
      const cacheKey = `api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
      await offlineStorage.cacheData(cacheKey, data, cacheDuration);
    } catch (error) {
      console.error('응답 캐싱 실패:', error);
    }
  }

  // 공통 HTTP 요청 함수 (네트워크 오류 처리 + 오프라인 캐싱 포함)
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry: boolean = false,
    useCache: boolean = true,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // 네트워크 상태 확인
    const isOnline = networkService.isOnline();
    
    // 오프라인 상태에서 GET 요청이면 캐시 조회
    if (!isOnline && options.method !== 'POST' && options.method !== 'PUT' && options.method !== 'DELETE' && useCache) {
      const cachedData = await this.getCachedResponse<T>(endpoint);
      if (cachedData) {
        console.log(`📖 오프라인 캐시 응답: ${endpoint}`);
        return cachedData;
      }
      
      // 캐시도 없고 중요하지 않은 요청이면 에러
      if (priority === 'low') {
        throw new Error('오프라인 상태이며 캐시된 데이터가 없습니다');
      }
    }
    
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

    // 실제 요청 실행 함수
    const executeRequest = async (): Promise<T> => {
      try {
        const response = await fetch(url, config);
        
        // 401 에러 (인증 실패) 처리
        if (response.status === 401 && !isRetry) {
          console.log('🔒 401 에러 감지, 토큰 갱신 시도...');
          
          // 이미 토큰 갱신 중인 경우, 큐에 추가
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({
                resolve,
                reject,
                config: { ...config, url }
              });
            });
          }

          this.isRefreshing = true;

          try {
            const refreshToken = await AsyncStorage.getItem('refresh_token');
            if (!refreshToken) {
              throw new Error('리프레시 토큰이 없습니다');
            }

            // 토큰 갱신 시도
            const refreshResponse = await this.refreshTokenRequest(refreshToken);
            
            // 새 토큰 저장
            await AsyncStorage.setItem('access_token', refreshResponse.access_token);
            if (refreshResponse.refresh_token) {
              await AsyncStorage.setItem('refresh_token', refreshResponse.refresh_token);
            }

            // 실패한 요청들 재시도
            this.processQueue(null, refreshResponse.access_token);

            // 원래 요청 재시도 (새 토큰으로)
            const newHeaders = {
              ...config.headers,
              'Authorization': `Bearer ${refreshResponse.access_token}`
            };

            return this.request<T>(endpoint, {
              ...options,
              headers: newHeaders
            }, true);

          } catch (refreshError: any) {
            console.error('토큰 갱신 실패:', refreshError);
            
            // 실패한 요청들 에러 처리
            this.processQueue(refreshError, null);
            
            // 인증 데이터 정리
            await AsyncStorage.multiRemove([
              'access_token',
              'refresh_token',
              'saved_email',
              'user_data'
            ]);

            throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
          } finally {
            this.isRefreshing = false;
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(errorData.detail || errorData.message || `HTTP ${response.status}: 요청 실패`);
          (error as any).response = { status: response.status };
          throw error;
        }

        const responseData = await response.json();
        
        // 성공한 GET 요청 응답 캐싱 (토큰 갱신 요청 제외)
        if (options.method !== 'POST' && options.method !== 'PUT' && options.method !== 'DELETE' && useCache && !endpoint.includes('refresh')) {
          await this.cacheResponse(endpoint, responseData);
        }

        return responseData;
      } catch (error: any) {
        // 네트워크 오류인 경우 적절한 에러 타입 설정
        if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
          error.name = 'NetworkError';
        }
        
        console.error('API 요청 실패:', error);
        throw error;
      }
    };

    // 재시도 로직 적용 여부 결정
    const shouldUseRetry = !isRetry && (priority === 'high' || priority === 'medium');
    
    if (shouldUseRetry && !isOnline) {
      // 오프라인 상태에서 중요한 요청은 재시도 매니저에 등록
      return retryManager.executeWithRetry(executeRequest, {
        maxRetries: 5,
        baseDelay: 2000,
        maxDelay: 30000,
        retryCondition: (error: any) => {
          return error.name === 'NetworkError' || !networkService.isOnline();
        },
        onRetry: (error: any, attempt: number) => {
          console.log(`🔄 네트워크 요청 재시도 ${attempt}: ${endpoint}`);
        }
      }, priority);
    } else if (shouldUseRetry) {
      // 온라인 상태에서도 네트워크 오류 대비 재시도
      return retryManager.executeWithRetry(executeRequest, {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000
      }, priority);
    } else {
      // 재시도 없이 바로 실행
      return executeRequest();
    }
  }

  // 토큰 갱신 전용 요청 (무한 루프 방지)
  private async refreshTokenRequest(refreshToken: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }> {
    const url = `${this.baseUrl}/auth/refresh`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Token refresh failed');
    }

    return response.json();
  }

  // 대기 중인 요청들 처리
  private processQueue(error: Error | null, token: string | null): void {
    this.failedQueue.forEach(({ resolve, reject, config }) => {
      if (error) {
        reject(error);
      } else if (token) {
        // 새 토큰으로 헤더 업데이트
        const newConfig = {
          ...config,
          headers: {
            ...config.headers,
            'Authorization': `Bearer ${token}`
          }
        };
        
        // 원래 요청 재시도
        fetch(config.url, newConfig)
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
          })
          .then(resolve)
          .catch(reject);
      }
    });
    
    this.failedQueue = [];
  }

  // 인증 헤더 추가 헬퍼
  private async getAuthHeaders(token?: string): Promise<Record<string, string>> {
    const authToken = token || await AsyncStorage.getItem('access_token');
    return authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
  }

  // GET 요청
  private get<T>(endpoint: string, token?: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<T> {
    return this.getAuthHeaders(token).then(authHeaders => 
      this.request<T>(endpoint, { 
        method: 'GET',
        headers: authHeaders
      }, false, true, priority)
    );
  }

  // POST 요청
  private post<T>(endpoint: string, data?: any, token?: string, priority: 'high' | 'medium' | 'low' = 'high'): Promise<T> {
    return this.getAuthHeaders(token).then(authHeaders =>
      this.request<T>(endpoint, {
        method: 'POST',
        headers: authHeaders,
        body: data ? JSON.stringify(data) : undefined,
      }, false, false, priority)
    );
  }

  // PUT 요청
  private put<T>(endpoint: string, data?: any, token?: string, priority: 'high' | 'medium' | 'low' = 'high'): Promise<T> {
    return this.getAuthHeaders(token).then(authHeaders =>
      this.request<T>(endpoint, {
        method: 'PUT',
        headers: authHeaders,
        body: data ? JSON.stringify(data) : undefined,
      }, false, false, priority)
    );
  }

  // DELETE 요청
  private delete<T>(endpoint: string, token?: string, priority: 'high' | 'medium' | 'low' = 'high'): Promise<T> {
    return this.getAuthHeaders(token).then(authHeaders =>
      this.request<T>(endpoint, { 
        method: 'DELETE',
        headers: authHeaders
      }, false, false, priority)
    );
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
  // 인증 관련 API
  // ===================

  // 회원가입
  async register(userData: {
    email: string;
    phone: string;
    first_name: string;
    last_name: string;
    country_code: string;
    pin: string;
    preferred_currency?: string;
  }) {
    return this.post<{
      message: string;
      user_id: number;
      wallet_creation_status: string;
      wallet_error?: string;
      verification_required: {
        email: boolean;
        phone: boolean;
      };
    }>('/auth/register', userData);
  }

  // 로그인
  async login(credentials: {
    email: string;
    pin: string;
  }) {
    return this.post<{
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
      user: any;
    }>('/auth/login', credentials);
  }

  // 이메일 인증
  async verifyEmail(data: {
    email: string;
    verification_code: string;
  }) {
    return this.post<{
      message: string;
      verified: boolean;
    }>('/auth/verify-email', data);
  }

  // SMS 인증
  async verifyPhone(data: {
    phone: string;
    verification_code: string;
  }) {
    return this.post<{
      message: string;
      verified: boolean;
    }>('/auth/verify-phone', data);
  }

  // 토큰 갱신
  async refreshToken(refreshToken: string) {
    return this.post<{
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
    }>('/auth/refresh', { refresh_token: refreshToken });
  }

  // 현재 사용자 정보 조회
  async getCurrentUser(accessToken?: string) {
    return this.get<any>('/auth/me', accessToken);
  }

  // 지갑 생성/재생성
  async createUserWallet(accessToken?: string) {
    return this.post<{
      status: string;
      message: string;
      wallet?: any;
    }>('/auth/create-wallet', undefined, accessToken);
  }

  // 개발용 인증 코드 조회 (개발 환경에서만)
  async getDevVerificationCode(identifier: string) {
    if (__DEV__) {
      return this.get<{
        identifier: string;
        code: string;
        timestamp: string;
      }>(`/auth/dev/verification-codes/${identifier}`);
    }
    throw new Error('개발 환경에서만 사용 가능합니다');
  }

  // ===================
  // 사용자 관련 API (레거시)
  // ===================

  async createUser(userData: any) {
    // 새로운 register 함수 사용 권장
    return this.register(userData);
  }

  async loginUser(credentials: any) {
    // 새로운 login 함수 사용 권장
    return this.login(credentials);
  }

  async getUserProfile(userId: string) {
    // getCurrentUser 함수 사용 권장
    return this.get<any>(`/users/${userId}`);
  }

  // ===================
  // USDC 충전 관련 API
  // ===================

  // 은행 송금 충전
  async createWireDeposit(walletId: number, request: {
    bank_account: {
      account_holder_name: string;
      bank_name: string;
      account_number: string;
      routing_number: string;
      address_line1: string;
      address_line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
    amount: string;
    currency?: string;
  }, accessToken?: string) {
    return this.post<{
      deposit_id: string;
      status: string;
      message: string;
      tracking_ref?: string;
      wire_instructions?: any;
      estimated_completion?: string;
    }>(`/deposits/wallets/${walletId}/deposit/wire`, request, accessToken);
  }

  // 암호화폐 충전
  async createCryptoDeposit(walletId: number, request: {
    chain: string;
    amount: string;
    currency?: string;
  }, accessToken?: string) {
    return this.post<{
      deposit_id: string;
      status: string;
      message: string;
      deposit_address?: string;
      estimated_completion?: string;
    }>(`/deposits/wallets/${walletId}/deposit/crypto`, request, accessToken);
  }

  // 충전 주소 목록 조회
  async getDepositAddresses(walletId: number, accessToken?: string) {
    return this.get<{
      wallet_id: number;
      deposit_addresses: Array<{
        id: string;
        address: string;
        currency: string;
        chain: string;
      }>;
      message: string;
    }>(`/deposits/wallets/${walletId}/deposit/addresses`, accessToken);
  }

  // 충전 상태 조회
  async getDepositStatus(depositId: string, accessToken?: string) {
    return this.get<{
      deposit_id: string;
      status: string;
      amount: number;
      currency: string;
      created_at: string;
      completed_at?: string;
      detailed_status?: any;
      notes?: string;
    }>(`/deposits/deposits/${depositId}/status`, accessToken);
  }

  // 충전 내역 조회
  async getDepositHistory(options: {
    limit?: number;
    offset?: number;
  } = {}, accessToken?: string) {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    
    return this.get<{
      deposits: Array<{
        deposit_id: string;
        status: string;
        amount: number;
        currency: string;
        method?: string;
        chain?: string;
        created_at: string;
        completed_at?: string;
        notes?: string;
      }>;
      total: number;
      limit: number;
      offset: number;
    }>(`/deposits/deposits/history${queryString}`, accessToken);
  }

  // ===================
  // 사용자 프로필 및 KYC 관련 API
  // ===================

  // 사용자 프로필 조회
  async getUserProfile(accessToken?: string) {
    return this.get<{
      id: number;
      email: string;
      first_name: string;
      last_name: string;
      country_code: string;
      preferred_currency: string;
      phone?: string;
      is_verified: boolean;
      kyc_status: string;
      kyc_level: number;
      created_at: string;
      last_login_at?: string;
    }>('/users/profile', accessToken);
  }

  // 사용자 프로필 업데이트
  async updateUserProfile(profileData: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    preferred_currency?: string;
  }, accessToken?: string) {
    return this.put<{
      id: number;
      email: string;
      first_name: string;
      last_name: string;
      country_code: string;
      preferred_currency: string;
      phone?: string;
      is_verified: boolean;
      kyc_status: string;
      kyc_level: number;
      created_at: string;
      last_login_at?: string;
    }>('/users/profile', profileData, accessToken);
  }

  // KYC 문서 제출
  async submitKYCDocument(kycData: {
    document_type: string;
    document_number?: string;
    full_name: string;
    date_of_birth: string;
    nationality: string;
    gender?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state_province?: string;
    postal_code?: string;
    country?: string;
    occupation?: string;
    employer?: string;
    income_range?: string;
    source_of_funds?: string;
  }, documentFile?: File, accessToken?: string) {
    // FormData를 사용하여 파일과 데이터를 함께 전송
    const formData = new FormData();
    
    // KYC 데이터를 JSON 문자열로 추가
    formData.append('kyc_data', JSON.stringify(kycData));
    
    // 파일이 있으면 추가
    if (documentFile) {
      formData.append('document_file', documentFile);
    }
    
    return this.post<{
      kyc_document_id: number;
      status: string;
      kyc_level: number;
      risk_score: number;
      message: string;
      estimated_review_time: string;
    }>('/users/kyc/submit', formData, accessToken);
  }

  // KYC 상태 조회
  async getKYCStatus(accessToken?: string) {
    return this.get<{
      user_id: number;
      kyc_status: string;
      kyc_level: number;
      documents: Array<{
        id: number;
        document_type: string;
        verification_status: string;
        risk_score?: number;
        created_at: string;
        verified_at?: string;
        expires_at?: string;
      }>;
      last_updated?: string;
      next_steps: string[];
    }>('/users/kyc/status', accessToken);
  }

  // KYC 문서 재제출
  async resubmitKYCDocument(
    documentId: number,
    kycData: {
      document_type: string;
      document_number?: string;
      full_name: string;
      date_of_birth: string;
      nationality: string;
      gender?: string;
      address_line1?: string;
      address_line2?: string;
      city?: string;
      state_province?: string;
      postal_code?: string;
      country?: string;
      occupation?: string;
      employer?: string;
      income_range?: string;
      source_of_funds?: string;
    },
    documentFile?: File,
    accessToken?: string
  ) {
    const formData = new FormData();
    formData.append('kyc_data', JSON.stringify(kycData));
    
    if (documentFile) {
      formData.append('document_file', documentFile);
    }
    
    return this.post<{
      message: string;
      document_id: number;
      status: string;
      estimated_review_time: string;
    }>(`/users/kyc/resubmit/${documentId}`, formData, accessToken);
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