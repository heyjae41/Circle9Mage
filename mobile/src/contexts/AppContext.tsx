import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, User, Wallet, Transaction, SupportedChain } from '../types';
import { apiService } from '../services/apiService';

// 액션 타입 정의
type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_WALLETS'; payload: Wallet[] }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'SET_SUPPORTED_CHAINS'; payload: SupportedChain[] }
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_WALLET_BALANCE'; payload: { walletId: string; balance: number } };

// 초기 상태
const initialState: AppState = {
  user: null,
  wallets: [],
  transactions: [],
  supportedChains: [],
  isLoading: false,
  error: null,
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
}

// 컨텍스트 생성
const AppContext = createContext<AppContextType | undefined>(undefined);

// 프로바이더 컴포넌트
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // 사용자 데이터 로드
  const loadUserData = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Mock 사용자 데이터 (실제로는 API에서 가져옴)
      const mockUser: User = {
        id: 'user_123',
        email: 'user@example.com',
        firstName: '홍',
        lastName: '길동',
        countryCode: 'KR',
        preferredCurrency: 'USDC',
        isVerified: true,
        kycStatus: 'approved',
      };
      
      dispatch({ type: 'SET_USER', payload: mockUser });
      await loadWallets(mockUser.id);
      
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '사용자 데이터 로드 실패' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 지갑 데이터 로드
  const loadWallets = async (userId: string) => {
    try {
      const response = await apiService.getUserWallets(userId);
      dispatch({ type: 'SET_WALLETS', payload: response.wallets });
    } catch (error) {
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

  // 앱 시작 시 초기 데이터 로드
  useEffect(() => {
    loadUserData();
    
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