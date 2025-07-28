import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FlowchartStructure } from '@/lib/types/flowchart';
import { 
  createVoiceFlowchartSession, 
  VoiceFlowchartSession,
  loadFlowchartTemplate,
  generateVoiceInstructions 
} from '@/lib/services/voiceFlowchartGenerator';
import * as DocumentPicker from 'expo-document-picker';

interface VoiceFlowchartCreatorProps {
  visible: boolean;
  onClose: () => void;
  onFlowchartCreated: (flowchart: FlowchartStructure) => void;
}

export function VoiceFlowchartCreator({
  visible,
  onClose,
  onFlowchartCreated
}: VoiceFlowchartCreatorProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState<Array<{type: 'user' | 'assistant', text: string}>>([]);
  const [textInput, setTextInput] = useState('');
  
  const sessionRef = useRef<VoiceFlowchartSession | null>(null);
  const textInputRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      initializeSession();
    } else {
      cleanupSession();
    }
    
    return () => cleanupSession();
  }, [visible]);

  const initializeSession = async () => {
    try {
      setIsLoading(true);
      
      // Load the flowchart template
      const template = await loadFlowchartTemplate();
      
      // Generate instructions from the centralized prompt file
      const sessionInstructions = await generateVoiceInstructions(template);
      
      const session = createVoiceFlowchartSession(
        {
          voice: 'alloy',
          temperature: 0.7,
          sessionInstructions
        },
        {
          onConnected: () => {
            console.log('🎯 Voice session connected');
            setIsConnected(true);
            setIsLoading(false);
          },
          onDisconnected: () => {
            console.log('🔌 Voice session disconnected');
            setIsConnected(false);
            setIsListening(false);
          },
          onListeningStart: () => {
            setIsListening(true);
          },
          onListeningStop: () => {
            setIsListening(false);
          },
          onTranscript: (transcriptText, isFinal) => {
            if (isFinal) {
              console.log('📝 Adding voice transcript:', transcriptText);
              setTranscript(transcriptText);
              
              // Add user message to conversation from voice
              setConversation(prev => {
                // Simple duplicate check - don't add if last message is identical
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.type === 'user' && lastMessage.text === transcriptText) {
                  return prev;
                }
                return [...prev, { type: 'user', text: transcriptText }];
              });
            }
          },
          onResponse: (response) => {
            if (!response) return;
            
            setConversation(prev => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage && lastMessage.type === 'assistant') {
                // Append to existing assistant message (streaming)
                return [...prev.slice(0, -1), { 
                  type: 'assistant', 
                  text: lastMessage.text + response
                }];
              } else {
                // Create new assistant message
                return [...prev, { type: 'assistant', text: response }];
              }
            });
          },
          onFlowchartGenerated: (flowchart) => {
            console.log('🎯 Flowchart generated via voice!');
            onFlowchartCreated(flowchart);
            Alert.alert('Success', 'Flowchart created successfully!', [
              { text: 'Close', onPress: onClose }
            ]);
          },
          onError: (error) => {
            console.error('❌ Voice session error:', error);
            Alert.alert('Error', error.message);
            setIsLoading(false);
          }
        }
      );
      
      sessionRef.current = session;
      await session.connect();
      
    } catch (error) {
      console.error('❌ Error initializing voice session:', error);
      Alert.alert('Error', 'Failed to initialize voice session');
      setIsLoading(false);
    }
  };

  const cleanupSession = () => {
    if (sessionRef.current) {
      sessionRef.current.disconnect();
      sessionRef.current = null;
    }
    
    setIsConnected(false);
    setIsListening(false);
    setConversation([]);
    setTranscript('');
  };

  const restartSession = async () => {
    console.log('🔄 Restarting voice session with fresh instructions...');
    cleanupSession();
    setTimeout(() => {
      initializeSession();
    }, 1000);
  };


  const handleStartListening = () => {
    if (sessionRef.current && isConnected) {
      sessionRef.current.startListening();
      setTranscript('');
    }
  };

  const handleStopListening = () => {
    if (sessionRef.current && isConnected) {
      sessionRef.current.stopListening();
    }
  };

  const handleSendText = () => {
    if (sessionRef.current && isConnected && textInput.trim()) {
      const messageText = textInput.trim();
      
      // Add user message to conversation
      setConversation(prev => [...prev, { type: 'user', text: messageText }]);
      
      // Check if this is a data structure request and modify the message to be more explicit
      const dataStructureTriggers = [
        'output the data structure', 'provide the json format', 'show me the data',
        'format this as json', 'structure this data', 'convert to data format',
        'create a flowchart', 'make a copy', 'generate a flowchart' // backup phrases
      ];
      
      let finalMessage = messageText;
      if (dataStructureTriggers.some(trigger => messageText.toLowerCase().includes(trigger.toLowerCase()))) {
        finalMessage = `I need this therapeutic information formatted as a JSON data structure. ${messageText}. Please output the data structure in JSON format.`;
        console.log('🎯 Data structure request detected, enhancing message:', finalMessage);
      }
      
      // Send to OpenAI
      sessionRef.current.sendMessage(finalMessage);
      
      // Clear input
      setTextInput('');
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={[
          styles.container,
          { backgroundColor: isDark ? '#000000' : '#FFFFFF' }
        ]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[
            styles.headerTitle,
            { color: isDark ? '#FFFFFF' : '#000000' }
          ]}>
            Voice Flowchart Creator
          </Text>
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>


        {/* Connection Status */}
        <View style={styles.statusSection}>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: isConnected ? '#4CAF50' : '#FF5722' }
          ]}>
            <Text style={styles.statusText}>
              {isLoading ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
          {isConnected && (
            <Pressable
              style={styles.restartButton}
              onPress={restartSession}
            >
              <Text style={styles.restartButtonText}>Restart Session</Text>
            </Pressable>
          )}
        </View>

        {/* Conversation */}
        <ScrollView style={styles.conversationContainer}>
          {conversation.map((message, index) => (
            <View
              key={index}
              style={[
                styles.messageContainer,
                message.type === 'user' 
                  ? styles.userMessage 
                  : [
                      styles.assistantMessage,
                      { backgroundColor: isDark ? '#2A2A2E' : '#F8F9FA' }
                    ]
              ]}
            >
              <Text style={[
                styles.messageText,
                { 
                  color: message.type === 'user' 
                    ? '#FFFFFF' 
                    : (isDark ? '#FFFFFF' : '#1A1A1A'),
                  fontWeight: message.type === 'assistant' ? '500' : 'normal'
                }
              ]}>
                {message.text}
              </Text>
            </View>
          ))}
          
          {/* Current transcript */}
          {transcript && (
            <View style={[styles.messageContainer, styles.transcriptMessage]}>
              <Text style={styles.transcriptText}>
                {transcript}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          {/* Voice Controls */}
          <View style={styles.voiceControls}>
            <Pressable
              style={[
                styles.voiceButton,
                { 
                  backgroundColor: isListening ? '#FF5722' : '#4CAF50',
                  opacity: isConnected ? 1 : 0.5
                }
              ]}
              onPressIn={handleStartListening}
              onPressOut={handleStopListening}
              disabled={!isConnected}
            >
              <Text style={styles.voiceButtonText}>
                {isListening ? '🎤 Recording... (Hold to speak)' : '🎤 Hold to Talk'}
              </Text>
            </Pressable>
            <Text style={[styles.instructionText, { color: isDark ? '#888888' : '#666666' }]}>
              Hold the button while speaking
            </Text>
          </View>

          {/* Text Input */}
          <View style={styles.textInputContainer}>
            <TextInput
              ref={textInputRef}
              style={[
                styles.textInput,
                {
                  backgroundColor: isDark ? '#333333' : '#F0F0F0',
                  color: isDark ? '#FFFFFF' : '#000000'
                }
              ]}
              placeholder="Type your message..."
              placeholderTextColor={isDark ? '#888888' : '#666666'}
              value={textInput}
              onChangeText={setTextInput}
              multiline
              editable={isConnected}
            />
            <Pressable
              style={[
                styles.sendButton,
                { opacity: (isConnected && textInput.trim()) ? 1 : 0.5 }
              ]}
              onPress={handleSendText}
              disabled={!isConnected || !textInput.trim()}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </Pressable>
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  templateSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  templateButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  templateButtonText: {
    fontSize: 14,
  },
  statusSection: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  restartButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  restartButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  conversationContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messageContainer: {
    marginVertical: 5,
    padding: 12,
    borderRadius: 12,
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: '#F8F9FA', // Light mode default, overridden in component
    alignSelf: 'flex-start',
  },
  transcriptMessage: {
    backgroundColor: '#FFF3CD',
    alignSelf: 'flex-end',
    opacity: 0.8,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  transcriptText: {
    fontSize: 14,
    color: '#856404',
    fontStyle: 'italic',
  },
  controlsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  voiceControls: {
    alignItems: 'center',
    marginBottom: 15,
  },
  voiceButton: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
  },
  voiceButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
});