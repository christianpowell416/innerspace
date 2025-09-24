import React, { useState, useEffect, useRef, Suspense } from 'react';
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
  BackHandler,
  Keyboard,
  PanResponder,
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
import { EmotionBubbleData } from '@/lib/types/bubbleChart';
import { PartBubbleData, NeedBubbleData } from '@/lib/types/partsNeedsChart';
import {
  transformDetectedEmotions,
  transformDetectedParts,
  transformDetectedNeeds,
  resetDetectionTracking,
  setDetectionConversationId
} from '@/lib/utils/detectionDataTransform';
import * as DocumentPicker from 'expo-document-picker';

// Lazy load bubble chart components to prevent them from loading until needed
const PartsHoneycombMiniBubbleChart = React.lazy(() => import('@/components/PartsHoneycombMiniBubbleChart'));
const NeedsHoneycombMiniBubbleChart = React.lazy(() => import('@/components/NeedsHoneycombMiniBubbleChart'));
const EmotionsHoneycombMiniBubbleChart = React.lazy(() => import('@/components/EmotionsHoneycombMiniBubbleChart'));

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
  const textInputMarginBottom = useRef(new Animated.Value(10)).current;
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
    }>,
    isRecording?: boolean,
    isProcessing?: boolean,
    isThinking?: boolean
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
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentUserInputSession, setCurrentUserInputSession] = useState<string | null>(null);
  // REMOVED: aiResponseQueue state - no longer needed with placeholder approach
  const [allowAIDisplay, setAllowAIDisplay] = useState(false);
  const [detectedItems, setDetectedItems] = useState<DetectedLists>({
    emotions: [],
    parts: [],
    needs: []
  });

  // Bubble chart data state
  const [detectedEmotionsData, setDetectedEmotionsData] = useState<EmotionBubbleData[]>([]);
  const [detectedPartsData, setDetectedPartsData] = useState<PartBubbleData[]>([]);
  const [detectedNeedsData, setDetectedNeedsData] = useState<NeedBubbleData[]>([]);

  // Chart dimensions state
  const [emotionsChartDimensions, setEmotionsChartDimensions] = useState({ width: 110, height: 110 });
  const [partsChartDimensions, setPartsChartDimensions] = useState({ width: 110, height: 110 });
  const [needsChartDimensions, setNeedsChartDimensions] = useState({ width: 110, height: 110 });

  // Chart loading state
  const [shouldRenderBubbleCharts, setShouldRenderBubbleCharts] = useState(false);

  const sessionRef = useRef<VoiceSession | null>(null);
  const textInputRef = useRef<any>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const colorPulseAnim = useRef(new Animated.Value(0)).current;

  // Create pan responder for swipe-down gesture (header)
  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes
        return gestureState.dy > 0;
      },
      onPanResponderMove: (_, gestureState) => {
        // Move modal with finger
        if (gestureState.dy > 0) {
          modalTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped down more than 100px or with velocity, close modal
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleClose();
        } else {
          // Snap back to top
          Animated.timing(modalTranslateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Refs for callback state to prevent closure issues
  const isAIRespondingRef = useRef(false);
  const isStreamingRef = useRef(false);
  const currentResponseIdRef = useRef<string | null>(null);
  const currentUserInputSessionRef = useRef<string | null>(null);
  const userMessageAddedForSessionRef = useRef<string | null>(null);

  // Robust check for when AI responses should display immediately
  const shouldDisplayAIImmediately = () => {
    const currentSession = currentUserInputSessionRef.current;
    const result = (
      allowAIDisplay && // User message animation completed
      currentSession && // Valid session exists
      userMessageAddedForSessionRef.current === currentSession // User message confirmed for this session
    );


    return result;
  };

  // REMOVED: Complex queue processing system - replaced by immediate placeholder creation
  //
  // Previous approach: Complex timing-based queue system with fallback timers
  // New approach: Create AI message placeholder immediately in onResponseStart,
  //               populate with streaming in onResponseStreaming, finalize in onResponse
  //
  // This ensures:
  // ✅ Proper message ordering (placeholder created at correct time)
  // ✅ Real-time streaming (always has message to update)
  // ✅ Works for all message lengths (no timing dependencies)
  // ✅ Simplified, reliable logic

  // REMOVED: Duplicate queue processor that was causing race conditions with the main processor above

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
      setShowSquareCards(false); // Always hide mini charts on open
      
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

  // Track keyboard visibility and animate margin
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        Animated.timing(textInputMarginBottom, {
          toValue: -5,
          duration: 0,
          useNativeDriver: false,
        }).start();
      }
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        Animated.timing(textInputMarginBottom, {
          toValue: 10,
          duration: 0,
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

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

  // Recording indicator animation - for all message indicators (recording, processing, thinking)
  useEffect(() => {
    const messageIndicators = conversation.filter(msg => msg.isRecording || msg.isProcessing || msg.isThinking);
    const hasActiveIndicators = isListening || isProcessingUserInput ||
      conversation.some(msg => msg.isRecording || msg.isProcessing || msg.isThinking);

    if (hasActiveIndicators) {
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
  }, [isListening, isProcessingUserInput, conversation, recordingIndicatorOpacity]);

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

            // Create a new session for this user input
            const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            setCurrentUserInputSession(sessionId);
            currentUserInputSessionRef.current = sessionId;

            // Add user recording indicator to conversation immediately
            const recordingMessageId = 'recording-' + sessionId;

            setConversation(prev => {
              // Check if recording indicator already exists (avoid duplicates)
              const existingIndex = prev.findIndex(msg => msg.id === recordingMessageId);
              if (existingIndex >= 0) {
                return prev;
              }

              return [...prev, {
                type: 'user',
                text: '', // Empty text initially
                id: recordingMessageId,
                sessionId: sessionId,
                timestamp: Date.now(),
                isRecording: true // Flag to show recording indicator
              }];
            });
          },
          onListeningStop: () => {
            setIsListeningWithLogging(false);
            setIsAIResponding(true); // Set AI responding immediately when recording stops
            isAIRespondingRef.current = true; // Update ref for callbacks

            // Clear any lingering transcript when recording stops
            setTimeout(() => setTranscript(''), 500);


            // Update recording indicator to processing state
            const currentSession = currentUserInputSessionRef.current;
            if (currentSession) {
              const recordingMessageId = 'recording-' + currentSession;

              setConversation(prev => {
                const existingIndex = prev.findIndex(msg => msg.id === recordingMessageId);
                if (existingIndex >= 0) {
                  const updatedConversation = [...prev];
                  updatedConversation[existingIndex] = {
                    ...updatedConversation[existingIndex],
                    isRecording: false,
                    isProcessing: true // Flag to show processing state
                  };
                  return updatedConversation;
                } else {
                  return prev;
                }
              });

              // Fallback for empty recordings: if no transcript comes within 3 seconds, assume empty
              setTimeout(() => {
                // Check if we still have a processing indicator (meaning no transcript came)
                setConversation(currentConversation => {
                  const processingMessage = currentConversation.find(msg => msg.id === recordingMessageId && msg.isProcessing);

                  if (processingMessage) {

                    // Remove the processing indicator
                    const filtered = currentConversation.filter(msg => msg.id !== recordingMessageId);

                    // Reset all states to idle (simulate empty transcript handling)
                    setIsListeningWithLogging(false);
                    setIsProcessingUserInput(false);
                    setIsAIResponding(false);
                    setCurrentResponseId(null);
                    setIsStreaming(false);

                    // Reset refs
                    isAIRespondingRef.current = false;
                    isStreamingRef.current = false;
                    currentResponseIdRef.current = null;

                    // Show tooltip
                    setShowWelcomeTooltip(true);
                    setTimeout(() => setShowWelcomeTooltip(false), 3000);

                    return filtered;
                  } else {
                    return currentConversation;
                  }
                });
              }, 3000); // 3 second timeout for empty recording detection
            }
          },
          onTranscript: (transcriptText, isFinal) => {
            if (isFinal) {
              console.log('👤 USER:', transcriptText);

              // Check if the transcript is empty or just whitespace
              if (!transcriptText || transcriptText.trim().length === 0) {

                // Remove the recording indicator from conversation - use USER INPUT session (not currentSession)
                const userInputSession = currentUserInputSessionRef.current;
                if (!userInputSession) {
                  return;
                }

                const recordingMessageId = 'recording-' + userInputSession;

                setConversation(prev => {
                  const beforeCount = prev.length;
                  const filtered = prev.filter(msg => {
                    const shouldKeep = msg.id !== recordingMessageId;
                    if (!shouldKeep) {
                    }
                    return shouldKeep;
                  });
                  const afterCount = filtered.length;
                  return filtered;
                });

                // Reset all recording/processing states to idle - simulate complete response cycle

                // Complete state reset - simulate onResponseComplete logic
                setIsListeningWithLogging(false);
                setIsProcessingUserInput(false);
                setIsAIResponding(false);
                setCurrentResponseId(null);
                setIsStreaming(false);

                // Reset all refs
                isAIRespondingRef.current = false;
                isStreamingRef.current = false;
                currentResponseIdRef.current = null;


                // Show tooltip to guide user
                setShowWelcomeTooltip(true);

                // Hide tooltip after 3 seconds
                setTimeout(() => {
                  setShowWelcomeTooltip(false);
                }, 3000);

                return; // Don't process empty transcript further
              }

              // Analyze user voice message for emotions, parts, and needs
              emotionPartsDetector.addMessage(transcriptText).then(detectedLists => {
                setDetectedItems(detectedLists);

                // Transform detected items to bubble chart data
                const conversationId = sessionRef.current?.sessionId || undefined;
                setDetectedEmotionsData(transformDetectedEmotions(detectedLists.emotions, conversationId));
                setDetectedPartsData(transformDetectedParts(detectedLists.parts, conversationId));
                setDetectedNeedsData(transformDetectedNeeds(detectedLists.needs, conversationId));

                // Enable bubble chart rendering and expand cards if we have data
                if (detectedLists.emotions.length > 0 || detectedLists.parts.length > 0 || detectedLists.needs.length > 0) {
                  setShouldRenderBubbleCharts(true);
                  setShowSquareCards(true); // Auto-expand when new items detected
                }
              }).catch(error => {
              });

              // Start processing indicator when we begin handling the transcript
              setIsProcessingUserInput(true);

              // Use existing session ID from onListeningStart (don't create new one)
              const currentSession = currentUserInputSessionRef.current;

              if (!currentSession) {
                const fallbackSessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                setCurrentUserInputSession(fallbackSessionId);
                currentUserInputSessionRef.current = fallbackSessionId;
              }

              // Reset AI display permission for new session
              setAllowAIDisplay(false);

              // Reset transcript
              setTranscript('');

              // Set pending message to ensure it's added before response
              setPendingUserMessage(transcriptText);

              // Set ref immediately for synchronous access by AI response logic
              if (currentSession) {
                userMessageAddedForSessionRef.current = currentSession;
              }

              // Replace recording indicator with actual user message
              const recordingMessageId = 'recording-' + (currentSession || currentUserInputSessionRef.current);

              setConversation(prev => {
                const existingIndex = prev.findIndex(msg => msg.id === recordingMessageId);
                if (existingIndex >= 0) {
                  // Replace recording indicator with actual message with fade-in animation
                  const fadeAnim = new Animated.Value(0);
                  const updatedConversation = [...prev];
                  updatedConversation[existingIndex] = {
                    type: 'user',
                    text: transcriptText,
                    id: recordingMessageId, // Keep same ID for seamless transition
                    sessionId: currentSession || currentUserInputSessionRef.current,
                    timestamp: Date.now(),
                    isRecording: false,
                    isProcessing: false,
                    fadeAnim
                  };

                  // Start fade-in animation
                  Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                  }).start();

                  return updatedConversation;
                } else {
                  // Fallback: add as new message if recording indicator not found
                  console.warn('📝 [TRANSCRIPT] Recording indicator not found, adding as new message');
                  const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                  return [...prev, {
                    type: 'user',
                    text: transcriptText,
                    id: messageId,
                    sessionId: currentSession || currentUserInputSessionRef.current,
                    timestamp: Date.now()
                  }];
                }
              });

              // Enable AI display after message is added
              setTimeout(() => {
                setAllowAIDisplay(true);
              }, 50); // Small delay to ensure message update is processed

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
            setIsAIResponding(true);
            setCurrentResponseId(responseId);
            setIsStreaming(true);
            setIsProcessingUserInput(false);

            // Update refs for callback access
            isAIRespondingRef.current = true;
            isStreamingRef.current = true;
            currentResponseIdRef.current = responseId;

            // Create AI thinking indicator immediately
            const currentSession = currentUserInputSessionRef.current;
            if (currentSession) {

              setConversation(prev => {
                // Check if message already exists (avoid duplicates)
                const existingIndex = prev.findIndex(msg => msg.id === responseId);
                if (existingIndex >= 0) {
                  return prev;
                }

                // Create AI thinking indicator for streaming to populate
                return [...prev, {
                  type: 'assistant',
                  text: '', // Empty initially, will be populated by streaming
                  id: responseId,
                  sessionId: currentSession,
                  timestamp: Date.now(),
                  isThinking: true // Flag to show thinking indicator
                }];
              });
            }
          },
          onResponseStreaming: (response, isComplete) => {
            // Handle real-time streaming display - update placeholder created in onResponseStart
            if (!response) return;

            const currentSession = currentUserInputSessionRef.current;
            const responseId = currentResponseIdRef.current;

            if (!responseId || !currentSession) {
              console.warn('💬 [STREAMING] Missing responseId or session:', { responseId, currentSession });
              return;
            }


            // Update the AI thinking indicator with streaming text
            setConversation(prev => {
              const existingMessageIndex = prev.findIndex(msg => msg.id === responseId);

              if (existingMessageIndex >= 0) {
                // ✅ Update AI thinking indicator with streaming text
                const updatedConversation = [...prev];
                updatedConversation[existingMessageIndex] = {
                  ...updatedConversation[existingMessageIndex],
                  text: response,
                  isThinking: false // Remove thinking state once streaming starts
                };
                return updatedConversation;
              } else {
                // This should not happen if thinking indicator was created in onResponseStart
                console.warn('💬 [STREAMING] AI thinking indicator not found for responseId:', responseId);
                return prev;
              }
            });
          },
          onResponse: (response) => {
            // Handle final response completion - ensure placeholder has complete punctuation
            if (!response) {
              return;
            }

            const currentSession = currentUserInputSessionRef.current;
            const responseId = currentResponseIdRef.current;

            if (!responseId || !currentSession) {
              console.warn('💬 [AI] Missing responseId or session for final response:', { responseId, currentSession });
              return;
            }


            // Update placeholder message with final complete response (ensures punctuation)
            setConversation(prev => {
              const existingMessageIndex = prev.findIndex(msg => msg.id === responseId);

              if (existingMessageIndex >= 0) {
                // ✅ Update placeholder with final complete response
                const updatedConversation = [...prev];
                updatedConversation[existingMessageIndex] = {
                  ...updatedConversation[existingMessageIndex],
                  text: response, // Final response with complete punctuation
                  isThinking: false // Ensure thinking state is removed
                };
                return updatedConversation;
              } else {
                // This should not happen if placeholder was created in onResponseStart
                console.warn('💬 [AI] Placeholder message not found for final response:', responseId);
                return prev;
              }
            });
          },
          onResponseComplete: () => {

            setIsAIResponding(false);
            setCurrentResponseId(null); // Reset response ID
            setIsStreaming(false); // Reset streaming state

            // Reset refs for callback access
            isAIRespondingRef.current = false;
            isStreamingRef.current = false;

            currentResponseIdRef.current = null;

            // Reset session tracking for next interaction
            setTimeout(() => {
              userMessageAddedForSessionRef.current = null; // Reset for next session
            }, 100); // Small delay to ensure any final updates complete
          },
          onFlowchartGenerated: (flowchart) => {
            // Flowchart generation temporarily disabled
            // onFlowchartCreated(flowchart);
            // Alert.alert('Success', 'Flowchart created successfully!', [
            //   { text: 'Close', onPress: onClose }
            // ]);
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

    // Reset bubble chart data and tracking
    setDetectedEmotionsData([]);
    setDetectedPartsData([]);
    setDetectedNeedsData([]);
    setShouldRenderBubbleCharts(false);
    resetDetectionTracking();

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
    
    
    // Hide welcome tooltip when user starts interacting
    setShowWelcomeTooltip(false);
    
    if (!sessionRef.current || !isConnected) {
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
    
    
    if (isListening && !shouldForceStart) {
      
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
      
      if (shouldForceStart) {
      }
      
      
      try {
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



  const processSendText = (finalText: string) => {
    if (sessionRef.current && isConnected && finalText.trim()) {
      const messageText = finalText.trim();

        // Analyze user message for emotions, parts, and needs
      emotionPartsDetector.addMessage(messageText).then(detectedLists => {
        setDetectedItems(detectedLists);

        // Transform detected items to bubble chart data
        const conversationId = sessionRef.current?.sessionId || undefined;
        setDetectedEmotionsData(transformDetectedEmotions(detectedLists.emotions, conversationId));
        setDetectedPartsData(transformDetectedParts(detectedLists.parts, conversationId));
        setDetectedNeedsData(transformDetectedNeeds(detectedLists.needs, conversationId));

        // Enable bubble chart rendering and expand cards if we have data
        if (detectedLists.emotions.length > 0 || detectedLists.parts.length > 0 || detectedLists.needs.length > 0) {
          setShouldRenderBubbleCharts(true);
          setShowSquareCards(true); // Auto-expand when new items detected
        }
      }).catch(error => {
      });

      // Generate session ID for text input (same as voice input)
      const newSessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      setCurrentUserInputSession(newSessionId);
      currentUserInputSessionRef.current = newSessionId;

      // Reset AI display permission for new session
      setAllowAIDisplay(false);

      // Add user message to conversation with fade-in animation (using corrected text)
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

  const handleSendText = () => {
    if (sessionRef.current && isConnected && textInput.trim()) {
      // Process the message directly without blurring
      processSendText(textInput);
    }
  };

  const handleTextEndEditing = (event: any) => {
    // Just update the text with any autocorrect changes
    const finalText = event.nativeEvent.text;
    if (finalText !== textInput) {
      setTextInput(finalText);
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

  // Modal content
  const modalContent = (
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
            <View
              style={styles.modalHeader}
              {...headerPanResponder.panHandlers}
            >
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                flex: 1,
              }}>
                {/* Dropdown button moved from Elements section */}
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
                      width: 28,
                      height: 28,
                      alignItems: 'center',
                      justifyContent: 'center',
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
                <Text style={[styles.modalTitle, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }]}>
                  New Conversation
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
                          {
                            color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                            fontWeight: 'bold'
                          }
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
                              padding: 0, // Remove padding for chart
                            }
                          ]}
                          onLayout={(event) => {
                            const { width, height } = event.nativeEvent.layout;
                            if (width > 0 && height > 0) {
                              setEmotionsChartDimensions({ width, height });
                            }
                          }}
                        >
                          {detectedEmotionsData.length === 0 ? (
                            <View style={styles.cardEmptyContainer}>
                              <Text style={[
                                styles.cardEmptyText,
                                { color: colorScheme === 'dark' ? '#888888' : '#999999' }
                              ]}>
                                No emotions detected yet...
                              </Text>
                            </View>
                          ) : shouldRenderBubbleCharts ? (
                            <Suspense fallback={<View style={styles.cardEmptyContainer} />}>
                              <EmotionsHoneycombMiniBubbleChart
                                data={detectedEmotionsData}
                                width={emotionsChartDimensions.width}
                                height={emotionsChartDimensions.height}
                                loading={!shouldRenderBubbleCharts}
                              />
                            </Suspense>
                          ) : (
                            <View style={styles.cardEmptyContainer} />
                          )}
                        </View>
                      </View>

                      <View style={styles.squareCardWrapper}>
                        <Text style={[
                          styles.squareCardTitle,
                          {
                            color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                            fontWeight: 'bold'
                          }
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
                              padding: 0, // Remove padding for chart
                            }
                          ]}
                          onLayout={(event) => {
                            const { width, height } = event.nativeEvent.layout;
                            if (width > 0 && height > 0) {
                              setPartsChartDimensions({ width, height });
                            }
                          }}
                        >
                          {detectedPartsData.length === 0 ? (
                            <View style={styles.cardEmptyContainer}>
                              <Text style={[
                                styles.cardEmptyText,
                                { color: colorScheme === 'dark' ? '#888888' : '#999999' }
                              ]}>
                                No parts detected yet...
                              </Text>
                            </View>
                          ) : shouldRenderBubbleCharts ? (
                            <Suspense fallback={<View style={styles.cardEmptyContainer} />}>
                              <PartsHoneycombMiniBubbleChart
                                data={detectedPartsData}
                                width={partsChartDimensions.width}
                                height={partsChartDimensions.height}
                                loading={!shouldRenderBubbleCharts}
                              />
                            </Suspense>
                          ) : (
                            <View style={styles.cardEmptyContainer} />
                          )}
                        </View>
                      </View>

                      <View style={styles.squareCardWrapper}>
                        <Text style={[
                          styles.squareCardTitle,
                          {
                            color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                            fontWeight: 'bold'
                          }
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
                              padding: 0, // Remove padding for chart
                            }
                          ]}
                          onLayout={(event) => {
                            const { width, height } = event.nativeEvent.layout;
                            if (width > 0 && height > 0) {
                              setNeedsChartDimensions({ width, height });
                            }
                          }}
                        >
                          {detectedNeedsData.length === 0 ? (
                            <View style={styles.cardEmptyContainer}>
                              <Text style={[
                                styles.cardEmptyText,
                                { color: colorScheme === 'dark' ? '#888888' : '#999999' }
                              ]}>
                                No needs detected yet...
                              </Text>
                            </View>
                          ) : shouldRenderBubbleCharts ? (
                            <Suspense fallback={<View style={styles.cardEmptyContainer} />}>
                              <NeedsHoneycombMiniBubbleChart
                                data={detectedNeedsData}
                                width={needsChartDimensions.width}
                                height={needsChartDimensions.height}
                                loading={!shouldRenderBubbleCharts}
                              />
                            </Suspense>
                          ) : (
                            <View style={styles.cardEmptyContainer} />
                          )}
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
        <View style={[
          styles.activeConversationContainer,
          { borderColor: isDark ? '#555555' : '#C7C7CC' }
        ]}>
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
              {/* Show indicator or message text based on state */}
              {message.isRecording ? (
                // User recording indicator
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
              ) : message.isProcessing ? (
                // User processing indicator with pulsating animation
                <View style={[styles.recordingIndicatorContainer, { justifyContent: 'flex-end' }]}>
                  <Animated.View style={[
                    styles.recordingIndicator,
                    {
                      backgroundColor: isDark ? '#999999' : '#777777',
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
              ) : message.isThinking ? (
                // AI thinking indicator
                <View style={[styles.recordingIndicatorContainer, { justifyContent: 'flex-start' }]}>
                  <Animated.View style={[
                    styles.recordingIndicator,
                    {
                      backgroundColor: isDark ? '#999999' : '#777777',
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
              ) : (
                // Normal message text - wrapped in same container structure as indicators
                <View style={[styles.recordingIndicatorContainer, {
                  justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start'
                }]}>
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
                </View>
              )}
            </Animated.View>
          ))}

          {/* REMOVED: Old floating recording indicator - now using message-based indicators */}

          </ScrollView>
        </View>

        {/* Conditional Text Input - positioned above controls */}
        {showTextInput && (
          <Animated.View style={[
            styles.textInputContainer,
            {
              paddingHorizontal: 20,
              paddingVertical: 15,
              minHeight: 60,
              marginBottom: textInputMarginBottom,
              backgroundColor: 'transparent',
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
                onEndEditing={handleTextEndEditing}
                multiline
                editable={isConnected}
                autoFocus={true}
                blurOnSubmit={false}
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
          </Animated.View>
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
                        Tap to{'\n'}record
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
    );
    // Voice Settings Modal - separate modal that always uses Modal wrapper
    const voiceSettingsModal = (
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
                <Pressable onPress={() => setShowVoiceSettings(false)}>
                  <Text style={[styles.closeButton, { color: isDark ? '#FFFFFF' : '#000000' }]}>×</Text>
                </Pressable>
              </View>

              {/* Voice Selection */}
              <Text style={[styles.sectionLabel, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                Select Voice:
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
          </BlurView>
        </View>
      </Modal>
    );

    // Main modal rendering: simple Modal approach + voice settings modal
    return (
      <>
        <Modal
          animationType="none"
          transparent={true}
          visible={visible}
          onRequestClose={onClose}
          statusBarTranslucent={true}
          presentationStyle="overFullScreen"
        >
          {modalContent}
        </Modal>
        {voiceSettingsModal}
      </>
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
    zIndex: 1000,
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
    minHeight: 24, // Match recording indicator container
    paddingTop: 2, // Match recording indicator container baseline alignment
  },
  messageText: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '400',
    fontFamily: 'Georgia',
  },
  recordingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 24, // Match message text line height
    paddingTop: 2, // Align with text baseline
  },
  recordingIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
    fontSize: 16,
    fontWeight: 'normal',
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
    marginLeft: 6, // Center the arrow
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
    fontSize: 22.5,
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
  cardEmptyContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
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
  squareCardSectionTitle: {
    fontSize: 22.5,
    fontWeight: '600',
    marginBottom: 6,
    fontFamily: 'Georgia',
  },
  activeConversationContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
});