import React, { useState, useEffect, useCallback } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '../contexts/AppContext';
import { safeToFixed, safeAdd } from '../utils/formatters';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { state, loadUserData, loadWallets, loadTransactions } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadInitialData();
  }, []);

  // 화면 포커스 시 자동 새로고침 (이더스캔 잔액 반영을 위해)
  useFocusEffect(
    useCallback(() => {
      console.log('🔍 HomeScreen 포커스됨 - 자동 잔액 새로고침 시작');
      if (state.isAuthenticated && state.user) {
        loadWallets(state.user.id).then(() => {
          setLastUpdated(new Date());
          console.log('✅ 자동 잔액 새로고침 완료');
        }).catch((error) => {
          console.error('❌ 자동 잔액 새로고침 실패:', error);
        });
      }
    }, [state.isAuthenticated, state.user])
  );

  const loadInitialData = async () => {
    try {
      if (state.isAuthenticated && state.user) {
        await loadUserData();
        await loadWallets(state.user.id);
        
        // 모든 지갑의 거래 내역 로드
        if (state.wallets.length > 0) {
          for (const wallet of state.wallets) {
            await loadTransactions(wallet.walletId);
          }
        }
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('초기 데이터 로드 실패:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 수동 새로고침 시작...');
      await loadUserData();
      if (state.user) {
        console.log('💰 지갑 잔액 새로고침 중...');
        await loadWallets(state.user.id);
        
        // 지갑별 거래 내역도 새로고침
        if (state.wallets.length > 0) {
          console.log('📊 거래 내역 새로고침 중...');
          for (const wallet of state.wallets) {
            await loadTransactions(wallet.walletId);
          }
        }
        
        setLastUpdated(new Date());
        Alert.alert(
          '새로고침 완료! ✅', 
          '최신 지갑 잔액과 거래내역을 불러왔습니다.',
          [{ text: '확인' }]
        );
      }
    } catch (error) {
      console.error('새로고침 실패:', error);
      Alert.alert('오류', '데이터를 새로고침할 수 없습니다.\n네트워크 연결을 확인해주세요.');
    } finally {
      setRefreshing(false);
    }
  };

  // 총 잔액 계산 (안전한 처리)
  const totalBalance = state.wallets.reduce((sum, wallet) => safeAdd(sum, wallet.usdcBalance), 0);

  // 지갑 주소 복사 함수
  const copyWalletAddress = async (address: string, walletName: string) => {
    try {
      await Clipboard.setStringAsync(address);
      
      // 지갑명이 undefined인 경우 기본값 사용
      const displayName = walletName || '지갑';
      
      Alert.alert(
        '복사 완료!',
        `${displayName} 주소가 클립보드에 복사되었습니다.`,
        [{ text: '확인' }]
      );
      console.log('📋 지갑 주소 복사 완료:', { address, walletName: displayName });
    } catch (error) {
      console.error('지갑 주소 복사 실패:', error);
      Alert.alert('오류', '주소 복사에 실패했습니다.');
    }
  };

  // 최근 거래 가져오기 (최대 3개)
  const recentTransactions = state.transactions.slice(0, 3);

  // 가장 큰 잔액을 가진 지갑 (주 지갑)
  const primaryWallet = state.wallets.find(w => w.isPrimary) || state.wallets[0];

  // 인증되지 않은 사용자 안내 화면
  if (!state.isAuthenticated) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.unauthenticatedContainer}>
          <LinearGradient
            colors={['#007AFF', '#0051D0']}
            style={styles.welcomeGradient}
          >
            <Ionicons name="globe" size={64} color="white" />
            <Text style={styles.welcomeTitle}>CirclePay Global</Text>
            <Text style={styles.welcomeSubtitle}>
              글로벌 크로스체인 USDC 결제 플랫폼
            </Text>
          </LinearGradient>
          
          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>주요 기능</Text>
            
            <View style={styles.featureItem}>
              <Ionicons name="flash" size={24} color="#28A745" />
              <Text style={styles.featureText}>빠른 크로스체인 송금</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={24} color="#007AFF" />
              <Text style={styles.featureText}>안전한 USDC 거래</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Ionicons name="card" size={24} color="#FF6B35" />
              <Text style={styles.featureText}>QR 코드 결제</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Ionicons name="person-add" size={24} color="#6F42C1" />
              <Text style={styles.featureText}>간편 KYC 인증</Text>
            </View>
          </View>
          
          <View style={styles.authButtons}>
            <TouchableOpacity 
              style={styles.primaryAuthButton}
              onPress={() => Alert.alert('회원가입', '회원가입 화면으로 이동합니다.')}
            >
              <Text style={styles.primaryAuthButtonText}>시작하기</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.secondaryAuthButton}
              onPress={() => Alert.alert('로그인', '로그인 화면으로 이동합니다.')}
            >
              <Text style={styles.secondaryAuthButtonText}>이미 계정이 있으신가요?</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

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
          <View style={styles.balanceActions}>
            <TouchableOpacity 
              onPress={onRefresh}
              style={styles.refreshButton}
              disabled={refreshing}
            >
              <Ionicons 
                name={refreshing ? "hourglass-outline" : "refresh-outline"} 
                size={20} 
                color="white" 
              />
            </TouchableOpacity>
            <Ionicons name="eye-outline" size={24} color="white" />
          </View>
        </View>
        <Text style={styles.balanceAmount}>
          ${safeToFixed(totalBalance)}
        </Text>
        <Text style={styles.balanceCurrency}>USDC</Text>
        
        {lastUpdated && (
          <Text style={styles.lastUpdatedText}>
            마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        )}
        
        {primaryWallet && (
          <View style={styles.primaryWalletInfo}>
            <Text style={styles.primaryWalletText}>
              주 지갑: {primaryWallet.chainName}
            </Text>
            <TouchableOpacity 
              onPress={() => copyWalletAddress(primaryWallet.address, primaryWallet.chainName)}
              style={styles.addressContainer}
            >
              <Text style={styles.primaryWalletAddress}>
                {primaryWallet.address.slice(0, 6)}...{primaryWallet.address.slice(-4)}
              </Text>
              <Ionicons name="copy-outline" size={16} color="rgba(255,255,255,0.8)" style={styles.copyIcon} />
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      {/* 빠른 액션 버튼들 */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Payment' as never)}
        >
          <LinearGradient
            colors={['#28A745', '#20C997']}
            style={styles.actionGradient}
          >
            <Ionicons name="qr-code" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.actionText}>QR 결제</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Send' as never)}
        >
          <LinearGradient
            colors={['#FD7E14', '#FF6B35']}
            style={styles.actionGradient}
          >
            <Ionicons name="send" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.actionText}>송금</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Send' as never)}
        >
          <LinearGradient
            colors={['#6F42C1', '#8A2BE2']}
            style={styles.actionGradient}
          >
            <Ionicons name="swap-horizontal" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.actionText}>크로스체인</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Deposit' as never)}
        >
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
              <TouchableOpacity 
                onPress={() => copyWalletAddress(wallet.address, wallet.chainName)}
                style={styles.walletAddressContainer}
              >
                <Text style={styles.walletAddress}>
                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                </Text>
                <Ionicons name="copy-outline" size={14} color="#666" style={styles.copyIconSmall} />
              </TouchableOpacity>
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
                      <TouchableOpacity onPress={() => navigation.navigate('History' as never)}>
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
  // 인증되지 않은 사용자 스타일
  unauthenticatedContainer: {
    flex: 1,
    padding: 20,
  },
  welcomeGradient: {
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 30,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  featuresContainer: {
    marginBottom: 30,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  featureText: {
    fontSize: 16,
    color: '#1A1A1A',
    marginLeft: 12,
    fontWeight: '500',
  },
  authButtons: {
    gap: 12,
  },
  primaryAuthButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryAuthButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryAuthButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  secondaryAuthButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
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
  balanceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 8,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 16,
    textAlign: 'center',
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
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  primaryWalletAddress: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'monospace',
    flex: 1,
  },
  copyIcon: {
    marginLeft: 6,
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
  walletAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  walletAddress: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    flex: 1,
  },
  copyIconSmall: {
    marginLeft: 4,
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