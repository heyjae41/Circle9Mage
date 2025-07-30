import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// 화면 임포트
import HomeScreen from './src/screens/HomeScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import SendScreen from './src/screens/SendScreen';
import DepositScreen from './src/screens/DepositScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import LoginScreen from './src/screens/LoginScreen';

// 컴포넌트 임포트
import TokenExpiredModal from './src/components/TokenExpiredModal';
import { OfflineModal } from './src/components/NetworkStatus';

// 컨텍스트 임포트
import { AppProvider, useApp } from './src/contexts/AppContext';

const Tab = createBottomTabNavigator();

// 인증된 사용자를 위한 메인 앱
function AuthenticatedApp() {
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
                title: '결제',
                headerTitle: 'QR 결제'
              }}
            />
            <Tab.Screen 
              name="Send" 
              component={SendScreen} 
              options={{
                title: '송금',
                headerTitle: '크로스체인 송금'
              }}
            />
            <Tab.Screen 
              name="Deposit" 
              component={DepositScreen} 
              options={{
                title: '충전',
                headerTitle: 'USDC 충전'
              }}
            />
            <Tab.Screen 
              name="History" 
              component={HistoryScreen} 
              options={{
                title: '내역',
                headerTitle: '거래 내역'
              }}
            />
                        <Tab.Screen 
              name="Profile" 
              component={ProfileScreen} 
              options={{
                title: '프로필',
                headerTitle: '프로필 & KYC'
              }}
            />
          </Tab.Navigator>
  );
}

// 인증되지 않은 사용자를 위한 앱 (로그인/회원가입)
function UnauthenticatedApp() {
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
          title: '로그인',
          headerTitle: '로그인'
        }}
      />
      <UnauthTab.Screen 
        name="SignUp" 
        component={SignUpScreen} 
        options={{
          title: '회원가입',
          headerTitle: '회원가입'
        }}
      />
    </UnauthTab.Navigator>
  );
}

// 앱 내비게이션 관리자
function AppNavigator() {
  const { state, hideTokenExpiredModal, hideOfflineModal } = useApp();
  
  return (
    <>
      {/* 인증 상태에 따라 다른 네비게이션 표시 */}
      {state.isAuthenticated && state.user ? (
        <AuthenticatedApp />
      ) : (
        <UnauthenticatedApp />
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
    </>
  );
}

// 메인 App 컴포넌트
export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <AppNavigator />
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}
