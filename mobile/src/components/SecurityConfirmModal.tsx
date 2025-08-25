/**
 * 보안 확인 모달
 * - 고액 송금 및 의심스러운 주소 경고
 * - 사용자 친화적인 보안 가이드
 * - 단계별 확인 프로세스
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface SecurityConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  securityLevel: 'high_amount' | 'suspicious_address' | 'compliance_failed';
  data: {
    amount?: number;
    address?: string;
    warning?: string;
    recommendations?: string[];
    risks?: string[];
    threshold?: number;
  };
}

const SecurityConfirmModal: React.FC<SecurityConfirmModalProps> = ({
  visible,
  onClose,
  onConfirm,
  securityLevel,
  data
}) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [step, setStep] = useState(1);
  const maxSteps = securityLevel === 'high_amount' ? 3 : 2;

  const getSecurityInfo = () => {
    switch (securityLevel) {
      case 'high_amount':
        return {
          icon: 'warning-outline',
          color: '#FF9500',
          title: '고액 송금 확인',
          description: `${data.amount} USDC는 고액 송금입니다.`,
          bgColor: '#FFF3E0'
        };
      case 'suspicious_address':
        return {
          icon: 'shield-outline',
          color: '#FF3B30',
          title: '주소 보안 경고',
          description: '이 주소는 의심스러운 패턴을 보입니다.',
          bgColor: '#FFEBEE'
        };
      case 'compliance_failed':
        return {
          icon: 'ban-outline',
          color: '#DC3545',
          title: '컴플라이언스 검사 실패',
          description: '이 거래는 보안 정책에 위배됩니다.',
          bgColor: '#F8D7DA'
        };
      default:
        return {
          icon: 'information-circle-outline',
          color: '#007AFF',
          title: '보안 확인',
          description: '추가 보안 확인이 필요합니다.',
          bgColor: '#E3F2FD'
        };
    }
  };

  const securityInfo = getSecurityInfo();

  const handleNext = () => {
    if (step < maxSteps) {
      setStep(step + 1);
    } else {
      handleConfirm();
    }
  };

  const handleConfirm = () => {
    if (!acknowledged) {
      Alert.alert(
        '확인 필요',
        '위험을 이해했다는 확인이 필요합니다.',
        [{ text: '확인', style: 'default' }]
      );
      return;
    }

    if (securityLevel === 'compliance_failed') {
      Alert.alert(
        '거래 불가',
        '컴플라이언스 검사에 실패한 거래는 진행할 수 없습니다.',
        [{ text: '확인', onPress: onClose }]
      );
      return;
    }

    onConfirm();
    setStep(1);
    setAcknowledged(false);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>1단계: 정보 확인</Text>
            
            {securityLevel === 'high_amount' && (
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>송금 금액</Text>
                <Text style={styles.infoValue}>{data.amount} USDC</Text>
                <Text style={styles.infoLabel}>고액 기준</Text>
                <Text style={styles.infoValue}>{data.threshold} USDC 이상</Text>
              </View>
            )}

            {securityLevel === 'suspicious_address' && (
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>대상 주소</Text>
                <Text style={styles.addressText}>{data.address}</Text>
                {data.risks && data.risks.length > 0 && (
                  <>
                    <Text style={styles.infoLabel}>감지된 위험 요소</Text>
                    {data.risks.map((risk, index) => (
                      <Text key={index} style={styles.riskText}>• {risk}</Text>
                    ))}
                  </>
                )}
              </View>
            )}

            <View style={styles.warningBox}>
              <Ionicons name="warning" size={24} color="#FF9500" />
              <Text style={styles.warningText}>{data.warning}</Text>
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>2단계: 보안 가이드</Text>
            
            {data.recommendations && (
              <View style={styles.recommendationsBox}>
                <Text style={styles.recommendationsTitle}>보안 권장사항</Text>
                {data.recommendations.map((rec, index) => (
                  <View key={index} style={styles.recommendationItem}>
                    <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                    <Text style={styles.recommendationText}>{rec}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.additionalTips}>
              <Text style={styles.tipsTitle}>추가 보안 팁</Text>
              <Text style={styles.tipText}>• 블록체인 거래는 되돌릴 수 없습니다</Text>
              <Text style={styles.tipText}>• 의심스럽다면 거래를 중단하세요</Text>
              <Text style={styles.tipText}>• 주소를 다시 한 번 확인해 주세요</Text>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>3단계: 최종 확인</Text>
            
            <View style={styles.finalConfirmBox}>
              <Ionicons name="shield-checkmark" size={48} color="#34C759" />
              <Text style={styles.finalConfirmTitle}>거래 최종 확인</Text>
              <Text style={styles.finalConfirmText}>
                위의 모든 보안 사항을 확인했으며, 거래를 진행하시겠습니까?
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.checkboxContainer, acknowledged && styles.checkboxChecked]}
              onPress={() => setAcknowledged(!acknowledged)}
            >
              <Ionicons 
                name={acknowledged ? "checkbox" : "square-outline"} 
                size={24} 
                color={acknowledged ? "#007AFF" : "#999"} 
              />
              <Text style={styles.checkboxText}>
                위험을 이해했으며 거래를 진행하겠습니다
              </Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* 헤더 */}
          <View style={[styles.header, { backgroundColor: securityInfo.bgColor }]}>
            <View style={styles.headerContent}>
              <Ionicons name={securityInfo.icon} size={32} color={securityInfo.color} />
              <View style={styles.headerText}>
                <Text style={styles.title}>{securityInfo.title}</Text>
                <Text style={styles.description}>{securityInfo.description}</Text>
              </View>
            </View>
            
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* 진행 상태 */}
          <View style={styles.progressContainer}>
            {Array.from({ length: maxSteps }, (_, index) => (
              <View key={index} style={styles.progressItem}>
                <View style={[
                  styles.progressDot,
                  step > index + 1 ? styles.progressDotCompleted :
                  step === index + 1 ? styles.progressDotActive : styles.progressDotInactive
                ]}>
                  {step > index + 1 ? (
                    <Ionicons name="checkmark" size={16} color="white" />
                  ) : (
                    <Text style={styles.progressDotText}>{index + 1}</Text>
                  )}
                </View>
                {index < maxSteps - 1 && (
                  <View style={[
                    styles.progressLine,
                    step > index + 1 ? styles.progressLineCompleted : styles.progressLineInactive
                  ]} />
                )}
              </View>
            ))}
          </View>

          {/* 콘텐츠 */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {renderStep()}
          </ScrollView>

          {/* 액션 버튼들 */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.nextButton,
                (step === maxSteps && !acknowledged) && styles.nextButtonDisabled
              ]}
              onPress={handleNext}
              disabled={step === maxSteps && !acknowledged}
            >
              <LinearGradient
                colors={
                  step === maxSteps && !acknowledged 
                    ? ['#CCC', '#AAA'] 
                    : step === maxSteps 
                      ? ['#34C759', '#28A745']
                      : ['#007AFF', '#0051D0']
                }
                style={styles.nextButtonGradient}
              >
                <Text style={styles.nextButtonText}>
                  {step === maxSteps ? '확인하고 진행' : '다음'}
                </Text>
                <Ionicons 
                  name={step === maxSteps ? "checkmark" : "chevron-forward"} 
                  size={20} 
                  color="white" 
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: width - 40,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F8F9FA',
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: {
    backgroundColor: '#007AFF',
  },
  progressDotCompleted: {
    backgroundColor: '#34C759',
  },
  progressDotInactive: {
    backgroundColor: '#E5E5EA',
  },
  progressDotText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
  },
  progressLineCompleted: {
    backgroundColor: '#34C759',
  },
  progressLineInactive: {
    backgroundColor: '#E5E5EA',
  },
  content: {
    maxHeight: 400,
  },
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  addressText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
    backgroundColor: '#FFF',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  riskText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  warningText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    lineHeight: 22,
  },
  recommendationsBox: {
    marginBottom: 16,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    lineHeight: 20,
  },
  additionalTips: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#1976D2',
    marginBottom: 4,
  },
  finalConfirmBox: {
    alignItems: 'center',
    padding: 20,
    marginBottom: 20,
  },
  finalConfirmTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  finalConfirmText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  checkboxChecked: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  checkboxText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  nextButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default SecurityConfirmModal;
