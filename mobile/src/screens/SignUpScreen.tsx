import React, { useState } from 'react';
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
import apiService from '../services/apiService';
import { useApp } from '../contexts/AppContext';
import CountryCodePicker from '../components/CountryCodePicker';
import { 
  COUNTRY_CODES, 
  CountryCode, 
  getCountryByCode, 
  cleanPhoneNumber, 
  validatePhoneNumber, 
  formatInternationalPhone 
} from '../utils/countryCodes';

interface SignUpData {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  selectedCountry: CountryCode;
  pin: string;
  confirmPin: string;
}

interface VerificationData {
  emailCode: string;
  phoneCode: string;
}

export default function SignUpScreen() {
  const navigation = useNavigation();
  const { setAuthToken } = useApp();
  
  // 폼 단계 관리
  const [currentStep, setCurrentStep] = useState<'form' | 'verification' | 'complete'>('form');
  const [loading, setLoading] = useState(false);
  
  // 회원가입 폼 데이터
  const [formData, setFormData] = useState<SignUpData>({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    countryCode: 'KR',
    selectedCountry: getCountryByCode('KR') || COUNTRY_CODES[0],
    pin: '',
    confirmPin: '',
  });
  
  // 인증 코드 데이터
  const [verificationData, setVerificationData] = useState<VerificationData>({
    emailCode: '',
    phoneCode: '',
  });
  
  // 회원가입 결과
  const [signUpResult, setSignUpResult] = useState<any>(null);

  // 이메일 유효성 검사
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 국가별 전화번호 유효성 검사
  const isValidPhone = (phone: string, countryCode: string) => {
    const cleanPhone = cleanPhoneNumber(phone);
    return validatePhoneNumber(cleanPhone, countryCode);
  };

  // 폼 유효성 검사
  const validateForm = (): boolean => {
    if (!formData.email || !isValidEmail(formData.email)) {
      Alert.alert('오류', '올바른 이메일 주소를 입력해주세요.');
      return false;
    }
    
    if (!formData.phone || !isValidPhone(formData.phone, formData.countryCode)) {
      const country = formData.selectedCountry;
      Alert.alert('오류', `올바른 전화번호를 입력해주세요.\n예시: ${country.placeholder}`);
      return false;
    }
    
    if (!formData.firstName.trim()) {
      Alert.alert('오류', '이름을 입력해주세요.');
      return false;
    }
    
    if (!formData.lastName.trim()) {
      Alert.alert('오류', '성을 입력해주세요.');
      return false;
    }
    
    if (!formData.pin || formData.pin.length < 6) {
      Alert.alert('오류', 'PIN은 6자리 이상이어야 합니다.');
      return false;
    }
    
    if (formData.pin !== formData.confirmPin) {
      Alert.alert('오류', 'PIN이 일치하지 않습니다.');
      return false;
    }
    
    return true;
  };

  // 회원가입 처리
  const handleSignUp = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // 전화번호를 국제 형식으로 변환 (숫자만 남기고 특수문자 제거)
      const formattedPhone = formatInternationalPhone(formData.phone, formData.countryCode);
      
      const response = await apiService.register({
        email: formData.email,
        phone: formattedPhone,
        first_name: formData.firstName,
        last_name: formData.lastName,
        country_code: formData.countryCode,
        pin: formData.pin,
        preferred_currency: 'USDC',
      });
      
      setSignUpResult(response);
      setCurrentStep('verification');
      
      Alert.alert(
        '회원가입 성공!',
        `이메일과 SMS로 인증 코드를 발송했습니다.\n지갑 생성 상태: ${response.wallet_creation_status}`,
        [{ text: '확인' }]
      );
      
    } catch (error: any) {
      Alert.alert('회원가입 실패', error.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 인증 코드 확인
  const handleVerification = async () => {
    if (!verificationData.emailCode || !verificationData.phoneCode) {
      Alert.alert('오류', '이메일과 SMS 인증 코드를 모두 입력해주세요.');
      return;
    }
    
    setLoading(true);
    
    try {
      // 이메일 인증
      await apiService.verifyEmail({
        email: formData.email,
        verification_code: verificationData.emailCode,
      });
      
      // SMS 인증
      const formattedPhone = formatInternationalPhone(formData.phone, formData.countryCode);
      const smsVerifyResponse = await apiService.verifyPhone({
        phone: formattedPhone,
        verification_code: verificationData.phoneCode,
      });
      
      // 자동 로그인 처리 확인
      if (smsVerifyResponse.auto_login && smsVerifyResponse.access_token) {
        console.log('🎉 자동 로그인 토큰 수신:', smsVerifyResponse);
        
        // AppContext에 토큰 설정 및 AsyncStorage에 저장
        await setAuthToken(smsVerifyResponse.access_token, smsVerifyResponse.refresh_token);
        
        setCurrentStep('complete');
        
        Alert.alert(
          '회원가입 완료!',
          '인증이 완료되었습니다! 환영합니다! 🎉',
          [{ text: '확인', onPress: () => {
            // 인증 상태가 변경되면 자동으로 홈화면으로 이동됩니다
            console.log('✅ 자동 로그인 완료, 홈 화면으로 이동 중...');
          }}]
        );
      } else {
        // 백엔드가 아직 자동 로그인을 지원하지 않는 경우 (fallback)
        setCurrentStep('complete');
        
        Alert.alert(
          '인증 완료!',
          '회원가입이 완료되었습니다. 로그인을 진행합니다.',
          [{ text: '확인', onPress: handleAutoLogin }]
        );
      }
      
    } catch (error: any) {
      Alert.alert('인증 실패', error.message || '인증 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 자동 로그인
  const handleAutoLogin = async () => {
    setLoading(true);
    
    try {
      const loginResponse = await apiService.login({
        email: formData.email,
        pin: formData.pin,
      });
      
      // AppContext에 토큰 설정 및 AsyncStorage에 저장
      await setAuthToken(loginResponse.access_token, loginResponse.refresh_token);
      
      Alert.alert('로그인 성공!', '환영합니다!', [
        { text: '확인', onPress: () => {
          // 인증 상태가 변경되면 자동으로 홈화면으로 이동됩니다
        }}
      ]);
      
    } catch (error: any) {
      Alert.alert('자동 로그인 실패', '수동으로 로그인해주세요.');
      // 로그인 탭으로 이동
      navigation.navigate('Login' as never);
    } finally {
      setLoading(false);
    }
  };

  // 개발용 인증 코드 가져오기
  const getDevVerificationCodes = async () => {
    if (!__DEV__) return;
    
    try {
      const emailCodeResult = await apiService.getDevVerificationCode(formData.email);
      const formattedPhone = formatInternationalPhone(formData.phone, formData.countryCode);
      const phoneCodeResult = await apiService.getDevVerificationCode(formattedPhone);
      
      setVerificationData({
        emailCode: emailCodeResult.code,
        phoneCode: phoneCodeResult.code,
      });
      
      Alert.alert(
        '개발용 인증 코드',
        `이메일 코드: ${emailCodeResult.code}\nSMS 코드: ${phoneCodeResult.code}`,
        [{ text: '확인' }]
      );
      
    } catch (error) {
      console.log('개발용 코드 가져오기 실패:', error);
    }
  };

  // 회원가입 폼 렌더링
  const renderSignUpForm = () => (
    <ScrollView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.headerSection}>
        <LinearGradient
          colors={['#007AFF', '#0051D0']}
          style={styles.headerGradient}
        >
          <Ionicons name="person-add" size={48} color="white" />
          <Text style={styles.headerTitle}>회원가입</Text>
          <Text style={styles.headerSubtitle}>
            CirclePay Global에 오신 것을 환영합니다
          </Text>
        </LinearGradient>
      </View>

      {/* 입력 폼 */}
      <View style={styles.formSection}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>이메일 주소</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="example@email.com"
              value={formData.email}
              onChangeText={(text) => setFormData({...formData, email: text})}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>전화번호</Text>
          <View style={styles.phoneInputContainer}>
            {/* 국가코드 선택 */}
            <CountryCodePicker
              selectedCountry={formData.selectedCountry}
              onCountrySelect={(country) => {
                setFormData({
                  ...formData,
                  selectedCountry: country,
                  countryCode: country.code,
                  phone: '' // 국가 변경 시 전화번호 초기화
                });
              }}
              style={styles.countryPicker}
            />
            
            {/* 전화번호 입력 */}
            <View style={styles.phoneInputWrapper}>
              <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.phoneTextInput}
                placeholder={formData.selectedCountry.placeholder}
                value={formData.phone}
                onChangeText={(text) => {
                  // 숫자, 하이픈, 공백만 허용
                  const filteredText = text.replace(/[^0-9\-\s]/g, '');
                  setFormData({...formData, phone: filteredText});
                }}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        <View style={styles.nameInputGroup}>
          <View style={styles.nameInput}>
            <Text style={styles.inputLabel}>성</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="김"
                value={formData.lastName}
                onChangeText={(text) => setFormData({...formData, lastName: text})}
              />
            </View>
          </View>

          <View style={styles.nameInput}>
            <Text style={styles.inputLabel}>이름</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="철수"
                value={formData.firstName}
                onChangeText={(text) => setFormData({...formData, firstName: text})}
              />
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>PIN 설정 (6자리 이상)</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="••••••"
              value={formData.pin}
              onChangeText={(text) => setFormData({...formData, pin: text})}
              secureTextEntry
              maxLength={20}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>PIN 확인</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="••••••"
              value={formData.confirmPin}
              onChangeText={(text) => setFormData({...formData, confirmPin: text})}
              secureTextEntry
              maxLength={20}
            />
          </View>
        </View>

        {/* 회원가입 버튼 */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSignUp}
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
                <Ionicons name="checkmark-circle" size={24} color="white" />
                <Text style={styles.submitText}>회원가입</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // 인증 코드 입력 화면 렌더링
  const renderVerificationForm = () => (
    <ScrollView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.headerSection}>
        <LinearGradient
          colors={['#FD7E14', '#FF6B35']}
          style={styles.headerGradient}
        >
          <Ionicons name="shield-checkmark" size={48} color="white" />
          <Text style={styles.headerTitle}>인증 코드 입력</Text>
          <Text style={styles.headerSubtitle}>
            이메일과 SMS로 발송된 코드를 입력해주세요
          </Text>
        </LinearGradient>
      </View>

      {/* 인증 코드 입력 */}
      <View style={styles.formSection}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>이메일 인증 코드</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="6자리 코드"
              value={verificationData.emailCode}
              onChangeText={(text) => setVerificationData({...verificationData, emailCode: text})}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>SMS 인증 코드</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="chatbubble" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="6자리 코드"
              value={verificationData.phoneCode}
              onChangeText={(text) => setVerificationData({...verificationData, phoneCode: text})}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>
        </View>

        {/* 개발용 코드 가져오기 버튼 */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.devButton}
            onPress={getDevVerificationCodes}
          >
            <Text style={styles.devButtonText}>🔧 개발용 코드 가져오기</Text>
          </TouchableOpacity>
        )}

        {/* 인증 완료 버튼 */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleVerification}
          disabled={loading}
        >
          <LinearGradient
            colors={loading ? ['#CCC', '#999'] : ['#007AFF', '#0051D0']}
            style={styles.submitGradient}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={24} color="white" />
                <Text style={styles.submitText}>인증 완료</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // 완료 화면 렌더링
  const renderCompleteScreen = () => (
    <View style={styles.container}>
      <View style={[styles.headerSection, { flex: 1, justifyContent: 'center' }]}>
        <LinearGradient
          colors={['#28A745', '#20C997']}
          style={[styles.headerGradient, { height: 300 }]}
        >
          <Ionicons name="checkmark-circle" size={80} color="white" />
          <Text style={[styles.headerTitle, { fontSize: 28 }]}>회원가입 완료!</Text>
          <Text style={styles.headerSubtitle}>
            환영합니다! 이제 CirclePay Global을 사용할 수 있습니다.
          </Text>
          
          {signUpResult?.wallet_creation_status === 'success' && (
            <View style={styles.walletInfo}>
              <Ionicons name="wallet" size={24} color="white" />
              <Text style={styles.walletText}>ETH 지갑이 자동으로 생성되었습니다</Text>
            </View>
          )}
        </LinearGradient>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {currentStep === 'form' && renderSignUpForm()}
        {currentStep === 'verification' && renderVerificationForm()}
        {currentStep === 'complete' && renderCompleteScreen()}
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
  
  // 전화번호 입력 전용 스타일
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countryPicker: {
    minWidth: 120,
    maxWidth: 140,
    flex: 0,
  },
  phoneInputWrapper: {
    flex: 1,
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
  phoneTextInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    paddingVertical: 12,
  },
  nameInputGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  nameInput: {
    flex: 0.48,
  },
  submitButton: {
    marginTop: 20,
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
  devButton: {
    backgroundColor: '#6C757D',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  devButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  walletText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 8,
  },
}); 