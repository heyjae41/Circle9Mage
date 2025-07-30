/**
 * 생체 인증 관리 유틸리티
 * - 생체 인증 가능 여부 확인
 * - 생체 인증 설정 관리
 * - 인증 프로세스 처리
 * - 보안 정책 관리
 */

import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BiometricCapabilities {
  isAvailable: boolean;
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  supportedTypeNames: string[];
}

export interface BiometricSettings {
  isEnabled: boolean;
  requirePinFallback: boolean;
  promptMessage: string;
  cancelLabel: string;
  fallbackLabel: string;
}

export class BiometricAuthManager {
  private static readonly STORAGE_KEY = 'biometric_settings';
  private static readonly LAST_AUTH_KEY = 'last_biometric_auth';
  
  private capabilities: BiometricCapabilities | null = null;

  /**
   * 생체 인증 가능 여부 확인
   */
  async checkCapabilities(): Promise<BiometricCapabilities> {
    try {
      // 하드웨어 지원 여부
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      
      // 생체 정보 등록 여부
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      // 지원되는 인증 방식
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      const capabilities: BiometricCapabilities = {
        isAvailable: hasHardware && isEnrolled,
        hasHardware,
        isEnrolled,
        supportedTypes,
        supportedTypeNames: this.getAuthenticationTypeNames(supportedTypes)
      };

      this.capabilities = capabilities;
      
      console.log('🔐 생체 인증 기능 확인:', {
        hasHardware,
        isEnrolled,
        supportedTypes: capabilities.supportedTypeNames
      });

      return capabilities;
    } catch (error) {
      console.error('생체 인증 기능 확인 실패:', error);
      
      const fallbackCapabilities: BiometricCapabilities = {
        isAvailable: false,
        hasHardware: false,
        isEnrolled: false,
        supportedTypes: [],
        supportedTypeNames: []
      };
      
      this.capabilities = fallbackCapabilities;
      return fallbackCapabilities;
    }
  }

  /**
   * 인증 방식 이름 변환
   */
  private getAuthenticationTypeNames(types: LocalAuthentication.AuthenticationType[]): string[] {
    const typeNames: string[] = [];
    
    types.forEach(type => {
      switch (type) {
        case LocalAuthentication.AuthenticationType.FINGERPRINT:
          typeNames.push('지문 인식');
          break;
        case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
          typeNames.push('얼굴 인식');
          break;
        case LocalAuthentication.AuthenticationType.IRIS:
          typeNames.push('홍채 인식');
          break;
        default:
          typeNames.push('생체 인증');
      }
    });
    
    return typeNames;
  }

  /**
   * 저장된 생체 인증 설정 조회
   */
  async getSettings(): Promise<BiometricSettings> {
    try {
      const stored = await AsyncStorage.getItem(BiometricAuthManager.STORAGE_KEY);
      
      if (stored) {
        return JSON.parse(stored);
      }
      
      // 기본 설정
      return this.getDefaultSettings();
    } catch (error) {
      console.error('생체 인증 설정 조회 실패:', error);
      return this.getDefaultSettings();
    }
  }

  /**
   * 생체 인증 설정 저장
   */
  async saveSettings(settings: BiometricSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(
        BiometricAuthManager.STORAGE_KEY,
        JSON.stringify(settings)
      );
      console.log('✅ 생체 인증 설정 저장 완료:', settings);
    } catch (error) {
      console.error('생체 인증 설정 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 기본 설정 반환
   */
  private getDefaultSettings(): BiometricSettings {
    return {
      isEnabled: false,
      requirePinFallback: true,
      promptMessage: '로그인을 위해 생체 인증을 사용해주세요',
      cancelLabel: '취소',
      fallbackLabel: 'PIN 입력'
    };
  }

  /**
   * 생체 인증 수행
   */
  async authenticate(customPrompt?: string): Promise<{
    success: boolean;
    error?: string;
    biometricType?: string;
  }> {
    try {
      // 기능 가용성 확인
      if (!this.capabilities) {
        await this.checkCapabilities();
      }

      if (!this.capabilities?.isAvailable) {
        return {
          success: false,
          error: '생체 인증을 사용할 수 없습니다'
        };
      }

      // 설정 확인
      const settings = await this.getSettings();
      if (!settings.isEnabled) {
        return {
          success: false,
          error: '생체 인증이 비활성화되어 있습니다'
        };
      }

      // 생체 인증 실행
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: customPrompt || settings.promptMessage,
        cancelLabel: settings.cancelLabel,
        fallbackLabel: settings.requirePinFallback ? settings.fallbackLabel : undefined,
        disableDeviceFallback: !settings.requirePinFallback,
        // 추가 보안 옵션
        requireConfirmation: false, // 빠른 인증을 위해 확인 비활성화
      });

      if (result.success) {
        // 마지막 인증 시간 저장
        await AsyncStorage.setItem(
          BiometricAuthManager.LAST_AUTH_KEY,
          Date.now().toString()
        );

        console.log('✅ 생체 인증 성공');
        
        return {
          success: true,
          biometricType: this.getPrimaryBiometricType()
        };
      } else {
        let errorMessage = '생체 인증에 실패했습니다';
        
        switch (result.error) {
          case 'app_cancel':
          case 'system_cancel':
            errorMessage = '사용자가 인증을 취소했습니다';
            break;
          case 'authentication_failed':
            errorMessage = '생체 인증에 실패했습니다. 다시 시도해주세요';
            break;
          case 'not_available':
            errorMessage = '생체 인증을 사용할 수 없습니다';
            break;
          case 'not_enrolled':
            errorMessage = '등록된 생체 정보가 없습니다';
            break;
          case 'passcode_not_set':
            errorMessage = '기기 잠금이 설정되어 있지 않습니다';
            break;
          case 'lockout':
            errorMessage = '너무 많은 실패로 인해 잠시 후 다시 시도해주세요';
            break;
          default:
            errorMessage = '생체 인증에 실패했습니다';
        }

        console.log('❌ 생체 인증 실패:', result.error);
        
        return {
          success: false,
          error: errorMessage
        };
      }
    } catch (error: any) {
      console.error('생체 인증 오류:', error);
      return {
        success: false,
        error: '생체 인증 중 오류가 발생했습니다'
      };
    }
  }

  /**
   * 주요 생체 인증 방식 반환
   */
  private getPrimaryBiometricType(): string {
    if (!this.capabilities?.supportedTypes.length) return '생체 인증';
    
    // 우선순위: 얼굴 인식 > 지문 인식 > 홍채 인식
    if (this.capabilities.supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return '얼굴 인식';
    }
    if (this.capabilities.supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return '지문 인식';
    }
    if (this.capabilities.supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return '홍채 인식';
    }
    
    return '생체 인증';
  }

  /**
   * 생체 인증 활성화
   */
  async enableBiometric(): Promise<{ success: boolean; error?: string }> {
    try {
      // 기능 확인
      const capabilities = await this.checkCapabilities();
      
      if (!capabilities.isAvailable) {
        return {
          success: false,
          error: capabilities.hasHardware 
            ? '생체 정보를 등록해주세요' 
            : '생체 인증을 지원하지 않는 기기입니다'
        };
      }

      // 테스트 인증 수행
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: '생체 인증을 활성화하려면 인증해주세요',
        cancelLabel: '취소',
        fallbackLabel: 'PIN 입력',
      });

      if (!authResult.success) {
        return {
          success: false,
          error: '생체 인증을 완료해야 활성화할 수 있습니다'
        };
      }

      // 설정 업데이트
      const settings = await this.getSettings();
      settings.isEnabled = true;
      await this.saveSettings(settings);

      console.log('✅ 생체 인증 활성화 완료');
      return { success: true };

    } catch (error: any) {
      console.error('생체 인증 활성화 실패:', error);
      return {
        success: false,
        error: '생체 인증 활성화 중 오류가 발생했습니다'
      };
    }
  }

  /**
   * 생체 인증 비활성화
   */
  async disableBiometric(): Promise<void> {
    try {
      const settings = await this.getSettings();
      settings.isEnabled = false;
      await this.saveSettings(settings);

      // 마지막 인증 시간 삭제
      await AsyncStorage.removeItem(BiometricAuthManager.LAST_AUTH_KEY);

      console.log('✅ 생체 인증 비활성화 완료');
    } catch (error) {
      console.error('생체 인증 비활성화 실패:', error);
      throw error;
    }
  }

  /**
   * 마지막 생체 인증 시간 조회
   */
  async getLastAuthTime(): Promise<number | null> {
    try {
      const lastAuth = await AsyncStorage.getItem(BiometricAuthManager.LAST_AUTH_KEY);
      return lastAuth ? parseInt(lastAuth, 10) : null;
    } catch (error) {
      console.error('마지막 인증 시간 조회 실패:', error);
      return null;
    }
  }

  /**
   * 생체 인증 사용 가능 여부 (설정 + 기능)
   */
  async isAvailableAndEnabled(): Promise<boolean> {
    try {
      const capabilities = await this.checkCapabilities();
      const settings = await this.getSettings();
      
      return capabilities.isAvailable && settings.isEnabled;
    } catch (error) {
      console.error('생체 인증 가능 여부 확인 실패:', error);
      return false;
    }
  }

  /**
   * 생체 인증 설정 정보 요약
   */
  async getStatus(): Promise<{
    capabilities: BiometricCapabilities;
    settings: BiometricSettings;
    isReady: boolean;
    statusMessage: string;
  }> {
    const capabilities = await this.checkCapabilities();
    const settings = await this.getSettings();
    
    let statusMessage = '';
    let isReady = false;

    if (!capabilities.hasHardware) {
      statusMessage = '생체 인증을 지원하지 않는 기기입니다';
    } else if (!capabilities.isEnrolled) {
      statusMessage = '생체 정보를 등록해주세요';
    } else if (!settings.isEnabled) {
      statusMessage = '생체 인증이 비활성화되어 있습니다';
    } else {
      statusMessage = `${capabilities.supportedTypeNames.join(', ')} 사용 가능`;
      isReady = true;
    }

    return {
      capabilities,
      settings,
      isReady,
      statusMessage
    };
  }
}

// 전역 생체 인증 관리자 인스턴스
export const biometricAuthManager = new BiometricAuthManager();