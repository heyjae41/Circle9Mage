/**
 * 글로벌 국가코드 및 전화번호 형식 정의
 * CirclePay Global 서비스를 위한 주요 국가들
 */

export interface CountryCode {
  code: string;        // ISO 국가코드 (KR, US, JP 등)
  name: string;        // 국가명
  dialCode: string;    // 국제전화 코드 (+82, +1 등)
  flag: string;        // 이모지 플래그
  phoneLength: number[]; // 허용되는 전화번호 길이 (지역번호 제외)
  placeholder: string; // 입력 예시
  searchKeywords?: string[]; // 추가 검색 키워드
}

export const COUNTRY_CODES: CountryCode[] = [
  // 주요 아시아 국가들
  {
    code: 'KR',
    name: '대한민국',
    dialCode: '+82',
    flag: '🇰🇷',
    phoneLength: [10, 11], // 01012345678 (11자리), 021234567 (9자리) 등
    placeholder: '01012345678',
    searchKeywords: ['korea', 'south korea', '82', '한국']
  },
  {
    code: 'JP',
    name: '일본',
    dialCode: '+81',
    flag: '🇯🇵',
    phoneLength: [10, 11],
    placeholder: '09012345678',
    searchKeywords: ['japan', '81']
  },
  {
    code: 'CN',
    name: '중국',
    dialCode: '+86',
    flag: '🇨🇳',
    phoneLength: [11],
    placeholder: '13812345678',
    searchKeywords: ['china', '86']
  },
  {
    code: 'SG',
    name: '싱가포르',
    dialCode: '+65',
    flag: '🇸🇬',
    phoneLength: [8],
    placeholder: '91234567',
    searchKeywords: ['singapore', '65']
  },
  {
    code: 'HK',
    name: '홍콩',
    dialCode: '+852',
    flag: '🇭🇰',
    phoneLength: [8],
    placeholder: '91234567',
    searchKeywords: ['hong kong', '852', 'hongkong']
  },
  {
    code: 'TH',
    name: '태국',
    dialCode: '+66',
    flag: '🇹🇭',
    phoneLength: [9],
    placeholder: '812345678',
    searchKeywords: ['thailand', '66']
  },
  {
    code: 'VN',
    name: '베트남',
    dialCode: '+84',
    flag: '🇻🇳',
    phoneLength: [9, 10],
    placeholder: '912345678',
    searchKeywords: ['vietnam', '84']
  },
  
  // 북미/남미
  {
    code: 'US',
    name: '미국',
    dialCode: '+1',
    flag: '🇺🇸',
    phoneLength: [10],
    placeholder: '2025551234',
    searchKeywords: ['usa', 'america', 'united states', '1', 'states']
  },
  {
    code: 'CA',
    name: '캐나다',
    dialCode: '+1',
    flag: '🇨🇦',
    phoneLength: [10],
    placeholder: '4165551234',
    searchKeywords: ['canada', '1']
  },
  {
    code: 'MX',
    name: '멕시코',
    dialCode: '+52',
    flag: '🇲🇽',
    phoneLength: [10],
    placeholder: '5512345678',
    searchKeywords: ['mexico', '52']
  },
  {
    code: 'BR',
    name: '브라질',
    dialCode: '+55',
    flag: '🇧🇷',
    phoneLength: [10, 11],
    placeholder: '11987654321',
    searchKeywords: ['brazil', '55']
  },
  
  // 유럽
  {
    code: 'GB',
    name: '영국',
    dialCode: '+44',
    flag: '🇬🇧',
    phoneLength: [10],
    placeholder: '7912345678',
    searchKeywords: ['uk', 'united kingdom', 'britain', 'england', '44']
  },
  {
    code: 'DE',
    name: '독일',
    dialCode: '+49',
    flag: '🇩🇪',
    phoneLength: [10, 11, 12],
    placeholder: '15123456789',
    searchKeywords: ['germany', '49', 'deutschland']
  },
  {
    code: 'FR',
    name: '프랑스',
    dialCode: '+33',
    flag: '🇫🇷',
    phoneLength: [9],
    placeholder: '612345678',
    searchKeywords: ['france', '33']
  },
  {
    code: 'IT',
    name: '이탈리아',
    dialCode: '+39',
    flag: '🇮🇹',
    phoneLength: [9, 10],
    placeholder: '3123456789',
    searchKeywords: ['italy', '39']
  },
  {
    code: 'ES',
    name: '스페인',
    dialCode: '+34',
    flag: '🇪🇸',
    phoneLength: [9],
    placeholder: '612345678',
    searchKeywords: ['spain', '34']
  },
  {
    code: 'NL',
    name: '네덜란드',
    dialCode: '+31',
    flag: '🇳🇱',
    phoneLength: [9],
    placeholder: '612345678',
    searchKeywords: ['netherlands', '31', 'holland']
  },
  {
    code: 'CH',
    name: '스위스',
    dialCode: '+41',
    flag: '🇨🇭',
    phoneLength: [9],
    placeholder: '791234567',
    searchKeywords: ['switzerland', '41']
  },
  
  // 오세아니아
  {
    code: 'AU',
    name: '호주',
    dialCode: '+61',
    flag: '🇦🇺',
    phoneLength: [9],
    placeholder: '412345678',
    searchKeywords: ['australia', '61', 'aussie']
  },
  {
    code: 'NZ',
    name: '뉴질랜드',
    dialCode: '+64',
    flag: '🇳🇿',
    phoneLength: [8, 9],
    placeholder: '21234567',
    searchKeywords: ['new zealand', '64', 'kiwi']
  },
  
  // 중동/아프리카
  {
    code: 'AE',
    name: '아랍에미리트',
    dialCode: '+971',
    flag: '🇦🇪',
    phoneLength: [9],
    placeholder: '501234567',
    searchKeywords: ['uae', 'emirates', '971', 'dubai']
  },
  {
    code: 'SA',
    name: '사우디아라비아',
    dialCode: '+966',
    flag: '🇸🇦',
    phoneLength: [9],
    placeholder: '501234567',
    searchKeywords: ['saudi arabia', '966', 'saudi']
  },
  {
    code: 'ZA',
    name: '남아프리카공화국',
    dialCode: '+27',
    flag: '🇿🇦',
    phoneLength: [9],
    placeholder: '821234567',
    searchKeywords: ['south africa', '27']
  },
  
  // 인도/기타
  {
    code: 'IN',
    name: '인도',
    dialCode: '+91',
    flag: '🇮🇳',
    phoneLength: [10],
    placeholder: '9123456789',
    searchKeywords: ['india', '91']
  },
  {
    code: 'ID',
    name: '인도네시아',
    dialCode: '+62',
    flag: '🇮🇩',
    phoneLength: [9, 10, 11],
    placeholder: '812345678',
    searchKeywords: ['indonesia', '62']
  },
  {
    code: 'PH',
    name: '필리핀',
    dialCode: '+63',
    flag: '🇵🇭',
    phoneLength: [10],
    placeholder: '9171234567',
    searchKeywords: ['philippines', '63']
  },
  {
    code: 'MY',
    name: '말레이시아',
    dialCode: '+60',
    flag: '🇲🇾',
    phoneLength: [9, 10],
    placeholder: '123456789',
    searchKeywords: ['malaysia', '60']
  }
];

/**
 * 국가코드로 국가 정보 찾기
 */
export const getCountryByCode = (code: string): CountryCode | undefined => {
  return COUNTRY_CODES.find(country => country.code === code);
};

/**
 * 국제전화 코드로 국가 정보 찾기
 */
export const getCountryByDialCode = (dialCode: string): CountryCode | undefined => {
  return COUNTRY_CODES.find(country => country.dialCode === dialCode);
};

/**
 * 전화번호에서 특수문자 제거 (숫자만 남기기)
 */
export const cleanPhoneNumber = (phone: string): string => {
  return phone.replace(/[^0-9]/g, '');
};

/**
 * 전화번호 형식 유효성 검사
 */
export const validatePhoneNumber = (phone: string, countryCode: string): boolean => {
  const country = getCountryByCode(countryCode);
  if (!country) return false;
  
  const cleanPhone = cleanPhoneNumber(phone);
  return country.phoneLength.includes(cleanPhone.length);
};

/**
 * 완전한 국제 전화번호 형식으로 변환
 */
export const formatInternationalPhone = (phone: string, countryCode: string): string => {
  const country = getCountryByCode(countryCode);
  if (!country) return phone;
  
  const cleanPhone = cleanPhoneNumber(phone);
  
  // 한국의 경우 010 -> 10으로 변환 (0 제거)
  if (countryCode === 'KR' && cleanPhone.startsWith('0')) {
    return `${country.dialCode}${cleanPhone.slice(1)}`;
  }
  
  return `${country.dialCode}${cleanPhone}`;
};

/**
 * 전화번호를 로컬 형식으로 표시 (사용자 친화적)
 */
export const formatLocalPhone = (phone: string, countryCode: string): string => {
  const cleanPhone = cleanPhoneNumber(phone);
  
  switch (countryCode) {
    case 'KR':
      // 한국: 010-1234-5678
      if (cleanPhone.length === 11 && cleanPhone.startsWith('010')) {
        return `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 7)}-${cleanPhone.slice(7)}`;
      } else if (cleanPhone.length === 10) {
        return `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`;
      }
      break;
    case 'US':
    case 'CA':
      // 미국/캐나다: (202) 555-1234
      if (cleanPhone.length === 10) {
        return `(${cleanPhone.slice(0, 3)}) ${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`;
      }
      break;
    default:
      // 기본적으로 3-4자리마다 공백 추가
      if (cleanPhone.length >= 6) {
        return cleanPhone.replace(/(\d{3})(\d{3,4})(\d+)/, '$1 $2 $3');
      }
      break;
  }
  
  return cleanPhone;
};