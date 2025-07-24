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
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// 컨텍스트 임포트
import { AppProvider } from './src/contexts/AppContext';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
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
                } else if (route.name === 'History') {
                  iconName = focused ? 'list' : 'list-outline';
                } else if (route.name === 'Settings') {
                  iconName = focused ? 'settings' : 'settings-outline';
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
              name="History" 
              component={HistoryScreen} 
              options={{
                title: '내역',
                headerTitle: '거래 내역'
              }}
            />
            <Tab.Screen 
              name="Settings" 
              component={SettingsScreen} 
              options={{
                title: '설정',
                headerTitle: '설정'
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}
