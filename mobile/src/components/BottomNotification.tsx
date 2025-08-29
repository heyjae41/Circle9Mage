/**
 * 하단 메시지 팝업 컴포넌트
 * CCTP V2 Hooks 실시간 알림을 위한 BottomSheet 스타일 컴포넌트
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CCTPNotification } from '../services/websocketService';
import { useTranslation } from 'react-i18next';

interface BottomNotificationProps {
  notification: CCTPNotification | null;
  visible: boolean;
  onClose: () => void;
  onPress?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

const BottomNotification: React.FC<BottomNotificationProps> = ({
  notification,
  visible,
  onClose,
  onPress
}) => {
  const { t } = useTranslation();
  const slideAnim = useRef(new Animated.Value(100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && notification) {
      // 나타날 때 애니메이션
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // 자동 숨김 타이머 (5초)
      const timer = setTimeout(() => {
        hideNotification();
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      hideNotification();
    }
  }, [visible, notification]);

  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'transfer_initiated':
      case 'transfer_incoming':
        return {
          backgroundColor: '#007AFF',
          borderColor: '#0056CC',
        };
      case 'transfer_pending':
        return {
          backgroundColor: '#FF9500',
          borderColor: '#CC7700',
        };
      case 'transfer_completed':
      case 'transfer_received':
        return {
          backgroundColor: '#34C759',
          borderColor: '#28A745',
        };
      case 'offline_notification':
        return {
          backgroundColor: '#8E8E93',
          borderColor: '#6D6D70',
        };
      default:
        return {
          backgroundColor: '#007AFF',
          borderColor: '#0056CC',
        };
    }
  };

  const formatAmount = (amount?: number) => {
    if (!amount) return '';
    return ` ${amount.toFixed(2)} USDC`;
  };

  const getIconName = (type: string): any => {
    switch (type) {
      case 'transfer_initiated':
        return 'paper-plane';
      case 'transfer_incoming':
        return 'download';
      case 'transfer_pending':
        return 'time';
      case 'transfer_completed':
        return 'checkmark-circle';
      case 'transfer_received':
        return 'cash';
      case 'offline_notification':
        return 'notifications-off';
      default:
        return 'information-circle';
    }
  };

  // 알림이 없거나 필수 필드가 누락된 경우 표시하지 않음
  if (!visible || !notification || !notification.title || !notification.message) {
    return null;
  }

  const notificationStyle = getNotificationStyle(notification.type);

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: opacityAnim,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.container,
          notificationStyle,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.content}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Text style={styles.emoji}>{notification.icon}</Text>
            <Ionicons
              name={getIconName(notification.type)}
              size={16}
              color="white"
              style={styles.statusIcon}
            />
          </View>

          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {notification.title}
              </Text>
              {notification.amount && (
                <Text style={styles.amount}>
                  {formatAmount(notification.amount)}
                </Text>
              )}
            </View>
            
            <Text style={styles.message} numberOfLines={2}>
              {notification.message}
            </Text>
            
            {notification.details && (
              <Text style={styles.details} numberOfLines={1}>
                {notification.details}
              </Text>
            )}

            {notification.is_offline && (
              <Text style={styles.offlineLabel}>
                📱 {t('common.offlineNotification', { defaultValue: '오프라인 알림' })}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={hideNotification}
          >
            <Ionicons name="close" size={20} color="white" />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* 진행 표시줄 (자동 숨김 시간) */}
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: Animated.timing(
                  new Animated.Value(screenWidth - 32),
                  {
                    toValue: 0,
                    duration: 5000,
                    useNativeDriver: false,
                  }
                ),
              },
            ]}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 1000,
    pointerEvents: 'box-none',
  },
  container: {
    marginHorizontal: 16,
    marginBottom: Platform.OS === 'ios' ? 34 : 16, // Safe Area 고려
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
  },
  iconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  emoji: {
    fontSize: 24,
  },
  statusIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 1,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  amount: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
    lineHeight: 18,
  },
  details: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
  },
  offlineLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
  progressContainer: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
});

export default BottomNotification;
