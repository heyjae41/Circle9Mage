import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// i18n 초기화 (반드시 다른 컴포넌트보다 먼저 import)
import './src/i18n';
import { useTranslation } from 'react-i18next';

// 화면 임포트
import HomeScreen from './src/screens/HomeScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import SendScreen from './src/screens/SendScreen';
import DepositScreen from './src/screens/DepositScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import LoginScreen from './src/screens/LoginScreen';
import AIAssistantScreen from './src/screens/AIAssistantScreen';

// 컴포넌트 임포트
import TokenExpiredModal from './src/components/TokenExpiredModal';
import { OfflineModal } from './src/components/NetworkStatus';
import BottomNotification from './src/components/BottomNotification';

// 컨텍스트 임포트
import { AppProvider, useApp } from './src/contexts/AppContext';

const Tab = createBottomTabNavigator();

// 인증된 사용자를 위한 메인 앱
function AuthenticatedApp({ t }: { t: any }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Payment') {
            iconName = focused ? 'qr-code' : 'qr-code-outline';
          } else if (route.name === 'Send') {
            iconName = focused ? 'send' : 'send-outline';
          } else if (route.name === 'Deposit') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'AIAssistant') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'SignUp') {
            iconName = focused ? 'person-add' : 'person-add-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#007AFF',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{
          title: 'CirclePay',
          headerTitle: 'CirclePay Global'
        }}
      />
      <Tab.Screen 
        name="Payment" 
        component={PaymentScreen} 
        options={{
          title: t('navigation.payment'),
          headerTitle: t('headers.qrPayment')
        }}
      />
      <Tab.Screen 
        name="Send" 
        component={SendScreen} 
        options={{
          title: t('navigation.send'),
          headerTitle: t('headers.crossChainSend')
        }}
      />
      <Tab.Screen 
        name="Deposit" 
        component={DepositScreen} 
        options={{
          title: t('navigation.deposit'),
          headerTitle: t('headers.usdcDeposit')
        }}
      />
      <Tab.Screen 
        name="History" 
        component={HistoryScreen} 
        options={{
          title: t('navigation.history'),
          headerTitle: t('headers.transactionHistory')
        }}
      />
      <Tab.Screen 
        name="AIAssistant" 
        component={AIAssistantScreen} 
        options={{
          title: t('navigation.aiAssistant'),
          headerTitle: t('headers.aiAssistant')
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{
          title: t('navigation.profile'),
          headerTitle: t('headers.profileKyc')
        }}
      />
    </Tab.Navigator>
  );
}

// 인증되지 않은 사용자를 위한 앱 (로그인/회원가입)
function UnauthenticatedApp({ t }: { t: any }) {
  const UnauthTab = createBottomTabNavigator();
  
  return (
    <UnauthTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Login') {
            iconName = focused ? 'log-in' : 'log-in-outline';
          } else if (route.name === 'SignUp') {
            iconName = focused ? 'person-add' : 'person-add-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#007AFF',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <UnauthTab.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{
          title: t('navigation.login'),
          headerTitle: t('navigation.login')
        }}
      />
      <UnauthTab.Screen 
        name="SignUp" 
        component={SignUpScreen} 
        options={{
          title: t('navigation.signUp'),
          headerTitle: t('navigation.signUp')
        }}
      />
    </UnauthTab.Navigator>
  );
}

// 앱 내비게이션 관리자
function AppNavigator() {
  const { t } = useTranslation();
  
  return (
    <AppProvider>
      <AppNavigatorContent t={t} />
    </AppProvider>
  );
}

// AppProvider 내부에서 사용할 컴포넌트
function AppNavigatorContent({ t }: { t: any }) {
  const { state, dispatch, hideTokenExpiredModal, hideOfflineModal } = useApp();
  
  // 상태 변경 로깅 (디버깅용)
  React.useEffect(() => {
    console.log('🔄 AppNavigator 상태 업데이트:', {
      isAuthenticated: state.isAuthenticated,
      hasUser: !!state.user,
      userName: state.user?.email || 'none',
      tokenExpiredModalVisible: state.tokenExpiredModal.visible
    });
  }, [state.isAuthenticated, state.user, state.tokenExpiredModal.visible]);
  
  const shouldShowAuthenticatedApp = state.isAuthenticated && state.user;
  
  console.log('🎯 AppNavigator 렌더링:', {
    shouldShowAuthenticatedApp,
    currentScreen: shouldShowAuthenticatedApp ? 'AuthenticatedApp' : 'UnauthenticatedApp'
  });
  
  return (
    <>
      {/* 인증 상태에 따라 다른 네비게이션 표시 */}
      {shouldShowAuthenticatedApp ? (
        <AuthenticatedApp t={t} />
      ) : (
        <UnauthenticatedApp t={t} />
      )}
      
      {/* 토큰 만료 모달 */}
      <TokenExpiredModal
        visible={state.tokenExpiredModal.visible}
        onClose={hideTokenExpiredModal}
        reason={state.tokenExpiredModal.reason}
        autoRetryCount={state.tokenExpiredModal.autoRetryCount}
      />
      
      {/* 오프라인 모달 */}
      <OfflineModal
        visible={state.offlineModal.visible}
        onClose={hideOfflineModal}
      />
      
      {/* CCTP 실시간 알림 - 유효한 알림이 있을 때만 표시 */}
      {state.cctpNotification.notification && (
        <BottomNotification
          visible={!!state.cctpNotification.notification}
          notification={state.cctpNotification.notification}
          onClose={() => dispatch({ type: 'HIDE_CCTP_NOTIFICATION' })}
        />
      )}
    </>
  );
}

// 메인 App 컴포넌트
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
