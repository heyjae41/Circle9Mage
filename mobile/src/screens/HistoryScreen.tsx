import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../contexts/AppContext';
import { Transaction } from '../types';
import { safeToFixed } from '../utils/formatters';

export default function HistoryScreen() {
  const { state, loadTransactions } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'payment' | 'transfer'>('all');

  // 필터링된 거래 목록
  const filteredTransactions = state.transactions.filter(transaction => {
    if (filter === 'all') return true;
    return transaction.type === filter;
  });

  // 새로고침 핸들러
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // 모든 지갑의 거래 내역 로드
      for (const wallet of state.wallets) {
        await loadTransactions(wallet.walletId);
      }
    } catch (error) {
      Alert.alert('오류', '거래 내역을 불러올 수 없습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  // 거래 상태에 따른 아이콘 및 색상
  const getTransactionIcon = (transaction: Transaction) => {
    switch (transaction.type) {
      case 'payment':
        return { name: 'card' as const, color: '#28A745' };
      case 'transfer':
        return { name: 'send' as const, color: '#007AFF' };
      case 'withdrawal':
        return { name: 'arrow-up' as const, color: '#FD7E14' };
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
        return '완료';
      case 'pending':
        return '진행중';
      case 'failed':
        return '실패';
      default:
        return '알 수 없음';
    }
  };

  // 거래 항목 렌더링
  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const icon = getTransactionIcon(item);
    const isOutgoing = item.type === 'payment' || item.type === 'transfer';

    return (
      <TouchableOpacity style={styles.transactionItem}>
        <View style={[styles.transactionIcon, { backgroundColor: `${icon.color}15` }]}>
          <Ionicons name={icon.name} size={20} color={icon.color} />
        </View>
        
        <View style={styles.transactionContent}>
          <View style={styles.transactionHeader}>
            <Text style={styles.transactionTitle}>
              {item.type === 'payment' ? '결제' : 
               item.type === 'transfer' ? '송금' : '출금'}
              {item.merchantName && ` - ${item.merchantName}`}
            </Text>
            <Text style={[
              styles.transactionAmount,
              { color: isOutgoing ? '#DC3545' : '#28A745' }
            ]}>
              {isOutgoing ? '-' : '+'}${safeToFixed(item.amount, 2)}
            </Text>
          </View>
          
          <View style={styles.transactionDetails}>
            <Text style={styles.transactionAddress}>
              {item.type === 'payment' && item.merchantName ? 
                `가맹점: ${item.merchantName}` :
                `수신자: ${item.toAddress.slice(0, 6)}...${item.toAddress.slice(-4)}`
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
              {new Date(item.createdAt).toLocaleString('ko-KR')}
            </Text>
            {item.transactionHash && (
              <TouchableOpacity style={styles.hashButton}>
                <Ionicons name="link-outline" size={12} color="#007AFF" />
                <Text style={styles.hashText}>트랜잭션 보기</Text>
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

  // 빈 상태 렌더링
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="receipt-outline" size={64} color="#CCC" />
      <Text style={styles.emptyStateTitle}>거래 내역이 없습니다</Text>
      <Text style={styles.emptyStateText}>
        {filter === 'all' ? 
          '아직 거래 내역이 없습니다.\n첫 번째 결제나 송금을 시작해보세요!' :
          `${filter === 'payment' ? '결제' : '송금'} 내역이 없습니다.`
        }
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>거래 내역</Text>
          <Text style={styles.subtitle}>
            총 {filteredTransactions.length}건의 거래
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
            전체
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, filter === 'payment' && styles.filterTabActive]}
          onPress={() => setFilter('payment')}
        >
          <Text style={[styles.filterTabText, filter === 'payment' && styles.filterTabTextActive]}>
            결제
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, filter === 'transfer' && styles.filterTabActive]}
          onPress={() => setFilter('transfer')}
        >
          <Text style={[styles.filterTabText, filter === 'transfer' && styles.filterTabTextActive]}>
            송금
          </Text>
        </TouchableOpacity>
      </View>

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
              <Text style={styles.summaryLabel}>이번 달 지출</Text>
              <Text style={styles.summaryValue}>
                ${safeToFixed(filteredTransactions
                  .filter(t => t.type === 'payment' && new Date(t.createdAt).getMonth() === new Date().getMonth())
                  .reduce((sum, t) => sum + (t.amount || 0), 0))}
              </Text>
            </View>
            
            <View style={styles.summaryDivider} />
            
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>이번 달 송금</Text>
              <Text style={styles.summaryValue}>
                ${safeToFixed(filteredTransactions
                  .filter(t => t.type === 'transfer' && new Date(t.createdAt).getMonth() === new Date().getMonth())
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