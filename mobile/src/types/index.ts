// 사용자 관련 타입
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  preferredCurrency: string;
  isVerified: boolean;
  kycStatus: 'pending' | 'approved' | 'rejected';
}

// 지갑 관련 타입
export interface Wallet {
  walletId: string;
  address: string;
  blockchain: string;
  chainId: number;
  chainName: string;
  usdcBalance: number;
  isPrimary: boolean;
  createdAt: string;
}

// 거래 관련 타입
export interface Transaction {
  transactionId: string;
  type: 'payment' | 'transfer' | 'withdrawal';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  fromAddress: string;
  toAddress: string;
  transactionHash?: string;
  createdAt: string;
  completedAt?: string;
  merchantName?: string;
  notes?: string;
}

// 결제 요청 타입
export interface PaymentRequest {
  amount: number;
  currency: string;
  merchantId: string;
  merchantName: string;
  description?: string;
}

// QR 코드 타입
export interface QRCodeData {
  qrCodeId: string;
  qrCodeData: string;
  paymentUrl: string;
  expiresAt: string;
  amount: number;
  currency: string;
  merchantName: string;
}

// 크로스체인 전송 요청 타입
export interface CrossChainTransferRequest {
  sourceWalletId: string;
  targetAddress: string;
  amount: number;
  sourceChain: string;
  targetChain: string;
  notes?: string;
}

// 지원 체인 타입
export interface SupportedChain {
  id: string;
  name: string;
  chainId: number;
  nativeCurrency: string;
  status: 'active' | 'inactive';
}

// API 응답 타입
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

// 앱 상태 타입
export interface AppState {
  user: User | null;
  wallets: Wallet[];
  transactions: Transaction[];
  supportedChains: SupportedChain[];
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  
  // 토큰 만료 모달 상태
  tokenExpiredModal: {
    visible: boolean;
    reason: 'expired' | 'invalid' | 'network' | 'unknown';
    autoRetryCount: number;
  };
  
  // 네트워크 상태
  networkState: any | null; // NetworkState 타입은 서비스에서 정의됨
  isOffline: boolean;
  offlineModal: {
    visible: boolean;
    hasShownOnce: boolean;
  };
} 