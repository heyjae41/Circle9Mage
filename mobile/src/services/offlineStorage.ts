/**
 * 오프라인 데이터 캐싱 시스템
 * - 사용자 데이터 캐싱
 * - 거래 내역 로컬 저장
 * - 지갑 정보 캐싱
 * - 데이터 동기화 관리
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Wallet, Transaction } from '../types';

export interface CachedData<T> {
  data: T;
  timestamp: number;
  version: string;
  expiresAt?: number;
}

export interface SyncStatus {
  lastSyncAt: number;
  pendingActions: PendingAction[];
  syncInProgress: boolean;
  lastSyncError?: string;
}

export interface PendingAction {
  id: string;
  type: 'payment' | 'transfer' | 'profile_update' | 'wallet_creation';
  data: any;
  timestamp: number;
  retryCount: number;
  priority: 'high' | 'medium' | 'low';
}

export class OfflineStorageService {
  private readonly VERSION = '1.0.0';
  private readonly CACHE_PREFIX = 'cache_';
  private readonly SYNC_PREFIX = 'sync_';
  private readonly PENDING_PREFIX = 'pending_';
  
  // 캐시 만료 시간 (밀리초)
  private readonly CACHE_EXPIRY = {
    user: 24 * 60 * 60 * 1000,        // 24시간
    wallets: 12 * 60 * 60 * 1000,     // 12시간
    transactions: 6 * 60 * 60 * 1000,  // 6시간
    chains: 7 * 24 * 60 * 60 * 1000,  // 7일
  };

  /**
   * 데이터 캐싱
   */
  async cacheData<T>(key: string, data: T, customExpiry?: number): Promise<void> {
    try {
      const cachedData: CachedData<T> = {
        data,
        timestamp: Date.now(),
        version: this.VERSION,
        expiresAt: customExpiry ? Date.now() + customExpiry : undefined
      };

      await AsyncStorage.setItem(
        `${this.CACHE_PREFIX}${key}`,
        JSON.stringify(cachedData)
      );

      console.log(`💾 데이터 캐싱 완료: ${key}`);
    } catch (error) {
      console.error(`데이터 캐싱 실패 (${key}):`, error);
      throw error;
    }
  }

  /**
   * 캐시된 데이터 조회
   */
  async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`${this.CACHE_PREFIX}${key}`);
      
      if (!cached) {
        return null;
      }

      const cachedData: CachedData<T> = JSON.parse(cached);
      
      // 버전 확인
      if (cachedData.version !== this.VERSION) {
        console.log(`🔄 캐시 버전 불일치, 삭제: ${key}`);
        await this.removeCachedData(key);
        return null;
      }

      // 만료 시간 확인
      if (cachedData.expiresAt && Date.now() > cachedData.expiresAt) {
        console.log(`⏰ 캐시 만료, 삭제: ${key}`);
        await this.removeCachedData(key);
        return null;
      }

      // 기본 만료 시간 확인
      const defaultExpiry = this.getDefaultExpiry(key);
      if (defaultExpiry && (Date.now() - cachedData.timestamp) > defaultExpiry) {
        console.log(`⏰ 기본 캐시 만료, 삭제: ${key}`);
        await this.removeCachedData(key);
        return null;
      }

      console.log(`📖 캐시 데이터 조회: ${key}`);
      return cachedData.data;
    } catch (error) {
      console.error(`캐시 데이터 조회 실패 (${key}):`, error);
      return null;
    }
  }

  /**
   * 캐시된 데이터 삭제
   */
  async removeCachedData(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${this.CACHE_PREFIX}${key}`);
      console.log(`🗑️ 캐시 삭제: ${key}`);
    } catch (error) {
      console.error(`캐시 삭제 실패 (${key}):`, error);
    }
  }

  /**
   * 기본 만료 시간 조회
   */
  private getDefaultExpiry(key: string): number | null {
    if (key.startsWith('user')) return this.CACHE_EXPIRY.user;
    if (key.startsWith('wallets')) return this.CACHE_EXPIRY.wallets;
    if (key.startsWith('transactions')) return this.CACHE_EXPIRY.transactions;
    if (key.startsWith('chains')) return this.CACHE_EXPIRY.chains;
    return null;
  }

  /**
   * 사용자 데이터 캐싱
   */
  async cacheUserData(userId: string, userData: User): Promise<void> {
    await this.cacheData(`user_${userId}`, userData);
  }

  /**
   * 캐시된 사용자 데이터 조회
   */
  async getCachedUserData(userId: string): Promise<User | null> {
    return this.getCachedData<User>(`user_${userId}`);
  }

  /**
   * 지갑 데이터 캐싱
   */
  async cacheWallets(userId: string, wallets: Wallet[]): Promise<void> {
    await this.cacheData(`wallets_${userId}`, wallets);
  }

  /**
   * 캐시된 지갑 데이터 조회
   */
  async getCachedWallets(userId: string): Promise<Wallet[] | null> {
    return this.getCachedData<Wallet[]>(`wallets_${userId}`);
  }

  /**
   * 거래 내역 캐싱
   */
  async cacheTransactions(userId: string, transactions: Transaction[]): Promise<void> {
    // 최근 100개 거래만 캐싱 (용량 절약)
    const recentTransactions = transactions
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 100);
    
    await this.cacheData(`transactions_${userId}`, recentTransactions);
  }

  /**
   * 캐시된 거래 내역 조회
   */
  async getCachedTransactions(userId: string): Promise<Transaction[] | null> {
    return this.getCachedData<Transaction[]>(`transactions_${userId}`);
  }

  /**
   * 지원 체인 정보 캐싱
   */
  async cacheSupportedChains(chains: any[]): Promise<void> {
    await this.cacheData('chains_supported', chains);
  }

  /**
   * 캐시된 지원 체인 정보 조회
   */
  async getCachedSupportedChains(): Promise<any[] | null> {
    return this.getCachedData<any[]>('chains_supported');
  }

  /**
   * 대기 중인 작업 추가
   */
  async addPendingAction(action: Omit<PendingAction, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    try {
      const actionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const pendingAction: PendingAction = {
        ...action,
        id: actionId,
        timestamp: Date.now(),
        retryCount: 0
      };

      const existingActions = await this.getPendingActions();
      const updatedActions = [...existingActions, pendingAction];

      await AsyncStorage.setItem(
        `${this.PENDING_PREFIX}actions`,
        JSON.stringify(updatedActions)
      );

      console.log(`📝 대기 작업 추가: ${action.type} (${actionId})`);
      return actionId;
    } catch (error) {
      console.error('대기 작업 추가 실패:', error);
      throw error;
    }
  }

  /**
   * 대기 중인 작업 조회
   */
  async getPendingActions(): Promise<PendingAction[]> {
    try {
      const stored = await AsyncStorage.getItem(`${this.PENDING_PREFIX}actions`);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('대기 작업 조회 실패:', error);
      return [];
    }
  }

  /**
   * 대기 작업 완료 처리
   */
  async completePendingAction(actionId: string): Promise<void> {
    try {
      const actions = await this.getPendingActions();
      const updatedActions = actions.filter(action => action.id !== actionId);

      await AsyncStorage.setItem(
        `${this.PENDING_PREFIX}actions`,
        JSON.stringify(updatedActions)
      );

      console.log(`✅ 대기 작업 완료: ${actionId}`);
    } catch (error) {
      console.error('대기 작업 완료 처리 실패:', error);
    }
  }

  /**
   * 대기 작업 재시도 횟수 증가
   */
  async incrementRetryCount(actionId: string): Promise<void> {
    try {
      const actions = await this.getPendingActions();
      const updatedActions = actions.map(action => 
        action.id === actionId 
          ? { ...action, retryCount: action.retryCount + 1 }
          : action
      );

      await AsyncStorage.setItem(
        `${this.PENDING_PREFIX}actions`,
        JSON.stringify(updatedActions)
      );
    } catch (error) {
      console.error('재시도 횟수 증가 실패:', error);
    }
  }

  /**
   * 동기화 상태 저장
   */
  async saveSyncStatus(status: SyncStatus): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${this.SYNC_PREFIX}status`,
        JSON.stringify(status)
      );
    } catch (error) {
      console.error('동기화 상태 저장 실패:', error);
    }
  }

  /**
   * 동기화 상태 조회
   */
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const stored = await AsyncStorage.getItem(`${this.SYNC_PREFIX}status`);
      
      if (stored) {
        return JSON.parse(stored);
      }

      // 기본 동기화 상태
      return {
        lastSyncAt: 0,
        pendingActions: [],
        syncInProgress: false
      };
    } catch (error) {
      console.error('동기화 상태 조회 실패:', error);
      return {
        lastSyncAt: 0,
        pendingActions: [],
        syncInProgress: false
      };
    }
  }

  /**
   * 캐시 크기 조회
   */
  async getCacheSize(): Promise<{
    totalItems: number;
    estimatedSizeKB: number;
    itemsByType: Record<string, number>;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      const itemsByType: Record<string, number> = {};
      let estimatedSizeKB = 0;

      for (const key of cacheKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          const sizeKB = new Blob([value]).size / 1024;
          estimatedSizeKB += sizeKB;

          const type = key.replace(this.CACHE_PREFIX, '').split('_')[0];
          itemsByType[type] = (itemsByType[type] || 0) + 1;
        }
      }

      return {
        totalItems: cacheKeys.length,
        estimatedSizeKB: Math.round(estimatedSizeKB * 100) / 100,
        itemsByType
      };
    } catch (error) {
      console.error('캐시 크기 조회 실패:', error);
      return {
        totalItems: 0,
        estimatedSizeKB: 0,
        itemsByType: {}
      };
    }
  }

  /**
   * 만료된 캐시 정리
   */
  async cleanupExpiredCache(): Promise<number> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      let cleanedCount = 0;

      for (const key of cacheKeys) {
        const shortKey = key.replace(this.CACHE_PREFIX, '');
        const data = await this.getCachedData(shortKey);
        
        if (data === null) {
          cleanedCount++;
        }
      }

      console.log(`🧹 만료된 캐시 정리 완료: ${cleanedCount}개 항목`);
      return cleanedCount;
    } catch (error) {
      console.error('캐시 정리 실패:', error);
      return 0;
    }
  }

  /**
   * 모든 캐시 삭제
   */
  async clearAllCache(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`🗑️ 모든 캐시 삭제 완료: ${cacheKeys.length}개 항목`);
    } catch (error) {
      console.error('캐시 전체 삭제 실패:', error);
    }
  }

  /**
   * 모든 대기 작업 삭제
   */
  async clearAllPendingActions(): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${this.PENDING_PREFIX}actions`);
      console.log('🗑️ 모든 대기 작업 삭제 완료');
    } catch (error) {
      console.error('대기 작업 전체 삭제 실패:', error);
    }
  }
}

// 전역 오프라인 저장소 서비스 인스턴스
export const offlineStorage = new OfflineStorageService();