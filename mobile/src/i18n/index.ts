/**
 * i18n 국제화 설정
 * React Native + Expo 환경에서 react-i18next 사용
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

// 번역 파일 import
import ko from './locales/ko.json';
import en from './locales/en.json';
import zh from './locales/zh.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import es from './locales/es.json';
import hi from './locales/hi.json';
import ja from './locales/ja.json';

const resources = {
  ko: { translation: ko },
  en: { translation: en },
  zh: { translation: zh },
  ar: { translation: ar },
  fr: { translation: fr },
  de: { translation: de },
  es: { translation: es },
  hi: { translation: hi },
  ja: { translation: ja },
};

// 기기의 기본 언어 감지
const deviceLanguage = Localization.locale?.split('-')[0] || 'ko';
const supportedLanguages = ['ko', 'en', 'zh', 'ar', 'fr', 'de', 'es', 'hi', 'ja'];
const defaultLanguage = supportedLanguages.includes(deviceLanguage) ? deviceLanguage : 'ko';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // 기본값을 영어로 고정 (사용자 선택 언어는 AppContext에서 관리)
    fallbackLng: 'en', // 번역이 없을 경우 영어로 폴백
    
    // React Native 호환성 설정
    compatibilityJSON: 'v3',
    
    // 추가 호환성 설정
    pluralSeparator: '_',
    contextSeparator: '_',
    
    interpolation: {
      escapeValue: false, // React에서는 XSS 보호가 기본 제공됨
    },
    
    // 디버그 모드 (개발 환경에서만)
    debug: __DEV__,
    
    // 캐싱 설정
    cache: {
      enabled: true,
    },
    
    // 네임스페이스 설정
    defaultNS: 'translation',
    ns: ['translation'],
  });

export default i18n;

// 지원하는 언어 목록과 정보
export const supportedLanguagesInfo = [
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
];

// RTL 언어 체크 함수
export const isRTLLanguage = (languageCode: string): boolean => {
  return languageCode === 'ar';
};
