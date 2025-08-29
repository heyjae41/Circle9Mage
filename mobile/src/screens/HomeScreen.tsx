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
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import { safeToFixed, safeAdd } from '../utils/formatters';
import ChainWalletCard from '../components/ChainWalletCard';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { state, loadUserData, loadWallets, loadTransactions } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [currentChainIndex, setCurrentChainIndex] = useState(0); // 현재 표시할 체인 인덱스

  // 체인별 지갑 그룹화
  const groupWalletsByChain = () => {
    if (!state.wallets || state.wallets.length === 0) {
      return [];
    }

    return state.wallets.map(wallet => ({
      chainName: wallet.chainName || 'ethereum',
      balance: wallet.usdcBalance || 0,
      address: wallet.address,
      walletId: wallet.walletId,
      chainId: wallet.chainId || 1,
    }));
  };

  // 총 잔액 계산 (모든 체인 합계)
  const calculateTotalBalance = () => {
    if (!state.wallets || state.wallets.length === 0) {
      return 0;
    }
    
    return state.wallets.reduce((total, wallet) => {
      return safeAdd(total, wallet.usdcBalance || 0);
    }, 0);
  };

  const chainWallets = groupWalletsByChain();

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
          t('common.success'),
          t('common.refreshComplete', { defaultValue: '최신 지갑 잔액과 거래내역을 불러왔습니다.' }),
          [{ text: t('common.confirm') }]
        );
      }
    } catch (error) {
      console.error('새로고침 실패:', error);
      Alert.alert(t('common.error'), t('common.refreshError', { defaultValue: '데이터를 새로고침할 수 없습니다.\n네트워크 연결을 확인해주세요.' }));
    } finally {
      setRefreshing(false);
    }
  };

  // 총 잔액 계산 (멀티체인 합계)
  const totalBalance = calculateTotalBalance();

  // 지갑 주소 복사 함수
  const copyWalletAddress = async (address: string, walletName: string) => {
    try {
      await Clipboard.setStringAsync(address);
      
      // 지갑명이 undefined인 경우 기본값 사용
      const displayName = walletName || '지갑';
      
      Alert.alert(
        t('common.success'),
        t('common.addressCopied', { walletName: displayName, defaultValue: `${displayName} 주소가 클립보드에 복사되었습니다.` }),
        [{ text: t('common.confirm') }]
      );
      console.log('📋 지갑 주소 복사 완료:', { address, walletName: displayName });
    } catch (error) {
      console.error('지갑 주소 복사 실패:', error);
      Alert.alert(t('common.error'), t('common.copyError', { defaultValue: '주소 복사에 실패했습니다.' }));
    }
  };

  // 크로스체인 송금 핸들러
  const handleCrossChainSend = (fromChain: string, walletId: string) => {
    console.log(`🔄 크로스체인 송금 시작: ${fromChain} → 다른 체인`);
    
    // 사용 가능한 대상 체인 결정
    const availableTargetChains = chainWallets
      .filter(wallet => wallet.chainName !== fromChain)
      .map(wallet => wallet.chainName);
    
    if (availableTargetChains.length === 0) {
      Alert.alert(
        t('chains.noTargetChain', { defaultValue: '대상 체인 없음' }),
        t('chains.needMultipleChains', { defaultValue: '크로스체인 송금을 위해서는 최소 2개 이상의 체인 지갑이 필요합니다.' })
      );
      return;
    }

    // 송금 화면으로 이동 (파라미터와 함께)
    (navigation as any).navigate('Send', {
      sourceChain: fromChain,
      sourceWalletId: walletId,
      targetChains: availableTargetChains,
    });
  };

  // 체인 전환 함수
  const handleChainSwitch = () => {
    console.log('🔄 체인 전환 버튼 클릭됨');
    console.log('현재 체인 인덱스:', currentChainIndex);
    console.log('사용 가능한 체인들:', chainWallets.map(w => w.chainName));
    
    if (chainWallets.length > 1) {
      const currentChain = chainWallets[currentChainIndex];
      const nextIndex = (currentChainIndex + 1) % chainWallets.length;
      const nextChain = chainWallets[nextIndex];
      
      console.log(`🔄 체인 전환: ${currentChain.chainName} → ${nextChain.chainName}`);
      setCurrentChainIndex(nextIndex);
    } else {
      console.log('⚠️ 체인 전환 불가: 체인이 1개 이하');
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
            <Text style={styles.welcomeTitle}>{t('headers.circlePay')}</Text>
            <Text style={styles.welcomeSubtitle}>
              {t('screens.home.appSubtitle')}
            </Text>
          </LinearGradient>
          
          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>{t('screens.home.features.title')}</Text>
            
            <View style={styles.featureItem}>
              <Ionicons name="flash" size={24} color="#28A745" />
              <Text style={styles.featureText}>{t('screens.home.features.fastTransfer')}</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={24} color="#007AFF" />
              <Text style={styles.featureText}>{t('screens.home.features.secureUsdc')}</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Ionicons name="card" size={24} color="#FF6B35" />
              <Text style={styles.featureText}>{t('screens.home.features.qrPayment')}</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Ionicons name="person-add" size={24} color="#6F42C1" />
              <Text style={styles.featureText}>{t('screens.home.features.simpleKyc')}</Text>
            </View>
          </View>
          
          <View style={styles.authButtons}>
            <TouchableOpacity 
              style={styles.primaryAuthButton}
              onPress={() => Alert.alert('회원가입', '회원가입 화면으로 이동합니다.')}
            >
              <Text style={styles.primaryAuthButtonText}>{t('screens.home.auth.getStarted')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.secondaryAuthButton}
              onPress={() => Alert.alert('로그인', '로그인 화면으로 이동합니다.')}
            >
              <Text style={styles.secondaryAuthButtonText}>{t('screens.home.auth.alreadyHaveAccount')}</Text>
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
          {t('screens.home.welcome', { name: state.user?.firstName || t('common.user', { defaultValue: '사용자' }) })}
        </Text>
        <Text style={styles.subtitleText}>
          {t('screens.home.subtitle')}
        </Text>
      </View>

      {/* 총 잔액 카드 */}
      <LinearGradient
        colors={['#007AFF', '#0051D0']}
        style={styles.balanceCard}
      >
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>{t('screens.home.wallet.totalBalance')}</Text>
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
            <TouchableOpacity 
              onPress={() => setIsBalanceHidden(!isBalanceHidden)}
              style={styles.eyeButton}
            >
              <Ionicons 
                name={isBalanceHidden ? "eye-off-outline" : "eye-outline"} 
                size={24} 
                color="white" 
              />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.balanceAmount}>
          {isBalanceHidden ? '****' : `$${safeToFixed(totalBalance)}`}
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
          <Text style={styles.actionText}>{t('navigation.payment')}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => Alert.alert(
            '쇼핑몰 준비중 🛍️',
            'USDC 크로스체인 결제 쇼핑몰을 준비 중입니다',
            [{ text: '확인' }]
          )}
        >
          <LinearGradient
            colors={['#FD7E14', '#FF6B35']}
            style={styles.actionGradient}
          >
            <Ionicons name="storefront" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.actionText}>{t('navigation.shopping')}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => Alert.alert(
            '핫플 서비스 준비중 🔥',
            '핫플과 맛집에서 상품을 주문하고 QR로 결제할 수 있는 POS를 준비 중입니다.',
            [{ text: '확인' }]
          )}
        >
          <LinearGradient
            colors={['#6F42C1', '#8A2BE2']}
            style={styles.actionGradient}
          >
            <Ionicons name="flame" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.actionText}>{t('navigation.hotplace')}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('AIAssistant' as never)}
        >
          <LinearGradient
            colors={['#DC3545', '#C82333']}
            style={styles.actionGradient}
          >
            <Ionicons name="sparkles" size={24} color="white" />
          </LinearGradient>
          <Text style={styles.actionText}>AI</Text>
        </TouchableOpacity>
      </View>

      {/* 멀티체인 지갑 대시보드 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('screens.home.wallet.multiChain', { defaultValue: '멀티체인 지갑' })}
          </Text>
          {chainWallets.length > 1 && (
            <TouchableOpacity onPress={handleChainSwitch}>
              <Text style={styles.chainSwitchText}>
                {(() => {
                  const nextIndex = (currentChainIndex + 1) % chainWallets.length;
                  const nextChain = chainWallets[nextIndex];
                  return t('chains.switchTo', { 
                    defaultValue: '{{chain}}로 전환',
                    chain: nextChain?.chainName || '다른 체인'
                  });
                })()}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {chainWallets.length > 0 ? (
          // 현재 선택된 체인만 표시
          <ChainWalletCard
            key={`chain-wallet-${chainWallets[currentChainIndex]?.chainName}-${currentChainIndex}`}
            wallet={chainWallets[currentChainIndex]}
            isBalanceHidden={isBalanceHidden}
            onCopyAddress={copyWalletAddress}
            onCrossChainSend={handleCrossChainSend}
            onChainSwitch={handleChainSwitch}
            showChainSwitch={chainWallets.length > 1}
          />
        ) : (
          <View style={styles.emptyWalletState}>
            <Ionicons name="wallet-outline" size={48} color="#CCC" />
            <Text style={styles.emptyStateText}>
              {t('screens.home.wallet.noWallets', { defaultValue: '지갑이 없습니다' })}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {t('screens.home.wallet.createWallet', { defaultValue: '첫 번째 지갑을 생성해보세요!' })}
            </Text>
          </View>
        )}
      </View>

      {/* 최근 거래 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('navigation.history')}</Text>
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
            <Text style={styles.emptyStateText}>{t('common.noTransactions', { defaultValue: '아직 거래 내역이 없습니다' })}</Text>
            <Text style={styles.emptyStateSubtext}>{t('common.startFirstTransaction', { defaultValue: '첫 번째 결제나 송금을 시작해보세요!' })}</Text>
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
  eyeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
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
  chainSwitchText: {
    fontSize: 14,
    color: '#28A745',
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
  emptyWalletState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: 'white',
    borderRadius: 12,
    marginVertical: 8,
  },
}); 