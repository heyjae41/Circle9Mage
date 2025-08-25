import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, User, Wallet, Transaction, SupportedChain } from '../types';
import { apiService } from '../services/apiService';
import { tokenManager } from '../utils/tokenManager';
import { backgroundTokenService } from '../services/backgroundTokenService';
import { biometricAuthManager } from '../utils/biometricAuth';
import { networkService, NetworkState } from '../services/networkService';
import { offlineStorage } from '../services/offlineStorage';
import { syncService, SyncResult } from '../services/syncService';
import i18n from '../i18n';

// 액션 타입 정의
type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_WALLETS'; payload: Wallet[] }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'SET_SUPPORTED_CHAINS'; payload: SupportedChain[] }
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_WALLET_BALANCE'; payload: { walletId: string; balance: number } }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_ACCESS_TOKEN'; payload: string | null }
  | { type: 'SET_LANGUAGE'; payload: string }
  | { type: 'SHOW_TOKEN_EXPIRED_MODAL'; payload: { reason: 'expired' | 'invalid' | 'network' | 'unknown'; autoRetryCount: number } }
  | { type: 'HIDE_TOKEN_EXPIRED_MODAL' }
  | { type: 'SET_NETWORK_STATE'; payload: NetworkState }
  | { type: 'SHOW_OFFLINE_MODAL' }
  | { type: 'HIDE_OFFLINE_MODAL' };

// 초기 상태
const initialState: AppState = {
  user: null,
  wallets: [],
  transactions: [],
  supportedChains: [],
  isLoading: false,
  error: null,
  isAuthenticated: false,
  accessToken: null,
  currentLanguage: 'ko', // 기본값 한국어
  tokenExpiredModal: {
    visible: false,
    reason: 'expired',
    autoRetryCount: 0,
  },
  networkState: null,
  isOffline: false,
  offlineModal: {
    visible: false,
    hasShownOnce: false,
  },
};

// 리듀서 함수
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_WALLETS':
      return { ...state, wallets: action.payload };
    case 'SET_TRANSACTIONS':
      return { ...state, transactions: action.payload };
    case 'SET_SUPPORTED_CHAINS':
      return { ...state, supportedChains: action.payload };
    case 'ADD_TRANSACTION':
      return { 
        ...state, 
        transactions: [action.payload, ...state.transactions] 
      };
    case 'UPDATE_WALLET_BALANCE':
      return {
        ...state,
        wallets: state.wallets.map(wallet =>
          wallet.walletId === action.payload.walletId
            ? { ...wallet, usdcBalance: action.payload.balance }
            : wallet
        ),
      };
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };
    case 'SET_ACCESS_TOKEN':
      return { ...state, accessToken: action.payload };
    case 'SET_LANGUAGE':
      return { ...state, currentLanguage: action.payload };
    case 'SHOW_TOKEN_EXPIRED_MODAL':
      return {
        ...state,
        tokenExpiredModal: {
          visible: true,
          reason: action.payload.reason,
          autoRetryCount: action.payload.autoRetryCount,
        },
      };
    case 'HIDE_TOKEN_EXPIRED_MODAL':
      return {
        ...state,
        tokenExpiredModal: {
          ...state.tokenExpiredModal,
          visible: false,
        },
      };
    case 'SET_NETWORK_STATE':
      return {
        ...state,
        networkState: action.payload,
        isOffline: !action.payload.isConnected || !action.payload.isReachable,
      };
    case 'SHOW_OFFLINE_MODAL':
      return {
        ...state,
        offlineModal: {
          visible: true,
          hasShownOnce: true,
        },
      };
    case 'HIDE_OFFLINE_MODAL':
      return {
        ...state,
        offlineModal: {
          ...state.offlineModal,
          visible: false,
        },
      };
    default:
      return state;
  }
}

// 컨텍스트 타입
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // 헬퍼 함수들
  loadUserData: () => Promise<void>;
  loadWallets: (userId: string) => Promise<void>;
  loadTransactions: (walletId: string) => Promise<void>;
  createPayment: (request: any) => Promise<any>;
  createTransfer: (request: any) => Promise<any>;
  // 인증 관련 함수들
  checkAuthStatus: () => Promise<void>;
  logout: () => Promise<void>;
  setAuthToken: (token: string, refreshToken?: string) => Promise<void>;
  
  // USDC 충전 관련 함수들
  createWireDeposit: (walletId: number, request: any) => Promise<any>;
  createCryptoDeposit: (walletId: number, request: any) => Promise<any>;
  getDepositAddresses: (walletId: number) => Promise<any>;
  getDepositStatus: (depositId: string) => Promise<any>;
  getDepositHistory: (options?: any) => Promise<any>;
  
  // 사용자 프로필 및 KYC 관련 함수들
  getUserProfile: () => Promise<any>;
  updateUserProfile: (profileData: any) => Promise<any>;
  submitKYCDocument: (kycData: any, documentFile?: File) => Promise<any>;
  getKYCStatus: () => Promise<any>;
  resubmitKYCDocument: (documentId: number, kycData: any, documentFile?: File) => Promise<any>;
  
  // 토큰 만료 모달 관련
  showTokenExpiredModal: (reason?: 'expired' | 'invalid' | 'network' | 'unknown', autoRetryCount?: number) => void;
  hideTokenExpiredModal: () => void;
  
  // 네트워크 상태 관련
  showOfflineModal: () => void;
  hideOfflineModal: () => void;
  
  // 동기화 관련
  requestSync: () => Promise<void>;
  
  // 언어 관련
  changeLanguage: (languageCode: string) => Promise<void>;
  isRTL: (languageCode?: string) => boolean;
  getRTLStyle: (languageCode?: string) => any;
}

// 컨텍스트 생성
const AppContext = createContext<AppContextType | undefined>(undefined);

// 프로바이더 컴포넌트
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  // TokenManager 콜백 설정
  useEffect(() => {
    // 토큰 자동 갱신 시 콜백
    const handleTokenUpdated = async (newToken: string, refreshToken?: string) => {
      console.log('🔄 토큰 자동 갱신됨, 상태 업데이트');
      dispatch({ type: 'SET_ACCESS_TOKEN', payload: newToken });
      
      // 사용자 데이터 다시 로드 (토큰이 바뀌었으므로)
      try {
        await loadUserData();
      } catch (error) {
        console.error('토큰 갱신 후 사용자 데이터 로드 실패:', error);
      }
    };

    // 토큰 만료 시 콜백 (사용자 친화적 처리)
    const handleTokenExpired = () => {
      console.log('🚨 토큰 만료, 사용자 친화적 처리');
      
      // 상태 초기화
      dispatch({ type: 'SET_ACCESS_TOKEN', payload: null });
      dispatch({ type: 'SET_AUTHENTICATED', payload: false });
      dispatch({ type: 'SET_USER', payload: null });
      dispatch({ type: 'SET_WALLETS', payload: [] });
      dispatch({ type: 'SET_TRANSACTIONS', payload: [] });
      
      // 토큰 만료 모달 표시
      showTokenExpiredModal('expired', 0);
    };

    // TokenManager에 콜백 설정
    tokenManager.onTokenUpdated = handleTokenUpdated;
    tokenManager.onTokenExpired = handleTokenExpired;

    // 백그라운드 토큰 서비스 시작
    backgroundTokenService.start();

    // 컴포넌트 언마운트 시 정리
    return () => {
      tokenManager.cleanup();
      backgroundTokenService.stop();
    };
  }, []);

  // 사용자 데이터 로드 (실제 API 사용)
  const loadUserData = async () => {
    console.log('🚀 loadUserData 시작');
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // 저장된 토큰 확인 (state 대신 AsyncStorage에서 직접 읽기)
      let token = state.accessToken;
      console.log('🔑 State 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
      
      // state에 토큰이 없으면 AsyncStorage에서 확인 (타이밍 이슈 방지)
      if (!token) {
        console.log('📱 AsyncStorage에서 토큰 재확인...');
        token = await AsyncStorage.getItem('access_token');
        console.log('🔑 AsyncStorage 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
        
        // AsyncStorage에서 토큰을 찾았으면 state에도 설정
        if (token) {
          console.log('✅ AsyncStorage에서 토큰 발견, state 업데이트');
          dispatch({ type: 'SET_ACCESS_TOKEN', payload: token });
        }
      }
      
      if (!token) {
        console.error('❌ 토큰이 없어서 loadUserData 중단');
        dispatch({ type: 'SET_ERROR', payload: '인증 토큰이 없습니다' });
        return;
      }
      
      console.log('📡 API 호출 시작: getCurrentUser');
      // 실제 API 호출로 사용자 정보 가져오기 (토큰은 자동으로 AsyncStorage에서 가져옴)
      const userResponse = await apiService.getCurrentUser();
      console.log('✅ API 응답 받음:', { id: userResponse.id, email: userResponse.email });
      
      // 사용자 데이터 변환
      const user: User = {
        id: userResponse.id?.toString() || 'unknown',
        email: userResponse.email || '',
        firstName: userResponse.first_name || '',
        lastName: userResponse.last_name || '',
        countryCode: userResponse.country_code || 'KR',
        preferredCurrency: userResponse.preferred_currency || 'USDC',
        isVerified: userResponse.is_verified || false,
        kycStatus: userResponse.kyc_status || 'pending',
      };
      
      console.log('👤 사용자 상태 업데이트 시작');
      dispatch({ type: 'SET_USER', payload: user });
      dispatch({ type: 'SET_AUTHENTICATED', payload: true });
      console.log('✅ 인증 상태 업데이트 완료:', { isAuthenticated: true, user: user.email });
      
      // 사용자 지갑 정보 로드
      console.log('💼 지갑 정보 로드 시작');
      await loadWallets(user.id);
      console.log('🎉 loadUserData 완전히 완료');
      
    } catch (error: any) {
      console.error('❌ 사용자 데이터 로드 실패:', error);
      dispatch({ type: 'SET_ERROR', payload: '사용자 데이터 로드 실패' });
      dispatch({ type: 'SET_AUTHENTICATED', payload: false });
      dispatch({ type: 'SET_USER', payload: null });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 지갑 데이터 로드
  const loadWallets = async (userId: string) => {
    try {
      const response = await apiService.getUserWallets(userId);
      
      // 백엔드 snake_case 응답을 프론트엔드 camelCase로 변환
      const transformedWallets = response.wallets.map((wallet: any) => ({
        walletId: wallet.wallet_id,
        address: wallet.address,
        blockchain: wallet.blockchain,
        chainId: wallet.chain_id,
        chainName: wallet.chain_name || wallet.blockchain, // fallback to blockchain
        usdcBalance: wallet.usdc_balance || 0,
        isPrimary: wallet.is_primary || false,
        createdAt: wallet.created_at
      }));
      
      console.log('🔄 지갑 데이터 변환 완료:', transformedWallets.map(w => ({
        walletId: w.walletId,
        chainName: w.chainName,
        blockchain: w.blockchain
      })));
      
      dispatch({ type: 'SET_WALLETS', payload: transformedWallets });
    } catch (error) {
      console.error('지갑 데이터 로드 실패:', error);
      dispatch({ type: 'SET_ERROR', payload: '지갑 데이터 로드 실패' });
    }
  };

  // 거래 내역 로드
  const loadTransactions = async (walletId: string) => {
    try {
      const response = await apiService.getWalletTransactions(walletId);
      dispatch({ type: 'SET_TRANSACTIONS', payload: response.transactions });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '거래 내역 로드 실패' });
    }
  };

  // 결제 생성
  const createPayment = async (request: any) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.createPayment(request);
      
      // 새 거래를 상태에 추가
      const newTransaction: Transaction = {
        transactionId: response.paymentId,
        type: 'payment',
        amount: request.amount,
        currency: request.currency,
        status: 'pending',
        fromAddress: '',
        toAddress: '',
        createdAt: new Date().toISOString(),
        merchantName: request.merchantName,
      };
      
      dispatch({ type: 'ADD_TRANSACTION', payload: newTransaction });
      return response;
      
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '결제 생성 실패' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 크로스체인 전송 생성
  const createTransfer = async (request: any) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.createCrossChainTransfer(request);
      
      // 새 거래를 상태에 추가
      const newTransaction: Transaction = {
        transactionId: response.paymentId,
        type: 'transfer',
        amount: request.amount,
        currency: 'USDC',
        status: 'pending',
        fromAddress: request.sourceWalletId,
        toAddress: request.targetAddress,
        createdAt: new Date().toISOString(),
        notes: request.notes,
      };
      
      dispatch({ type: 'ADD_TRANSACTION', payload: newTransaction });
      return response;
      
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '전송 생성 실패' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // ===================
  // USDC 충전 관련 함수들
  // ===================

  // 은행 송금 충전
  const createWireDeposit = async (walletId: number, request: any) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.createWireDeposit(walletId, request, state.accessToken || undefined);
      
      // 새 거래를 상태에 추가 (deposit 타입)
      const newTransaction: Transaction = {
        transactionId: response.deposit_id,
        type: 'transfer', // deposit은 transfer의 하위 타입으로 처리
        amount: parseFloat(request.amount),
        currency: request.currency || 'USD',
        status: 'pending',
        fromAddress: 'bank_account',
        toAddress: walletId.toString(),
        createdAt: new Date().toISOString(),
        notes: `은행 송금 충전 - ${request.bank_account.bank_name}`,
      };
      
      dispatch({ type: 'ADD_TRANSACTION', payload: newTransaction });
      return response;
      
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '은행 충전 요청 실패' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 암호화폐 충전
  const createCryptoDeposit = async (walletId: number, request: any) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.createCryptoDeposit(walletId, request, state.accessToken || undefined);
      
      // 새 거래를 상태에 추가
      const newTransaction: Transaction = {
        transactionId: response.deposit_id,
        type: 'transfer',
        amount: parseFloat(request.amount),
        currency: request.currency || 'USD',
        status: 'pending',
        fromAddress: 'external_wallet',
        toAddress: response.deposit_address || walletId.toString(),
        createdAt: new Date().toISOString(),
        notes: `암호화폐 충전 - ${request.chain} 체인`,
      };
      
      dispatch({ type: 'ADD_TRANSACTION', payload: newTransaction });
      return response;
      
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '암호화폐 충전 요청 실패' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 충전 주소 목록 조회
  const getDepositAddresses = async (walletId: number) => {
    try {
      const response = await apiService.getDepositAddresses(walletId, state.accessToken || undefined);
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '충전 주소 조회 실패' });
      throw error;
    }
  };

  // 충전 상태 조회
  const getDepositStatus = async (depositId: string) => {
    try {
      const response = await apiService.getDepositStatus(depositId, state.accessToken || undefined);
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '충전 상태 조회 실패' });
      throw error;
    }
  };

  // 충전 내역 조회
  const getDepositHistory = async (options: any = {}) => {
    try {
      const response = await apiService.getDepositHistory(options, state.accessToken || undefined);
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '충전 내역 조회 실패' });
      throw error;
    }
  };

  // ===================
  // 사용자 프로필 및 KYC 관련 함수들
  // ===================

  // 사용자 프로필 조회
  const getUserProfile = async () => {
    try {
      const response = await apiService.getUserProfile(state.accessToken || undefined);
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '프로필 조회 실패' });
      throw error;
    }
  };

  // 사용자 프로필 업데이트
  const updateUserProfile = async (profileData: any) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.updateUserProfile(profileData, state.accessToken || undefined);
      
      // 사용자 정보 업데이트
      if (state.user) {
        dispatch({ 
          type: 'SET_USER', 
          payload: {
            ...state.user,
            firstName: response.first_name,
            lastName: response.last_name,
            preferredCurrency: response.preferred_currency
          }
        });
      }
      
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '프로필 업데이트 실패' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // KYC 문서 제출
  const submitKYCDocument = async (kycData: any, documentFile?: File) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.submitKYCDocument(kycData, documentFile, state.accessToken || undefined);
      
      // 사용자 KYC 상태 업데이트
      if (state.user) {
        dispatch({ 
          type: 'SET_USER', 
          payload: {
            ...state.user,
            kycStatus: response.status as 'pending' | 'approved' | 'rejected'
          }
        });
      }
      
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'KYC 문서 제출 실패' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // KYC 상태 조회
  const getKYCStatus = async () => {
    try {
      const response = await apiService.getKYCStatus(state.accessToken || undefined);
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'KYC 상태 조회 실패' });
      throw error;
    }
  };

  // KYC 문서 재제출
  const resubmitKYCDocument = async (documentId: number, kycData: any, documentFile?: File) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await apiService.resubmitKYCDocument(documentId, kycData, documentFile, state.accessToken || undefined);
      
      // 사용자 KYC 상태를 pending으로 업데이트
      if (state.user) {
        dispatch({ 
          type: 'SET_USER', 
          payload: {
            ...state.user,
            kycStatus: 'pending'
          }
        });
      }
      
      return response;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'KYC 문서 재제출 실패' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 인증 상태 확인 및 자동 로그인
  const checkAuthStatus = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // AsyncStorage에서 저장된 토큰 가져오기
      const savedToken = await AsyncStorage.getItem('access_token');
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      
      if (savedToken) {
        dispatch({ type: 'SET_ACCESS_TOKEN', payload: savedToken });
        
        // 토큰 자동 갱신 스케줄링
        tokenManager.scheduleTokenRefresh(savedToken);
        
        // 토큰으로 사용자 정보 로드 시도
        try {
          await loadUserData();
        } catch (userError: any) {
          console.log('저장된 토큰으로 로그인 실패, 토큰 갱신 시도');
          
          // 토큰이 만료된 경우 refresh 시도
          if (refreshToken) {
            try {
              const refreshResponse = await apiService.refreshToken(refreshToken);
              
              // 새 토큰 저장
              await AsyncStorage.setItem('access_token', refreshResponse.accessToken);
              await AsyncStorage.setItem('refresh_token', refreshResponse.refreshToken);
              
              dispatch({ type: 'SET_ACCESS_TOKEN', payload: refreshResponse.accessToken });
              
              // 새 토큰으로 자동 갱신 스케줄링
              tokenManager.scheduleTokenRefresh(refreshResponse.accessToken);
              
              await loadUserData();
              
              console.log('토큰 갱신 성공, 자동 로그인 완료');
            } catch (refreshError) {
              console.log('토큰 갱신 실패, 로그아웃 처리');
              await clearAuthData(); // 기본값 true로 로그인 정보 보존
            }
          } else {
            await clearAuthData(); // 기본값 true로 로그인 정보 보존
          }
        }
      } else {
        // 토큰이 없는 경우 생체 인증 자동 로그인 시도
        await attemptBiometricAutoLogin();
      }
    } catch (error) {
      console.error('인증 상태 확인 실패:', error);
      dispatch({ type: 'SET_AUTHENTICATED', payload: false });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 인증 데이터 완전 정리 (내부 함수)
  const clearAuthData = async (preserveLoginInfo: boolean = true) => {
    try {
      // 토큰 자동 갱신 타이머 정리
      tokenManager.clearRefreshTimer();
      
      // 기본 삭제 대상 (토큰과 사용자 데이터)
      const keysToRemove = [
        'access_token',
        'refresh_token', 
        'user_data'
      ];
      
      // 완전 로그아웃시에만 로그인 정보도 삭제
      if (!preserveLoginInfo) {
        keysToRemove.push('saved_email', 'saved_pin');
        console.log('🗑️ 로그인 정보까지 완전 삭제');
      } else {
        console.log('💾 로그인 정보는 보존 (토큰 만료)');
      }
      
      // AsyncStorage에서 인증 관련 데이터 삭제
      await AsyncStorage.multiRemove(keysToRemove);
      
      // 상태 초기화
      dispatch({ type: 'SET_ACCESS_TOKEN', payload: null });
      dispatch({ type: 'SET_AUTHENTICATED', payload: false });
      dispatch({ type: 'SET_USER', payload: null });
      dispatch({ type: 'SET_WALLETS', payload: [] });
      dispatch({ type: 'SET_TRANSACTIONS', payload: [] });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error) {
      console.error('인증 데이터 정리 실패:', error);
    }
  };

  // 로그아웃 (사용자가 명시적으로 로그아웃 선택)
  const logout = async () => {
    try {
      await clearAuthData(false); // 로그인 정보도 완전 삭제
      console.log('로그아웃 완료');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  // 인증 토큰 설정 및 저장
  const setAuthToken = async (token: string, refreshToken?: string) => {
    try {
      // AsyncStorage에 토큰 저장
      await AsyncStorage.setItem('access_token', token);
      if (refreshToken) {
        await AsyncStorage.setItem('refresh_token', refreshToken);
      }
      
      // 상태 업데이트
      dispatch({ type: 'SET_ACCESS_TOKEN', payload: token });
      
      // 토큰 자동 갱신 스케줄링
      tokenManager.scheduleTokenRefresh(token);
      
      console.log('토큰 저장 및 자동 갱신 스케줄링 완료');
    } catch (error) {
      console.error('토큰 저장 실패:', error);
      // 저장 실패해도 일단 상태는 업데이트
      dispatch({ type: 'SET_ACCESS_TOKEN', payload: token });
    }
  };

  // 생체 인증 자동 로그인 시도
  const attemptBiometricAutoLogin = async () => {
    try {
      // 생체 인증 사용 가능 여부 확인
      const isAvailableAndEnabled = await biometricAuthManager.isAvailableAndEnabled();
      
      if (!isAvailableAndEnabled) {
        dispatch({ type: 'SET_AUTHENTICATED', payload: false });
        return;
      }

      // 마지막 생체 인증 시간 확인 (24시간 이내)
      const lastAuthTime = await biometricAuthManager.getLastAuthTime();
      const now = Date.now();
      const dayInMs = 24 * 60 * 60 * 1000; // 24시간

      if (!lastAuthTime || (now - lastAuthTime) > dayInMs) {
        console.log('생체 인증이 너무 오래되었거나 기록이 없음, 수동 로그인 필요');
        dispatch({ type: 'SET_AUTHENTICATED', payload: false });
        return;
      }

      console.log('🔐 앱 시작 시 생체 인증 자동 로그인 시도...');

      // 생체 인증 수행 (자동 로그인용 메시지)
      const authResult = await biometricAuthManager.authenticate(
        'CirclePay에 빠르게 접근하려면 생체 인증을 사용해주세요'
      );

      if (authResult.success) {
        // 저장된 이메일로 자동 로그인 시도
        const savedEmail = await AsyncStorage.getItem('saved_email');
        
        if (savedEmail) {
          console.log('✅ 생체 인증 성공, 자동 로그인 완료');
          // 실제로는 생체 인증만으로는 완전한 로그인이 어려우므로
          // 사용자에게 PIN 입력을 요청하거나 다른 방법을 사용해야 함
          // 여기서는 생체 인증이 성공했다는 것만 표시
          dispatch({ type: 'SET_AUTHENTICATED', payload: false });
        } else {
          console.log('저장된 이메일이 없음');
          dispatch({ type: 'SET_AUTHENTICATED', payload: false });
        }
      } else {
        console.log('생체 인증 실패 또는 취소됨');
        dispatch({ type: 'SET_AUTHENTICATED', payload: false });
      }
    } catch (error) {
      console.error('생체 인증 자동 로그인 실패:', error);
      dispatch({ type: 'SET_AUTHENTICATED', payload: false });
    }
  };

  // 토큰 만료 모달 표시
  const showTokenExpiredModal = (reason: 'expired' | 'invalid' | 'network' | 'unknown' = 'expired', autoRetryCount: number = 0) => {
    dispatch({ 
      type: 'SHOW_TOKEN_EXPIRED_MODAL', 
      payload: { reason, autoRetryCount } 
    });
  };

  // 토큰 만료 모달 숨기기
  const hideTokenExpiredModal = () => {
    dispatch({ type: 'HIDE_TOKEN_EXPIRED_MODAL' });
  };

  // 오프라인 모달 표시
  const showOfflineModal = () => {
    dispatch({ type: 'SHOW_OFFLINE_MODAL' });
  };

  // 오프라인 모달 숨기기
  const hideOfflineModal = () => {
    dispatch({ type: 'HIDE_OFFLINE_MODAL' });
  };

  // 수동 동기화 요청
  const requestSync = async (): Promise<void> => {
    if (!state.user) {
      console.log('사용자가 로그인되어 있지 않아 동기화를 건너뜁니다');
      return;
    }

    try {
      console.log('🔄 수동 동기화 시작');
      const result: SyncResult = await syncService.requestManualSync(state.user.id.toString());
      
      if (result.success) {
        console.log('✅ 동기화 성공:', result.syncedItems);
        
        // 동기화된 데이터로 상태 업데이트
        if (result.syncedItems.users > 0 || result.syncedItems.wallets > 0 || result.syncedItems.transactions > 0) {
          await loadUserData();
        }
      } else {
        console.error('❌ 동기화 실패:', result.errors);
      }
    } catch (error) {
      console.error('동기화 요청 실패:', error);
    }
  };

  // 언어 변경 함수
  const changeLanguage = async (languageCode: string): Promise<void> => {
    try {
      console.log(`🌍 언어 변경 시작: ${state.currentLanguage} -> ${languageCode}`);
      
      // AsyncStorage에 언어 설정 저장 (biometricAuth.ts 패턴 준수)
      await AsyncStorage.setItem('user_language', languageCode);
      console.log('💾 AsyncStorage에 언어 설정 저장 완료');
      
      // i18n 언어 변경
      await i18n.changeLanguage(languageCode);
      console.log('🔄 i18n 언어 변경 완료');
      
      // 상태 업데이트
      dispatch({ type: 'SET_LANGUAGE', payload: languageCode });
      console.log('✅ 언어 변경 완료:', languageCode);
      
    } catch (error) {
      console.error('❌ 언어 변경 실패:', error);
      dispatch({ type: 'SET_ERROR', payload: '언어 변경에 실패했습니다' });
      throw error;
    }
  };

  // RTL 언어 감지 함수
  const isRTL = (languageCode?: string): boolean => {
    const rtlLanguages = ['ar', 'he', 'fa']; // 아랍어, 히브리어, 페르시아어
    return rtlLanguages.includes(languageCode || state.currentLanguage);
  };

  // RTL 스타일 헬퍼 함수
  const getRTLStyle = (languageCode?: string) => {
    const isRightToLeft = isRTL(languageCode);
    return {
      flexDirection: isRightToLeft ? 'row-reverse' : 'row',
      textAlign: isRightToLeft ? 'right' : 'left',
      writingDirection: isRightToLeft ? 'rtl' : 'ltr',
    };
  };

  // 네트워크 상태 모니터링
  useEffect(() => {
    const unsubscribe = networkService.addListener((networkState: NetworkState) => {
      dispatch({ type: 'SET_NETWORK_STATE', payload: networkState });
      
      // 오프라인 상태로 전환되고 아직 모달을 보여주지 않았다면 표시
      const isOffline = !networkState.isConnected || !networkState.isReachable;
      if (isOffline && !state.offlineModal.hasShownOnce) {
        setTimeout(() => showOfflineModal(), 1000); // 1초 지연 후 표시
      }
      
      // 온라인으로 복귀했을 때 모달 숨기기
      if (!isOffline && state.offlineModal.visible) {
        hideOfflineModal();
      }
    });

    return unsubscribe;
  }, [state.offlineModal.hasShownOnce, state.offlineModal.visible]);

  // 저장된 언어 설정 로드
  const loadSavedLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('user_language');
      if (savedLanguage) {
        console.log('💾 저장된 언어 설정 발견:', savedLanguage);
        await i18n.changeLanguage(savedLanguage);
        dispatch({ type: 'SET_LANGUAGE', payload: savedLanguage });
        console.log('✅ 저장된 언어 설정 적용 완료');
      } else {
        console.log('📱 저장된 언어 설정 없음, 기본값(ko) 사용');
      }
    } catch (error) {
      console.error('❌ 언어 설정 로드 실패:', error);
    }
  };

  // 앱 시작 시 초기 데이터 로드
  useEffect(() => {
    // 언어 설정을 가장 먼저 로드
    loadSavedLanguage();
    
    checkAuthStatus();
    
    // 지원 체인 로드
    const loadSupportedChains = async () => {
      try {
        const response = await apiService.getSupportedChains();
        dispatch({ type: 'SET_SUPPORTED_CHAINS', payload: response.chains });
      } catch (error) {
        console.error('지원 체인 로드 실패:', error);
      }
    };
    
    loadSupportedChains();
  }, []);

  const contextValue: AppContextType = {
    state,
    dispatch,
    loadUserData,
    loadWallets,
    loadTransactions,
    createPayment,
    createTransfer,
    // USDC 충전 관련 함수들
    createWireDeposit,
    createCryptoDeposit,
    getDepositAddresses,
    getDepositStatus,
    getDepositHistory,
    // 사용자 프로필 및 KYC 관련 함수들
    getUserProfile,
    updateUserProfile,
    submitKYCDocument,
    getKYCStatus,
    resubmitKYCDocument,
    // 인증 및 기타 함수들
    checkAuthStatus,
    logout,
    setAuthToken,
    showTokenExpiredModal,
    hideTokenExpiredModal,
    showOfflineModal,
    hideOfflineModal,
    requestSync,
    changeLanguage,
    isRTL,
    getRTLStyle,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// 커스텀 훅
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
} 