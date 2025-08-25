import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import { safeToFixed, safeAdd } from '../utils/formatters';

let BarCodeScanner: any = null;

// 네이티브 플랫폼에서만 바코드 스캐너 import
if (Platform.OS !== 'web') {
  try {
    const barcodeModule = require('expo-barcode-scanner');
    BarCodeScanner = barcodeModule.BarCodeScanner;
  } catch (error) {
    console.warn('바코드 스캐너를 로드할 수 없습니다:', error);
  }
}

export default function PaymentScreen() {
  const { t } = useTranslation();
  const { state, createPayment } = useApp();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    merchantName: '',
    description: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // 카메라 권한 요청 (모바일에서만)
  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      if (Platform.OS === 'web' || !BarCodeScanner) {
        setHasPermission(false);
        return;
      }
      
      try {
        const { status } = await BarCodeScanner.requestPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch (error) {
        console.warn('권한 요청 실패:', error);
        setHasPermission(false);
      }
    };

    getBarCodeScannerPermissions();
  }, []);

  // QR 코드 스캔 처리
  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setShowQRScanner(false);
    
    try {
      // QR 코드 데이터 파싱
      // 예상 형식: circlepay://pay?id=xxx&amount=100&currency=USDC&merchant=shop123
      const url = new URL(data);
      const amount = url.searchParams.get('amount');
      const merchant = url.searchParams.get('merchant');
      const qrCodeId = url.searchParams.get('id');
      
      if (amount && merchant && qrCodeId) {
        processPayment({
          amount: parseFloat(amount),
          merchantId: merchant,
          merchantName: `매장 ${merchant}`,
          qrCodeId,
        });
      } else {
        Alert.alert(t('common.error'), t('common.invalidQRCode', { defaultValue: '유효하지 않은 QR 코드입니다.' }));
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('common.cannotReadQR', { defaultValue: 'QR 코드를 읽을 수 없습니다.' }));
    }
  };

  // 결제 처리
  const processPayment = async (payment: any) => {
    try {
      setIsProcessing(true);
      
      const result = await createPayment({
        amount: payment.amount,
        currency: 'USDC',
        merchantId: payment.merchantId,
        merchantName: payment.merchantName,
        description: payment.description,
      });

      Alert.alert(
        t('common.paymentComplete', { defaultValue: '결제 완료!' }),
        t('common.paymentSuccess', { amount: payment.amount, merchant: payment.merchantName, time: result.estimatedCompletionTime, defaultValue: `$${payment.amount} USDC가 ${payment.merchantName}에 결제되었습니다.\n\n예상 완료 시간: ${result.estimatedCompletionTime}` }),
        [{ text: '확인', onPress: () => setScanned(false) }]
      );
    } catch (error) {
      Alert.alert(t('common.paymentFailed', { defaultValue: '결제 실패' }), t('common.paymentError', { defaultValue: '결제 처리 중 오류가 발생했습니다.' }));
    } finally {
      setIsProcessing(false);
    }
  };

  // 수동 결제 처리
  const handleManualPayment = async () => {
    if (!paymentData.amount || !paymentData.merchantName) {
      Alert.alert(t('common.error'), t('common.enterAmountAndMerchant', { defaultValue: '금액과 가맹점명을 입력해주세요.' }));
      return;
    }

    await processPayment({
      amount: parseFloat(paymentData.amount),
      merchantId: 'manual_' + Date.now(),
      merchantName: paymentData.merchantName,
      description: paymentData.description,
    });

    setShowManualPayment(false);
    setPaymentData({ amount: '', merchantName: '', description: '' });
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>{t('common.requestingPermission', { defaultValue: '카메라 권한을 요청 중입니다...' })}</Text>
      </View>
    );
  }

  // 웹에서는 권한 요청 화면을 스킵하고 메인 화면으로
  if (hasPermission === false && Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#CCC" />
          <Text style={styles.permissionTitle}>{t('common.cameraPermissionNeeded', { defaultValue: '카메라 권한이 필요합니다' })}</Text>
          <Text style={styles.permissionText}>
            QR 코드를 스캔하여 결제하려면 카메라 권한을 허용해주세요.
          </Text>
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={() => BarCodeScanner?.requestPermissionsAsync()}
          >
            <Text style={styles.permissionButtonText}>{t('common.allowPermission', { defaultValue: '권한 허용' })}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 메인 컨텐츠 */}
      <View style={styles.mainContent}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('headers.qrPayment')}</Text>
          <Text style={styles.subtitle}>{t('common.scanOrManualPayment', { defaultValue: 'QR 코드를 스캔하거나 수동으로 결제하세요' })}</Text>
        </View>

        {/* 총 잔액 표시 */}
        <LinearGradient
          colors={['#28A745', '#20C997']}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>{t('common.availableBalance', { defaultValue: '사용 가능 잔액' })}</Text>
          <Text style={styles.balanceAmount}>
            ${safeToFixed(state.wallets.reduce((sum, w) => safeAdd(sum, w.usdcBalance), 0), 2)} USDC
          </Text>
        </LinearGradient>

        {/* 결제 옵션 버튼들 */}
        <View style={styles.paymentOptions}>
          <TouchableOpacity
            style={[styles.optionButton, Platform.OS === 'web' && styles.disabledButton]}
            onPress={() => {
              if (Platform.OS === 'web') {
                Alert.alert(
                  t('common.featureLimitation', { defaultValue: '기능 제한' }),
                  t('common.qrMobileOnly', { defaultValue: 'QR 스캔 기능은 모바일 앱에서만 사용할 수 있습니다.\n수동 결제를 이용해주세요.' }),
                  [{ text: '확인' }]
                );
              } else {
                setShowQRScanner(true);
              }
            }}
          >
            <LinearGradient
              colors={Platform.OS === 'web' ? ['#999', '#666'] : ['#007AFF', '#0051D0']}
              style={styles.optionGradient}
            >
              <Ionicons name="qr-code-outline" size={48} color="white" />
              <Text style={styles.optionTitle}>{t('common.qrScan', { defaultValue: 'QR 스캔' })}</Text>
              <Text style={styles.optionSubtitle}>
                {Platform.OS === 'web' ? '모바일에서만 사용 가능' : '매장의 QR 코드를 스캔하세요'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => setShowManualPayment(true)}
          >
            <LinearGradient
              colors={['#6F42C1', '#8A2BE2']}
              style={styles.optionGradient}
            >
              <Ionicons name="card-outline" size={48} color="white" />
              <Text style={styles.optionTitle}>{t('common.manualPayment', { defaultValue: '수동 결제' })}</Text>
              <Text style={styles.optionSubtitle}>{t('common.enterAmountManually', { defaultValue: '금액을 직접 입력하세요' })}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* 최근 결제 내역 */}
        <View style={styles.recentPayments}>
          <Text style={styles.sectionTitle}>{t('common.recentPayments', { defaultValue: '최근 결제' })}</Text>
          {state.transactions.filter(t => t.type === 'payment').slice(0, 3).map((payment, index) => (
            <View key={`payment-${payment.transactionId}-${index}`} style={styles.paymentItem}>
              <View style={styles.paymentIcon}>
                <Ionicons name="card" size={20} color="#28A745" />
              </View>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentMerchant}>{payment.merchantName}</Text>
                <Text style={styles.paymentDate}>
                  {new Date(payment.createdAt).toLocaleDateString('ko-KR')}
                </Text>
              </View>
              <Text style={styles.paymentAmount}>-${safeToFixed(payment.amount, 2)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* QR 스캐너 모달 */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showQRScanner}
        onRequestClose={() => setShowQRScanner(false)}
      >
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowQRScanner(false)}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>{t('common.qrScan')}</Text>
          </View>
          
          {Platform.OS !== 'web' && BarCodeScanner ? (
            <BarCodeScanner
              onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="camera-outline" size={80} color="#666" />
              <Text style={{ color: 'white', marginTop: 20, textAlign: 'center' }}>
                카메라 기능은 모바일 앱에서만{'\n'}사용할 수 있습니다
              </Text>
            </View>
          )}
          
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerText}>
              결제용 QR 코드를 프레임 안에 맞춰주세요
            </Text>
          </View>
        </View>
      </Modal>

      {/* 수동 결제 모달 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showManualPayment}
        onRequestClose={() => setShowManualPayment(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('common.manualPayment')}</Text>
              <TouchableOpacity onPress={() => setShowManualPayment(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('common.paymentAmount', { defaultValue: '결제 금액 (USDC)' })}</Text>
                <TextInput
                  style={styles.input}
                  value={paymentData.amount}
                  onChangeText={(text) => setPaymentData(prev => ({ ...prev, amount: text }))}
                  placeholder="100.00"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('common.merchantName', { defaultValue: '가맹점명' })}</Text>
                <TextInput
                  style={styles.input}
                  value={paymentData.merchantName}
                  onChangeText={(text) => setPaymentData(prev => ({ ...prev, merchantName: text }))}
                  placeholder="매장 이름"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('common.memo', { defaultValue: '메모 (선택사항)' })}</Text>
                <TextInput
                  style={styles.input}
                  value={paymentData.description}
                  onChangeText={(text) => setPaymentData(prev => ({ ...prev, description: text }))}
                  placeholder="결제 내용"
                />
              </View>

              <TouchableOpacity
                style={styles.payButton}
                onPress={handleManualPayment}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.payButtonText}>{t('common.pay', { defaultValue: '결제하기' })}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  mainContent: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 24,
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
    padding: 20,
    borderRadius: 16,
    marginBottom: 32,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  paymentOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  optionButton: {
    flex: 1,
    marginHorizontal: 6,
  },
  optionGradient: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    minHeight: 160,
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 12,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  recentPayments: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  paymentItem: {
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
  paymentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentMerchant: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  paymentDate: {
    fontSize: 12,
    color: '#666',
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#DC3545',
  },
  // 권한 관련 스타일
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  // 스캐너 관련 스타일
  scannerContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    zIndex: 1,
  },
  closeButton: {
    marginRight: 16,
  },
  scannerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  scannerOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: 'transparent',
    marginBottom: 24,
  },
  scannerText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // 모달 관련 스타일
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
  },
  payButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  payButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 