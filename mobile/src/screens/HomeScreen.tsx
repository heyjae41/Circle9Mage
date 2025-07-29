import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../contexts/AppContext';
import { safeToFixed, safeAdd } from '../utils/formatters';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { state, loadUserData, loadWallets } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUserData();
      if (state.user) {
        await loadWallets(state.user.id);
      }
    } catch (error) {
      Alert.alert('오류', '데이터를 새로고침할 수 없습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  // 총 잔액 계산 (안전한 처리)
  const totalBalance = state.wallets.reduce((sum, wallet) => safeAdd(sum, wallet.usdcBalance), 0);

  // 최근 거래 가져오기 (최대 3개)
  const recentTransactions = state.transactions.slice(0, 3);

  // 가장 큰 잔액을 가진 지갑 (주 지갑)
  const primaryWallet = state.wallets.find(w => w.isPrimary) || state.wallets[0];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* 사용자 환영 섹션 */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>
          안녕하세요, {state.user?.firstName || '사용자'}님! 👋
        </Text>
        <Text style={styles.subtitleText}>
          글로벌 크로스체인 결제가 준비되었습니다
        </Text>
      </View>

      {/* 총 잔액 카드 */}
      <LinearGradient
        colors={['#007AFF', '#0051D0']}
        style={styles.balanceCard}
      >
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>총 잔액</Text>
          <Ionicons name="eye-outline" size={24} color="white" />
        </View>
        <Text style={styles.balanceAmount}>
          ${safeToFixed(totalBalance)}
        </Text>
        <Text style={styles.balanceCurrency}>USDC</Text>
        
        {primaryWallet && (
          <View style={styles.primaryWalletInfo}>
            <Text style={styles.primaryWalletText}>
              주 지갑: {primaryWallet.chainName}
            </Text>
            <Text style={styles.primaryWalletAddress}>
              {primaryWallet.address.slice(0, 6)}...{primaryWallet.address.slice(-4)}
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* 빠른 액션 버튼들 */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionButton}>
          <LinearGradient
            colors={['#28A745', '#20C997']}
            style={styles.actionGradient}
          >
            <Ionicons name="qr-code" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.actionText}>QR 결제</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <LinearGradient
            colors={['#FD7E14', '#FF6B35']}
            style={styles.actionGradient}
          >
            <Ionicons name="send" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.actionText}>송금</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <LinearGradient
            colors={['#6F42C1', '#8A2BE2']}
            style={styles.actionGradient}
          >
            <Ionicons name="swap-horizontal" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.actionText}>크로스체인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <LinearGradient
            colors={['#DC3545', '#C82333']}
            style={styles.actionGradient}
          >
            <Ionicons name="card" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.actionText}>충전</Text>
        </TouchableOpacity>
      </View>

      {/* 지갑 목록 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>내 지갑</Text>
                      <TouchableOpacity onPress={() => 
              Alert.alert('지갑 관리', '설정 화면으로 이동합니다.\n(네비게이션 기능이 연결됨을 확인)', 
                [{text: '확인', onPress: () => console.log('지갑 전체보기 클릭')}])
            }>
              <Text style={styles.seeAllText}>전체보기</Text>
            </TouchableOpacity>
        </View>
        
        {state.wallets.map((wallet, index) => (
          <View key={`wallet-${wallet.walletId}-${index}`} style={styles.walletItem}>
            <View style={styles.walletIcon}>
              <Ionicons 
                name="wallet" 
                size={24} 
                color="#007AFF" 
              />
            </View>
            <View style={styles.walletInfo}>
              <Text style={styles.walletName}>{wallet.chainName}</Text>
              <Text style={styles.walletAddress}>
                {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
              </Text>
            </View>
            <View style={styles.walletBalance}>
              <Text style={styles.walletBalanceAmount}>
                ${safeToFixed(wallet.usdcBalance)}
              </Text>
              <Text style={styles.walletBalanceCurrency}>USDC</Text>
            </View>
          </View>
        ))}
      </View>

      {/* 최근 거래 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>최근 거래</Text>
                      <TouchableOpacity onPress={() => 
              Alert.alert('거래 내역', '내역 화면으로 이동합니다.\n(네비게이션 기능이 연결됨을 확인)', 
                [{text: '확인', onPress: () => console.log('거래내역 전체보기 클릭')}])
            }>
              <Text style={styles.seeAllText}>전체보기</Text>
            </TouchableOpacity>
        </View>
        
        {recentTransactions.length > 0 ? (
          recentTransactions.map((transaction, index) => (
            <View key={`transaction-${transaction.transactionId}-${index}`} style={styles.transactionItem}>
              <View style={styles.transactionIcon}>
                <Ionicons 
                  name={transaction.type === 'payment' ? 'card' : 'send'} 
                  size={20} 
                  color={transaction.type === 'payment' ? '#28A745' : '#007AFF'} 
                />
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionTitle}>
                  {transaction.type === 'payment' ? '결제' : '송금'}
                  {transaction.merchantName && ` - ${transaction.merchantName}`}
                </Text>
                <Text style={styles.transactionDate}>
                  {new Date(transaction.createdAt).toLocaleDateString('ko-KR')}
                </Text>
              </View>
              <View style={styles.transactionAmount}>
                <Text style={[
                  styles.transactionAmountText,
                  { color: transaction.type === 'payment' ? '#DC3545' : '#007AFF' }
                ]}>
                  {transaction.type === 'payment' ? '-' : '+'}${safeToFixed(transaction.amount)}
                </Text>
                <View style={[
                  styles.transactionStatus,
                  { backgroundColor: transaction.status === 'completed' ? '#28A745' : '#FFC107' }
                ]}>
                  <Text style={styles.transactionStatusText}>
                    {transaction.status === 'completed' ? '완료' : '진행중'}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#CCC" />
            <Text style={styles.emptyStateText}>아직 거래 내역이 없습니다</Text>
            <Text style={styles.emptyStateSubtext}>첫 번째 결제나 송금을 시작해보세요!</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  welcomeSection: {
    padding: 20,
    paddingTop: 10,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 16,
    color: '#666',
  },
  balanceCard: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  balanceCurrency: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
  },
  primaryWalletInfo: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    paddingTop: 16,
  },
  primaryWalletText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  primaryWalletAddress: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'monospace',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  seeAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  walletIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  walletAddress: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  walletBalance: {
    alignItems: 'flex-end',
  },
  walletBalanceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  walletBalanceCurrency: {
    fontSize: 12,
    color: '#666',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#CCC',
    marginTop: 4,
  },
}); 