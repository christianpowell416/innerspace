import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  Dimensions,
  AppState,
  BackHandler,
  Keyboard,
  PanResponder,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { router, useLocalSearchParams } from 'expo-router';
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
import { useAuth } from '@/contexts/AuthContext';
import {
  createRealtimeConversationSync,
  RealtimeSync,
  SessionState
} from '@/lib/services/realtimeConversationSync';
import * as DocumentPicker from 'expo-document-picker';

import { PartsHoneycombMiniBubbleChart } from '@/components/PartsHoneycombMiniBubbleChart';
import { NeedsHoneycombMiniBubbleChart } from '@/components/NeedsHoneycombMiniBubbleChart';
import { EmotionsHoneycombMiniBubbleChart } from '@/components/EmotionsHoneycombMiniBubbleChart';

export default function ConversationScreen() {
  const { topic } = useLocalSearchParams();
  const selectedTopic = typeof topic === 'string' ? topic : 'general';
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { user } = useAuth();


  // Core state variables
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedVoice, setSelectedVoiceState] = useState<VoiceType>('alloy');
  const [isProcessingUserInput, setIsProcessingUserInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState<Array<{
    id: string;
    text: string;
    type: 'user' | 'assistant';
    timestamp: number;
    sessionId?: string | null;
    isRecording?: boolean;
    isProcessing?: boolean;
    isThinking?: boolean;
    fadeAnim?: Animated.Value;
    words?: Array<{ text: string; opacity: Animated.Value }>;
  }>>([]);
  const [textInput, setTextInput] = useState('');
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
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
  const [allowAIDisplay, setAllowAIDisplay] = useState(false);
  const [detectedItems, setDetectedItems] = useState<DetectedLists>({
    emotions: [],
    parts: [],
    needs: []
  });
  const [detectedEmotionsData, setDetectedEmotionsData] = useState<EmotionBubbleData[]>([]);
  const [detectedPartsData, setDetectedPartsData] = useState<PartBubbleData[]>([]);
  const [detectedNeedsData, setDetectedNeedsData] = useState<NeedBubbleData[]>([]);
  const [emotionsChartDimensions, setEmotionsChartDimensions] = useState({ width: 110, height: 110 });
  const [partsChartDimensions, setPartsChartDimensions] = useState({ width: 110, height: 110 });
  const [needsChartDimensions, setNeedsChartDimensions] = useState({ width: 110, height: 110 });
  const [shouldRenderBubbleCharts, setShouldRenderBubbleCharts] = useState(false);

  // Refs for session and recording management
  const sessionRef = useRef<VoiceSession | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const colorPulseAnim = useRef(new Animated.Value(0)).current;
  const recordingIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const textInputMarginBottom = useRef(new Animated.Value(10)).current;

  // Refs for callback state to prevent closure issues
  const isAIRespondingRef = useRef(false);
  const isStreamingRef = useRef(false);
  const currentResponseIdRef = useRef<string | null>(null);
  const currentUserInputSessionRef = useRef<string | null>(null);
  const userMessageAddedForSessionRef = useRef<string | null>(null);

  // Real-time sync state
  const [realtimeSync, setRealtimeSync] = useState<RealtimeSync | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const realtimeSyncRef = useRef<RealtimeSync | null>(null);

  // Helper functions for logging
  const setIsListeningWithLogging = (listening: boolean) => {
    setIsListening(listening);
  };

  // Helper function to sync conversation with real-time service
  const syncConversationToRealtimeService = async (conversationMessages: typeof conversation) => {
    if (!realtimeSyncRef.current || !user) return;

    try {
      // Filter and transform messages to ConversationMessage format
      const validMessages = conversationMessages
        .filter(msg => msg.text && msg.text.trim().length > 0 && !msg.isRecording && !msg.isProcessing)
        .map(msg => ({
          id: msg.id,
          type: msg.type,
          text: msg.text,
          timestamp: msg.timestamp,
          sessionId: msg.sessionId || null,
        }));

      await realtimeSyncRef.current.updateMessages(validMessages);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('❌ Failed to sync conversation:', error);
    }
  };

  // Helper function to sync detected data with real-time service
  const syncDetectedDataToRealtimeService = async () => {
    if (!realtimeSyncRef.current || !user) return;

    try {
      await realtimeSyncRef.current.updateDetectedData({
        emotions: detectedItems.emotions,
        parts: detectedItems.parts,
        needs: detectedItems.needs,
      });
    } catch (error) {
      console.error('❌ Failed to sync detected data:', error);
    }
  };

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

  // Helper function to add user message with fade-in animation
  const addUserMessageWithAnimation = (text: string) => {
    const fadeAnim = new Animated.Value(0);
    const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    // Session ID is already set in onTranscript callback - no need to generate here
    // Set ref immediately for synchronous access by AI response logic
    const currentSession = currentUserInputSessionRef.current;
    if (currentSession) {
      userMessageAddedForSessionRef.current = currentSession;
    }

    // Stop processing state - text is about to appear
    setIsProcessingUserInput(false);

    setConversation(prev => {
      // Check for immediate duplicates
      const lastMessage = prev[prev.length - 1];
      const isImmediateDuplicate = lastMessage &&
        lastMessage.type === 'user' &&
        lastMessage.text === text;

      if (isImmediateDuplicate) {
        return prev;
      }

      const newMessage = {
        type: 'user' as const,
        text,
        id: messageId,
        sessionId: currentUserInputSessionRef.current || undefined,
        timestamp: Date.now(),
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

  const handleFlowchartCreated = async (flowchart: FlowchartStructure) => {
    console.log('Flowchart created from conversation:', flowchart);
    router.back();
  };

  const handleClose = () => {
    cleanupSession();
    router.back();
  };

  // Analysis callbacks for incremental flowchart generation
  const analysisCallbacks: ConversationAnalysisCallbacks = {
    onFlowchartUpdate: (flowchart) => {
      setIncrementalFlowchart(flowchart);
    },
    onAnalysisUpdate: (analysis) => {
      setAnalysisStatus(analysis);
    },
    onError: (error) => {
      setAnalysisStatus(`Analysis Error: ${error.message}`);
    }
  };

  // Load voice settings and initialize
  const loadVoiceSettingAndInitialize = async () => {
    try {
      const voice = await getSelectedVoice();
      setSelectedVoiceState(voice);

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
    } catch (error) {
      console.error('❌ Error saving voice setting:', error);
    }
  };

  // Initialize voice session
  const initializeSession = async () => {
    try {
      setIsLoading(true);

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

            // Show welcome tooltip after connection
            setTimeout(() => {
              setShowWelcomeTooltip(true);
              // Auto-hide after 4 seconds
              setTimeout(() => setShowWelcomeTooltip(false), 4000);
            }, 500);
          },
          onDisconnected: () => {
            setIsConnected(false);
            setIsListeningWithLogging(false);
          },
          onListeningStart: () => {
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
              console.log('👤 User:', transcriptText);

              // Check if the transcript is empty or just whitespace
              if (!transcriptText || transcriptText.trim().length === 0) {
                // Remove the recording indicator from conversation - use USER INPUT session (not currentSession)
                const userInputSession = currentUserInputSessionRef.current;
                if (!userInputSession) {
                  return;
                }

                const recordingMessageId = 'recording-' + userInputSession;

                setConversation(prev => {
                  const filtered = prev.filter(msg => {
                    const shouldKeep = msg.id !== recordingMessageId;
                    return shouldKeep;
                  });
                  return filtered;
                });

                // Reset all recording/processing states to idle - simulate complete response cycle
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

                // Sync detected data to real-time service
                setTimeout(() => {
                  if (realtimeSyncRef.current && user) {
                    realtimeSyncRef.current.updateDetectedData({
                      emotions: detectedLists.emotions,
                      parts: detectedLists.parts,
                      needs: detectedLists.needs,
                    }).catch(error => console.error('❌ Failed to sync detected data:', error));
                  }
                }, 100);

                // Transform detected items to bubble chart data
                const conversationId = Date.now().toString() || undefined;
                setDetectedEmotionsData(transformDetectedEmotions(detectedLists.emotions, conversationId));
                setDetectedPartsData(transformDetectedParts(detectedLists.parts, conversationId));
                setDetectedNeedsData(transformDetectedNeeds(detectedLists.needs, conversationId));

                // Enable bubble chart rendering and expand cards if we have data
                if (detectedLists.emotions.length > 0 || detectedLists.parts.length > 0 || detectedLists.needs.length > 0) {
                  setShouldRenderBubbleCharts(true);
                  setShowSquareCards(true); // Auto-expand when new items detected
                }
              }).catch(error => {
                console.error('Error analyzing message:', error);
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

                  // Sync conversation after state update
                  setTimeout(() => syncConversationToRealtimeService(updatedConversation), 100);

                  return updatedConversation;
                } else {
                  // Fallback: add as new message if recording indicator not found
                  console.warn('📝 [TRANSCRIPT] Recording indicator not found, adding as new message');
                  const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                  const updatedConversation = [...prev, {
                    type: 'user',
                    text: transcriptText,
                    id: messageId,
                    sessionId: currentSession || currentUserInputSessionRef.current,
                    timestamp: Date.now()
                  }];

                  // Sync conversation after state update
                  setTimeout(() => syncConversationToRealtimeService(updatedConversation), 100);

                  return updatedConversation;
                }
              });

              // Enable AI display after message is added
              setTimeout(() => {
                setAllowAIDisplay(true);
              }, 50); // Small delay to ensure message update is processed

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

            // Create AI thinking indicator immediately or update existing placeholder
            const currentSession = currentUserInputSessionRef.current;
            if (currentSession) {
              setConversation(prev => {
                // Check if there's already a thinking placeholder from text input
                const thinkingPlaceholderIndex = prev.findIndex(msg =>
                  msg.type === 'assistant' &&
                  msg.isThinking &&
                  msg.sessionId === currentSession &&
                  msg.text === ''
                );

                if (thinkingPlaceholderIndex >= 0) {
                  // Update existing placeholder with the actual response ID
                  const updatedConversation = [...prev];
                  updatedConversation[thinkingPlaceholderIndex] = {
                    ...updatedConversation[thinkingPlaceholderIndex],
                    id: responseId // Update with actual response ID from voice service
                  };
                  return updatedConversation;
                }

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

                // Sync conversation if response is complete
                if (isComplete) {
                  setTimeout(() => syncConversationToRealtimeService(updatedConversation), 100);
                }

                return updatedConversation;
              } else {
                // This should not happen if thinking indicator was created in onResponseStart
                return prev;
              }
            });
          },
          onResponse: (response) => {
            // Handle final response completion - only update if no streaming has occurred
            if (!response) {
              return;
            }

            console.log('🤖 AI:', response);

            const currentSession = currentUserInputSessionRef.current;
            const responseId = currentResponseIdRef.current;

            if (!responseId || !currentSession) {
              return;
            }

            // Only update if the message is still in thinking state (no streaming occurred)
            setConversation(prev => {
              const existingMessageIndex = prev.findIndex(msg => msg.id === responseId);

              if (existingMessageIndex >= 0) {
                const existingMessage = prev[existingMessageIndex];
                // Only update text if message is still thinking (no streaming occurred)
                if (existingMessage.isThinking) {
                  const updatedConversation = [...prev];
                  updatedConversation[existingMessageIndex] = {
                    ...updatedConversation[existingMessageIndex],
                    text: response,
                    isThinking: false
                  };
                  return updatedConversation;
                } else {
                  // Streaming already occurred, just remove thinking state
                  const updatedConversation = [...prev];
                  updatedConversation[existingMessageIndex] = {
                    ...updatedConversation[existingMessageIndex],
                    isThinking: false
                  };
                  return updatedConversation;
                }
              } else {
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
          },
          onError: (error) => {
            console.error('❌ ConversationScreen: Voice session error:', error);
            Alert.alert('Error', error.message);
            setIsLoading(false);
          }
        }
      );

      sessionRef.current = session;

      // Initialize real-time sync service
      if (user) {
        try {
          const syncService = createRealtimeConversationSync({
            userId: user.id,
            topic: selectedTopic,
            complexId: undefined, // Will be set when user saves conversation
            autoSaveInterval: 15000, // Auto-save every 15 seconds
            enableSessionRecovery: true,
          });

          setRealtimeSync(syncService);
          realtimeSyncRef.current = syncService;

          // Start the real-time session
          await syncService.startSession();
          console.log('🔄 Real-time sync service initialized');
        } catch (error) {
          console.error('❌ Failed to initialize real-time sync:', error);
        }
      }

      // Add a timeout to detect hanging connections
      const connectionTimeout = setTimeout(() => {
        if (!isConnected) {
          setIsLoading(false);
        }
      }, 10000);

      await session.connect();
      clearTimeout(connectionTimeout);

    } catch (error) {
      console.error('❌ ConversationScreen: Session initialization failed:', error);
      Alert.alert('Error', 'Failed to initialize voice session');
      setIsLoading(false);
    }
  };

  const cleanupSession = () => {
    if (isCleaningUp) {
      return; // Prevent multiple simultaneous cleanups
    }

    setIsCleaningUp(true);

    if (sessionRef.current) {
      try {
        sessionRef.current.disconnect();
      } catch (error) {
        console.warn('⚠️ Error during session cleanup:', error);
      }
      sessionRef.current = null;
    }

    // Cleanup real-time sync service
    if (realtimeSyncRef.current) {
      try {
        realtimeSyncRef.current.endSession();
        console.log('🔄 Real-time sync service ended');
      } catch (error) {
        console.warn('⚠️ Error during real-time sync cleanup:', error);
      }
      realtimeSyncRef.current = null;
      setRealtimeSync(null);
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

  const openSettingsModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/voice-settings',
      params: {
        selectedVoice: selectedVoice
      }
    });
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

        // Sync detected data to real-time service
        setTimeout(() => {
          if (realtimeSyncRef.current && user) {
            realtimeSyncRef.current.updateDetectedData({
              emotions: detectedLists.emotions,
              parts: detectedLists.parts,
              needs: detectedLists.needs,
            }).catch(error => console.error('❌ Failed to sync detected data:', error));
          }
        }, 100);

        // Transform detected items to bubble chart data
        const conversationId = Date.now().toString() || undefined;
        setDetectedEmotionsData(transformDetectedEmotions(detectedLists.emotions, conversationId));
        setDetectedPartsData(transformDetectedParts(detectedLists.parts, conversationId));
        setDetectedNeedsData(transformDetectedNeeds(detectedLists.needs, conversationId));

        // Enable bubble chart rendering and expand cards if we have data
        if (detectedLists.emotions.length > 0 || detectedLists.parts.length > 0 || detectedLists.needs.length > 0) {
          setShouldRenderBubbleCharts(true);
          setShowSquareCards(true); // Auto-expand when new items detected
        }
      }).catch(error => {
        console.error('Error analyzing message:', error);
      });

      // Generate session ID for text input (same as voice input)
      const newSessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      setCurrentUserInputSession(newSessionId);
      currentUserInputSessionRef.current = newSessionId;

      // Reset AI display permission for new session
      setAllowAIDisplay(false);

      // Add user message to conversation with fade-in animation (using corrected text)
      addUserMessageWithAnimation(messageText);

      // Send to OpenAI
      sessionRef.current.sendMessage(messageText);

      // Clear input but keep text input visible and focused
      setTextInput('');

      // Keep focus on the text input to maintain keyboard
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };

  // Simple text input handler
  const handleSendText = () => {
    // Basic validation
    if (!sessionRef.current || !isConnected || !textInput?.trim()) {
      return;
    }

    const messageText = textInput.trim();
    console.log('👤 User:', messageText);

    // Create session context for text input (same as voice input)
    const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setCurrentUserInputSession(sessionId);
    currentUserInputSessionRef.current = sessionId;

    // Add user message to conversation
    const userMessage = {
      type: 'user' as const,
      text: messageText,
      id: Date.now().toString(),
      timestamp: Date.now(),
      sessionId: sessionId,
    };

    // Add AI response placeholder - will be updated with real ID from onResponseStart
    const temporaryId = `temp-response-${Date.now()}`;
    const aiPlaceholder = {
      type: 'assistant' as const,
      text: '',
      id: temporaryId,
      timestamp: Date.now(),
      sessionId: sessionId,
      isThinking: true,
    };

    setConversation(prev => [...prev, userMessage, aiPlaceholder]);

    // Set AI responding state - response ID will be set by onResponseStart
    setIsAIResponding(true);
    isAIRespondingRef.current = true;

    // Send to session
    try {
      sessionRef.current.sendMessage(messageText);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      // Reset AI state on error
      setIsAIResponding(false);
      isAIRespondingRef.current = false;
    }

    // Clear input
    setTextInput('');
  };

  const handleTextEndEditing = () => {
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

  // Show tooltip when connected
  useEffect(() => {
    if (isConnected && !isListening && !isAIResponding) {
      const timer = setTimeout(() => {
        setShowWelcomeTooltip(true);
        // Auto-hide after 4 seconds
        setTimeout(() => setShowWelcomeTooltip(false), 4000);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, isListening, isAIResponding]);

  // Initialize session when component mounts
  useEffect(() => {
    if (!isConnected && !isLoading) {
      // Always start with voice mode (big green button)
      setShowTextInput(false);

      // Load voice settings and initialize session
      loadVoiceSettingAndInitialize();

      // Set detection conversation ID for bubble chart analytics
      const conversationId = Date.now().toString();
      setDetectionConversationId(conversationId);

      // Auto-show welcome tooltip after connection
      const showTooltipTimer = setTimeout(() => {
        if (isConnected && !isListening && !isAIResponding) {
          setShowWelcomeTooltip(true);
        }
      }, 1000); // Show after 1 second if idle

      // Hide tooltip after 4 seconds
      const hideTooltipTimer = setTimeout(() => {
        setShowWelcomeTooltip(false);
      }, 5000);

      return () => {
        clearTimeout(showTooltipTimer);
        clearTimeout(hideTooltipTimer);
      };
    }
  }, [isConnected, isLoading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupSession();
    };
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (conversation.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversation.length]);

  // Start/stop color pulse animation based on state
  useEffect(() => {
    const shouldAnimate = isListening || isAIResponding;

    if (shouldAnimate) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(colorPulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(colorPulseAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();

      return () => animation.stop();
    } else {
      colorPulseAnim.setValue(0);
    }
  }, [isListening, isAIResponding]);

  // Track keyboard visibility and animate margin
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        Animated.timing(textInputMarginBottom, {
          toValue: -55,
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

  // Recording indicator animation loop for pulsing effect
  useEffect(() => {
    const shouldAnimate = isListening || isProcessingUserInput || conversation.some(msg => msg.isRecording || msg.isProcessing || msg.isThinking);

    if (shouldAnimate) {
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

  return (
    <GradientBackground>
      <View style={[styles.safeArea, { paddingLeft: insets.left, paddingRight: insets.right }]}>
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={styles.blurContainer}
        >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 110 : 0}
        >
          {/* Handle Bar */}
          <View style={styles.handleBarContainer}>
            <View style={[
              styles.handleBar,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }
            ]} />
          </View>

          {/* Fixed Header */}
          <View style={styles.pageHeader}>
            <Text style={[styles.pageTitle, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }]}>
              New Conversation
            </Text>
          </View>

          {/* Down caret button positioned beneath header */}
          <View style={styles.dropdownCaretContainer}>
            <Pressable
              style={styles.dropdownCaret}
              onPress={() => setShowSquareCards(!showSquareCards)}
            >
              <View style={[
                styles.chevronContainer,
                { transform: [{ rotate: showSquareCards ? '180deg' : '0deg' }] }
              ]}>
                <IconSymbol
                  size={32}
                  name="chevron.compact.down"
                  color={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                />
              </View>
            </Pressable>
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
                          padding: 0,
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
                        <EmotionsHoneycombMiniBubbleChart
                          data={detectedEmotionsData}
                          width={emotionsChartDimensions.width}
                          height={emotionsChartDimensions.height}
                          loading={!shouldRenderBubbleCharts}
                        />
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
                          padding: 0,
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
                        <PartsHoneycombMiniBubbleChart
                          data={detectedPartsData}
                          width={partsChartDimensions.width}
                          height={partsChartDimensions.height}
                          loading={!shouldRenderBubbleCharts}
                        />
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
                          padding: 0,
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
                        <NeedsHoneycombMiniBubbleChart
                          data={detectedNeedsData}
                          width={needsChartDimensions.width}
                          height={needsChartDimensions.height}
                          loading={!shouldRenderBubbleCharts}
                        />
                      ) : (
                        <View style={styles.cardEmptyContainer} />
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Main Content */}
          <View style={styles.pageScrollView}>
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
                {conversation.length === 0 ? null : (
                  conversation.map((message, index) => (
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
                  ))
                )}
              </ScrollView>
            </View>

            {/* Text Input */}
            {showTextInput && (
              <View style={[styles.textInputContainer, { paddingHorizontal: 20, paddingVertical: 15, paddingTop: 10 }]}>
                {/* Voice Mode Button */}
                <Pressable
                  style={[styles.textInputVoiceButton, { backgroundColor: '#2E7D32' }]}
                  onPress={() => {
                    textInputRef.current?.blur();
                    setTextInput('');
                    setShowTextInput(false);
                  }}
                >
                  <Image
                    source={require('@/assets/images/Logo.png')}
                    style={[styles.textInputVoiceButtonLogo, { tintColor: '#FFF' }]}
                    resizeMode="contain"
                  />
                </Pressable>

                {/* Text Input with Send Button */}
                <View style={[
                  styles.textInputWithButton,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: isDark ? '#555555' : '#C7C7CC',
                    paddingHorizontal: 12,
                    minHeight: 44,
                  }
                ]}>
                  <TextInput
                    ref={textInputRef}
                    style={[
                      styles.textInput,
                      {
                        color: isDark ? '#FFFFFF' : '#000000',
                        backgroundColor: 'transparent',
                        paddingHorizontal: 0,
                        borderRadius: 0,
                        minHeight: 'auto',
                        maxHeight: 'auto',
                      }
                    ]}
                    placeholder="Type a message..."
                    placeholderTextColor={isDark ? '#888888' : '#666666'}
                    value={textInput}
                    onChangeText={setTextInput}
                    multiline={false}
                    editable={isConnected}
                    autoFocus={true}
                    blurOnSubmit={false}
                    returnKeyType="send"
                    onSubmitEditing={handleSendText}
                  />

                  {/* Send Button */}
                  <Pressable
                    style={[
                      styles.sendButton,
                      {
                        backgroundColor: isConnected && textInput?.trim() ? '#007AFF' : '#CCCCCC',
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                      }
                    ]}
                    onPress={handleSendText}
                    disabled={!isConnected || !textInput?.trim()}
                  >
                    <IconSymbol
                      size={16}
                      name="arrow.up"
                      color="#FFFFFF"
                    />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Controls Container */}
            <View style={[
              styles.controlsContainer,
              {
                paddingBottom: showTextInput ? 0 : 34,
                backgroundColor: 'transparent',
                borderTopWidth: 0,
              }
            ]}>
              {/* Voice Controls */}
              <View style={styles.voiceControlsContainer}>
                {/* Text Input Toggle Button */}
                <View style={styles.leftControls}>
                  {!showTextInput && (
                    <Pressable
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: isDark ? '#333333' : '#E0E0E0',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                      onPress={() => {
                        setShowTextInput(true);
                        setShowWelcomeTooltip(false);
                        setTimeout(() => {
                          textInputRef.current?.focus();
                        }, 150);
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

                {/* Centered Voice Button */}
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
                            Tap to{"\n"}record
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
                              ? ['#FF5722', '#BF360C']
                              : isAIResponding
                                ? ['#2196F3', '#1565C0']
                                : ['#2E7D32', '#2E7D32'],
                          }),
                          borderRadius: 50,
                          opacity: isConnected ? 1 : 0.5
                        }}
                      >
                        <Pressable
                          style={[
                            styles.circularVoiceButton,
                            {
                              opacity: isConnected ? 1 : 0.5
                            }
                          ]}
                          onPress={handleTapToTalk}
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

                {/* Settings Button */}
                <View style={styles.rightControls}>
                  {!showTextInput && (
                    <Pressable
                      style={[
                        styles.settingsButton,
                        { backgroundColor: isDark ? '#333333' : '#E0E0E0' }
                      ]}
                      onPress={openSettingsModal}
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
      </View>

    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  blurContainer: {
    flex: 1,
  },
  handleBarContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: 'transparent',
    minHeight: 80, // Prevent layout shift by reserving space
  },
  minimizeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 35,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
    fontFamily: 'Georgia',
  },
  dropdownCaretContainer: {
    alignItems: 'center',
    paddingVertical: 0,
    marginTop: -16,
    marginBottom: -11,
  },
  dropdownCaret: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapsibleSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 140, // Prevent layout shift when cards expand
  },
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
    overflow: 'hidden',
  },
  cardEmptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  cardEmptyText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  pageScrollView: {
    flex: 1,
  },
  incrementalToggleSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  incrementalToggle: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  incrementalToggleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  analysisStatus: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  incrementalFlowchartContainer: {
    margin: 20,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
  },
  incrementalFlowchartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  incrementalFlowchartContent: {
    maxHeight: 150,
  },
  flowchartNodes: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 8,
  },
  flowchartNode: {
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  flowchartNodeText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  flowchartNodeType: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  activeConversationContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 300, // Prevent layout shift
  },
  conversationContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyConversationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyConversationText: {
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
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
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 10,
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
    paddingRight: 44,
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
  controlsContainer: {
    paddingHorizontal: 20,
    paddingTop: 15,
    minHeight: 120, // Prevent layout shift for controls
  },
  voiceControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftControls: {
    width: 50,
    alignItems: 'flex-start',
  },
  centerControls: {
    flex: 1,
    alignItems: 'center',
  },
  rightControls: {
    width: 50,
    alignItems: 'flex-end',
  },
  textToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonContainer: {
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
    transform: [{ translateX: 6 }], // Center the arrow
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
  circularVoiceButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', // Background now handled by Animated.View
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
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

