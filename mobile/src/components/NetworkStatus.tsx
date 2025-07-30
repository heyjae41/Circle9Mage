/**
 * 네트워크 상태 표시 컴포넌트
 * - 연결 상태 시각적 표시
 * - 오프라인 모드 안내
 * - 재연결 시도 버튼
 * - 네트워크 품질 표시
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { networkService, NetworkState } from '../services/networkService';
import { retryManager } from '../services/retryManager';

interface NetworkStatusProps {
  showDetails?: boolean;
  style?: any;
  onStatusPress?: () => void;
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({
  showDetails = false,
  style,
  onStatusPress
}) => {
  const [networkState, setNetworkState] = useState<NetworkState | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [animatedHeight] = useState(new Animated.Value(0));
  const [retryCount, setRetryCount] = useState(0);
  
  useEffect(() => {
    // 네트워크 상태 구독
    const unsubscribe = networkService.addListener((state: NetworkState) => {
      setNetworkState(state);
      
      // 재연결 시 카운터 리셋
      if (state.isConnected && state.isReachable) {
        setRetryCount(0);
      }
    });

    return unsubscribe;
  }, []);

  // 확장/축소 애니메이션
  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: isExpanded ? 120 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isExpanded, animatedHeight]);

  const getStatusIcon = (): string => {
    if (!networkState) return 'help-circle';
    
    if (networkState.isConnected && networkState.isReachable) {
      switch (networkState.connectionQuality) {
        case 'excellent': return 'wifi';
        case 'good': return 'wifi-outline';
        case 'poor': return 'cellular-outline';
        default: return 'globe-outline';
      }
    }
    
    return 'cloud-offline';
  };

  const getStatusColor = (): string => {
    if (!networkState) return '#666';
    
    if (networkState.isConnected && networkState.isReachable) {
      switch (networkState.connectionQuality) {
        case 'excellent': return '#10B981';
        case 'good': return '#F59E0B';
        case 'poor': return '#EF4444';
        default: return '#6B7280';
      }
    }
    
    return '#EF4444';
  };

  const getStatusText = (): string => {
    if (!networkState) return '상태 확인 중';
    
    if (networkState.isConnected && networkState.isReachable) {
      const typeText = networkState.isWifi ? 'WiFi' : 
                      networkState.isCellular ? '모바일 데이터' : '인터넷';
      const qualityText = networkState.connectionQuality === 'excellent' ? '우수' :
                         networkState.connectionQuality === 'good' ? '양호' :
                         networkState.connectionQuality === 'poor' ? '불량' : '';
      
      return `${typeText} 연결됨${qualityText ? ` (${qualityText})` : ''}`;
    }
    
    return '오프라인';
  };

  const handleRetryConnection = async (): Promise<void> => {
    setRetryCount(prev => prev + 1);
    
    try {
      console.log('🔄 수동 연결 테스트 시도...');
      const testResult = await networkService.testConnection();
      
      if (testResult.success) {
        console.log('✅ 연결 테스트 성공');
      } else {
        console.log('❌ 연결 테스트 실패:', testResult.error);
      }
    } catch (error) {
      console.error('연결 테스트 오류:', error);
    }
  };

  const toggleExpanded = (): void => {
    setIsExpanded(!isExpanded);
    onStatusPress?.();
  };

  const getQueueInfo = () => {
    return retryManager.getQueueStatus();
  };

  if (!networkState) {
    return (
      <View style={[styles.container, styles.loading, style]}>
        <Ionicons name="help-circle" size={16} color="#666" />
        <Text style={styles.statusText}>네트워크 상태 확인 중...</Text>
      </View>
    );
  }

  const isOffline = !networkState.isConnected || !networkState.isReachable;
  const queueInfo = getQueueInfo();

  return (
    <View style={[styles.container, style]}>
      {/* 상태 바 */}
      <TouchableOpacity 
        style={[
          styles.statusBar,
          isOffline ? styles.offlineBar : styles.onlineBar
        ]}
        onPress={showDetails ? toggleExpanded : onStatusPress}
        activeOpacity={0.7}
      >
        <View style={styles.statusLeft}>
          <Ionicons 
            name={getStatusIcon()} 
            size={16} 
            color={getStatusColor()} 
          />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
          
          {/* 대기 중인 요청 표시 */}
          {queueInfo.totalRequests > 0 && (
            <View style={styles.queueBadge}>
              <Text style={styles.queueText}>{queueInfo.totalRequests}</Text>
            </View>
          )}
        </View>

        {showDetails && (
          <Ionicons 
            name={isExpanded ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color={getStatusColor()} 
          />
        )}
      </TouchableOpacity>

      {/* 상세 정보 (확장 시) */}
      {showDetails && (
        <Animated.View style={[styles.detailsContainer, { height: animatedHeight }]}>
          <View style={styles.detailsContent}>
            {/* 네트워크 정보 */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>연결 타입:</Text>
              <Text style={styles.detailValue}>
                {networkState.type} {networkState.isExpensive ? '(요금제)' : ''}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>연결 품질:</Text>
              <Text style={[styles.detailValue, { color: getStatusColor() }]}>
                {networkState.connectionQuality}
              </Text>
            </View>

            {/* 대기 중인 요청 정보 */}
            {queueInfo.totalRequests > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>대기 요청:</Text>
                <Text style={styles.detailValue}>
                  {queueInfo.totalRequests}개 
                  {queueInfo.processingRequests > 0 && ` (처리 중: ${queueInfo.processingRequests}개)`}
                </Text>
              </View>
            )}

            {/* 오프라인 액션 */}
            {isOffline && (
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={handleRetryConnection}
                disabled={retryCount > 3}
              >
                <LinearGradient
                  colors={retryCount > 3 ? ['#9CA3AF', '#6B7280'] : ['#3B82F6', '#1D4ED8']}
                  style={styles.retryGradient}
                >
                  <Ionicons name="refresh" size={16} color="white" />
                  <Text style={styles.retryText}>
                    {retryCount > 3 ? '재시도 제한 초과' : `연결 재시도 ${retryCount > 0 ? `(${retryCount})` : ''}`}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
};

// 오프라인 모드 전체 화면 안내
export const OfflineModal: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  const [networkState, setNetworkState] = useState<NetworkState | null>(null);
  
  useEffect(() => {
    const unsubscribe = networkService.addListener(setNetworkState);
    return unsubscribe;
  }, []);

  if (!visible) return null;

  const isOnline = networkState?.isConnected && networkState?.isReachable;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Ionicons 
            name={isOnline ? "wifi" : "cloud-offline"} 
            size={48} 
            color={isOnline ? "#10B981" : "#EF4444"} 
          />
          <Text style={styles.modalTitle}>
            {isOnline ? "인터넷 연결됨!" : "인터넷 연결 없음"}
          </Text>
        </View>

        <View style={styles.modalBody}>
          {isOnline ? (
            <Text style={styles.modalDescription}>
              인터넷에 다시 연결되었습니다.{'\n'}
              대기 중인 작업들이 자동으로 처리됩니다.
            </Text>
          ) : (
            <>
              <Text style={styles.modalDescription}>
                현재 인터넷에 연결되어 있지 않습니다.{'\n'}
                다음 기능들은 제한적으로 이용 가능합니다:
              </Text>
              
              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.featureText}>저장된 계정 정보 조회</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.featureText}>최근 거래 내역 보기</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.featureText}>지갑 주소 복사</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                  <Text style={[styles.featureText, styles.disabledText]}>새 결제 요청</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                  <Text style={[styles.featureText, styles.disabledText]}>실시간 환율 조회</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.modalButton} onPress={onClose}>
          <Text style={styles.modalButtonText}>확인</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    minHeight: 48,
  },
  onlineBar: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  offlineBar: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  queueBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  queueText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailsContainer: {
    overflow: 'hidden',
  },
  detailsContent: {
    padding: 16,
    paddingTop: 0,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  retryButton: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  retryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // 모달 스타일
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: Math.min(screenWidth - 40, 340),
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 12,
    textAlign: 'center',
  },
  modalBody: {
    width: '100%',
    marginBottom: 24,
  },
  modalDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  disabledText: {
    color: '#9CA3AF',
  },
  modalButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 120,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default NetworkStatus;