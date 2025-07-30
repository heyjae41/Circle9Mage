/**
 * 생체 인증 프롬프트 도우미 컴포넌트
 * - 생체 인증 사용 안내
 * - fallback 옵션 제공
 * - 실패 시 대안 제시
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface BiometricPromptProps {
  visible: boolean;
  biometricType: string;
  onBiometricPress: () => void;
  onPinPress: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const BiometricPrompt: React.FC<BiometricPromptProps> = ({
  visible,
  biometricType,
  onBiometricPress,
  onPinPress,
  onCancel,
  isLoading = false
}) => {
  
  const getIcon = () => {
    if (biometricType.includes('지문')) return 'finger-print';
    if (biometricType.includes('얼굴')) return 'scan';
    return 'shield-checkmark';
  };

  const getDescription = () => {
    return `더 빠르고 안전한 로그인을 위해 ${biometricType}을 사용하세요.`;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name={getIcon()} 
              size={48} 
              color="#007AFF" 
            />
          </View>
          
          <Text style={styles.title}>생체 인증으로 로그인</Text>
          <Text style={styles.description}>{getDescription()}</Text>
          
          <View style={styles.buttonContainer}>
            {/* 생체 인증 버튼 */}
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={onBiometricPress}
              disabled={isLoading}
            >
              <LinearGradient
                colors={['#007AFF', '#5856D6']}
                style={styles.gradientButton}
              >
                {isLoading ? (
                  <Text style={styles.buttonText}>인증 중...</Text>
                ) : (
                  <>
                    <Ionicons 
                      name={getIcon()} 
                      size={20} 
                      color="white" 
                    />
                    <Text style={styles.buttonText}>{biometricType} 사용</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            {/* PIN 입력 버튼 */}
            <TouchableOpacity
              style={styles.pinButton}
              onPress={onPinPress}
              disabled={isLoading}
            >
              <Text style={styles.pinButtonText}>PIN 번호로 로그인</Text>
            </TouchableOpacity>
          </View>
          
          {/* 도움말 */}
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => {
              Alert.alert(
                '생체 인증 도움말',
                `• ${biometricType}이 인식되지 않는 경우 PIN 번호를 사용하세요\n• 설정에서 생체 인증을 활성화/비활성화할 수 있습니다\n• 보안을 위해 24시간마다 PIN 확인이 필요할 수 있습니다`,
                [{ text: '확인' }]
              );
            }}
          >
            <Ionicons name="help-circle-outline" size={16} color="#666" />
            <Text style={styles.helpText}>도움말</Text>
          </TouchableOpacity>
          
          {/* 취소 버튼 */}
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={onCancel}
          >
            <Text style={styles.cancelText}>나중에</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: Math.min(screenWidth - 40, 320),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 16,
  },
  biometricButton: {
    width: '100%',
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradientButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pinButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  pinButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    marginBottom: 8,
  },
  helpText: {
    color: '#666',
    fontSize: 14,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: '#999',
    fontSize: 14,
  },
});

export default BiometricPrompt;