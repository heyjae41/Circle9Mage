import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../contexts/AppContext';

export default function SendScreen() {
  const { state, createTransfer } = useApp();
  const [sendData, setSendData] = useState({
    amount: '',
    targetAddress: '',
    sourceChain: '',
    targetChain: '',
    notes: '',
  });
  const [selectedSourceWallet, setSelectedSourceWallet] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 총 잔액 계산
  const totalBalance = state.wallets.reduce((sum, wallet) => sum + wallet.usdcBalance, 0);

  // 송금 처리
  const handleSend = async () => {
    if (!sendData.amount || !sendData.targetAddress || !selectedSourceWallet) {
      Alert.alert('오류', '모든 필수 항목을 입력해주세요.');
      return;
    }

    if (parseFloat(sendData.amount) <= 0) {
      Alert.alert('오류', '유효한 금액을 입력해주세요.');
      return;
    }

    const sourceWallet = state.wallets.find(w => w.walletId === selectedSourceWallet);
    if (!sourceWallet) {
      Alert.alert('오류', '출금 지갑을 선택해주세요.');
      return;
    }

    if (parseFloat(sendData.amount) > sourceWallet.usdcBalance) {
      Alert.alert('오류', '잔액이 부족합니다.');
      return;
    }

    try {
      setIsProcessing(true);
      
      const result = await createTransfer({
        sourceWalletId: selectedSourceWallet,
        targetAddress: sendData.targetAddress,
        amount: parseFloat(sendData.amount),
        sourceChain: sourceWallet.blockchain.toLowerCase(),
        targetChain: sendData.targetChain || sourceWallet.blockchain.toLowerCase(),
        notes: sendData.notes,
      });

      Alert.alert(
        '송금 완료!',
        `$${sendData.amount} USDC가 성공적으로 전송되었습니다.\n\n예상 완료 시간: ${result.estimatedCompletionTime}`,
        [
          {
            text: '확인',
            onPress: () => {
              setSendData({
                amount: '',
                targetAddress: '',
                sourceChain: '',
                targetChain: '',
                notes: '',
              });
              setSelectedSourceWallet('');
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('송금 실패', '송금 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>크로스체인 송금</Text>
        <Text style={styles.subtitle}>안전하고 빠른 글로벌 송금 서비스</Text>
      </View>

      {/* 총 잔액 카드 */}
      <LinearGradient
        colors={['#FD7E14', '#FF6B35']}
        style={styles.balanceCard}
      >
        <Text style={styles.balanceLabel}>총 사용 가능 금액</Text>
        <Text style={styles.balanceAmount}>${totalBalance.toFixed(2)} USDC</Text>
        <Text style={styles.balanceNote}>모든 체인의 USDC 잔액 합계</Text>
      </LinearGradient>

      {/* 송금 폼 */}
      <View style={styles.formContainer}>
        {/* 출금 지갑 선택 */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>출금 지갑 선택</Text>
          <View style={styles.walletSelector}>
            {state.wallets.map((wallet) => (
              <TouchableOpacity
                key={wallet.walletId}
                style={[
                  styles.walletOption,
                  selectedSourceWallet === wallet.walletId && styles.walletOptionSelected
                ]}
                onPress={() => setSelectedSourceWallet(wallet.walletId)}
              >
                <View style={styles.walletOptionContent}>
                  <View style={styles.walletOptionInfo}>
                    <Text style={styles.walletOptionName}>{wallet.chainName}</Text>
                    <Text style={styles.walletOptionAddress}>
                      {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                    </Text>
                  </View>
                  <View style={styles.walletOptionBalance}>
                    <Text style={styles.walletOptionBalanceAmount}>
                      ${wallet.usdcBalance.toFixed(2)}
                    </Text>
                    <Text style={styles.walletOptionBalanceCurrency}>USDC</Text>
                  </View>
                </View>
                {selectedSourceWallet === wallet.walletId && (
                  <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 수신자 주소 */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>수신자 주소</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={sendData.targetAddress}
              onChangeText={(text) => setSendData(prev => ({ ...prev, targetAddress: text }))}
              placeholder="0x..."
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={styles.inputButton}>
              <Ionicons name="qr-code-outline" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.inputHint}>
            Ethereum 주소 형식 (0x로 시작하는 42자리)
          </Text>
        </View>

        {/* 송금 금액 */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>송금 금액</Text>
          <View style={styles.amountContainer}>
            <TextInput
              style={styles.amountInput}
              value={sendData.amount}
              onChangeText={(text) => setSendData(prev => ({ ...prev, amount: text }))}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#999"
            />
            <View style={styles.currencyBadge}>
              <Text style={styles.currencyText}>USDC</Text>
            </View>
          </View>
          
          {/* 빠른 금액 선택 */}
          <View style={styles.quickAmounts}>
            {[10, 50, 100, 500].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={styles.quickAmountButton}
                onPress={() => setSendData(prev => ({ ...prev, amount: amount.toString() }))}
              >
                <Text style={styles.quickAmountText}>${amount}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 목적지 체인 (옵션) */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>목적지 체인 (선택사항)</Text>
          <View style={styles.chainSelector}>
            {state.supportedChains.map((chain) => (
              <TouchableOpacity
                key={chain.id}
                style={[
                  styles.chainOption,
                  sendData.targetChain === chain.id && styles.chainOptionSelected
                ]}
                onPress={() => setSendData(prev => ({ ...prev, targetChain: chain.id }))}
              >
                <Text style={[
                  styles.chainOptionText,
                  sendData.targetChain === chain.id && styles.chainOptionTextSelected
                ]}>
                  {chain.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.inputHint}>
            선택하지 않으면 출금 체인과 동일한 체인으로 전송됩니다
          </Text>
        </View>

        {/* 메모 */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>메모 (선택사항)</Text>
          <TextInput
            style={[styles.input, styles.memoInput]}
            value={sendData.notes}
            onChangeText={(text) => setSendData(prev => ({ ...prev, notes: text }))}
            placeholder="송금 목적이나 메모를 입력하세요"
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* 수수료 정보 */}
        <View style={styles.feeInfo}>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>예상 가스비</Text>
            <Text style={styles.feeValue}>$2.50</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>브리지 수수료</Text>
            <Text style={styles.feeValue}>$0.50</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>서비스 수수료</Text>
            <Text style={styles.feeValue}>$1.00</Text>
          </View>
          <View style={[styles.feeRow, styles.totalFeeRow]}>
            <Text style={styles.totalFeeLabel}>총 수수료</Text>
            <Text style={styles.totalFeeValue}>$4.00</Text>
          </View>
        </View>

        {/* 송금 버튼 */}
        <TouchableOpacity
          style={[styles.sendButton, (!sendData.amount || !sendData.targetAddress || !selectedSourceWallet || isProcessing) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!sendData.amount || !sendData.targetAddress || !selectedSourceWallet || isProcessing}
        >
          <LinearGradient
            colors={(!sendData.amount || !sendData.targetAddress || !selectedSourceWallet || isProcessing) 
              ? ['#CCC', '#999'] 
              : ['#007AFF', '#0051D0']
            }
            style={styles.sendButtonGradient}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="white" />
                <Text style={styles.sendButtonText}>송금하기</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* 최근 송금 내역 */}
        <View style={styles.recentTransfers}>
          <Text style={styles.sectionTitle}>최근 송금</Text>
          {state.transactions.filter(t => t.type === 'transfer').slice(0, 3).map((transfer) => (
            <View key={transfer.transactionId} style={styles.transferItem}>
              <View style={styles.transferIcon}>
                <Ionicons name="send" size={16} color="#007AFF" />
              </View>
              <View style={styles.transferInfo}>
                <Text style={styles.transferAddress}>
                  {transfer.toAddress.slice(0, 6)}...{transfer.toAddress.slice(-4)}
                </Text>
                <Text style={styles.transferDate}>
                  {new Date(transfer.createdAt).toLocaleDateString('ko-KR')}
                </Text>
              </View>
              <Text style={styles.transferAmount}>${transfer.amount.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  balanceCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  balanceNote: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  formContainer: {
    padding: 20,
    paddingTop: 0,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
  },
  inputButton: {
    marginLeft: 12,
    padding: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  memoInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  // 지갑 선택 스타일
  walletSelector: {
    gap: 8,
  },
  walletOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  walletOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  walletOptionContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginRight: 8,
  },
  walletOptionInfo: {
    flex: 1,
  },
  walletOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  walletOptionAddress: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  walletOptionBalance: {
    alignItems: 'flex-end',
  },
  walletOptionBalanceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  walletOptionBalanceCurrency: {
    fontSize: 12,
    color: '#666',
  },
  // 금액 입력 스타일
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderRadius: 12,
    marginBottom: 12,
  },
  amountInput: {
    flex: 1,
    padding: 16,
    fontSize: 24,
    fontWeight: '600',
  },
  currencyBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  currencyText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
  },
  quickAmountButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  // 체인 선택 스타일
  chainSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chainOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  chainOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  chainOptionText: {
    fontSize: 14,
    color: '#666',
  },
  chainOptionTextSelected: {
    color: 'white',
  },
  // 수수료 정보 스타일
  feeInfo: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalFeeRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E1E5E9',
    marginBottom: 0,
  },
  feeLabel: {
    fontSize: 14,
    color: '#666',
  },
  feeValue: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  totalFeeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  totalFeeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  // 송금 버튼 스타일
  sendButton: {
    marginBottom: 32,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  // 최근 송금 스타일
  recentTransfers: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  transferItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  transferIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transferInfo: {
    flex: 1,
  },
  transferAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  transferDate: {
    fontSize: 12,
    color: '#666',
  },
  transferAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
  },
}); 