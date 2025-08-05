import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../contexts/AppContext';
import { safeToFixed, safeAdd } from '../utils/formatters';

export default function DepositScreen() {
  const { 
    state, 
    createWireDeposit, 
    createCryptoDeposit, 
    getDepositAddresses,
    getDepositHistory 
  } = useApp();
  
  const [selectedMethod, setSelectedMethod] = useState<'wire' | 'crypto' | null>(null);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [depositAddresses, setDepositAddresses] = useState<any[]>([]);
  const [depositHistory, setDepositHistory] = useState<any[]>([]);
  
  // 은행 송금 데이터
  const [wireData, setWireData] = useState({
    amount: '',
    currency: 'USD',
    bank_account: {
      account_holder_name: '',
      bank_name: '',
      account_number: '',
      routing_number: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
    },
  });
  
  // 암호화폐 충전 데이터
  const [cryptoData, setCryptoData] = useState({
    amount: '',
    currency: 'USD',
    chain: 'ETH',
  });
  
  const [selectedWallet, setSelectedWallet] = useState<string>('');

  // 총 잔액 계산
  const totalBalance = state.wallets.reduce((sum, wallet) => safeAdd(sum, wallet.usdcBalance), 0);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // 첫 번째 지갑 선택
      if (state.wallets.length > 0) {
        setSelectedWallet(state.wallets[0].walletId);
        
        // 충전 주소 목록 로드
        const addresses = await getDepositAddresses(state.wallets[0].walletId);
        setDepositAddresses(addresses.deposit_addresses || []);
      }
      
      // 충전 내역 로드
      const history = await getDepositHistory({ limit: 10 });
      setDepositHistory(history.deposits || []);
    } catch (error) {
      console.error('초기 데이터 로드 실패:', error);
    }
  };

  // 충전 방법 선택
  const handleMethodSelect = (method: 'wire' | 'crypto') => {
    setSelectedMethod(method);
    setShowDepositForm(true);
  };

  // 은행 송금 충전 처리
  const handleWireDeposit = async () => {
    if (!wireData.amount || !wireData.bank_account.account_holder_name || 
        !wireData.bank_account.bank_name || !wireData.bank_account.account_number ||
        !wireData.bank_account.routing_number) {
      Alert.alert('오류', '모든 필수 항목을 입력해주세요.');
      return;
    }

    if (parseFloat(wireData.amount) <= 0) {
      Alert.alert('오류', '유효한 금액을 입력해주세요.');
      return;
    }

    if (!selectedWallet) {
      Alert.alert('오류', '충전할 지갑을 선택해주세요.');
      return;
    }

    try {
      setIsProcessing(true);
      
      const result = await createWireDeposit(selectedWallet, wireData);
      
      Alert.alert(
        '충전 요청 완료!',
        `은행 송금 충전 요청이 완료되었습니다.\n\n금액: $${wireData.amount}\n예상 완료: ${result.estimated_completion}\n\n추적 번호: ${result.tracking_ref}`,
        [
          {
            text: '송금 지침 보기',
            onPress: () => showWireInstructions(result.wire_instructions)
          },
          {
            text: '확인',
            onPress: () => {
              setShowDepositForm(false);
              resetWireData();
              loadInitialData(); // 새로고침
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('충전 실패', '충전 요청 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 암호화폐 충전 처리
  const handleCryptoDeposit = async () => {
    if (!cryptoData.amount || !cryptoData.chain) {
      Alert.alert('오류', '금액과 체인을 선택해주세요.');
      return;
    }

    if (parseFloat(cryptoData.amount) <= 0) {
      Alert.alert('오류', '유효한 금액을 입력해주세요.');
      return;
    }

    if (!selectedWallet) {
      Alert.alert('오류', '충전할 지갑을 선택해주세요.');
      return;
    }

    try {
      setIsProcessing(true);
      
      const result = await createCryptoDeposit(selectedWallet, cryptoData);
      
      Alert.alert(
        '충전 주소 생성 완료!',
        `${cryptoData.chain} 네트워크에서 아래 주소로 ${cryptoData.amount} ${cryptoData.currency}를 송금해주세요.\n\n주소: ${result.deposit_address}\n\n예상 완료: ${result.estimated_completion}`,
        [
          {
            text: '주소 복사',
            onPress: () => {
              // 클립보드 복사 기능 (expo-clipboard 필요)
              console.log('주소 복사:', result.deposit_address);
            }
          },
          {
            text: '확인',
            onPress: () => {
              setShowDepositForm(false);
              resetCryptoData();
              loadInitialData(); // 새로고침
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('충전 실패', '충전 주소 생성 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 송금 지침 표시
  const showWireInstructions = (instructions: any) => {
    const instructionText = `
은행 송금 지침:

수취인: ${instructions.beneficiary.name}
수취인 주소: ${instructions.beneficiary.address1}

수취 은행: ${instructions.beneficiaryBank.name}
은행 주소: ${instructions.beneficiaryBank.address}
SWIFT 코드: ${instructions.beneficiaryBank.swiftCode}
계좌번호: ${instructions.beneficiaryBank.accountNumber}
라우팅 번호: ${instructions.beneficiaryBank.routingNumber}

추적 번호: ${instructions.trackingRef}
    `;
    
    Alert.alert('은행 송금 지침', instructionText.trim());
  };

  // 데이터 초기화 함수들
  const resetWireData = () => {
    setWireData({
      amount: '',
      currency: 'USD',
      bank_account: {
        account_holder_name: '',
        bank_name: '',
        account_number: '',
        routing_number: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
      },
    });
  };

  const resetCryptoData = () => {
    setCryptoData({
      amount: '',
      currency: 'USD',
      chain: 'ETH',
    });
  };

  // 충전 방법 선택 화면
  const renderMethodSelection = () => (
    <View style={styles.methodContainer}>
      <Text style={styles.methodTitle}>충전 방법을 선택하세요</Text>
      
      <TouchableOpacity
        style={styles.methodCard}
        onPress={() => handleMethodSelect('wire')}
      >
        <LinearGradient
          colors={['#4338ca', '#6366f1']}
          style={styles.methodGradient}
        >
          <Ionicons name="card" size={40} color="white" />
          <Text style={styles.methodName}>은행 송금</Text>
          <Text style={styles.methodDesc}>
            은행 계좌에서 직접 USDC 충전
          </Text>
          <Text style={styles.methodTime}>1-3 영업일</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.methodCard}
        onPress={() => handleMethodSelect('crypto')}
      >
        <LinearGradient
          colors={['#059669', '#10b981']}
          style={styles.methodGradient}
        >
          <Ionicons name="wallet" size={40} color="white" />
          <Text style={styles.methodName}>암호화폐 송금</Text>
          <Text style={styles.methodDesc}>
            외부 지갑에서 USDC 직접 전송
          </Text>
          <Text style={styles.methodTime}>10-30분</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  // 은행 송금 폼
  const renderWireForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.formTitle}>은행 송금 충전</Text>
      
      {/* 금액 입력 */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>충전 금액</Text>
        <TextInput
          style={styles.input}
          value={wireData.amount}
          onChangeText={(text) => setWireData({...wireData, amount: text})}
          placeholder="예: 100"
          keyboardType="decimal-pad"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* 계좌 소유자 이름 */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>계좌 소유자 이름</Text>
        <TextInput
          style={styles.input}
          value={wireData.bank_account.account_holder_name}
          onChangeText={(text) => setWireData({
            ...wireData, 
            bank_account: {...wireData.bank_account, account_holder_name: text}
          })}
          placeholder="홍길동"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* 은행명 */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>은행명</Text>
        <TextInput
          style={styles.input}
          value={wireData.bank_account.bank_name}
          onChangeText={(text) => setWireData({
            ...wireData, 
            bank_account: {...wireData.bank_account, bank_name: text}
          })}
          placeholder="예: Wells Fargo Bank"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* 계좌번호 */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>계좌번호</Text>
        <TextInput
          style={styles.input}
          value={wireData.bank_account.account_number}
          onChangeText={(text) => setWireData({
            ...wireData, 
            bank_account: {...wireData.bank_account, account_number: text}
          })}
          placeholder="1234567890"
          keyboardType="numeric"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* 라우팅 번호 */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>라우팅 번호</Text>
        <TextInput
          style={styles.input}
          value={wireData.bank_account.routing_number}
          onChangeText={(text) => setWireData({
            ...wireData, 
            bank_account: {...wireData.bank_account, routing_number: text}
          })}
          placeholder="121000248"
          keyboardType="numeric"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* 주소 */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>주소</Text>
        <TextInput
          style={styles.input}
          value={wireData.bank_account.address_line1}
          onChangeText={(text) => setWireData({
            ...wireData, 
            bank_account: {...wireData.bank_account, address_line1: text}
          })}
          placeholder="123 Main Street"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* 도시, 주, 우편번호 */}
      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
          <Text style={styles.inputLabel}>도시</Text>
          <TextInput
            style={styles.input}
            value={wireData.bank_account.city}
            onChangeText={(text) => setWireData({
              ...wireData, 
              bank_account: {...wireData.bank_account, city: text}
            })}
            placeholder="New York"
            placeholderTextColor="#9ca3af"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
          <Text style={styles.inputLabel}>주/도</Text>
          <TextInput
            style={styles.input}
            value={wireData.bank_account.state}
            onChangeText={(text) => setWireData({
              ...wireData, 
              bank_account: {...wireData.bank_account, state: text}
            })}
            placeholder="NY"
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>우편번호</Text>
        <TextInput
          style={styles.input}
          value={wireData.bank_account.postal_code}
          onChangeText={(text) => setWireData({
            ...wireData, 
            bank_account: {...wireData.bank_account, postal_code: text}
          })}
          placeholder="10001"
          keyboardType="numeric"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* 제출 버튼 */}
      <TouchableOpacity
        style={[styles.submitButton, isProcessing && styles.disabledButton]}
        onPress={handleWireDeposit}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.submitButtonText}>충전 요청</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // 암호화폐 충전 폼
  const renderCryptoForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.formTitle}>암호화폐 충전</Text>
      
      {/* 금액 입력 */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>충전 금액</Text>
        <TextInput
          style={styles.input}
          value={cryptoData.amount}
          onChangeText={(text) => setCryptoData({...cryptoData, amount: text})}
          placeholder="예: 50"
          keyboardType="decimal-pad"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* 체인 선택 */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>블록체인 네트워크</Text>
        <View style={styles.chainContainer}>
          {['ETH', 'BASE', 'ARB', 'MATIC', 'AVAX'].map((chain) => (
            <TouchableOpacity
              key={chain}
              style={[
                styles.chainButton,
                cryptoData.chain === chain && styles.chainButtonSelected
              ]}
              onPress={() => setCryptoData({...cryptoData, chain})}
            >
              <Text style={[
                styles.chainButtonText,
                cryptoData.chain === chain && styles.chainButtonTextSelected
              ]}>
                {chain}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 충전 주소 미리보기 */}
      {depositAddresses.length > 0 && (
        <View style={styles.addressPreview}>
          <Text style={styles.inputLabel}>충전 주소 (미리보기)</Text>
          {depositAddresses
            .filter(addr => addr.chain === cryptoData.chain)
            .map((addr, index) => (
              <View key={index} style={styles.addressCard}>
                <Text style={styles.addressChain}>{addr.chain}</Text>
                <Text style={styles.addressText}>{addr.address}</Text>
              </View>
            ))
          }
        </View>
      )}

      {/* 제출 버튼 */}
      <TouchableOpacity
        style={[styles.submitButton, isProcessing && styles.disabledButton]}
        onPress={handleCryptoDeposit}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.submitButtonText}>충전 주소 생성</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // 충전 내역
  const renderDepositHistory = () => (
    <View style={styles.historyContainer}>
      <Text style={styles.historyTitle}>최근 충전 내역</Text>
      {depositHistory.length === 0 ? (
        <Text style={styles.emptyText}>충전 내역이 없습니다.</Text>
      ) : (
        depositHistory.map((deposit, index) => (
          <View key={index} style={styles.historyItem}>
            <View style={styles.historyLeft}>
              <Text style={styles.historyAmount}>
                ${safeToFixed(deposit.amount, 2)} {deposit.currency}
              </Text>
              <Text style={styles.historyMethod}>
                {deposit.method === 'wire_transfer' ? '은행 송금' : '암호화폐'}
                {deposit.chain && ` (${deposit.chain})`}
              </Text>
              <Text style={styles.historyDate}>
                {new Date(deposit.created_at).toLocaleDateString('ko-KR')}
              </Text>
            </View>
            <View style={styles.historyRight}>
              <View style={[
                styles.statusBadge,
                deposit.status === 'completed' && styles.statusCompleted,
                deposit.status === 'pending' && styles.statusPending,
                deposit.status === 'failed' && styles.statusFailed,
              ]}>
                <Text style={styles.statusText}>
                  {deposit.status === 'completed' ? '완료' : 
                   deposit.status === 'pending' ? '진행중' : '실패'}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>USDC 충전</Text>
        <Text style={styles.subtitle}>빠르고 안전한 디지털 달러 충전</Text>
      </View>

      {/* 현재 잔액 표시 */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>총 USDC 잔액</Text>
        <Text style={styles.balanceAmount}>${safeToFixed(totalBalance, 2)}</Text>
        <Text style={styles.balanceDesc}>
          {state.wallets.length}개 지갑에서 관리 중
        </Text>
      </View>

      {/* 메인 컨텐츠 */}
      {!showDepositForm ? renderMethodSelection() : (
        selectedMethod === 'wire' ? renderWireForm() : renderCryptoForm()
      )}

      {/* 뒤로 가기 버튼 (폼이 표시된 경우만) */}
      {showDepositForm && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setShowDepositForm(false);
            setSelectedMethod(null);
          }}
        >
          <Ionicons name="arrow-back" size={20} color="#6366f1" />
          <Text style={styles.backButtonText}>다른 방법 선택</Text>
        </TouchableOpacity>
      )}

      {/* 충전 내역 */}
      {!showDepositForm && renderDepositHistory()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  balanceCard: {
    margin: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  balanceDesc: {
    fontSize: 14,
    color: '#9ca3af',
  },
  methodContainer: {
    padding: 20,
  },
  methodTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  methodCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  methodGradient: {
    padding: 24,
    alignItems: 'center',
  },
  methodName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 12,
    marginBottom: 8,
  },
  methodDesc: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 8,
  },
  methodTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  formContainer: {
    padding: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#1f2937',
  },
  row: {
    flexDirection: 'row',
  },
  chainContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chainButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: 'white',
  },
  chainButtonSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  chainButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  chainButtonTextSelected: {
    color: 'white',
  },
  addressPreview: {
    marginBottom: 20,
  },
  addressCard: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  addressChain: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#374151',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  submitButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6366f1',
    marginLeft: 8,
    fontWeight: '600',
  },
  historyContainer: {
    padding: 20,
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 40,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  historyLeft: {
    flex: 1,
  },
  historyAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  historyMethod: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCompleted: {
    backgroundColor: '#d1fae5',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusFailed: {
    backgroundColor: '#fecaca',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
}); 