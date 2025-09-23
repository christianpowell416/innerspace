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
  Animated,
  Image,
  Dimensions,
  AppState,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { FlowchartStructure } from '@/lib/types/flowchart';
import { getSelectedVoice, setSelectedVoice, getAllVoices, VoiceType } from '@/lib/services/voiceSettings';
import {
  createVoiceSession,
  VoiceSession,
  loadFlowchartTemplate,
  generateVoiceInstructions
} from '@/lib/services/voiceSessionService';
import {
  conversationAnalyzer,
  ConversationMessage,
  ConversationAnalysisCallbacks
} from '@/lib/services/conversationAnalyzer';
import {
  emotionPartsDetector,
  DetectedLists,
  DetectionCallbacks
} from '@/lib/services/emotionPartsDetector';
import * as DocumentPicker from 'expo-document-picker';

interface VoiceConversationModalProps {
  visible: boolean;
  onClose: () => void;
  onFlowchartCreated: (flowchart: FlowchartStructure) => void;
}

export function VoiceConversationModal({
  visible,
  onClose,
  onFlowchartCreated
}: VoiceConversationModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [selectedVoice, setSelectedVoiceState] = useState<VoiceType>('alloy');
  const modalTranslateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const recordingIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const [isProcessingUserInput, setIsProcessingUserInput] = useState(false);
  
  // Debug wrapper for setIsListening to track state changes
  const setIsListeningWithLogging = (value: boolean) => {
    // console.log(`🔄 setIsListening: ${isListening} → ${value}`, new Error().stack?.split('\n')[2]);
    setIsListening(value);
  };
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState<Array<{
    type: 'user' | 'assistant',
    text: string,
    id: string,
    sessionId?: string,
    fadeAnim?: Animated.Value,
    words?: Array<{
      text: string,
      opacity: Animated.Value
    }>
  }>>([]);
  const [textInput, setTextInput] = useState('');
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentResponseId, setCurrentResponseId] = useState<string | null>(null);
  const [incrementalFlowchart, setIncrementalFlowchart] = useState<FlowchartStructure | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [showIncrementalFlowchart, setShowIncrementalFlowchart] = useState(true);
  const [showTextInput, setShowTextInput] = useState(false);
  const [showWelcomeTooltip, setShowWelcomeTooltip] = useState(false);
  const [showSquareCards, setShowSquareCards] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentUserInputSession, setCurrentUserInputSession] = useState<string | null>(null);
  const [aiResponseQueue, setAiResponseQueue] = useState<Array<{sessionId: string, text: string, responseId: string}>>([]);
  const [allowAIDisplay, setAllowAIDisplay] = useState(false);
  const [detectedItems, setDetectedItems] = useState<DetectedLists>({
    emotions: [],
    parts: [],
    needs: []
  });

  const sessionRef = useRef<VoiceSession | null>(null);
  const textInputRef = useRef<any>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const colorPulseAnim = useRef(new Animated.Value(0)).current;

  // Refs for callback state to prevent closure issues
  const isAIRespondingRef = useRef(false);
  const isStreamingRef = useRef(false);
  const currentResponseIdRef = useRef<string | null>(null);
  const currentUserInputSessionRef = useRef<string | null>(null);
  const userMessageAddedForSessionRef = useRef<string | null>(null);

  // Robust check for when AI responses should display immediately
  const shouldDisplayAIImmediately = () => {
    const currentSession = currentUserInputSessionRef.current;
    return (
      allowAIDisplay && // User message animation completed
      currentSession && // Valid session exists
      userMessageAddedForSessionRef.current === currentSession // User message confirmed for this session
    );
  };

  // Enhanced queue processor - runs when state changes
  useEffect(() => {
    if (shouldDisplayAIImmediately() && aiResponseQueue.length > 0) {
      // Process all queued responses for the current session
      const currentSession = currentUserInputSessionRef.current;
      const responsesToProcess = aiResponseQueue.filter(response => response.sessionId === currentSession);

      if (responsesToProcess.length > 0) {
        // Remove processed responses from queue
        setAiResponseQueue(prev => prev.filter(response => response.sessionId !== currentSession));

        // Add/update all responses in conversation
        responsesToProcess.forEach(queuedResponse => {
          setConversation(prev => {
            const lastMessage = prev[prev.length - 1];
            const existingMessageIndex = prev.findIndex(msg => msg.id === queuedResponse.responseId);

            if (existingMessageIndex >= 0) {
              // Message with this ID already exists - update it
              const updatedConversation = [...prev];
              updatedConversation[existingMessageIndex] = {
                ...updatedConversation[existingMessageIndex],
                text: queuedResponse.text
              };
              return updatedConversation;
            }

            // If last message is assistant with same response ID, update it
            if (lastMessage && lastMessage.type === 'assistant' && lastMessage.id === queuedResponse.responseId) {
              // Update existing message with new content (streaming)
              return [...prev.slice(0, -1), {
                ...lastMessage,
                text: queuedResponse.text
              }];
            } else {
              // Create new assistant message
              return [...prev, {
                type: 'assistant',
                text: queuedResponse.text,
                id: queuedResponse.responseId,
                sessionId: queuedResponse.sessionId
              }];
            }
          });
        });
      }
    }
  }, [allowAIDisplay, aiResponseQueue, currentUserInputSession]);

  // Separate queue monitor - watches for new queue items and processes immediately if ready
  useEffect(() => {
    if (aiResponseQueue.length > 0 && shouldDisplayAIImmediately()) {
      // Process queued responses immediately when conditions are met
      const currentSession = currentUserInputSessionRef.current;
      const responsesToProcess = aiResponseQueue.filter(response => response.sessionId === currentSession);

      if (responsesToProcess.length > 0) {
        // Remove processed responses from queue
        setAiResponseQueue(prev => prev.filter(response => response.sessionId !== currentSession));

        // Add/update all responses in conversation
        responsesToProcess.forEach(queuedResponse => {
          setConversation(prev => {
            const lastMessage = prev[prev.length - 1];
            const existingMessageIndex = prev.findIndex(msg => msg.id === queuedResponse.responseId);

            if (existingMessageIndex >= 0) {
              // Message with this ID already exists - update it
              const updatedConversation = [...prev];
              updatedConversation[existingMessageIndex] = {
                ...updatedConversation[existingMessageIndex],
                text: queuedResponse.text
              };
              return updatedConversation;
            }

            // If last message is assistant with same response ID, update it
            if (lastMessage && lastMessage.type === 'assistant' && lastMessage.id === queuedResponse.responseId) {
              // Update existing message with new content (streaming)
              return [...prev.slice(0, -1), {
                ...lastMessage,
                text: queuedResponse.text
              }];
            } else {
              // Create new assistant message
              return [...prev, {
                type: 'assistant',
                text: queuedResponse.text,
                id: queuedResponse.responseId,
                sessionId: queuedResponse.sessionId
              }];
            }
          });
        });
      }
    }
  }, [aiResponseQueue.length]);

  // Helper function to add user message with fade-in animation
  const addUserMessageWithAnimation = (text: string) => {
    // console.log('📝 Adding user message with animation:', text);
    const fadeAnim = new Animated.Value(0);
    const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    // Session ID is already set in onTranscript callback - no need to generate here
    // Set ref immediately for synchronous access by AI response logic
    const currentSession = currentUserInputSessionRef.current;
    if (currentSession) {
      userMessageAddedForSessionRef.current = currentSession;
    }

    // Stop processing state - text is about to appear
    // console.log('🛑 Stopping processing indicator');
    setIsProcessingUserInput(false);
    
    setConversation(prev => {
      // Check for immediate duplicates
      const lastMessage = prev[prev.length - 1];
      const isImmediateDuplicate = lastMessage && 
        lastMessage.type === 'user' && 
        lastMessage.text === text;
      
      if (isImmediateDuplicate) {
        // console.log('🚫 Skipping immediate duplicate user message:', text);
        return prev;
      }
      
      const newMessage = {
        type: 'user' as const,
        text,
        id: messageId,
        sessionId: currentUserInputSessionRef.current || undefined,
        fadeAnim
      };
      
      // Start fade-in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Animation complete - allow AI responses to display
        setAllowAIDisplay(true);
      });

      return [...prev, newMessage];
    });
  };

  // Helper function to create animated words for AI messages
  const createAnimatedWords = (text: string) => {
    // Split by spaces but preserve punctuation with words
    return text.split(' ').filter(word => word.length > 0).map(word => ({
      text: word + ' ', // Add space back to each word
      opacity: new Animated.Value(0)
    }));
  };

  // Helper function to add assistant message with word-by-word animation
  const addAssistantMessage = (text: string) => {
    const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const words = createAnimatedWords(text);
    
    setConversation(prev => {
      const newMessage = { 
        type: 'assistant' as const, 
        text, 
        id: messageId,
        words
      };
      
      // Start word-by-word animation
      words.forEach((word, index) => {
        setTimeout(() => {
          Animated.timing(word.opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }, index * 100); // 100ms delay between each word
      });
      
      return [...prev, newMessage];
    });
  };

  // Helper function to get node colors
  const getNodeColor = (type: string, isDark: boolean) => {
    const colors = {
      'Self': isDark ? '#2E7D32' : '#66BB6A',
      'Manager': isDark ? '#2196F3' : '#64B5F6', 
      'Firefighter': isDark ? '#FF5722' : '#FF8A65',
      'Exile': isDark ? '#9C27B0' : '#BA68C8',
      'Need': isDark ? '#FF9800' : '#FFB74D'
    };
    return colors[type as keyof typeof colors] || (isDark ? '#666666' : '#CCCCCC');
  };

  // Load voice settings
  const loadVoiceSettingAndInitialize = async () => {
    try {
      const voice = await getSelectedVoice();
      setSelectedVoiceState(voice);
      // console.log('✅ Loaded voice setting:', voice);
      
      // Add small delay to ensure any previous session cleanup is complete
      setTimeout(() => {
        initializeSession();
      }, 500);
    } catch (error) {
      console.error('❌ Error loading voice setting:', error);
    }
  };

  // Handle voice selection change
  const handleVoiceChange = async (voice: VoiceType) => {
    try {
      setSelectedVoiceState(voice);
      await setSelectedVoice(voice);
      // console.log('✅ Voice setting saved:', voice);
    } catch (error) {
      console.error('❌ Error saving voice setting:', error);
    }
  };

  // Handle modal close with animation
  const handleClose = () => {
    // Animate modal sliding down
    Animated.timing(modalTranslateY, {
      toValue: Dimensions.get('window').height,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  useEffect(() => {
    if (visible) {
      // Always start with voice mode (big green button)
      setShowTextInput(false);
      setShowWelcomeTooltip(false);
      
      loadVoiceSettingAndInitialize();
      
      // Animate modal sliding up from bottom
      Animated.timing(modalTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      
      // Show welcome tooltip if this is a fresh conversation
      if (conversation.length === 0) {
        setTimeout(() => {
          setShowWelcomeTooltip(true);
        }, 1000); // Delay to allow UI to settle
      }
    } else {
      cleanupSession();
      setShowWelcomeTooltip(false);
      setShowTextInput(false); // Reset to voice mode when closing
      // Reset modal position for next time
      modalTranslateY.setValue(Dimensions.get('window').height);
    }
    
    return () => cleanupSession();
  }, [visible]);

  // Handle app state changes to prevent UI issues when backgrounding/foregrounding
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      // console.log('📱 App state changed to:', nextAppState);
      
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App going to background - cleanup active sessions
        if (visible && sessionRef.current) {
          console.log('📱 App backgrounded - stopping recording and cleanup');
          try {
            if (isListening) {
              sessionRef.current.stopListening();
              setIsListeningWithLogging(false);
            }
            setIsProcessingUserInput(false);
            setIsAIResponding(false);
          } catch (error) {
            console.warn('⚠️ Error during background cleanup:', error);
          }
        }
      } else if (nextAppState === 'active') {
        // App coming to foreground - ensure clean state
        console.log('📱 App foregrounded - ensuring clean state');
        setIsProcessingUserInput(false);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => subscription?.remove();
  }, [visible, isListening]);

  // Debug effect to monitor button state
  useEffect(() => {
    const color = isListening ? 'RED' : (isAIResponding ? 'BLUE' : 'GREEN');
    // console.log(`🎨 Button Color: ${color} (isListening=${isListening}, isAIResponding=${isAIResponding})`);
  }, [isListening, isAIResponding]);

  // Color pulse animation for recording or AI responding states
  useEffect(() => {
    if (isListening || isAIResponding) {
      // Start pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(colorPulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false, // Can't use native driver for color
          }),
          Animated.timing(colorPulseAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      // Stop animation
      colorPulseAnim.stopAnimation();
      colorPulseAnim.setValue(0);
    }
  }, [isListening, isAIResponding, colorPulseAnim]);

  // Recording indicator animation - only for user input, not AI responses
  useEffect(() => {
    if (isListening || isProcessingUserInput) {
      // Start fade in/out animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingIndicatorOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(recordingIndicatorOpacity, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      recordingIndicatorOpacity.stopAnimation();
      recordingIndicatorOpacity.setValue(0);
    }
  }, [isListening, isProcessingUserInput, recordingIndicatorOpacity]);

  // Setup incremental flowchart callbacks
  // These are COMPLETELY ISOLATED from the voice conversation system
  const analysisCallbacks: ConversationAnalysisCallbacks = {
    onFlowchartUpdate: (flowchart, isPartial) => {
      // Update the incremental flowchart display in chat
      setIncrementalFlowchart(flowchart);
      
      // Flowchart generation temporarily disabled
      // if (!isPartial) {
      //   onFlowchartCreated(flowchart);
      //   // Show success message and close chat after a brief delay
      //   setTimeout(() => {
      //     Alert.alert('Flowchart Generated', 'A flowchart has been created from your conversation and added to the flowchart viewer.', [
      //       { text: 'Continue Conversation', onPress: () => {} },
      //       { text: 'Close Chat', onPress: onClose }
      //     ]);
      //   }, 1000);
      // }
    },
    onAnalysisUpdate: (analysis) => {
      setAnalysisStatus(analysis);
    },
    onError: (error) => {
      setAnalysisStatus(`Analysis Error: ${error.message}`);
    }
  };


  const initializeSession = async () => {
    try {
      setIsLoading(true);
      
      // Skip flowchart template loading for now
      // const template = await loadFlowchartTemplate();
      
      // Generate instructions from the centralized prompt file with null template
      const sessionInstructions = await generateVoiceInstructions(null);
      
      const session = createVoiceSession(
        {
          voice: selectedVoice,
          temperature: 0.7,
          sessionInstructions,
          enableVAD: false
        },
        {
          onConnected: () => {
            setIsConnected(true);
            setIsLoading(false);
          },
          onDisconnected: () => {
            setIsConnected(false);
            setIsListeningWithLogging(false);
          },
          onListeningStart: () => {
            // console.log('🎤 VOICE: Started recording');
            // console.log('🔵 Button State: isListening=true, isAIResponding=false → RED');
            setIsListeningWithLogging(true);
            // Clear AI responding state when we start listening for user input
            setIsAIResponding(false);
            isAIRespondingRef.current = false; // Update ref for callbacks
          },
          onListeningStop: () => {
            // console.log('🛑 VOICE: Stopped recording');
            // console.log('🔵 Button State: isListening=false, isAIResponding=true → BLUE');
            setIsListeningWithLogging(false);
            setIsAIResponding(true); // Set AI responding immediately when recording stops
            isAIRespondingRef.current = true; // Update ref for callbacks
            // Clear any lingering transcript when recording stops
            setTimeout(() => setTranscript(''), 500);
          },
          onTranscript: (transcriptText, isFinal) => {
            if (isFinal) {
              console.log('📝 TRANSCRIPTION:', transcriptText);

              // Analyze user voice message for emotions, parts, and needs
              emotionPartsDetector.addMessage(transcriptText).then(detectedLists => {
                setDetectedItems(detectedLists);
              }).catch(error => {
                console.warn('🔍 [DETECTION] Voice analysis error:', error);
              });

              // Start processing indicator when we begin handling the transcript
              console.log('🟡 Starting processing indicator for transcript');
              setIsProcessingUserInput(true);

              // Generate session ID here BEFORE adding user message to ensure proper ordering
              const newSessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
              setCurrentUserInputSession(newSessionId);
              currentUserInputSessionRef.current = newSessionId;

              // Reset AI display permission for new session
              setAllowAIDisplay(false);

              // Reset transcript
              setTranscript('');

              // Set pending message to ensure it's added before response
              setPendingUserMessage(transcriptText);

              // Add user message to conversation with fade-in animation
              addUserMessageWithAnimation(transcriptText);

              // Add a small delay to ensure user message gets processed before AI response
              setTimeout(() => {
                // This timeout ensures the user message state update has been processed
                // before any AI responses can be added to the conversation
              }, 10);

              // Clear pending after a short delay
              setTimeout(() => setPendingUserMessage(null), 1000);
            } else {
              // Show partial transcript while speaking
              setTranscript(transcriptText);
            }
          },
          onResponseStart: (responseId) => {
            console.log('🔵 Button: AI_RESPONDING');
            setIsAIResponding(true);
            setCurrentResponseId(responseId);
            setIsStreaming(true);
            setIsProcessingUserInput(false);

            // Update refs for callback access
            isAIRespondingRef.current = true;
            isStreamingRef.current = true;
            currentResponseIdRef.current = responseId;
          },
          onResponse: (response) => {
            if (!response) return;

            // Don't start AI response if user is actively recording
            if (isListening) {
              return;
            }

            const currentSession = currentUserInputSessionRef.current;
            const responseId = currentResponseIdRef.current || (currentSession ? `response_${currentSession}` : (Date.now().toString() + Math.random().toString(36).substr(2, 9)));

            // Always queue responses first - let the queue processor decide when to display
            if (currentSession) {
              setAiResponseQueue(prev => {
                // Update existing queued response or add new one
                const existingIndex = prev.findIndex(item => item.responseId === responseId);
                if (existingIndex >= 0) {
                  const updated = [...prev];
                  updated[existingIndex] = { sessionId: currentSession, text: response, responseId };
                  return updated;
                } else {
                  return [...prev, { sessionId: currentSession, text: response, responseId }];
                }
              });
            }
          },
          onResponseComplete: () => {
            console.log('⚪ Button: IDLE');
            setIsAIResponding(false);
            setCurrentResponseId(null); // Reset response ID
            setIsStreaming(false); // Reset streaming state

            // Only clear queue for the current session to avoid clearing queued responses for new sessions
            const currentSession = currentUserInputSessionRef.current;
            if (currentSession) {
              setAiResponseQueue(prev => prev.filter(response => response.sessionId !== currentSession));
            }

            // Reset refs for callback access
            isAIRespondingRef.current = false;
            isStreamingRef.current = false;
            currentResponseIdRef.current = null;
            userMessageAddedForSessionRef.current = null; // Reset for next session

            // Clear user input session to prevent duplicate responses
            // Note: Don't reset currentUserInputSession state here as it's needed for React rendering
            // Only reset the ref to signal that this session is complete
            // The state will be updated when the next user input starts a new session
          },
          onFlowchartGenerated: (flowchart) => {
            // Flowchart generation temporarily disabled
            // onFlowchartCreated(flowchart);
            // Alert.alert('Success', 'Flowchart created successfully!', [
            //   { text: 'Close', onPress: onClose }
            // ]);
            console.log('Flowchart generation disabled - conversation only mode');
          },
          onError: (error) => {
            Alert.alert('Error', error.message);
            setIsLoading(false);
          }
        }
      );
      
      sessionRef.current = session;
      await session.connect();
      
    } catch (error) {
      Alert.alert('Error', 'Failed to initialize voice session');
      setIsLoading(false);
    }
  };

  const cleanupSession = () => {
    if (isCleaningUp) {
      // console.log('🚫 Cleanup already in progress, skipping...');
      return; // Prevent multiple simultaneous cleanups
    }
    
    // console.log('🧹 Starting cleanup session...');
    setIsCleaningUp(true);
    
    if (sessionRef.current) {
      try {
        sessionRef.current.disconnect();
      } catch (error) {
        console.warn('⚠️ Error during session cleanup:', error);
      }
      sessionRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    // Reset incremental flowchart generator
    try {
      conversationAnalyzer.reset();
    } catch (error) {
      console.warn('⚠️ Error resetting incremental flowchart generator:', error);
    }
    setIncrementalFlowchart(null);
    setAnalysisStatus('');
    
    setIsConnected(false);
    setIsListeningWithLogging(false);
    setIsProcessingUserInput(false); // Reset processing state
    setConversation([]);
    setTranscript('');
    setRecordingDuration(0);
    setRecordingStartTime(null);
    setIsAIResponding(false);
    setCurrentResponseId(null);

    // Reset detected items
    emotionPartsDetector.reset();
    setDetectedItems({ emotions: [], parts: [], needs: [] });
    setIsStreaming(false);

    // Reset refs for callback access
    isAIRespondingRef.current = false;
    isStreamingRef.current = false;
    currentResponseIdRef.current = null;

    // Reset cleanup flag
    setIsCleaningUp(false);
  };

  const restartSession = async () => {
    cleanupSession();
    // Wait longer for cleanup to complete before reinitializing
    setTimeout(() => {
      initializeSession();
    }, 2000); // Increased from 1000ms to 2000ms
  };


  
  const handleTapToTalk = () => {
    // IMMEDIATE haptic feedback for tactile response
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    console.log('🎤 handleTapToTalk called', {
      isListening,
      isAIResponding, 
      isConnected,
      hasSession: !!sessionRef.current
    });
    
    // Hide welcome tooltip when user starts interacting
    setShowWelcomeTooltip(false);
    
    if (!sessionRef.current || !isConnected) {
      console.log('⚠️ Cannot handle tap - no session or not connected');
      return;
    }
    
    // Simple interruption logic: if the button shows recording duration of 0ms with substantial file size,
    // that indicates a failed recording attempt (state mismatch) - always force START in this case
    // Also, add a manual "double-tap" detection - if user taps twice quickly, force START
    const sessionIsListening = sessionRef.current?.isListening;
    const hasStateMismatch = isListening && !sessionIsListening;
    
    // Force START in these scenarios:
    // 1. AI is responding 
    // 2. AI audio is playing
    // 3. State mismatch (UI thinks listening but session isn't recording)
    // Note: Removed hasLongRecording condition as it was interfering with normal stop operations
    // The monitoring logic in the service will handle silent recording failures
    const shouldForceStart = isAIResponding || sessionRef.current?.isPlaying || hasStateMismatch;
    
    console.log('🔍 Button decision logic:', {
      isListening,
      isAIResponding,
      sessionIsPlaying: sessionRef.current?.isPlaying,
      sessionIsListening,
      hasStateMismatch,
      recordingDuration,
      shouldForceStart,
      decision: shouldForceStart ? 'FORCE_START' : (isListening ? 'STOP' : 'START')
    });
    
    if (isListening && !shouldForceStart) {
      console.log('🛑 Stopping active recording...');
      
      try {
        // Immediately set AI responding to prevent button turning green
        setIsAIResponding(true);
        isAIRespondingRef.current = true;
        
        sessionRef.current.stopListening();
        
        // Immediately set listening to false to prevent double-tap issues
        setIsListeningWithLogging(false);
        
        // Clear timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
        setRecordingDuration(0);
        setRecordingStartTime(null);
        
        // Clear any transcript preview immediately
        setTranscript('');
        
        
        // SUCCESS haptic feedback for successful recording completion
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
      } catch (error) {
        console.error('❌ Error stopping recording in handleTapToTalk:', error);
      }
    } else {
      // Starting recording (either normal start or forced start due to interruption)
      
      // SET VISUAL STATE IMMEDIATELY for instant feedback
      setIsListeningWithLogging(true);
      setIsAIResponding(false);
      isAIRespondingRef.current = false;
      console.log('🔴 IMMEDIATE: Button state set to RED (listening=true)');
      
      if (shouldForceStart) {
        console.log('🎯 FORCING START - Interrupting AI to start recording');
      }
      
      console.log('▶️ UI: Starting recording...', {
        isListening,
        isAIResponding,
        sessionIsListening: sessionRef.current?.isListening,
        sessionIsPlaying: sessionRef.current?.isPlaying,
        reason: shouldForceStart ? 'AI_INTERRUPTION' : 'NORMAL_START'
      });
      
      try {
        console.log('🎤 UI: Calling sessionRef.current.startListening()');
        sessionRef.current.startListening();
        setTranscript('');
        
        // Start timer
        const startTime = new Date();
        setRecordingStartTime(startTime);
        
        recordingTimerRef.current = setInterval(() => {
          const duration = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
          setRecordingDuration(duration);
        }, 100);
        
      } catch (error) {
        console.error('❌ UI: Error starting recording:', error);
        // Reset visual state if recording fails
        setIsListeningWithLogging(false);
      }
    }
  };



  const handleSendText = () => {
    if (sessionRef.current && isConnected && textInput.trim()) {
      const messageText = textInput.trim();

      // Analyze user message for emotions, parts, and needs
      emotionPartsDetector.addMessage(messageText).then(detectedLists => {
        setDetectedItems(detectedLists);
      }).catch(error => {
        console.warn('🔍 [DETECTION] Text analysis error:', error);
      });

      // Generate session ID for text input (same as voice input)
      const newSessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      setCurrentUserInputSession(newSessionId);
      currentUserInputSessionRef.current = newSessionId;

      // Reset AI display permission for new session
      setAllowAIDisplay(false);

      // Add user message to conversation with fade-in animation
      addUserMessageWithAnimation(messageText);
      
      // Incremental flowchart generation disabled
      // try {
      //   const message: ConversationMessage = {
      //     role: 'user',
      //     content: messageText,
      //     timestamp: new Date()
      //   };
      //   conversationAnalyzer.addMessage(message, analysisCallbacks);
      // } catch (analyzerError) {
      //   // Silently handle analyzer errors - they won't affect voice conversation
      // }
      
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
      
      // Clear input but keep text input visible and focused
      setTextInput('');
      
      // Keep focus on the text input to maintain keyboard
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };

  // Minimized floating button
  if (visible && isMinimized) {
    return (
      <View style={styles.minimizedContainer}>
        <Animated.View
          style={{
            transform: [{ scale: pulseAnim }]
          }}
        >
          <Pressable
            style={[
              styles.minimizedButton,
              { 
                backgroundColor: isListening ? '#FF5722' : (isConnected ? '#2E7D32' : '#666666')
              }
            ]}
            onPress={() => setIsMinimized(false)}
          >
            <Text style={styles.minimizedButtonText}>
              {isListening ? '🔴' : '🎤'}
            </Text>
          </Pressable>
        </Animated.View>
        
        {/* Quick tap-to-talk when minimized */}
        {isConnected && (
          <Pressable
            style={[styles.minimizedTalkButton, { opacity: isConnected ? 1 : 0.5 }]}
            onPress={handleTapToTalk}
            disabled={!isConnected}
          >
            <Text style={styles.minimizedTalkText}>
              {isListening ? '⏹️' : '🎙️'}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={handleClose} />
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: modalTranslateY }],
            }
          ]}
        >
          <BlurView
            intensity={80}
            tint={colorScheme === 'dark' ? 'dark' : 'light'}
            style={styles.blurContainer}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 110 : 0}
            >
            {/* Fixed Header - draggable */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }]}>
                New Loop
              </Text>
              <View style={styles.headerControls}>
                <Pressable
                  style={styles.closeButton}
                  onPress={handleClose}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </Pressable>
              </View>
            </View>

            {/* Elements Section */}
            <View style={styles.elementsSection}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingHorizontal: 20,
                gap: 12,
              }}>
                {/* Dropdown button moved from header */}
                <Pressable
                  style={[
                    styles.minimizeButton,
                    {
                      backgroundColor: colorScheme === 'dark'
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.05)',
                      borderColor: colorScheme === 'dark'
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(0, 0, 0, 0.1)',
                      position: 'relative',
                      top: -5,
                      right: 0,
                      zIndex: 1,
                    }
                  ]}
                  onPress={() => setShowSquareCards(!showSquareCards)}
                >
                  <Text style={[
                    styles.collapsibleArrow,
                    {
                      color: colorScheme === 'dark' ? '#AAAAAA' : '#666666',
                      transform: [{ rotate: showSquareCards ? '0deg' : '-90deg' }]
                    }
                  ]}>
                    ▼
                  </Text>
                </Pressable>

                <Text style={[
                  styles.sectionTitle,
                  {
                    color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                    fontSize: 22.5,
                    fontWeight: '600',
                    marginBottom: 6,
                    fontFamily: 'Georgia',
                    marginTop: 0,
                  }
                ]}>
                  Elements
                </Text>
              </View>
            </View>

            {/* Square Cards Section - only show when dropdown is expanded */}
            {showSquareCards && (
              <View style={styles.collapsibleSection}>
                  <View style={styles.squareCardsContainer}>
                    <View style={styles.squareCardsInner}>
                      <View style={styles.squareCardWrapper}>
                        <Text style={[
                          styles.squareCardTitle,
                          { color: colorScheme === 'dark' ? '#CCCCCC' : '#666666' }
                        ]}>
                          Emotions
                        </Text>
                        <View
                          style={[
                            styles.squareCard,
                            {
                              backgroundColor: colorScheme === 'dark'
                                ? 'rgba(255, 255, 255, 0.1)'
                                : 'rgba(0, 0, 0, 0.05)',
                              borderColor: colorScheme === 'dark'
                                ? 'rgba(255, 255, 255, 0.2)'
                                : 'rgba(0, 0, 0, 0.1)',
                            }
                          ]}
                        >
                          <ScrollView style={styles.cardScrollView} showsVerticalScrollIndicator={false}>
                            {detectedItems.emotions.length === 0 ? (
                              <Text style={[
                                styles.cardEmptyText,
                                { color: colorScheme === 'dark' ? '#888888' : '#999999' }
                              ]}>
                                No emotions detected yet...
                              </Text>
                            ) : (
                              detectedItems.emotions.map((emotion, index) => (
                                <Text
                                  key={`emotion-${index}`}
                                  style={[
                                    styles.cardListItem,
                                    { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }
                                  ]}
                                >
                                  • {emotion}
                                </Text>
                              ))
                            )}
                          </ScrollView>
                        </View>
                      </View>

                      <View style={styles.squareCardWrapper}>
                        <Text style={[
                          styles.squareCardTitle,
                          { color: colorScheme === 'dark' ? '#CCCCCC' : '#666666' }
                        ]}>
                          Parts
                        </Text>
                        <View
                          style={[
                            styles.squareCard,
                            {
                              backgroundColor: colorScheme === 'dark'
                                ? 'rgba(255, 255, 255, 0.1)'
                                : 'rgba(0, 0, 0, 0.05)',
                              borderColor: colorScheme === 'dark'
                                ? 'rgba(255, 255, 255, 0.2)'
                                : 'rgba(0, 0, 0, 0.1)',
                            }
                          ]}
                        >
                          <ScrollView style={styles.cardScrollView} showsVerticalScrollIndicator={false}>
                            {detectedItems.parts.length === 0 ? (
                              <Text style={[
                                styles.cardEmptyText,
                                { color: colorScheme === 'dark' ? '#888888' : '#999999' }
                              ]}>
                                No parts detected yet...
                              </Text>
                            ) : (
                              detectedItems.parts.map((part, index) => (
                                <Text
                                  key={`part-${index}`}
                                  style={[
                                    styles.cardListItem,
                                    { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }
                                  ]}
                                >
                                  • {part}
                                </Text>
                              ))
                            )}
                          </ScrollView>
                        </View>
                      </View>

                      <View style={styles.squareCardWrapper}>
                        <Text style={[
                          styles.squareCardTitle,
                          { color: colorScheme === 'dark' ? '#CCCCCC' : '#666666' }
                        ]}>
                          Needs
                        </Text>
                        <View
                          style={[
                            styles.squareCard,
                            {
                              backgroundColor: colorScheme === 'dark'
                                ? 'rgba(255, 255, 255, 0.1)'
                                : 'rgba(0, 0, 0, 0.05)',
                              borderColor: colorScheme === 'dark'
                                ? 'rgba(255, 255, 255, 0.2)'
                                : 'rgba(0, 0, 0, 0.1)',
                            }
                          ]}
                        >
                          <ScrollView style={styles.cardScrollView} showsVerticalScrollIndicator={false}>
                            {detectedItems.needs.length === 0 ? (
                              <Text style={[
                                styles.cardEmptyText,
                                { color: colorScheme === 'dark' ? '#888888' : '#999999' }
                              ]}>
                                No needs detected yet...
                              </Text>
                            ) : (
                              detectedItems.needs.map((need, index) => (
                                <Text
                                  key={`need-${index}`}
                                  style={[
                                    styles.cardListItem,
                                    { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }
                                  ]}
                                >
                                  • {need}
                                </Text>
                              ))
                            )}
                          </ScrollView>
                        </View>
                      </View>
                    </View>
                  </View>
              </View>
            )}

            {/* Content Container */}
            <View style={styles.modalScrollView}>
                {/* Incremental Flowchart Toggle */}
        {incrementalFlowchart && (
          <View style={styles.incrementalToggleSection}>
            <Pressable
              style={[
                styles.incrementalToggle,
                { backgroundColor: showIncrementalFlowchart ? '#2E7D32' : (isDark ? '#333333' : '#E0E0E0') }
              ]}
              onPress={() => setShowIncrementalFlowchart(!showIncrementalFlowchart)}
            >
              <Text style={[
                styles.incrementalToggleText,
                { color: showIncrementalFlowchart ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#000000') }
              ]}>
                📊 {showIncrementalFlowchart ? 'Hide' : 'Show'} Live Flowchart
              </Text>
            </Pressable>
            {analysisStatus && (
              <Text style={[styles.analysisStatus, { color: isDark ? '#888888' : '#666666' }]}>
                {analysisStatus}
              </Text>
            )}
          </View>
        )}

        {/* Incremental Flowchart Display */}
        {showIncrementalFlowchart && incrementalFlowchart && (
          <View style={[
            styles.incrementalFlowchartContainer,
            { backgroundColor: isDark ? '#1A1A1A' : '#F5F5F5' }
          ]}>
            <Text style={[styles.incrementalFlowchartTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
              🎯 Live Flowchart Analysis
            </Text>
            <ScrollView style={styles.incrementalFlowchartContent} horizontal>
              <View style={styles.flowchartNodes}>
                {incrementalFlowchart.nodes.map((node, index) => (
                  <View
                    key={node.id}
                    style={[
                      styles.flowchartNode,
                      { backgroundColor: getNodeColor(node.type, isDark) }
                    ]}
                  >
                    <Text style={[
                      styles.flowchartNodeText,
                      { color: isDark ? '#FFFFFF' : '#000000' }
                    ]}>
                      {node.label}
                    </Text>
                    <Text style={[
                      styles.flowchartNodeType,
                      { color: isDark ? '#CCCCCC' : '#666666' }
                    ]}>
                      {node.type}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Active Conversation Container */}
        <View style={styles.activeConversationContainer}>
          {/* Conversation */}
          <ScrollView
            ref={scrollViewRef}
            style={[
              styles.conversationContainer,
              { flex: showIncrementalFlowchart && incrementalFlowchart ? 0.6 : 1 }
            ]}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {conversation.map((message, index) => (
            <Animated.View
              key={message.id}
              style={[
                styles.messageTextContainer,
                message.type === 'user' && message.fadeAnim ? {
                  opacity: message.fadeAnim
                } : {}
              ]}
            >
              <Text style={[
                styles.messageText,
                { 
                  color: message.type === 'user' 
                    ? (isDark ? '#CCCCCC' : '#555555') 
                    : (isDark ? '#FFFFFF' : '#000000'),
                  fontWeight: 'normal',
                  textAlign: message.type === 'user' ? 'right' : 'left'
                }
              ]}>
                {message.text}
              </Text>
            </Animated.View>
          ))}
          
          {/* Recording Indicator */}
          {(isListening || isProcessingUserInput) && (
            <View style={styles.messageTextContainer}>
              <View style={[styles.recordingIndicatorContainer, { justifyContent: 'flex-end' }]}>
                <Animated.View style={[
                  styles.recordingIndicator,
                  { 
                    backgroundColor: isDark ? '#CCCCCC' : '#555555',
                    opacity: recordingIndicatorOpacity
                  }
                ]}>
                  <Text style={[
                    styles.recordingText,
                    { color: isDark ? '#000000' : '#FFFFFF' }
                  ]}>
                    ●
                  </Text>
                </Animated.View>
              </View>
            </View>
          )}

          </ScrollView>
        </View>

        {/* Conditional Text Input - positioned above controls */}
        {showTextInput && (
          <View style={[
            styles.textInputContainer,
            {
              paddingHorizontal: 10,
              paddingVertical: 15,
              minHeight: 60,
              marginBottom: -15,
              backgroundColor: colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            }
          ]}>
            <Pressable
              style={[
                styles.textInputVoiceButton,
                { backgroundColor: '#2E7D32' }
              ]}
              onPress={() => {
                // Hide text input and clear it
                setShowTextInput(false);
                setTextInput('');
                // Just switch back to voice mode without starting recording
              }}
            >
              <Image
                source={require('@/assets/images/Logo.png')}
                style={[
                  styles.textInputVoiceButtonLogo,
                  { tintColor: '#FFF' }
                ]}
                resizeMode="contain"
              />
            </Pressable>
            <View style={styles.textInputWithButton}>
              <TextInput
                ref={textInputRef}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: 'transparent',
                    color: isDark ? '#FFFFFF' : '#000000',
                    borderColor: isDark ? '#555555' : '#C7C7CC',
                    borderWidth: 1
                  }
                ]}
                placeholder=""
                placeholderTextColor={isDark ? '#888888' : '#666666'}
                value={textInput}
                onChangeText={setTextInput}
                multiline
                editable={isConnected}
                autoFocus={true}
              />
              <Pressable
                style={[
                  styles.sendButton,
                  { opacity: (isConnected && textInput.trim()) ? 1 : 0.5 }
                ]}
                onPress={handleSendText}
                disabled={!isConnected || !textInput.trim()}
              >
                <IconSymbol
                  size={18}
                  name="arrow.up"
                  color="#FFFFFF"
                />
              </Pressable>
            </View>
          </View>
        )}

        {/* Controls - Transparent Container */}
        <View style={[
          styles.controlsContainer,
          { 
            paddingBottom: showTextInput ? 0 : 34, // Only add bottom padding when text input is hidden
            backgroundColor: 'transparent',
            borderTopWidth: 0,
          }
        ]}>
          {/* Voice Controls */}
          <View style={styles.voiceControlsContainer}>
            {/* Text Input Toggle Button - only shown when text input is hidden */}
            <View style={styles.leftControls}>
              {!showTextInput && (
                <Pressable
                  style={[
                    styles.textToggleButton,
                    { backgroundColor: isDark ? '#333333' : '#E0E0E0' }
                  ]}
                  onPress={() => {
                    setShowTextInput(true);
                    setShowWelcomeTooltip(false); // Hide tooltip when opening text input
                    
                    // Auto-focus when showing it
                    setTimeout(() => {
                      textInputRef.current?.focus();
                    }, 100);
                  }}
                >
                  <IconSymbol 
                    size={20} 
                    name="pencil" 
                    color={isDark ? '#FFFFFF' : '#000000'} 
                  />
                </Pressable>
              )}
            </View>

            {/* Centered Voice Button - only show when text input is hidden */}
            <View style={styles.centerControls}>
              {!showTextInput && (
                <View style={styles.voiceButtonContainer}>
                  {/* Welcome Tooltip */}
                  {showWelcomeTooltip && isConnected && !isListening && !isAIResponding && (
                    <View style={[
                      styles.welcomeTooltip,
                      { backgroundColor: isDark ? '#333333' : '#000000' }
                    ]}>
                      <Text style={styles.welcomeTooltipText}>
                        Tap to toggle recording
                      </Text>
                      <View style={styles.tooltipArrowContainer}>
                        <View style={[
                          styles.tooltipArrow,
                          { borderTopColor: isDark ? '#333333' : '#000000' }
                        ]} />
                      </View>
                    </View>
                  )}
                  
                  <Animated.View
                  style={{
                    backgroundColor: colorPulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: isListening 
                        ? ['#FF5722', '#BF360C']  // Red to much darker red when recording
                        : isAIResponding 
                          ? ['#2196F3', '#1565C0']  // Blue to darker blue when AI is responding
                          : ['#2E7D32', '#2E7D32'], // Green stays the same when idle (no pulsing)
                    }),
                    borderRadius: 50,
                    opacity: isConnected ? 1 : 0.5
                  }}
                >
                  <Pressable
                    style={styles.circularVoiceButton}
                    onPress={() => {
                      // Normal voice button behavior only (text input now has its own button)
                      console.log('🚨 BUTTON PRESSED DURING:', {
                        isListening,
                        isAIResponding,
                        isPlaying: !!sessionRef.current?.isPlaying
                      });
                      handleTapToTalk();
                    }}
                    disabled={!isConnected}
                  >
                    <Image 
                      source={require('@/assets/images/Logo.png')}
                      style={[
                        styles.voiceButtonLogo,
                        { 
                          tintColor: '#FFF',
                        }
                      ]}
                      resizeMode="contain"
                    />
                  </Pressable>
                </Animated.View>
                </View>
              )}
            </View>

            {/* Settings Button - Bottom Right */}
            <View style={styles.rightControls}>
              {!showTextInput && (
                <Pressable
                  style={[
                    styles.settingsButton,
                    { backgroundColor: isDark ? '#333333' : '#E0E0E0' }
                  ]}
                  onPress={() => setShowVoiceSettings(true)}
                >
                  <IconSymbol size={20} name="slider.horizontal.3" color={isDark ? '#fff' : '#000'} />
                </Pressable>
              )}
            </View>
          </View>

        </View>
            </View>
            </KeyboardAvoidingView>
          </BlurView>
        </Animated.View>
      </View>

      {/* Voice Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showVoiceSettings}
        onRequestClose={() => setShowVoiceSettings(false)}
      >
        <View style={styles.voiceModalOverlay}>
          <BlurView intensity={50} style={styles.voiceModalOverlay}>
            <View style={[styles.voiceSettingsModal, { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF' }]}>
              {/* Settings Header */}
              <View style={styles.settingsHeader}>
                <Text style={[styles.settingsTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                  Voice Settings
                </Text>
                <Pressable
                  style={styles.settingsCloseButton}
                  onPress={() => setShowVoiceSettings(false)}
                >
                  <Text style={styles.settingsCloseText}>✕</Text>
                </Pressable>
              </View>

              {/* Voice Selection */}
              <View style={styles.voiceSettingsContent}>
                <Text style={[styles.settingsSectionTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                  Voice Assistant
                </Text>
                <Text style={[styles.settingsSectionDescription, { color: isDark ? '#CCCCCC' : '#666666' }]}>
                  Choose the voice for your AI therapy companion
                </Text>
                
                <View style={styles.voiceGrid}>
                  {getAllVoices().map((voice) => (
                    <Pressable
                      key={voice}
                      style={[
                        styles.voiceButton,
                        {
                          backgroundColor: selectedVoice === voice 
                            ? '#2E7D32' 
                            : (isDark ? '#333333' : '#E0E0E0'),
                        }
                      ]}
                      onPress={() => handleVoiceChange(voice)}
                    >
                      <Text style={[
                        styles.voiceButtonText,
                        { color: selectedVoice === voice ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#000000') }
                      ]}>
                        {voice}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 65,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    position: 'absolute',
    top: 110,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  blurContainer: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    fontSize: 35,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
    fontFamily: 'Georgia',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: -5,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    textAlign: 'left',
    fontFamily: 'Georgia',
    lineHeight: 50,
    flex: 1,
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
    fontFamily: 'Georgia',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickActionsToggle: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    fontFamily: 'Georgia',
  },
  templateButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  templateButtonText: {
    fontSize: 14,
    fontFamily: 'Georgia',
  },
  conversationContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messageTextContainer: {
    marginVertical: 12,
  },
  messageText: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '400',
    fontFamily: 'Georgia',
  },
  recordingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  transcriptText: {
    fontSize: 14,
    color: '#856404',
    fontStyle: 'italic',
    fontFamily: 'Georgia',
  },
  controlsContainer: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderTopWidth: 0,
    backgroundColor: 'transparent',
  },
  voiceControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    paddingHorizontal: 20,
  },
  leftControls: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerControls: {
    flex: 1,
    alignItems: 'center',
  },
  voiceButtonContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  welcomeTooltip: {
    position: 'absolute',
    bottom: 120, // Position above the voice button
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1000,
  },
  welcomeTooltipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: 'Georgia',
  },
  tooltipArrowContainer: {
    position: 'absolute',
    bottom: -6,
    width: '100%',
    height: 6,
  },
  tooltipArrow: {
    position: 'absolute',
    left: '50%',
    marginLeft: 3, // Fine adjustment to move slightly right
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderBottomWidth: 0,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  rightControls: {
    flex: 1,
    alignItems: 'flex-end',
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
    fontFamily: 'Georgia',
  },
  circularVoiceButton: {
    width: 100,
    height: 100,
    backgroundColor: 'transparent', // Background now handled by Animated.View
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  voiceButtonLogo: {
    width: 80,
    height: 80,
  },
  textToggleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 10, // Default spacing, overridden conditionally
  },
  textInputWithButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingRight: 44, // Add space for the send button
    minHeight: 36,
    maxHeight: 100,
    fontSize: 18,
    textAlignVertical: 'center',
    fontFamily: 'Georgia',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 4,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Georgia',
  },
  textInputVoiceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInputVoiceButtonLogo: {
    width: 32,
    height: 32,
  },
  instructionText: {
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
    fontFamily: 'Georgia',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  minimizeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFC107',
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimizeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 18,
    fontFamily: 'Georgia',
  },
  minimizedContainer: {
    position: 'absolute',
    top: 100,
    right: 20,
    zIndex: 1000,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  minimizedButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  minimizedButtonText: {
    fontSize: 24,
    fontFamily: 'Georgia',
  },
  minimizedTalkButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  minimizedTalkText: {
    fontSize: 20,
    fontFamily: 'Georgia',
  },
  incrementalToggleSection: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  incrementalToggle: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    alignSelf: 'center',
  },
  incrementalToggleText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Georgia',
  },
  analysisStatus: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
    fontStyle: 'italic',
    fontFamily: 'Georgia',
  },
  incrementalFlowchartContainer: {
    maxHeight: 200,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    padding: 15,
  },
  incrementalFlowchartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: 'Georgia',
  },
  incrementalFlowchartContent: {
    flex: 1,
  },
  flowchartNodes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  flowchartNode: {
    padding: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  flowchartNodeText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
    fontFamily: 'Georgia',
  },
  flowchartNodeType: {
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '400',
    fontFamily: 'Georgia',
  },
  // Voice Settings Modal Styles
  voiceModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceSettingsModal: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Georgia',
  },
  settingsCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Georgia',
  },
  voiceSettingsContent: {
    padding: 20,
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: 'Georgia',
  },
  settingsSectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    fontFamily: 'Georgia',
  },
  voiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  voiceButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  voiceButtonText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Georgia',
    textTransform: 'capitalize',
  },
  // Collapsible Section Styles
  collapsibleSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 10,
  },
  collapsibleHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Georgia',
  },
  collapsibleArrow: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Square Cards Styles
  squareCardsContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  squareCardsInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  squareCardWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  squareCardTitle: {
    fontSize: 20,
    fontFamily: 'Georgia',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  squareCard: {
    width: '100%',
    maxWidth: 110,
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    padding: 8,
  },
  cardScrollView: {
    flex: 1,
    width: '100%',
  },
  cardEmptyText: {
    fontSize: 11,
    fontFamily: 'Georgia',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 15,
    lineHeight: 14,
  },
  cardListItem: {
    fontSize: 11,
    fontFamily: 'Georgia',
    lineHeight: 14,
    marginBottom: 4,
  },
  elementsSection: {
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 22.5,
    fontWeight: '600',
    marginBottom: 6,
    fontFamily: 'Georgia',
  },
  activeConversationContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    marginHorizontal: 10,
    marginVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
});