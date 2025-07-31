import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COUNTRY_CODES, CountryCode } from '../utils/countryCodes';

interface CountryCodePickerProps {
  selectedCountry: CountryCode;
  onCountrySelect: (country: CountryCode) => void;
  style?: any;
}

export default function CountryCodePicker({ 
  selectedCountry, 
  onCountrySelect, 
  style 
}: CountryCodePickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  // 검색 필터링 (useMemo로 최적화 및 확실한 리렌더링 보장)
  const filteredCountries = useMemo(() => {
    const search = searchText.toLowerCase().trim();
    
    // 검색어가 없으면 모든 국가 표시
    if (!search) {
      if (__DEV__) {
        console.log(`🔄 빈 검색어: 모든 ${COUNTRY_CODES.length}개 국가 표시`);
      }
      return COUNTRY_CODES;
    }
    
    const results = COUNTRY_CODES.filter(country => {
      // 기본 검색 조건
      const basicMatch = (
        country.name.toLowerCase().includes(search) ||
        country.code.toLowerCase().includes(search) ||
        country.dialCode.toLowerCase().includes(search) ||
        country.dialCode.replace('+', '').includes(search)
      );
      
      // 추가 키워드 검색
      const keywordMatch = country.searchKeywords?.some(keyword => 
        keyword.toLowerCase().includes(search)
      ) || false;
      
      const matched = basicMatch || keywordMatch;
      
      // 개발 모드에서 검색 디버깅
      if (__DEV__ && matched) {
        console.log(`🔍 검색 결과: "${search}" → ${country.name} (${country.code})`);
      }
      
      return matched;
    });
    
    if (__DEV__) {
      console.log(`📊 검색 "${search}" 최종 결과: ${results.length}개 국가`);
      console.log(`🎯 필터링된 국가들:`, results.map(c => `${c.name}(${c.code})`));
    }
    
    return results;
  }, [searchText]);

  // 렌더링 시점 디버깅
  if (__DEV__) {
    console.log(`🔄 렌더링 시점: 검색어="${searchText}", 필터결과=${filteredCountries.length}개`);
  }

  const handleCountrySelect = (country: CountryCode) => {
    onCountrySelect(country);
    setModalVisible(false);
    setSearchText('');
  };

  return (
    <>
      {/* 선택된 국가 표시 버튼 */}
      <TouchableOpacity
        style={[styles.pickerButton, style]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.flagText}>{selectedCountry.flag}</Text>
        <Text style={styles.dialCodeText}>{selectedCountry.dialCode}</Text>
        <Ionicons name="chevron-down" size={16} color="#666" />
      </TouchableOpacity>

      {/* 국가 선택 모달 */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* 모달 헤더 */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>국가 선택</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* 검색 입력 */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="예: 미국, US, 1, America..."
                value={searchText}
                onChangeText={(text) => {
                  setSearchText(text);
                  if (__DEV__) {
                    console.log(`🎯 검색어 입력: "${text}"`);
                  }
                }}
                placeholderTextColor="#999"
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="never"
              />
              {searchText.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchText('')}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            {/* 국가 목록 */}
            <ScrollView 
              style={styles.countryList} 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {filteredCountries.map((country, index) => {
                if (__DEV__ && index < 3) {
                  console.log(`🎨 렌더링 중: ${country.name} (${country.code})`);
                }
                return (
                  <TouchableOpacity
                    key={country.code}
                    style={[
                      styles.countryItem,
                      selectedCountry.code === country.code && styles.selectedCountryItem
                    ]}
                    onPress={() => handleCountrySelect(country)}
                  >
                    <Text style={styles.countryFlag}>{country.flag}</Text>
                    <View style={styles.countryInfo}>
                      <Text style={styles.countryName}>{country.name}</Text>
                      <Text style={styles.countryCode}>{country.code}</Text>
                    </View>
                    <Text style={styles.countryDialCode}>{country.dialCode}</Text>
                    {selectedCountry.code === country.code && (
                      <Ionicons name="checkmark" size={20} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                );
              })}
              
              {/* 디버깅용 - 배열 길이 표시 */}
              {__DEV__ && (
                <View style={{ padding: 10, backgroundColor: '#f0f0f0' }}>
                  <Text style={{ fontSize: 12, color: '#666' }}>
                    디버그: {filteredCountries.length}개 결과
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* 검색 결과 없음 */}
            {filteredCountries.length === 0 && (
              <View style={styles.noResultsContainer}>
                <Ionicons name="search" size={48} color="#CCC" />
                <Text style={styles.noResultsText}>검색 결과가 없습니다</Text>
                <Text style={styles.noResultsSubtext}>
                  다른 키워드로 검색해보세요
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // 선택 버튼 스타일
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 120,
    maxWidth: 140,
  },
  flagText: {
    fontSize: 18,
    marginRight: 4,
  },
  dialCodeText: {
    fontSize: 14,
    color: '#1A1A1A',
    flex: 1,
    fontWeight: '600',
    textAlign: 'left',
    numberOfLines: 1,
  },

  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%', // 최소 높이 보장
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  closeButton: {
    padding: 4,
  },

  // 검색 스타일
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    paddingVertical: 12,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },

  // 국가 목록 스타일
  countryList: {
    flex: 1,
    maxHeight: 400, // 최대 높이 설정으로 스크롤 가능하게
    minHeight: 200, // 최소 높이 보장
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  selectedCountryItem: {
    backgroundColor: '#E3F2FD',
  },
  countryFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  countryCode: {
    fontSize: 14,
    color: '#666',
  },
  countryDialCode: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
    marginRight: 8,
  },

  // 검색 결과 없음 스타일
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});