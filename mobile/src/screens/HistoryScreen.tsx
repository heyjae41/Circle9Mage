import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import { Transaction } from '../types';
import { safeToFixed } from '../utils/formatters';
import apiService from '../services/apiService';

export default function HistoryScreen() {
  const { t } = useTranslation();
  const { state, loadTransactions, dispatch } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'payment' | 'transfer' | 'deposit' | 'received'>('all');
  const [syncStatus, setSyncStatus] = useState<{
    isSyncing: boolean;
    lastSyncTime: string | null;
    syncMessage: string | null;
  }>({
    isSyncing: false,
    lastSyncTime: null,
    syncMessage: null,
  });

  // 필터링된 거래 목록
  const filteredTransactions = state.transactions.filter(transaction => {
    if (filter === 'all') return true;
    if (filter === 'transfer') {
      // 송금 필터는 'sent'와 'transfer' 모두 포함
      return transaction.type === 'sent' || transaction.type === 'transfer';
    }
    if (filter === 'deposit') {
      // 입금 필터는 'received'와 'deposit' 모두 포함
      return transaction.type === 'received' || transaction.type === 'deposit';
    }
    return transaction.type === filter;
  });

  // 새로고침 핸들러 (동기화 포함)
  const onRefresh = async () => {
    setRefreshing(true);
    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    
    try {
      console.log('🔄 거래 내역 새로고침 시작');
      
      // 모든 지갑의 거래 내역을 누적하여 로드 (백엔드에서 자동 동기화)
      let allTransactions: Transaction[] = [];
      
      for (const wallet of state.wallets) {
        console.log(`📱 지갑 ${wallet.walletId} 거래 내역 로드 중...`);
        try {
          const response = await apiService.getWalletTransactions(wallet.walletId);
          if (response.transactions && response.transactions.length > 0) {
            console.log(`📊 지갑 ${wallet.walletId}: ${response.transactions.length}건의 거래 발견`);
            allTransactions = [...allTransactions, ...response.transactions];
          }
        } catch (error) {
          console.error(`❌ 지갑 ${wallet.walletId} 거래 내역 로드 실패:`, error);
        }
      }
      
      // 모든 거래를 한 번에 상태에 설정
      if (allTransactions.length > 0) {
        console.log(`✅ 총 ${allTransactions.length}건의 거래 내역 로드 완료`);
        dispatch({ type: 'SET_TRANSACTIONS', payload: allTransactions });
      } else {
        console.log('📭 모든 지갑에서 거래 내역을 찾을 수 없습니다');
        dispatch({ type: 'SET_TRANSACTIONS', payload: [] });
      }
      
      // 동기화 완료 상태 업데이트
      setSyncStatus({
        isSyncing: false,
        lastSyncTime: new Date().toISOString(),
        syncMessage: '거래 내역이 최신 상태로 업데이트되었습니다',
      });
      
      console.log('✅ 거래 내역 새로고침 완료');
      
    } catch (error) {
      console.error('❌ 거래 내역 새로고침 실패:', error);
      Alert.alert('오류', '거래 내역을 불러올 수 없습니다.');
      
      setSyncStatus({
        isSyncing: false,
        lastSyncTime: null,
        syncMessage: t('common.refreshError'),
      });
    } finally {
      setRefreshing(false);
    }
  };

  // 동기화 상태 메시지 표시
  const renderSyncStatus = () => {
    if (syncStatus.isSyncing) {
      return (
        <View style={styles.syncStatusContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.syncStatusText}>{t('common.syncingTransactions', { defaultValue: '거래 내역 동기화 중...' })}</Text>
        </View>
      );
    }
    
    if (syncStatus.syncMessage) {
      return (
        <View style={styles.syncStatusContainer}>
          <Ionicons 
            name={syncStatus.syncMessage.includes('오류') ? 'warning' : 'checkmark-circle'} 
            size={16} 
            color={syncStatus.syncMessage.includes('오류') ? '#FF6B35' : '#28A745'} 
          />
          <Text style={[
            styles.syncStatusText,
            { color: syncStatus.syncMessage.includes('오류') ? '#FF6B35' : '#28A745' }
          ]}>
            {syncStatus.syncMessage}
          </Text>
        </View>
      );
    }
    
    return null;
  };

  // 거래 상태에 따른 아이콘 및 색상
  const getTransactionIcon = (transaction: Transaction) => {
    switch (transaction.type) {
      case 'payment':
        return { name: 'card' as const, color: '#28A745' };
      case 'sent':
        return { name: 'send' as const, color: '#DC3545' };
      case 'received':
        return { name: 'arrow-down' as const, color: '#28A745' };
      case 'transfer':
        return { name: 'send' as const, color: '#007AFF' };
      case 'withdrawal':
        return { name: 'arrow-up' as const, color: '#FD7E14' };
      case 'deposit':
        return { name: 'arrow-down' as const, color: '#28A745' };
      default:
        return { name: 'swap-horizontal' as const, color: '#6F42C1' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#28A745';
      case 'pending':
        return '#FFC107';
      case 'failed':
        return '#DC3545';
      default:
        return '#6C757D';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return t('transactions.status.completed');
      case 'pending':
        return t('transactions.status.pending');
      case 'failed':
        return t('transactions.status.failed');
      case 'cancelled':
        return t('transactions.status.cancelled');
      default:
        return t('common.unknown', { defaultValue: '알 수 없음' });
    }
  };

  // 거래 타입별 다국어 표시
  const getTransactionTypeText = (type: string) => {
    switch (type) {
      case 'payment':
        return t('transactions.types.payment');
      case 'sent':
        return t('transactions.types.send');
      case 'received':
        return t('transactions.types.receive');
      case 'transfer':
        return t('transactions.types.send');
      case 'withdrawal':
        return t('transactions.types.withdrawal');
      case 'deposit':
        return t('transactions.types.deposit');
      default:
        return t('common.transaction', { defaultValue: '거래' });
    }
  };

  // 거래 항목 렌더링
  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const icon = getTransactionIcon(item);
    const isOutgoing = item.type === 'payment' || item.type === 'transfer' || item.type === 'sent';
    const isIncoming = item.type === 'deposit' || item.type === 'received';

    return (
      <TouchableOpacity style={styles.transactionItem}>
        <View style={[styles.transactionIcon, { backgroundColor: `${icon.color}15` }]}>
          <Ionicons name={icon.name} size={20} color={icon.color} />
        </View>
        
        <View style={styles.transactionContent}>
          <View style={styles.transactionHeader}>
            <Text style={styles.transactionTitle}>
              {getTransactionTypeText(item.type)}
              {item.merchantName && ` - ${item.merchantName}`}
            </Text>
            <Text style={[
              styles.transactionAmount,
              { color: isOutgoing ? '#DC3545' : isIncoming ? '#28A745' : '#007AFF' }
            ]}>
              {isOutgoing ? '-' : isIncoming ? '+' : ''}${safeToFixed(item.amount, 2)}
            </Text>
          </View>
          
          <View style={styles.transactionDetails}>
            <Text style={styles.transactionAddress}>
              {item.type === 'payment' && item.merchantName ? 
                `가맹점: ${item.merchantName}` :
                item.type === 'deposit' ?
                `입금 주소: ${item.toAddress ? item.toAddress.slice(0, 6) + '...' + item.toAddress.slice(-4) : 'N/A'}` :
                `수신자: ${item.toAddress ? item.toAddress.slice(0, 6) + '...' + item.toAddress.slice(-4) : 'N/A'}`
              }
            </Text>
            <View style={[
              styles.transactionStatus,
              { backgroundColor: getStatusColor(item.status) }
            ]}>
              <Text style={styles.transactionStatusText}>
                {getStatusText(item.status)}
              </Text>
            </View>
          </View>
          
          <View style={styles.transactionFooter}>
            <Text style={styles.transactionDate}>
              {item.createdAt ? new Date(item.createdAt).toLocaleString(state.currentLanguage || 'ko-KR') : t('common.noDateInfo', { defaultValue: '날짜 정보 없음' })}
            </Text>
            {item.transactionHash && (
              <TouchableOpacity style={styles.hashButton}>
                <Ionicons name="link-outline" size={12} color="#007AFF" />
                <Text style={styles.hashText}>{t('common.viewTransaction', { defaultValue: '트랜잭션 보기' })}</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {item.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesText}>{item.notes}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // 빈 상태 렌더링 (개선된 메시지)
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="receipt-outline" size={64} color="#CCC" />
              <Text style={styles.emptyStateTitle}>{t('common.noTransactionHistory')}</Text>
      <Text style={styles.emptyStateText}>
        {filter === 'all' ? 
                  t('common.emptyStateMessages.noHistory') :
        filter === 'payment' ? t('common.emptyStateMessages.noPayment') :
        filter === 'transfer' ? t('common.emptyStateMessages.noTransfer') :
        filter === 'deposit' ? t('common.emptyStateMessages.noDeposit') :
        t('common.emptyStateMessages.noTransactions')
        }
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
        <Ionicons name="refresh" size={16} color="#007AFF" />
                      <Text style={styles.refreshButtonText}>{t('common.refresh')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('headers.transactionHistory')}</Text>
          <Text style={styles.subtitle}>
            {t('common.totalTransactions', { count: filteredTransactions.length })}
          </Text>
        </View>
        
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search-outline" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* 필터 탭 */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
            {t('common.filterTabs.all')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, filter === 'payment' && styles.filterTabActive]}
          onPress={() => setFilter('payment')}
        >
          <Text style={[styles.filterTabText, filter === 'payment' && styles.filterTabTextActive]}>
            {t('common.filterTabs.payment')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, filter === 'transfer' && styles.filterTabActive]}
          onPress={() => setFilter('transfer')}
        >
          <Text style={[styles.filterTabText, filter === 'transfer' && styles.filterTabTextActive]}>
            {t('common.filterTabs.transfer')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, filter === 'deposit' && styles.filterTabActive]}
          onPress={() => setFilter('deposit')}
        >
          <Text style={[styles.filterTabText, filter === 'deposit' && styles.filterTabTextActive]}>
            {t('common.filterTabs.deposit')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 동기화 상태 메시지 */}
      {renderSyncStatus()}

      {/* 거래 목록 */}
      <FlatList
        data={filteredTransactions}
        renderItem={renderTransactionItem}
        keyExtractor={(item) => item.transactionId}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
      
      {/* 통계 요약 (하단 고정) */}
      {filteredTransactions.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('common.thisMonthSpending')}</Text>
              <Text style={styles.summaryValue}>
                ${safeToFixed(filteredTransactions
                  .filter(t => t.type === 'payment' && new Date(t.createdAt).getMonth() === new Date().getMonth())
                  .reduce((sum, t) => sum + (t.amount || 0), 0))}
              </Text>
            </View>
            
            <View style={styles.summaryDivider} />
            
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('common.thisMonthSent')}</Text>
              <Text style={styles.summaryValue}>
                ${safeToFixed(filteredTransactions
                  .filter(t => (t.type === 'transfer' || t.type === 'sent') && new Date(t.createdAt).getMonth() === new Date().getMonth())
                  .reduce((sum, t) => sum + (t.amount || 0), 0))}
              </Text>
            </View>
            
            <View style={styles.summaryDivider} />
            
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('common.thisMonthReceived')}</Text>
              <Text style={styles.summaryValue}>
                ${safeToFixed(filteredTransactions
                  .filter(t => (t.type === 'deposit' || t.type === 'received') && new Date(t.createdAt).getMonth() === new Date().getMonth())
                  .reduce((sum, t) => sum + (t.amount || 0), 0))}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterTabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#E9ECEF',
    borderRadius: 12,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: 'white',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  filterTabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionContent: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionAddress: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  transactionStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  transactionStatusText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
  },
  hashButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hashText: {
    fontSize: 12,
    color: '#007AFF',
  },
  notesContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  notesText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#CCC',
    textAlign: 'center',
    lineHeight: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#E0F2FE',
    borderRadius: 10,
  },
  refreshButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  syncStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  syncStatusText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  summaryCard: {
    backgroundColor: 'white',
    margin: 20,
    padding: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E1E5E9',
    marginHorizontal: 16,
  },
}); 