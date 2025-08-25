import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import { ChatMessage } from '../types';
import { aiService } from '../services/aiService';

export default function AIAssistantScreen() {
  const { t } = useTranslation();
  const { state, isRTL, getRTLStyle } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // 메시지 전송
  const sendMessage = async () => {
    if (!inputText.trim() || !state.user?.id) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageContent = inputText.trim();
    setInputText('');

    // 스크롤을 맨 아래로
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      console.log('🤖 AI 메시지 전송 시작:', messageContent);
      
      // 실제 AI 서비스 호출
      const response = await aiService.sendMessage(
        messageContent,
        state.user.id,
        () => setIsTyping(true),  // 타이핑 시작
        () => setIsTyping(false), // 타이핑 종료
        (error) => {              // 에러 처리
          console.error('AI 서비스 에러:', error);
          const errorMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'system',
            content: `${t('common.sorry', { defaultValue: '죄송합니다' })}. ${error}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
        },
        state.currentLanguage // 현재 언어 전달
      );

      if (response) {
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: response.response,
          timestamp: new Date(response.timestamp),
          data: response.functionCalls
        };

        setMessages(prev => [...prev, aiMessage]);
        console.log('✅ AI 응답 수신:', response.response.substring(0, 100));
        
        // Function Calls가 있으면 로그에 출력
        if (response.functionCalls && response.functionCalls.length > 0) {
          console.log('🔧 Function Calls 실행됨:', response.functionCalls.map(fc => fc.function));
        }
      }

    } catch (error) {
      console.error('❌ AI 메시지 전송 실패:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        content: t('common.networkError', { defaultValue: '죄송합니다. 네트워크 연결을 확인하고 다시 시도해 주세요.' }),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      // 스크롤을 맨 아래로
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // 음성 녹음 시작
  const startRecording = async () => {
    try {
      console.log('🎤 음성 녹음 시작 요청');
      
      // 권한 요청
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('권한 필요', '음성 입력을 위해 마이크 권한이 필요합니다.');
        return;
      }

      // 오디오 모드 설정
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('🎤 녹음 시작 중...');
      const recordingInstance = new Audio.Recording();
      await recordingInstance.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recordingInstance.startAsync();
      
      setRecording(recordingInstance);
      setIsRecording(true);
      setIsListening(true);
      console.log('✅ 녹음 시작됨');
    } catch (error) {
      console.error('❌ 녹음 시작 실패:', error);
      Alert.alert('오류', '음성 녹음을 시작할 수 없습니다.');
    }
  };

  // 음성 녹음 중지 및 텍스트 변환
  const stopRecording = async () => {
    if (!recording) return;

    try {
      console.log('🛑 녹음 중지 중...');
      setIsListening(false);
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);
      
      console.log('✅ 녹음 완료, URI:', uri);
      
      // 실제 음성 인식은 복잡하므로, 여기서는 시연용으로 간단한 처리
      // 실제 구현시에는 Google Speech-to-Text API나 다른 서비스 필요
      setInputText(t('common.voiceInputPlaceholder', { defaultValue: '음성으로 입력된 메시지입니다. (음성 인식 기능 개발 중)' }));
      
      Alert.alert(
        '음성 입력 완료', 
        '음성이 텍스트로 변환되었습니다. 전송하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '전송', onPress: () => sendMessage() }
        ]
      );
      
    } catch (error) {
      console.error('❌ 녹음 중지 실패:', error);
      setIsRecording(false);
      setIsListening(false);
      setRecording(null);
    }
  };

  // AI 응답을 음성으로 읽기
  const speakText = async (text: string) => {
    try {
      console.log('🔊 TTS 시작:', text.substring(0, 50));
      // 현재 언어에 맞는 TTS 언어 설정
      const getTTSLanguage = (lang: string) => {
        switch (lang) {
          case 'ko': return 'ko-KR';
          case 'en': return 'en-US';
          case 'zh': return 'zh-CN';
          case 'ar': return 'ar-SA';
          case 'fr': return 'fr-FR';
          case 'de': return 'de-DE';
          case 'es': return 'es-ES';
          case 'hi': return 'hi-IN';
          case 'ja': return 'ja-JP';
          default: return 'ko-KR';
        }
      };

      await Speech.speak(text, {
        language: getTTSLanguage(state.currentLanguage || 'ko'),
        pitch: 1.0,
        rate: 0.9,
      });
    } catch (error) {
      console.error('❌ TTS 실패:', error);
    }
  };

  // AI 서비스 초기화 및 이전 채팅 히스토리 로드
  const initializeAI = async () => {
    if (isInitialized) return;

    try {
      console.log('🤖 AI 서비스 초기화 중...');
      
      // AI 서비스 상태 확인
      const healthCheck = await aiService.checkHealth();
      console.log('🏥 AI 서비스 상태:', healthCheck.status);

      // 이전 메시지 히스토리 로드
      const history = await aiService.getMessageHistory();
      if (history.length > 0) {
        setMessages(history);
        console.log(`📱 이전 채팅 히스토리 로드: ${history.length}개 메시지`);
      } else {
        // 첫 방문 시 환영 메시지
        const welcomeMessage: ChatMessage = {
          id: '1',
          type: 'ai',
          content: '안녕하세요! 👋 CirclePay AI 어시스턴트입니다.\n\n자연어로 다음과 같은 기능을 이용하실 수 있습니다:\n• USDC 송금 ("10달러 송금해줘")\n• 잔액 조회 ("내 잔액 알려줘")\n• 거래내역 확인 ("최근 거래 보여줘")\n• 수수료 계산 ("이더리움에서 베이스로 송금 수수료는?")\n• 지갑 정보 ("내 지갑 정보 알려줘")\n\n무엇을 도와드릴까요?',
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
      }

      setIsInitialized(true);
    } catch (error) {
      console.error('❌ AI 서비스 초기화 실패:', error);
      // 초기화 실패 시에도 기본 환영 메시지 표시
      const errorMessage: ChatMessage = {
        id: '1',
        type: 'system',
        content: '⚠️ AI 서비스 연결에 문제가 있습니다. 기본 기능만 사용 가능합니다.',
        timestamp: new Date(),
      };
      setMessages([errorMessage]);
      setIsInitialized(true);
    }
  };

  // 새 채팅 세션 시작
  const startNewSession = async () => {
    try {
      await aiService.createNewSession();
      setMessages([]);
      await initializeAI();
      console.log('🆕 새로운 AI 채팅 세션 시작');
    } catch (error) {
      console.error('❌ 새 세션 시작 실패:', error);
    }
  };

  // 컴포넌트 마운트 시 AI 서비스 초기화
  useEffect(() => {
    initializeAI();
  }, []);

  // 메시지 변경 시 스크롤을 맨 아래로
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, [messages]);

  // 메시지 렌더링
  const renderMessage = (message: ChatMessage) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';
    const isRightToLeft = isRTL();

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.aiMessageContainer,
          isRightToLeft && { flexDirection: 'row-reverse' }
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userMessage : isSystem ? styles.systemMessage : styles.aiMessage,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userMessageText : styles.aiMessageText,
              { textAlign: isRightToLeft ? 'right' : 'left' }
            ]}
          >
            {message.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isUser ? styles.userMessageTime : styles.aiMessageTime,
              ]}
            >
              {message.timestamp.toLocaleTimeString(state.currentLanguage || 'ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {/* AI 메시지에만 음성 읽기 버튼 추가 */}
            {message.type === 'ai' && (
              <TouchableOpacity
                style={styles.speakButton}
                onPress={() => speakText(message.content)}
              >
                <Ionicons name="volume-high-outline" size={16} color="#007AFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* 헤더 영역 */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{t('headers.aiAssistant')}</Text>
            <Text style={styles.headerSubtitle}>
              {aiService.getCurrentSessionId() ? '채팅 중' : '새 세션'}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.newSessionButton}
            onPress={startNewSession}
          >
            <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
            <Text style={styles.newSessionText}>{t('common.newChat', { defaultValue: '새 채팅' })}</Text>
          </TouchableOpacity>
        </View>

        {/* 채팅 메시지 영역 */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map(renderMessage)}
          
          {/* 타이핑 인디케이터 */}
          {isTyping && (
            <View style={styles.typingContainer}>
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.typingText}>{t('common.aiTyping', { defaultValue: 'AI가 답변을 준비 중입니다...' })}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* 입력 영역 */}
        <View style={[styles.inputContainer, isRTL() && { flexDirection: 'row-reverse' }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.textInput, { textAlign: isRTL() ? 'right' : 'left' }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={t('common.typeMessage', { defaultValue: '메시지를 입력하세요...' })}
              placeholderTextColor="#999"
              multiline
              maxLength={500}
              onSubmitEditing={sendMessage}
              blurOnSubmit={false}
            />
            {/* 음성 입력 버튼 */}
            <TouchableOpacity
              style={[
                styles.voiceButton,
                isRecording ? styles.voiceButtonActive : styles.voiceButtonInactive,
              ]}
              onPress={isRecording ? stopRecording : startRecording}
              disabled={isTyping}
            >
              <LinearGradient
                colors={
                  isRecording
                    ? ['#FF3B30', '#D70015']
                    : ['#34C759', '#28A745']
                }
                style={styles.voiceButtonGradient}
              >
                <Ionicons
                  name={isRecording ? 'stop' : 'mic'}
                  size={20}
                  color="white"
                />
              </LinearGradient>
              {isListening && (
                <View style={styles.listeningIndicator}>
                  <ActivityIndicator size="small" color="#FF3B30" />
                </View>
              )}
            </TouchableOpacity>
            
            {/* 전송 버튼 */}
            <TouchableOpacity
              style={[
                styles.sendButton,
                inputText.trim() ? styles.sendButtonActive : styles.sendButtonInactive,
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || isTyping}
            >
              <LinearGradient
                colors={
                  inputText.trim() && !isTyping
                    ? ['#007AFF', '#0051D0']
                    : ['#CCC', '#AAA']
                }
                style={styles.sendButtonGradient}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={inputText.trim() && !isTyping ? 'white' : '#666'}
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  newSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  newSessionText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  messageContainer: {
    marginVertical: 4,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userMessage: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  systemMessage: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFEAA7',
    borderWidth: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  aiMessageText: {
    color: '#333333',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  userMessageTime: {
    color: '#FFFFFF',
    textAlign: 'right',
  },
  aiMessageTime: {
    color: '#666666',
  },
  typingContainer: {
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#F8F9FA',
  },
  sendButton: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendButtonActive: {
    // 활성화 상태 스타일
  },
  sendButtonInactive: {
    // 비활성화 상태 스타일
  },
  sendButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButton: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  voiceButtonActive: {
    // 녹음 중 상태 스타일
  },
  voiceButtonInactive: {
    // 녹음 대기 상태 스타일
  },
  voiceButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listeningIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  speakButton: {
    marginLeft: 8,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
});
