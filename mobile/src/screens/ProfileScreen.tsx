import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../contexts/AppContext';
import { safeToFixed } from '../utils/formatters';

export default function ProfileScreen() {
  const { 
    state, 
    getUserProfile, 
    updateUserProfile, 
    submitKYCDocument, 
    getKYCStatus,
    resubmitKYCDocument 
  } = useApp();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showKYCForm, setShowKYCForm] = useState(false);
  const [kycStatus, setKycStatus] = useState<any>(null);
  
  // 프로필 데이터
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    preferred_currency: 'USDC'
  });
  
  // KYC 데이터
  const [kycData, setKycData] = useState({
    document_type: 'national_id',
    document_number: '',
    full_name: '',
    date_of_birth: '',
    nationality: 'KR',
    gender: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state_province: '',
    postal_code: '',
    country: 'KR',
    occupation: '',
    employer: '',
    income_range: '',
    source_of_funds: 'salary'
  });
  
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadProfileData();
    loadKYCStatus();
  }, []);

  const loadProfileData = async () => {
    try {
      setIsLoading(true);
      const profile = await getUserProfile();
      setProfileData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        preferred_currency: profile.preferred_currency || 'USDC'
      });
    } catch (error) {
      console.error('프로필 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadKYCStatus = async () => {
    try {
      const status = await getKYCStatus();
      setKycStatus(status);
    } catch (error) {
      console.error('KYC 상태 로드 실패:', error);
    }
  };

  // 프로필 업데이트
  const handleUpdateProfile = async () => {
    if (!profileData.first_name || !profileData.last_name) {
      Alert.alert('오류', '이름과 성을 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      await updateUserProfile(profileData);
      
      Alert.alert(
        '프로필 업데이트 완료!',
        '프로필 정보가 성공적으로 업데이트되었습니다.',
        [
          {
            text: '확인',
            onPress: () => setShowEditProfile(false)
          }
        ]
      );
    } catch (error) {
      Alert.alert('프로필 업데이트 실패', '프로필 업데이트 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // KYC 문서 제출
  const handleSubmitKYC = async () => {
    if (!kycData.full_name || !kycData.date_of_birth || !kycData.nationality) {
      Alert.alert('오류', '필수 항목을 모두 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      const result = await submitKYCDocument(kycData, selectedDocumentFile || undefined);
      
      Alert.alert(
        'KYC 문서 제출 완료!',
        `${result.message}\n\n상태: ${result.status}\n예상 처리 시간: ${result.estimated_review_time}`,
        [
          {
            text: '확인',
            onPress: () => {
              setShowKYCForm(false);
              loadKYCStatus(); // 상태 새로고침
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('KYC 제출 실패', 'KYC 문서 제출 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // KYC 상태 배지 렌더링
  const renderKYCStatusBadge = (status: string) => {
    const statusColors = {
      pending: { bg: '#fef3c7', text: '#d97706' },
      approved: { bg: '#d1fae5', text: '#059669' },
      rejected: { bg: '#fecaca', text: '#dc2626' }
    };
    
    const colors = statusColors[status as keyof typeof statusColors] || statusColors.pending;
    const statusText = {
      pending: '검토 중',
      approved: '승인됨',
      rejected: '거절됨'
    };
    
    return (
      <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
        <Text style={[styles.statusText, { color: colors.text }]}>
          {statusText[status as keyof typeof statusText] || status}
        </Text>
      </View>
    );
  };

  // 프로필 정보 섹션
  const renderProfileSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>프로필 정보</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setShowEditProfile(true)}
        >
          <Ionicons name="pencil" size={16} color="#6366f1" />
          <Text style={styles.editButtonText}>편집</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.profileInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>이메일</Text>
          <Text style={styles.infoValue}>{state.user?.email || 'N/A'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>이름</Text>
          <Text style={styles.infoValue}>
            {profileData.first_name} {profileData.last_name}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>전화번호</Text>
          <Text style={styles.infoValue}>{profileData.phone || '미설정'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>선호 통화</Text>
          <Text style={styles.infoValue}>{profileData.preferred_currency}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>국가</Text>
          <Text style={styles.infoValue}>{state.user?.countryCode || 'N/A'}</Text>
        </View>
      </View>
    </View>
  );

  // KYC 상태 섹션
  const renderKYCSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>KYC 인증</Text>
        {kycStatus && renderKYCStatusBadge(kycStatus.kyc_status)}
      </View>
      
      {kycStatus ? (
        <View style={styles.kycInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>인증 레벨</Text>
            <Text style={styles.infoValue}>Level {kycStatus.kyc_level}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>문서 수</Text>
            <Text style={styles.infoValue}>{kycStatus.documents?.length || 0}개</Text>
          </View>
          
          {kycStatus.last_updated && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>마지막 업데이트</Text>
              <Text style={styles.infoValue}>
                {new Date(kycStatus.last_updated).toLocaleDateString('ko-KR')}
              </Text>
            </View>
          )}
          
          {kycStatus.next_steps && kycStatus.next_steps.length > 0 && (
            <View style={styles.nextSteps}>
              <Text style={styles.nextStepsTitle}>다음 단계:</Text>
              {kycStatus.next_steps.map((step: string, index: number) => (
                <Text key={index} style={styles.nextStepItem}>• {step}</Text>
              ))}
            </View>
          )}
          
          {kycStatus.kyc_status !== 'approved' && (
            <TouchableOpacity
              style={styles.kycButton}
              onPress={() => setShowKYCForm(true)}
            >
              <Text style={styles.kycButtonText}>
                {kycStatus.kyc_status === 'rejected' ? 'KYC 재제출' : 'KYC 인증 시작'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.kycInfo}>
          <Text style={styles.emptyText}>KYC 정보를 불러오는 중...</Text>
        </View>
      )}
    </View>
  );

  // 문서 목록 섹션
  const renderDocumentsSection = () => (
    kycStatus && kycStatus.documents && kycStatus.documents.length > 0 && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>제출된 문서</Text>
        
        {kycStatus.documents.map((doc: any, index: number) => (
          <View key={index} style={styles.documentItem}>
            <View style={styles.documentLeft}>
              <Text style={styles.documentType}>
                {getDocumentTypeName(doc.document_type)}
              </Text>
              <Text style={styles.documentDate}>
                {new Date(doc.created_at).toLocaleDateString('ko-KR')}
              </Text>
            </View>
            <View style={styles.documentRight}>
              {renderKYCStatusBadge(doc.verification_status)}
              {doc.risk_score !== null && (
                <Text style={styles.riskScore}>
                  위험도: {(doc.risk_score * 100).toFixed(1)}%
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    )
  );

  // 문서 타입 한국어 변환
  const getDocumentTypeName = (type: string) => {
    const typeNames = {
      passport: '여권',
      driver_license: '운전면허증',
      national_id: '주민등록증',
      utility_bill: '공과금 고지서'
    };
    return typeNames[type as keyof typeof typeNames] || type;
  };

  // 프로필 편집 모달
  const renderEditProfileModal = () => (
    <Modal
      visible={showEditProfile}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowEditProfile(false)}>
            <Text style={styles.modalCancel}>취소</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>프로필 편집</Text>
          <TouchableOpacity onPress={handleUpdateProfile} disabled={isLoading}>
            <Text style={styles.modalSave}>저장</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>이름 *</Text>
            <TextInput
              style={styles.input}
              value={profileData.first_name}
              onChangeText={(text) => setProfileData({...profileData, first_name: text})}
              placeholder="이름"
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>성 *</Text>
            <TextInput
              style={styles.input}
              value={profileData.last_name}
              onChangeText={(text) => setProfileData({...profileData, last_name: text})}
              placeholder="성"
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>전화번호</Text>
            <TextInput
              style={styles.input}
              value={profileData.phone}
              onChangeText={(text) => setProfileData({...profileData, phone: text})}
              placeholder="+82-10-1234-5678"
              keyboardType="phone-pad"
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>선호 통화</Text>
            <View style={styles.currencyContainer}>
              {['USDC', 'USD', 'KRW', 'THB'].map((currency) => (
                <TouchableOpacity
                  key={currency}
                  style={[
                    styles.currencyButton,
                    profileData.preferred_currency === currency && styles.currencyButtonSelected
                  ]}
                  onPress={() => setProfileData({...profileData, preferred_currency: currency})}
                >
                  <Text style={[
                    styles.currencyButtonText,
                    profileData.preferred_currency === currency && styles.currencyButtonTextSelected
                  ]}>
                    {currency}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  // KYC 폼 모달
  const renderKYCFormModal = () => (
    <Modal
      visible={showKYCForm}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowKYCForm(false)}>
            <Text style={styles.modalCancel}>취소</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>KYC 인증</Text>
          <TouchableOpacity onPress={handleSubmitKYC} disabled={isLoading}>
            <Text style={styles.modalSave}>제출</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* 문서 타입 선택 */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>신분증 종류 *</Text>
            <View style={styles.documentTypeContainer}>
              {[
                { type: 'national_id', name: '주민등록증' },
                { type: 'passport', name: '여권' },
                { type: 'driver_license', name: '운전면허증' }
              ].map((docType) => (
                <TouchableOpacity
                  key={docType.type}
                  style={[
                    styles.documentTypeButton,
                    kycData.document_type === docType.type && styles.documentTypeButtonSelected
                  ]}
                  onPress={() => setKycData({...kycData, document_type: docType.type})}
                >
                  <Text style={[
                    styles.documentTypeButtonText,
                    kycData.document_type === docType.type && styles.documentTypeButtonTextSelected
                  ]}>
                    {docType.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 개인 정보 */}
          <Text style={styles.sectionSubtitle}>개인 정보</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>전체 이름 *</Text>
            <TextInput
              style={styles.input}
              value={kycData.full_name}
              onChangeText={(text) => setKycData({...kycData, full_name: text})}
              placeholder="홍길동"
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>생년월일 *</Text>
            <TextInput
              style={styles.input}
              value={kycData.date_of_birth}
              onChangeText={(text) => setKycData({...kycData, date_of_birth: text})}
              placeholder="1990-01-01"
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>성별</Text>
            <View style={styles.genderContainer}>
              {['남성', '여성', '기타'].map((gender) => (
                <TouchableOpacity
                  key={gender}
                  style={[
                    styles.genderButton,
                    kycData.gender === gender && styles.genderButtonSelected
                  ]}
                  onPress={() => setKycData({...kycData, gender})}
                >
                  <Text style={[
                    styles.genderButtonText,
                    kycData.gender === gender && styles.genderButtonTextSelected
                  ]}>
                    {gender}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 주소 정보 (Level 2) */}
          <Text style={styles.sectionSubtitle}>주소 정보 (선택사항 - Level 2 인증)</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>주소</Text>
            <TextInput
              style={styles.input}
              value={kycData.address_line1}
              onChangeText={(text) => setKycData({...kycData, address_line1: text})}
              placeholder="서울시 강남구 테헤란로 123"
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.inputLabel}>도시</Text>
              <TextInput
                style={styles.input}
                value={kycData.city}
                onChangeText={(text) => setKycData({...kycData, city: text})}
                placeholder="서울"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
              <Text style={styles.inputLabel}>우편번호</Text>
              <TextInput
                style={styles.input}
                value={kycData.postal_code}
                onChangeText={(text) => setKycData({...kycData, postal_code: text})}
                placeholder="12345"
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          {/* 직업 정보 (Level 2) */}
          <Text style={styles.sectionSubtitle}>직업 정보 (선택사항 - Level 2 인증)</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>직업</Text>
            <TextInput
              style={styles.input}
              value={kycData.occupation}
              onChangeText={(text) => setKycData({...kycData, occupation: text})}
              placeholder="소프트웨어 엔지니어"
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>고용주</Text>
            <TextInput
              style={styles.input}
              value={kycData.employer}
              onChangeText={(text) => setKycData({...kycData, employer: text})}
              placeholder="회사명"
              placeholderTextColor="#9ca3af"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>소득 범위</Text>
            <View style={styles.incomeContainer}>
              {['0-25000', '25000-50000', '50000-100000', '100000+'].map((range) => (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.incomeButton,
                    kycData.income_range === range && styles.incomeButtonSelected
                  ]}
                  onPress={() => setKycData({...kycData, income_range: range})}
                >
                  <Text style={[
                    styles.incomeButtonText,
                    kycData.income_range === range && styles.incomeButtonTextSelected
                  ]}>
                    ${range}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 파일 업로드 안내 */}
          <View style={styles.fileUploadSection}>
            <Text style={styles.sectionSubtitle}>문서 첨부</Text>
            <Text style={styles.fileUploadNote}>
              신분증 사진을 첨부하면 검증 속도가 빨라집니다. (선택사항)
            </Text>
            <Text style={styles.fileUploadNote}>
              지원 형식: JPEG, PNG, PDF (최대 10MB)
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  if (isLoading && !kycStatus) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>프로필 정보를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>프로필 & KYC</Text>
        <Text style={styles.subtitle}>개인정보 관리 및 신원 인증</Text>
      </View>

      {/* 프로필 정보 섹션 */}
      {renderProfileSection()}

      {/* KYC 상태 섹션 */}
      {renderKYCSection()}

      {/* 문서 목록 섹션 */}
      {renderDocumentsSection()}

      {/* 모달들 */}
      {renderEditProfileModal()}
      {renderKYCFormModal()}
      
      {/* 로딩 오버레이 */}
      {isLoading && (
        <Modal visible={true} transparent={true}>
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingModal}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingModalText}>처리 중...</Text>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  section: {
    margin: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
    marginTop: 20,
    marginBottom: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  editButtonText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  profileInfo: {
    gap: 12,
  },
  kycInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  nextSteps: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  nextStepsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  nextStepItem: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  kycButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  kycButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  documentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  documentLeft: {
    flex: 1,
  },
  documentType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  documentDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  documentRight: {
    alignItems: 'flex-end',
  },
  riskScore: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalCancel: {
    fontSize: 16,
    color: '#6b7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modalSave: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#1f2937',
  },
  row: {
    flexDirection: 'row',
  },
  currencyContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: 'white',
  },
  currencyButtonSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  currencyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  currencyButtonTextSelected: {
    color: 'white',
  },
  documentTypeContainer: {
    gap: 8,
  },
  documentTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: 'white',
  },
  documentTypeButtonSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  documentTypeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
  },
  documentTypeButtonTextSelected: {
    color: 'white',
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  genderButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: 'white',
  },
  genderButtonSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  genderButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  genderButtonTextSelected: {
    color: 'white',
  },
  incomeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  incomeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: 'white',
  },
  incomeButtonSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  incomeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  incomeButtonTextSelected: {
    color: 'white',
  },
  fileUploadSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  fileUploadNote: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingModal: {
    backgroundColor: 'white',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  loadingModalText: {
    marginTop: 16,
    fontSize: 16,
    color: '#374151',
  },
}); 