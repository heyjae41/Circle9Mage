import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import { safeToFixed } from '../utils/formatters';

interface ChainWallet {
  chainName: string;
  balance: number;
  address: string;
  walletId: string;
  chainId: number;
}

interface ChainWalletCardProps {
  wallet: ChainWallet;
  isBalanceHidden: boolean;
  onCopyAddress: (address: string, chainName: string) => void;
  onCrossChainSend: (fromChain: string, walletId: string) => void;
}

const ChainWalletCard: React.FC<ChainWalletCardProps> = ({
  wallet,
  isBalanceHidden,
  onCopyAddress,
  onCrossChainSend,
}) => {
  const { t } = useTranslation();

  // 체인별 설정
  const getChainConfig = (chainName: string) => {
    switch (chainName.toLowerCase()) {
      case 'ethereum':
        return {
          icon: 'diamond-outline',
          colors: ['#627EEA', '#4A90E2'],
          bgColor: '#F0F4FF',
          name: t('chains.ethereum', { defaultValue: 'Ethereum' }),
          shortName: 'ETH',
        };
      case 'base':
        return {
          icon: 'business-outline',
          colors: ['#0052FF', '#1976D2'],
          bgColor: '#F0F7FF',
          name: t('chains.base', { defaultValue: 'Base' }),
          shortName: 'BASE',
        };
      default:
        return {
          icon: 'link-outline',
          colors: ['#6C757D', '#495057'],
          bgColor: '#F8F9FA',
          name: chainName,
          shortName: chainName.toUpperCase().slice(0, 4),
        };
    }
  };

  const chainConfig = getChainConfig(wallet.chainName);

  const handleCrossChainSend = () => {
    Alert.alert(
      t('chains.crossChainSend', { defaultValue: '크로스체인 송금' }),
      t('chains.selectTarget', { 
        defaultValue: '{{chain}}에서 다른 체인으로 송금하시겠습니까?',
        chain: chainConfig.name 
      }),
      [
        {
          text: t('common.cancel', { defaultValue: '취소' }),
          style: 'cancel',
        },
        {
          text: t('common.confirm', { defaultValue: '확인' }),
          onPress: () => onCrossChainSend(wallet.chainName, wallet.walletId),
        },
      ]
    );
  };

  return (
    <View style={[styles.cardContainer, { backgroundColor: chainConfig.bgColor }]}>
      {/* 체인 헤더 */}
      <View style={styles.cardHeader}>
        <View style={styles.chainInfo}>
                  <LinearGradient
          colors={chainConfig.colors as [string, string]}
          style={styles.chainIconContainer}
        >
            <Ionicons 
              name={chainConfig.icon as any}
              size={20} 
              color="white" 
            />
          </LinearGradient>
          <View style={styles.chainTextInfo}>
            <Text style={styles.chainName}>{chainConfig.name}</Text>
            <Text style={styles.chainShortName}>{chainConfig.shortName}</Text>
          </View>
        </View>
        
        {/* 크로스체인 송금 버튼 */}
        <TouchableOpacity
          style={styles.crossChainButton}
          onPress={handleCrossChainSend}
        >
          <Ionicons name="swap-horizontal" size={16} color={chainConfig.colors[0]} />
        </TouchableOpacity>
      </View>

      {/* 잔액 표시 */}
      <View style={styles.balanceSection}>
        <Text style={styles.balanceAmount}>
          {isBalanceHidden ? '••••••' : `$${safeToFixed(wallet.balance)}`}
        </Text>
        <Text style={styles.balanceCurrency}>USDC</Text>
      </View>

      {/* 지갑 주소 */}
      <TouchableOpacity 
        style={styles.addressSection}
        onPress={() => onCopyAddress(wallet.address, wallet.chainName)}
      >
        <Ionicons name="wallet-outline" size={14} color="#666" />
        <Text style={styles.walletAddress}>
          {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
        </Text>
        <Ionicons name="copy-outline" size={14} color="#666" />
      </TouchableOpacity>

      {/* 체인 상태 인디케이터 */}
      <View style={styles.statusSection}>
        <View style={[styles.statusDot, { backgroundColor: chainConfig.colors[0] }]} />
        <Text style={styles.statusText}>
          {t('common.active', { defaultValue: '활성' })}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginVertical: 8,
    marginHorizontal: 4,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chainIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chainTextInfo: {
    flex: 1,
  },
  chainName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  chainShortName: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  crossChainButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  balanceSection: {
    alignItems: 'center',
    marginVertical: 12,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  balanceCurrency: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  addressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  walletAddress: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginHorizontal: 8,
    flex: 1,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
});

export default ChainWalletCard;
