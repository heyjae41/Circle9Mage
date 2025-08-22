import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/apiService';
import { useApp } from '../contexts/AppContext';
import { biometricAuthManager } from '../utils/biometricAuth';

interface LoginData {
  email: string;
  pin: string;
}

export default function LoginScreen({ route }: any) {
  const navigation = useNavigation();
  const { loadUserData, setAuthToken, hideTokenExpiredModal } = useApp();
  
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('생체 인증');
  const [savedCredentials, setSavedCredentials] = useState<LoginData | null>(null);
  
  // 로그인 폼 데이터
  const [loginData, setLoginData] = useState<LoginData>({
    email: '',
    pin: '',
  });

  // loginData 변경 감지 (디버깅용)
  useEffect(() => {
    console.log('🔄 LoginScreen - loginData 상태 변경:', {
      email: loginData.email || 'empty',
      pin: loginData.pin ? '***' : 'empty',
      emailLength: loginData.email.length,
      pinLength: loginData.pin.length
    });
  }, [loginData]);

  // 생체 인증 가능 여부 확인 및 저장된 정보 로드
  useEffect(() => {
    checkBiometricAvailability();
    loadSavedCredentials();
    loadLoginInformation();
  }, []);

  // route params 변경시 로그인 정보 업데이트
  useEffect(() => {
    console.log('📥 LoginScreen - route params 변경 감지:', route?.params);
    
    if (route?.params) {
      const { prefillEmail, prefillPin } = route.params;
      
      console.log('🔍 LoginScreen - 받은 route params:', { 
        prefillEmail: prefillEmail || 'none', 
        prefillPin: prefillPin ? '***' : 'none',
        hasPrefillEmail: !!prefillEmail,
        hasPrefillPin: !!prefillPin
      });
      
      if (prefillEmail || prefillPin) {
        // 함수형 업데이트로 안전하게 처리
        setLoginData(prevData => {
          const newData = {
            email: prefillEmail || prevData.email,
            pin: prefillPin || prevData.pin,
          };
          
          console.log('✅ LoginScreen - loginData 업데이트:', {
            이전: { email: prevData.email ? '***' : 'none', pin: prevData.pin ? '***' : 'none' },
            새로운: { email: newData.email ? '***' : 'none', pin: newData.pin ? '***' : 'none' }
          });
          
          return newData;
        });
      }
    }
  }, [route?.params]);

  // 저장된 로그인 정보 로드
  const loadLoginInformation = async () => {
    try {
      // route params가 우선순위가 높음
      if (route?.params?.prefillEmail || route?.params?.prefillPin) {
        console.log('📋 Route params가 있어서 저장된 정보 로드 건너뜀');
        return;
      }
      
      const savedEmail = await AsyncStorage.getItem('saved_email');
      const savedPin = await AsyncStorage.getItem('saved_pin');
      
      if (savedEmail || savedPin) {
        console.log('📱 저장된 로그인 정보 로드:', { 
          email: savedEmail || 'none', 
          pin: savedPin ? '***' : 'none' 
        });
        
        // 함수형 업데이트로 안전하게 처리
        setLoginData(prevData => ({
          email: savedEmail || prevData.email,
          pin: savedPin || prevData.pin,
        }));
      }
    } catch (error) {
      console.error('로그인 정보 로드 실패:', error);
    }
  };

  const checkBiometricAvailability = async () => {
    try {
      const status = await biometricAuthManager.getStatus();
      setBiometricAvailable(status.capabilities.isAvailable);
      setBiometricEnabled(status.settings.isEnabled);
      
      if (status.capabilities.supportedTypeNames.length > 0) {
        setBiometricType(status.capabilities.supportedTypeNames[0]);
      }
      
      console.log('🔐 생체 인증 상태:', {
        available: status.capabilities.isAvailable,
        enabled: status.settings.isEnabled,
        types: status.capabilities.supportedTypeNames
      });
    } catch (error) {
      console.log('생체 인증 확인 실패:', error);
      setBiometricAvailable(false);
      setBiometricEnabled(false);
    }
  };

  // 저장된 로그인 정보 불러오기
  const loadSavedCredentials = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('saved_email');
      if (savedEmail) {
        setLoginData(prev => ({ ...prev, email: savedEmail }));
        setSavedCredentials({ email: savedEmail, pin: '' });
      }
    } catch (error) {
      console.log('저장된 정보 불러오기 실패:', error);
    }
  };

  // 이메일 유효성 검사
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 폼 유효성 검사
  const validateForm = (): boolean => {
    if (!loginData.email || !isValidEmail(loginData.email)) {
      Alert.alert('오류', '올바른 이메일 주소를 입력해주세요.');
      return false;
    }
    
    if (!loginData.pin || loginData.pin.length < 6) {
      Alert.alert('오류', 'PIN을 입력해주세요.');
      return false;
    }
    
    return true;
  };

  // 로그인 처리
  const handleLogin = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const response = await apiService.login({
        email: loginData.email,
        pin: loginData.pin,
      });
      
      // JWT 토큰 설정 및 AsyncStorage에 저장
      await setAuthToken(response.accessToken, response.refreshToken);
      
      // 로그인 정보 저장 (편의성을 위해)
      await AsyncStorage.setItem('saved_email', loginData.email);
      await AsyncStorage.setItem('saved_pin', loginData.pin);
      
      console.log('💾 로그인 정보 저장 완료:', { 
        email: '***', 
        pin: '***' 
      });
      
      // 사용자 데이터 로드
      await loadUserData();
      
      // 토큰 만료 모달 닫기 (중요!)
      hideTokenExpiredModal();
      
      console.log('🎉 로그인 성공, 토큰 만료 모달 닫기 완료');
      
      // Alert 대신 간단한 메시지로 변경하여 UI 블록 방지
      setTimeout(() => {
        Alert.alert('로그인 성공!', '환영합니다!');
      }, 200); // 상태 업데이트 후 알림 표시
      
    } catch (error: any) {
      Alert.alert('로그인 실패', error.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 생체 인증 로그인
  const handleBiometricLogin = async () => {
    if (!biometricAvailable || !biometricEnabled) {
      Alert.alert('알림', '생체 인증을 사용할 수 없습니다.\n설정에서 생체 인증을 활성화해주세요.');
      return;
    }

    // 저장된 토큰이 있는지 확인
    const savedToken = await AsyncStorage.getItem('access_token');
    if (!savedToken) {
      Alert.alert('알림', '저장된 로그인 정보가 없습니다.\n먼저 일반 로그인을 진행해주세요.');
      return;
    }

    setLoading(true);

    try {
      // 생체 인증 수행
      const authResult = await biometricAuthManager.authenticate(
        `CirclePay에 로그인하려면 ${biometricType}을 사용해주세요`
      );

      if (authResult.success) {
        try {
          // 저장된 토큰으로 사용자 정보 확인
          await setAuthToken(savedToken);
          await loadUserData();
          
          Alert.alert('로그인 성공!', `${biometricType}으로 로그인되었습니다!`, [
            { text: '확인' }
          ]);
          
          console.log('✅ 생체 인증 로그인 성공');
        } catch (tokenError: any) {
          // 토큰이 만료되었거나 유효하지 않은 경우
          console.log('토큰 검증 실패:', tokenError);
          Alert.alert(
            '알림', 
            '인증 정보가 만료되었습니다.\nPIN으로 다시 로그인해주세요.',
            [
              { text: '확인', onPress: () => {
                // 만료된 토큰 삭제
                AsyncStorage.removeItem('access_token');
              }}
            ]
          );
        }
             } else {
         // 생체 인증 실패 시 PIN 입력 안내
         if (authResult.error?.includes('취소')) {
           console.log('사용자가 생체 인증을 취소함');
           // 취소 시에는 별도 알림 없이 PIN 입력 유지
         } else if (authResult.error?.includes('PIN 입력으로 전환')) {
           // 사용자가 fallback을 선택한 경우
           Alert.alert(
             '생체 인증 대신 PIN 사용',
             'PIN 번호를 입력하여 로그인해주세요.',
             [{ text: '확인', onPress: () => {
               // 이메일 필드에 포커스 (PIN 입력 유도)
               if (loginData.email) {
                 // PIN 필드로 포커스 이동 (실제 구현 시 ref 사용)
               }
             }}]
           );
         } else {
           // 기타 생체 인증 실패
           Alert.alert(
             '생체 인증 실패',
             `${authResult.error}\n\nPIN 번호로 로그인을 계속하세요.`,
             [{ text: '확인' }]
           );
         }
       }
    } catch (error: any) {
      console.error('생체 인증 로그인 오류:', error);
      Alert.alert('오류', '생체 인증 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 회원가입으로 이동
  const goToSignUp = () => {
    navigation.navigate('SignUp' as never);
  };

  // PIN 초기화 (비밀번호 찾기)
  const handleForgotPin = () => {
    Alert.alert(
      '도움말',
      'PIN을 잊으셨나요?\n\n현재는 개발 단계로 다음 방법을 시도해보세요:\n1. 회원가입 시 사용한 PIN 확인\n2. 새로 회원가입\n\n향후 이메일/SMS를 통한 PIN 재설정 기능이 추가될 예정입니다.',
      [
        { text: '회원가입', onPress: goToSignUp },
        { text: '닫기', style: 'cancel' }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.container}>
          {/* 헤더 */}
          <View style={styles.headerSection}>
            <LinearGradient
              colors={['#007AFF', '#0051D0']}
              style={styles.headerGradient}
            >
              <Ionicons name="log-in" size={48} color="white" />
              <Text style={styles.headerTitle}>로그인</Text>
              <Text style={styles.headerSubtitle}>
                CirclePay Global에 다시 오신 것을 환영합니다
              </Text>
            </LinearGradient>
          </View>

          {/* 로그인 폼 */}
          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>이메일 주소</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="example@email.com"
                  value={loginData.email}
                  onChangeText={(text) => {
                    console.log('📝 이메일 입력 변경:', text ? '***' : 'empty');
                    setLoginData({...loginData, email: text});
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PIN</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="••••••"
                  value={loginData.pin}
                  onChangeText={(text) => {
                    console.log('📝 PIN 입력 변경:', text ? '***' : 'empty');
                    setLoginData({...loginData, pin: text});
                  }}
                  secureTextEntry
                  maxLength={20}
                />
              </View>
            </View>

            {/* PIN 찾기 */}
            <TouchableOpacity onPress={handleForgotPin} style={styles.forgotPinButton}>
              <Text style={styles.forgotPinText}>PIN을 잊으셨나요?</Text>
            </TouchableOpacity>

            {/* 로그인 버튼 */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              <LinearGradient
                colors={loading ? ['#CCC', '#999'] : ['#28A745', '#20C997']}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="log-in" size={24} color="white" />
                    <Text style={styles.submitText}>로그인</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* 생체 인증 버튼 */}
            {biometricAvailable && biometricEnabled && (
              <TouchableOpacity
                style={styles.biometricButton}
                onPress={handleBiometricLogin}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#6F42C1', '#8A2BE2']}
                  style={styles.submitGradient}
                >
                  <Ionicons 
                    name={biometricType.includes('얼굴') ? 'scan' : 'finger-print'} 
                    size={24} 
                    color="white" 
                  />
                  <Text style={styles.submitText}>{biometricType}으로 로그인</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* 구분선 */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>또는</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* 회원가입 버튼 */}
            <TouchableOpacity
              style={styles.signupButton}
              onPress={goToSignUp}
            >
              <LinearGradient
                colors={['#FD7E14', '#FF6B35']}
                style={styles.submitGradient}
              >
                <Ionicons name="person-add" size={24} color="white" />
                <Text style={styles.submitText}>새 계정 만들기</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerSection: {
    margin: 20,
    marginBottom: 30,
  },
  headerGradient: {
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 12,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  formSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    paddingVertical: 12,
  },
  forgotPinButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPinText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  submitButton: {
    marginBottom: 16,
  },
  biometricButton: {
    marginBottom: 16,
  },
  signupButton: {
    marginTop: 8,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
}); 