import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../contexts/AppContext';
import { biometricAuthManager } from '../utils/biometricAuth';

export default function SettingsScreen() {
  const { state, logout, requestSync } = useApp();
  const [notifications, setNotifications] = React.useState(true);
  const [biometric, setBiometric] = React.useState(false);
  const [autoConvert, setAutoConvert] = React.useState(true);
  
  // 생체 인증 관련 상태
  const [biometricStatus, setBiometricStatus] = React.useState<{
    isAvailable: boolean;
    isEnabled: boolean;
    statusMessage: string;
    supportedTypes: string[];
  }>({
    isAvailable: false,
    isEnabled: false,
    statusMessage: '확인 중...',
    supportedTypes: []
  });
  const [biometricLoading, setBiometricLoading] = React.useState(false);

  // 생체 인증 상태 로드
  const loadBiometricStatus = async () => {
    try {
      const status = await biometricAuthManager.getStatus();
      
      setBiometricStatus({
        isAvailable: status.capabilities.isAvailable,
        isEnabled: status.settings.isEnabled,
        statusMessage: status.statusMessage,
        supportedTypes: status.capabilities.supportedTypeNames
      });
      
      setBiometric(status.settings.isEnabled);
      
    } catch (error) {
      console.error('생체 인증 상태 로드 실패:', error);
      setBiometricStatus(prev => ({
        ...prev,
        statusMessage: '상태 확인 실패'
      }));
    }
  };

  // 생체 인증 토글
  const handleBiometricToggle = async (enabled: boolean) => {
    if (biometricLoading) return;
    
    setBiometricLoading(true);
    
    try {
      if (enabled) {
        // 생체 인증 활성화
        const result = await biometricAuthManager.enableBiometric();
        
        if (result.success) {
          setBiometric(true);
          Alert.alert('✅ 성공', '생체 인증이 활성화되었습니다.');
          await loadBiometricStatus(); // 상태 새로고침
        } else {
          Alert.alert('❌ 오류', result.error || '생체 인증 활성화에 실패했습니다.');
        }
      } else {
        // 생체 인증 비활성화 확인
        Alert.alert(
          '생체 인증 비활성화',
          '생체 인증을 비활성화하면 매번 PIN을 입력해야 합니다.\n정말 비활성화하시겠습니까?',
          [
            { text: '취소', style: 'cancel' },
            { 
              text: '비활성화', 
              style: 'destructive',
              onPress: async () => {
                try {
                  await biometricAuthManager.disableBiometric();
                  setBiometric(false);
                  Alert.alert('✅ 완료', '생체 인증이 비활성화되었습니다.');
                  await loadBiometricStatus(); // 상태 새로고침
                } catch (error) {
                  Alert.alert('❌ 오류', '비활성화 중 오류가 발생했습니다.');
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('생체 인증 토글 실패:', error);
      Alert.alert('❌ 오류', '설정 변경 중 오류가 발생했습니다.');
    } finally {
      setBiometricLoading(false);
    }
  };

  // 생체 인증 상세 정보 표시
  const showBiometricInfo = () => {
    const { isAvailable, statusMessage, supportedTypes } = biometricStatus;
    
    let message = `상태: ${statusMessage}`;
    
    if (isAvailable && supportedTypes.length > 0) {
      message += `\n\n지원되는 인증 방식:\n${supportedTypes.map(type => `• ${type}`).join('\n')}`;
      message += '\n\n보안 기능:\n• 24시간마다 PIN 확인\n• 실패 시 자동 PIN 입력 전환\n• 앱 재시작 시 빠른 로그인';
    }
    
    if (!isAvailable) {
      if (statusMessage.includes('등록')) {
        message += '\n\n기기 설정 > 생체 인증에서 지문이나 얼굴을 등록해주세요.';
      } else if (statusMessage.includes('지원하지 않는')) {
        message += '\n\n이 기기는 생체 인증을 지원하지 않습니다.';
      }
    }
    
    const buttons = isAvailable && biometricStatus.isEnabled 
      ? [
          { text: '고급 설정', onPress: showAdvancedBiometricSettings },
          { text: '확인' }
        ]
      : [{ text: '확인' }];
    
    Alert.alert('생체 인증 정보', message, buttons);
  };

  // 고급 생체 인증 설정
  const showAdvancedBiometricSettings = () => {
    Alert.alert(
      '고급 생체 인증 설정',
      '생체 인증 실패 시 어떻게 하시겠습니까?',
      [
        {
          text: 'PIN 입력 허용',
          onPress: async () => {
            try {
              const settings = await biometricAuthManager.getSettings();
              settings.requirePinFallback = true;
              settings.fallbackLabel = 'PIN 사용';
              await biometricAuthManager.saveSettings(settings);
              Alert.alert('설정 완료', 'PIN 입력 fallback이 활성화되었습니다.');
              await loadBiometricStatus();
            } catch (error) {
              Alert.alert('오류', '설정 저장에 실패했습니다.');
            }
          }
        },
        {
          text: '생체 인증만 허용',
          onPress: async () => {
            try {
              const settings = await biometricAuthManager.getSettings();
              settings.requirePinFallback = false;
              await biometricAuthManager.saveSettings(settings);
              Alert.alert('설정 완료', '생체 인증만 허용됩니다.');
              await loadBiometricStatus();
            } catch (error) {
              Alert.alert('오류', '설정 저장에 실패했습니다.');
            }
          }
        },
        { text: '취소', style: 'cancel' }
      ]
    );
  };

  // 컴포넌트 마운트 시 생체 인증 상태 로드
  React.useEffect(() => {
    loadBiometricStatus();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { text: '로그아웃', style: 'destructive', onPress: async () => {
          try {
            await logout();
            Alert.alert('로그아웃 완료', '성공적으로 로그아웃되었습니다.');
          } catch (error) {
            Alert.alert('오류', '로그아웃 중 오류가 발생했습니다.');
          }
        }}
      ]
    );
  };

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    rightComponent,
    showArrow = true 
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightComponent?: React.ReactNode;
    showArrow?: boolean;
  }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon as any} size={20} color="#007AFF" />
      </View>
      
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      
      {rightComponent || (showArrow && (
        <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
      ))}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 사용자 프로필 카드 */}
      <LinearGradient
        colors={['#007AFF', '#0051D0']}
        style={styles.profileCard}
      >
        <View style={styles.profileIcon}>
          <Text style={styles.profileInitials}>
            {state.user?.firstName?.charAt(0)}{state.user?.lastName?.charAt(0)}
          </Text>
        </View>
        
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {state.user?.firstName} {state.user?.lastName}
          </Text>
          <Text style={styles.profileEmail}>{state.user?.email}</Text>
          <View style={styles.profileBadge}>
            <Ionicons name="checkmark-circle" size={12} color="white" />
            <Text style={styles.profileBadgeText}>인증 완료</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.editButton}>
          <Ionicons name="create-outline" size={20} color="white" />
        </TouchableOpacity>
      </LinearGradient>

      {/* 계정 설정 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>계정</Text>
        
        <SettingItem
          icon="person-outline"
          title="개인정보"
          subtitle="이름, 이메일, 전화번호"
          onPress={() => console.log('개인정보')}
        />
        
        <SettingItem
          icon="shield-checkmark-outline"
          title="보안 설정"
          subtitle="PIN, 생체인증, 2단계 인증"
          onPress={() => console.log('보안 설정')}
        />
        
        <SettingItem
          icon="card-outline"
          title="결제 방법"
          subtitle="카드, 은행 계좌 관리"
          onPress={() => console.log('결제 방법')}
        />
        
        <SettingItem
          icon="wallet-outline"
          title="지갑 관리"
          subtitle="지갑 추가, 백업, 복구"
          onPress={() => console.log('지갑 관리')}
        />
      </View>

      {/* 앱 설정 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>앱 설정</Text>
        
        <SettingItem
          icon="notifications-outline"
          title="알림"
          subtitle="거래, 보안, 마케팅 알림"
          rightComponent={
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#E9ECEF', true: '#007AFF' }}
              thumbColor="white"
            />
          }
          showArrow={false}
        />
        
        <SettingItem
          icon="finger-print"
          title="생체인증"
          subtitle={biometricStatus.statusMessage}
          onPress={showBiometricInfo}
          rightComponent={
            <Switch
              value={biometric}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: '#E9ECEF', true: '#007AFF' }}
              thumbColor="white"
              disabled={!biometricStatus.isAvailable || biometricLoading}
            />
          }
          showArrow={true}
        />
        
        <SettingItem
          icon="sync"
          title="데이터 동기화"
          subtitle="서버와 로컬 데이터 동기화"
          onPress={async () => {
            try {
              await requestSync();
              Alert.alert('동기화 완료', '데이터 동기화가 완료되었습니다.');
            } catch (error) {
              Alert.alert('동기화 실패', '데이터 동기화 중 오류가 발생했습니다.');
            }
          }}
        />
        
        <SettingItem
          icon="swap-horizontal-outline"
          title="자동 환전"
          subtitle="결제 시 자동 USDC 변환"
          rightComponent={
            <Switch
              value={autoConvert}
              onValueChange={setAutoConvert}
              trackColor={{ false: '#E9ECEF', true: '#007AFF' }}
              thumbColor="white"
            />
          }
          showArrow={false}
        />
        
        <SettingItem
          icon="globe-outline"
          title="언어"
          subtitle="한국어"
          onPress={() => console.log('언어 설정')}
        />
        
        <SettingItem
          icon="color-palette-outline"
          title="테마"
          subtitle="라이트 모드"
          onPress={() => console.log('테마 설정')}
        />
      </View>

      {/* 지원 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>지원</Text>
        
        <SettingItem
          icon="help-circle-outline"
          title="도움말"
          subtitle="자주 묻는 질문, 사용법"
          onPress={() => console.log('도움말')}
        />
        
        <SettingItem
          icon="chatbubble-outline"
          title="고객 지원"
          subtitle="24시간 채팅 상담"
          onPress={() => console.log('고객 지원')}
        />
        
        <SettingItem
          icon="document-text-outline"
          title="이용약관"
          subtitle="서비스 약관 및 개인정보 처리방침"
          onPress={() => console.log('이용약관')}
        />
        
        <SettingItem
          icon="star-outline"
          title="앱 평가"
          subtitle="App Store에서 평가하기"
          onPress={() => console.log('앱 평가')}
        />
      </View>

      {/* 개발자 정보 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>정보</Text>
        
        <SettingItem
          icon="information-circle-outline"
          title="앱 버전"
          subtitle="1.0.0 (빌드 001)"
          showArrow={false}
        />
        
        <SettingItem
          icon="shield-outline"
          title="라이선스"
          subtitle="오픈소스 라이선스"
          onPress={() => console.log('라이선스')}
        />
      </View>

      {/* 로그아웃 */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#DC3545" />
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>
      
      {/* 하단 여백 */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  profileIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInitials: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  profileBadgeText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginLeft: 20,
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC3545',
  },
  bottomSpacing: {
    height: 40,
  },
}); 