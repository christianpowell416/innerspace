import { GradientBackground } from '@/components/ui/GradientBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { loadComplexes, ComplexData } from '@/lib/services/complexManagementService';
import { backgroundSaver } from '@/lib/services/backgroundSaver';
import {
  ConversationAnalysisCallbacks,
  conversationAnalyzer
} from '@/lib/services/conversationAnalyzer';
import {
  DetectedLists,
  emotionPartsDetector
} from '@/lib/services/emotionPartsDetector';
import {
  createVoiceSession,
  generateVoiceInstructions,
  VoiceSession
} from '@/lib/services/voiceSessionService';
import { getSelectedVoice, setSelectedVoice, VoiceType } from '@/lib/services/voiceSettings';
import { getVoiceCharacteristics } from '@/lib/services/voiceCharacteristics';
import { EmotionBubbleData } from '@/lib/types/bubbleChart';
import { FlowchartStructure } from '@/lib/types/flowchart';
import { NeedBubbleData, PartBubbleData } from '@/lib/types/partsNeedsChart';
import {
  resetDetectionTracking,
  setDetectionConversationId,
  transformDetectedEmotions,
  transformDetectedNeeds,
  transformDetectedParts
} from '@/lib/utils/detectionDataTransform';
import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect, usePreventRemove } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-native';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmotionsHoneycombMiniBubbleChart } from '@/components/EmotionsHoneycombMiniBubbleChart';
import { NeedsHoneycombMiniBubbleChart } from '@/components/NeedsHoneycombMiniBubbleChart';
import { PartsHoneycombMiniBubbleChart } from '@/components/PartsHoneycombMiniBubbleChart';

export default function ConversationScreen() {
  const { topic, complexId } = useLocalSearchParams();
  const selectedTopic = typeof topic === 'string' ? topic : 'general';
  const presetComplexId = typeof complexId === 'string' ? complexId : undefined;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();
  const { keyboardHeight, isKeyboardVisible: isKeyboardShowing } = useKeyboardHeight();

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
    type: 'user' | 'assistant' | 'detection_log';
    timestamp: number;
    sessionId?: string | null;
    isRecording?: boolean;
    isProcessing?: boolean;
    isThinking?: boolean;
    fadeAnim?: Animated.Value;
    words?: Array<{ text: string; opacity: Animated.Value }>;
    detectionType?: 'emotion' | 'part' | 'need';
    detectionName?: string;
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
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isFirstOpen, setIsFirstOpen] = useState(true);
  const [showSquareCards, setShowSquareCards] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  // Single session for entire conversation
  const conversationSessionId = useRef<string>(Date.now().toString() + Math.random().toString(36).substr(2, 9));
  const messageCounter = useRef<number>(0);

  // Helper to generate sequential message IDs
  const generateMessageId = () => {
    messageCounter.current += 1;
    return `msg-${conversationSessionId.current}-${messageCounter.current}`;
  };

  // Helper to add detection log messages for newly detected items
  const addDetectionLogMessages = (previousDetectedItems: DetectedLists, newDetectedItems: DetectedLists, userMessageId?: string) => {
    const detectionMessages: Array<{
      id: string;
      text: string;
      type: 'detection_log';
      timestamp: number;
      sessionId: string;
      detectionType: 'emotion' | 'part' | 'need';
      detectionName: string;
    }> = [];

    // Check for new emotions
    newDetectedItems.emotions.forEach(emotion => {
      if (!previousDetectedItems.emotions.includes(emotion)) {
        detectionMessages.push({
          id: generateMessageId(),
          text: `new emotion logged: ${emotion.toLowerCase()}`,
          type: 'detection_log',
          timestamp: Date.now(),
          sessionId: conversationSessionId.current,
          detectionType: 'emotion',
          detectionName: emotion
        });
      }
    });

    // Check for new parts
    newDetectedItems.parts.forEach(part => {
      if (!previousDetectedItems.parts.includes(part)) {
        detectionMessages.push({
          id: generateMessageId(),
          text: `new part logged: ${part.toLowerCase()}`,
          type: 'detection_log',
          timestamp: Date.now(),
          sessionId: conversationSessionId.current,
          detectionType: 'part',
          detectionName: part
        });
      }
    });

    // Check for new needs
    newDetectedItems.needs.forEach(need => {
      if (!previousDetectedItems.needs.includes(need)) {
        detectionMessages.push({
          id: generateMessageId(),
          text: `new need logged: ${need.toLowerCase()}`,
          type: 'detection_log',
          timestamp: Date.now(),
          sessionId: conversationSessionId.current,
          detectionType: 'need',
          detectionName: need
        });
      }
    });

    // Add detection messages to conversation if any were found
    if (detectionMessages.length > 0) {
      setConversation(prev => {
        if (userMessageId) {
          // Find the user message and insert detection messages right after it
          const userMessageIndex = prev.findIndex(msg => msg.id === userMessageId);
          if (userMessageIndex !== -1) {
            const newConversation = [...prev];
            // Insert detection messages after the user message
            newConversation.splice(userMessageIndex + 1, 0, ...detectionMessages);
            return newConversation;
          }
        }
        // Fallback: append to end if user message not found
        return [...prev, ...detectionMessages];
      });

      // Note: Detection log messages are not saved to database - they're UI-only
    }
  };

  const [allowAIDisplay, setAllowAIDisplay] = useState(false);
  const [detectedItems, setDetectedItems] = useState<DetectedLists>({
    emotions: [],
    parts: [],
    needs: []
  });
  const [detectedEmotionsData, setDetectedEmotionsData] = useState<EmotionBubbleData[]>([]);
  const [detectedPartsData, setDetectedPartsData] = useState<PartBubbleData[]>([]);
  const [detectedNeedsData, setDetectedNeedsData] = useState<NeedBubbleData[]>([]);
  const [cachedComplexes, setCachedComplexes] = useState<ComplexData[]>([]);
  const [emotionsChartDimensions, setEmotionsChartDimensions] = useState({ width: 110, height: 110 });
  const [partsChartDimensions, setPartsChartDimensions] = useState({ width: 110, height: 110 });
  const [needsChartDimensions, setNeedsChartDimensions] = useState({ width: 110, height: 110 });
  const [shouldRenderBubbleCharts, setShouldRenderBubbleCharts] = useState(false);
  const [hasNavigatedToSave, setHasNavigatedToSave] = useState(false);

  // Refs for session and recording management
  const sessionRef = useRef<VoiceSession | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const colorPulseAnim = useRef(new Animated.Value(0)).current;
  const recordingIndicatorOpacity = useRef(new Animated.Value(0)).current;

  // Refs for callback state to prevent closure issues
  const isAIRespondingRef = useRef(false);
  const isStreamingRef = useRef(false);
  const currentResponseIdRef = useRef<string | null>(null);
  const userMessageAddedForSessionRef = useRef<string | null>(null);

  // Track if we need to reload session after settings change
  const shouldReloadSessionRef = useRef(false);

  // Computed value to track if any messages have indicator flags
  const hasIndicatorMessages = useMemo(() => {
    return conversation.some(msg => msg.isRecording || msg.isProcessing || msg.isThinking);
  }, [conversation]);

  // Helper functions for logging
  const setIsListeningWithLogging = (listening: boolean) => {
    setIsListening(listening);
  };





  const createAnimatedWords = (text: string) => {
    return text.split(' ').filter(word => word.length > 0).map(word => ({
      text: word + ' ',
      opacity: new Animated.Value(0)
    }));
  };

  const handleFlowchartCreated = async (flowchart: FlowchartStructure) => {
    console.log('Flowchart created from conversation:', flowchart);
    router.back();
  };

  const handleClose = () => {

    if (conversation.length > 0) {
      // If opened from a complex detail page, save directly to that complex
      if (presetComplexId) {
        // Force save the conversation with the preset complex ID
        const messagesForSave = conversation.filter(msg => msg.text && !msg.isRecording && !msg.isProcessing);

        backgroundSaver.forceSaveWithComplex(presetComplexId).then(() => {
          cleanupSession();
          // Dismiss all modals and return to the tabs
          router.dismissAll();
        }).catch((error) => {
          console.error('Failed to save conversation to complex:', error);
          // Fallback to save conversation screen
          setHasNavigatedToSave(true);
          router.replace({
            pathname: '/save-conversation',
            params: {
              sessionId: conversationSessionId.current,
              topic: selectedTopic,
              messages: JSON.stringify(messagesForSave),
              complexes: JSON.stringify(cachedComplexes),
              preselectedComplexId: presetComplexId
            }
          });
        });
      } else {
        // Set flag to prevent usePreventRemove from triggering again
        setHasNavigatedToSave(true);

        // Navigate to save screen with session ID and cached complexes
        router.replace({
          pathname: '/save-conversation',
          params: {
            sessionId: conversationSessionId.current,
            topic: selectedTopic,
            messages: JSON.stringify(conversation.filter(msg => msg.text && !msg.isRecording && !msg.isProcessing)),
            complexes: JSON.stringify(cachedComplexes)
          }
        });
      }
    } else {
      cleanupSession();
      router.back();
    }
  };

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

  const loadVoiceSettingAndInitialize = async () => {
    try {
      const voice = await getSelectedVoice();
      setSelectedVoiceState(voice);
      setTimeout(() => {
        initializeSession();
      }, 500);
    } catch (error) {
      console.error('❌ Error loading voice setting:', error);
    }
  };

  const handleVoiceChange = async (voice: VoiceType) => {
    try {
      setSelectedVoiceState(voice);
      await setSelectedVoice(voice);
    } catch (error) {
      console.error('❌ Error saving voice setting:', error);
    }
  };

  const reloadSessionWithNewSettings = async (newVoice?: VoiceType) => {
    try {
      console.log('🔄 Reloading session with updated characteristics and voice:', newVoice || selectedVoice);

      // Disconnect existing session
      if (sessionRef.current) {
        sessionRef.current.disconnect();
        sessionRef.current = null;
      }

      // Reset session states
      setIsConnected(false);
      setIsListeningWithLogging(false);
      setIsAIResponding(false);
      isAIRespondingRef.current = false;

      // Reload with new settings - use provided voice or current selectedVoice
      await initializeSession(newVoice);

      console.log('✅ Session reloaded with updated characteristics');
    } catch (error) {
      console.error('❌ Error reloading session:', error);
    }
  };

  const initializeSession = async (voiceOverride?: VoiceType) => {
    try {
      setIsLoading(true);

      // Initialize background saver for this session
      if (user) {
        backgroundSaver.initialize({
          sessionId: conversationSessionId.current,
          userId: user.id,
          topic: selectedTopic,
          complexId: presetComplexId,
        });
      }

      const sessionInstructions = await generateVoiceInstructions(null);
      const characteristics = await getVoiceCharacteristics();

      // Use override voice if provided, otherwise use current selectedVoice
      const voiceToUse = voiceOverride || selectedVoice;

      const session = createVoiceSession(
        {
          voice: voiceToUse,
          temperature: 0.7,
          sessionInstructions,
          enableVAD: false,
          characteristics
        },
        {
          onConnected: () => {
            setIsConnected(true);
            setIsLoading(false);
            // Only show tooltip on first open
            if (isFirstOpen) {
              setTimeout(() => {
                setShowWelcomeTooltip(true);
                setTimeout(() => setShowWelcomeTooltip(false), 4000);
              }, 500);
              setIsFirstOpen(false);
            }
          },
          onDisconnected: () => {
            setIsConnected(false);
            setIsListeningWithLogging(false);
          },
          onListeningStart: () => {
            setIsListeningWithLogging(true);
            setIsAIResponding(false);
            isAIRespondingRef.current = false;
            setHasUserInteracted(true);

            // Create a new recording indicator message
            const messageId = generateMessageId();
            userMessageAddedForSessionRef.current = messageId; // Store for transcript update

            setConversation(prev => [...prev, {
              type: 'user' as const,
              text: '',
              id: messageId,
              sessionId: conversationSessionId.current,
              timestamp: Date.now(),
              isRecording: true
            }]);
          },
          onListeningStop: () => {
            setIsListeningWithLogging(false);
            setIsAIResponding(true);
            isAIRespondingRef.current = true;
            setTranscript('');

            // Update the recording message to processing state
            const recordingMessageId = userMessageAddedForSessionRef.current;
            if (recordingMessageId) {
              setConversation(prev => {
                const existingIndex = prev.findIndex(msg => msg.id === recordingMessageId);
                if (existingIndex >= 0) {
                  const updatedConversation = [...prev];
                  updatedConversation[existingIndex] = {
                    ...updatedConversation[existingIndex],
                    isRecording: false,
                    isProcessing: true,
                    isThinking: false
                  };
                  return updatedConversation;
                }
                return prev;
              });
            }
          },
          onTranscript: (transcriptText, isFinal) => {
            if (isFinal) {
              console.log('👤 User:', transcriptText);

              if (!transcriptText || transcriptText.trim().length === 0) {
                // Remove the recording/processing indicator if no text was spoken
                const recordingMessageId = userMessageAddedForSessionRef.current;
                if (recordingMessageId) {
                  setConversation(prev => prev.filter(msg => msg.id !== recordingMessageId));
                }

                setIsListeningWithLogging(false);
                setIsProcessingUserInput(false);
                setIsAIResponding(false);
                setCurrentResponseId(null);
                setIsStreaming(false);

                isAIRespondingRef.current = false;
                isStreamingRef.current = false;
                currentResponseIdRef.current = null;
                userMessageAddedForSessionRef.current = null; // Clear on cancellation

                // Show tooltip briefly
                setShowWelcomeTooltip(true);
                setTimeout(() => setShowWelcomeTooltip(false), 3000);
                return;
              }

              // Process detection in background without blocking UI
              emotionPartsDetector.addMessage(transcriptText).then(detectedLists => {
                if (detectedLists.emotions.length > 0 || detectedLists.parts.length > 0 || detectedLists.needs.length > 0) {
                  console.log('🔍 Detected:', {
                    emotions: detectedLists.emotions,
                    parts: detectedLists.parts,
                    needs: detectedLists.needs
                  });
                }
                // Batch all state updates together
                unstable_batchedUpdates(() => {
                  // Store previous detected items for comparison
                  const previousDetectedItems = detectedItems;

                  setDetectedItems(detectedLists);

                  const conversationId = Date.now().toString() || undefined;

                  // Convert string arrays to DetectedItem arrays with proper structure
                  const emotionItems = detectedLists.emotions.map(emotion => ({
                    name: emotion,
                    confidence: 0.8
                  }));
                  const partItems = detectedLists.parts.map(part => ({
                    name: part,
                    confidence: 0.8
                  }));
                  const needItems = detectedLists.needs.map(need => ({
                    name: need,
                    confidence: 0.8
                  }));

                  const emotionsData = transformDetectedEmotions(emotionItems, conversationId);
                  const partsData = transformDetectedParts(partItems, conversationId);
                  const needsData = transformDetectedNeeds(needItems, conversationId);

                  setDetectedEmotionsData(emotionsData);
                  setDetectedPartsData(partsData);
                  setDetectedNeedsData(needsData);

                  if (detectedLists.emotions.length > 0 || detectedLists.parts.length > 0 || detectedLists.needs.length > 0) {
                    setShouldRenderBubbleCharts(true);
                    setShowSquareCards(true);
                  }

                  // Add detection log messages for newly detected items
                  const recordingMessageId = userMessageAddedForSessionRef.current;
                  addDetectionLogMessages(previousDetectedItems, detectedLists, recordingMessageId || undefined);
                });

                // Save detected data in background
                if (user) {
                  backgroundSaver.saveDetectedData({
                    emotions: detectedLists.emotions.map(e => ({ name: e, confidence: 0.8 })),
                    parts: detectedLists.parts.map(p => ({ name: p, confidence: 0.8 })),
                    needs: detectedLists.needs.map(n => ({ name: n, confidence: 0.8 })),
                  });
                }
              }).catch(error => {
                console.error('Error analyzing message:', error);
              });

              setIsProcessingUserInput(true);
              setTranscript('');
              setPendingUserMessage(transcriptText);

              // Find and update the recording message in place
              const recordingMessageId = userMessageAddedForSessionRef.current;

              // Clear the ref now that we've captured the ID - prevents it from being used again
              userMessageAddedForSessionRef.current = null;

              setConversation(prev => {
                // Look for the recording/processing message by ID only
                const existingIndex = prev.findIndex(msg => msg.id === recordingMessageId);

                if (existingIndex >= 0) {
                  // Replace the entire message object to ensure all flags are cleared
                  const updatedConversation = [...prev];
                  const originalMessage = updatedConversation[existingIndex];

                  const finalMessage = {
                    type: originalMessage.type,
                    text: transcriptText,
                    id: originalMessage.id,
                    sessionId: originalMessage.sessionId,
                    timestamp: originalMessage.timestamp,
                    // Explicitly no indicator flags - they're all cleared
                  };
                  updatedConversation[existingIndex] = finalMessage;

                  // Fire-and-forget save (non-blocking)
                  if (user) {
                    backgroundSaver.saveMessage(finalMessage);
                  }

                  return updatedConversation;
                } else {
                  // Add new user message if no recording indicator found
                  const messageId = generateMessageId();
                  const newMessage = {
                    type: 'user' as const,
                    text: transcriptText,
                    id: messageId,
                    sessionId: conversationSessionId.current,
                    timestamp: Date.now()
                  };
                  const updatedConversation = [...prev, newMessage];

                  // Fire-and-forget save (non-blocking)
                  if (user) {
                    backgroundSaver.saveMessage(newMessage);
                  }

                  return updatedConversation;
                }
              });

              // Clear pending state
              setPendingUserMessage(null);
              setAllowAIDisplay(true);

              // Clear the ref now that we've used it (not in onResponseComplete)
              // userMessageAddedForSessionRef.current = null;
            } else {
              // Update the recording message in real-time with partial transcript
              setTranscript(transcriptText);
              const recordingMessageId = userMessageAddedForSessionRef.current;
              if (recordingMessageId && transcriptText) {
                setConversation(prev => {
                  const existingIndex = prev.findIndex(msg => msg.id === recordingMessageId);
                  if (existingIndex >= 0) {
                    const updatedConversation = [...prev];
                    updatedConversation[existingIndex] = {
                      ...updatedConversation[existingIndex],
                      text: transcriptText,
                      isRecording: true // Keep the recording flag
                    };
                    return updatedConversation;
                  }
                  return prev;
                });
              }
            }
          },
          onResponseStart: (responseId) => {
            setIsAIResponding(true);
            setCurrentResponseId(responseId);
            setIsStreaming(true);
            setIsProcessingUserInput(false);

            isAIRespondingRef.current = true;
            isStreamingRef.current = true;
            currentResponseIdRef.current = responseId;

            // Add AI message with the response ID
            setConversation(prev => {
              // Check if this response already exists (shouldn't happen but safety check)
              if (prev.some(msg => msg.id === responseId)) {
                return prev;
              }

              return [...prev, {
                type: 'assistant' as const,
                text: '',
                id: responseId,
                sessionId: conversationSessionId.current,
                timestamp: Date.now(),
                isThinking: true
              }];
            });
          },
          onResponseStreaming: (response, isComplete) => {
            if (!response) return;

            setConversation(prev => {
              // Find the last assistant message (should be the one we're updating)
              let aiMessageIndex = -1;
              for (let i = prev.length - 1; i >= 0; i--) {
                if (prev[i].type === 'assistant') {
                  aiMessageIndex = i;
                  break;
                }
              }


              if (aiMessageIndex === -1) {
                return prev;
              }

              // Update the found AI message with the response text
              const updatedConversation = [...prev];
              updatedConversation[aiMessageIndex] = {
                ...updatedConversation[aiMessageIndex],
                text: response,
                isThinking: false
              };

              return updatedConversation;
            });
          },
          onResponse: (response) => {
            if (!response) return;

            console.log('🤖 AI:', response);

            const responseId = currentResponseIdRef.current;
            if (!responseId) return;

            setConversation(prev => {
              const existingMessageIndex = prev.findIndex(msg => msg.id === responseId);

              if (existingMessageIndex >= 0) {
                const updatedConversation = [...prev];
                const finalAIMessage = {
                  ...updatedConversation[existingMessageIndex],
                  text: response,
                  isThinking: false
                };
                updatedConversation[existingMessageIndex] = finalAIMessage;

                // Save AI response when complete
                if (user) {
                  backgroundSaver.saveMessage(finalAIMessage);
                }

                return updatedConversation;
              }
              return prev;
            });
          },
          onResponseComplete: () => {
            setIsAIResponding(false);
            setCurrentResponseId(null);
            setIsStreaming(false);

            isAIRespondingRef.current = false;
            isStreamingRef.current = false;
            currentResponseIdRef.current = null;
            // Don't clear userMessageAddedForSessionRef here - it's cleared after transcript processing
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

      // Initialize both services in parallel for faster startup
      const initPromises = [];

      // 1. Connect voice session
      const connectionPromise = session.connect();
      initPromises.push(connectionPromise);


      // Wait for all initializations with timeout
      const connectionTimeout = setTimeout(() => {
        if (!isConnected) {
          setIsLoading(false);
        }
      }, 10000);

      try {
        await Promise.all(initPromises);
      } finally {
        clearTimeout(connectionTimeout);
      }

    } catch (error) {
      console.error('❌ ConversationScreen: Session initialization failed:', error);
      Alert.alert('Error', 'Failed to initialize voice session');
      setIsLoading(false);
    }
  };

  const cleanupSession = async () => {
    if (isCleaningUp) return;

    setIsCleaningUp(true);

    // Force save any pending messages
    if (user) {
      await backgroundSaver.forceSave();
    }

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

    try {
      conversationAnalyzer.reset();
    } catch (error) {
      console.warn('⚠️ Error resetting incremental flowchart generator:', error);
    }
    setIncrementalFlowchart(null);
    setAnalysisStatus('');

    setIsConnected(false);
    setIsListeningWithLogging(false);
    setIsProcessingUserInput(false);
    setConversation([]);
    setHasNavigatedToSave(false); // Reset flag when conversation is cleared
    setTranscript('');
    setRecordingDuration(0);
    setRecordingStartTime(null);
    setIsAIResponding(false);
    setCurrentResponseId(null);

    emotionPartsDetector.reset();
    setDetectedItems({ emotions: [], parts: [], needs: [] });

    setDetectedEmotionsData([]);
    setDetectedPartsData([]);
    setDetectedNeedsData([]);
    setShouldRenderBubbleCharts(false);
    resetDetectionTracking();

    setIsStreaming(false);

    isAIRespondingRef.current = false;
    isStreamingRef.current = false;
    currentResponseIdRef.current = null;

    setIsCleaningUp(false);
  };

  const openSettingsModal = () => {
    // Don't open settings while recording
    if (isListening) {
      console.log('⚠️ Cannot open settings while recording');
      return;
    }

    console.log('🎛️ Opening settings modal');
    // Mark that we should check for updated settings on return
    shouldReloadSessionRef.current = true;
    console.log('🔄 Set shouldReloadSessionRef.current = true');

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/voice-settings',
      params: {
        selectedVoice,
        returnToConversation: 'true' // Mark that we should check for updates on return
      }
    });
  };

  const handleTapToTalk = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowWelcomeTooltip(false);

    if (!sessionRef.current || !isConnected) return;

    const sessionIsListening = sessionRef.current?.isListening;
    const hasStateMismatch = isListening && !sessionIsListening;

    const shouldForceStart = isAIResponding || sessionRef.current?.isPlaying || hasStateMismatch;

    if (isListening && !shouldForceStart) {
      try {
        setIsAIResponding(true);
        isAIRespondingRef.current = true;

        sessionRef.current.stopListening();

        setIsListeningWithLogging(false);

        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        setRecordingDuration(0);
        setRecordingStartTime(null);
        setTranscript('');

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.error('❌ Error stopping recording in handleTapToTalk:', error);
      }
    } else {
      setIsListeningWithLogging(true);
      setIsAIResponding(false);
      isAIRespondingRef.current = false;

      try {
        sessionRef.current.startListening();
        setTranscript('');

        const startTime = new Date();
        setRecordingStartTime(startTime);

        recordingTimerRef.current = setInterval(() => {
          const duration = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
          setRecordingDuration(duration);
        }, 100);
      } catch (error) {
        console.error('❌ UI: Error starting recording:', error);
        setIsListeningWithLogging(false);
      }
    }
  };

  const processSendText = (finalText: string) => {
    if (sessionRef.current && isConnected && finalText.trim()) {
      const messageText = finalText.trim();

      // Create user message with sequential ID first so we have the ID for detection
      const userMessage = {
        type: 'user' as const,
        text: messageText,
        id: generateMessageId(),
        timestamp: Date.now(),
        sessionId: conversationSessionId.current,
      };

      // Process detection in background without blocking UI
      emotionPartsDetector.addMessage(messageText).then(detectedLists => {
        if (detectedLists.emotions.length > 0 || detectedLists.parts.length > 0 || detectedLists.needs.length > 0) {
          console.log('🔍 Detected:', {
            emotions: detectedLists.emotions,
            parts: detectedLists.parts,
            needs: detectedLists.needs
          });
        }
        // Batch all state updates together
        unstable_batchedUpdates(() => {
          // Store previous detected items for comparison
          const previousDetectedItems = detectedItems;

          setDetectedItems(detectedLists);

          const conversationId = Date.now().toString() || undefined;

          // Convert string arrays to DetectedItem arrays with proper structure
          const emotionItems = detectedLists.emotions.map(emotion => ({
            name: emotion,
            confidence: 0.8
          }));
          const partItems = detectedLists.parts.map(part => ({
            name: part,
            confidence: 0.8
          }));
          const needItems = detectedLists.needs.map(need => ({
            name: need,
            confidence: 0.8
          }));

          setDetectedEmotionsData(transformDetectedEmotions(emotionItems, conversationId));
          setDetectedPartsData(transformDetectedParts(partItems, conversationId));
          setDetectedNeedsData(transformDetectedNeeds(needItems, conversationId));

          if (detectedLists.emotions.length > 0 || detectedLists.parts.length > 0 || detectedLists.needs.length > 0) {
            setShouldRenderBubbleCharts(true);
            setShowSquareCards(true);
          }

          // Add detection log messages for newly detected items after the user message
          addDetectionLogMessages(previousDetectedItems, detectedLists, userMessage.id);
        });

        // Save detected data in background
        if (user) {
          backgroundSaver.saveDetectedData({
            emotions: detectedLists.emotions.map(e => ({ name: e, confidence: 0.8 })),
            parts: detectedLists.parts.map(p => ({ name: p, confidence: 0.8 })),
            needs: detectedLists.needs.map(n => ({ name: n, confidence: 0.8 })),
          });
        }
      }).catch(error => {
        console.error('Error analyzing message:', error);
      });

      // Add user message immediately
      setConversation(prev => [...prev, userMessage]);

      // Fire-and-forget save
      if (user) {
        backgroundSaver.saveMessage(userMessage);
      }

      // Send to AI
      sessionRef.current.sendMessage(messageText);

      setTextInput('');

      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };


  const handleSubmitEditing = () => {
    handleSendText();
  };

  const handleSendText = () => {
    // For send button, use the current text input value
    if (!sessionRef.current || !isConnected || !textInput?.trim()) return;

    const messageText = textInput.trim();
    console.log('👤 User:', messageText);

    // Create user message with sequential ID first so we have the ID for detection
    const userMessage = {
      type: 'user' as const,
      text: messageText,
      id: generateMessageId(),
      timestamp: Date.now(),
      sessionId: conversationSessionId.current,
    };

    // Process detection in background without blocking UI
    emotionPartsDetector.addMessage(messageText).then(detectedLists => {
      if (detectedLists.emotions.length > 0 || detectedLists.parts.length > 0 || detectedLists.needs.length > 0) {
        console.log('🔍 Detected:', {
          emotions: detectedLists.emotions,
          parts: detectedLists.parts,
          needs: detectedLists.needs
        });
      }
      // Batch all state updates together
      unstable_batchedUpdates(() => {
        // Store previous detected items for comparison
        const previousDetectedItems = detectedItems;

        setDetectedItems(detectedLists);

        const conversationId = Date.now().toString() || undefined;

        // Convert string arrays to DetectedItem arrays with proper structure
        const emotionItems = detectedLists.emotions.map(emotion => ({
          name: emotion,
          confidence: 0.8
        }));
        const partItems = detectedLists.parts.map(part => ({
          name: part,
          confidence: 0.8
        }));
        const needItems = detectedLists.needs.map(need => ({
          name: need,
          confidence: 0.8
        }));

        setDetectedEmotionsData(transformDetectedEmotions(emotionItems, conversationId));
        setDetectedPartsData(transformDetectedParts(partItems, conversationId));
        setDetectedNeedsData(transformDetectedNeeds(needItems, conversationId));

        if (detectedLists.emotions.length > 0 || detectedLists.parts.length > 0 || detectedLists.needs.length > 0) {
          setShouldRenderBubbleCharts(true);
          setShowSquareCards(true);
        }

        // Add detection log messages for newly detected items after the user message
        addDetectionLogMessages(previousDetectedItems, detectedLists, userMessage.id);
      });

      // Save detected data in background
      if (user) {
        backgroundSaver.saveDetectedData({
          emotions: detectedLists.emotions.map(e => ({ name: e, confidence: 0.8 })),
          parts: detectedLists.parts.map(p => ({ name: p, confidence: 0.8 })),
          needs: detectedLists.needs.map(n => ({ name: n, confidence: 0.8 })),
        });
      }
    }).catch(error => {
      console.error('Error analyzing message:', error);
    });

    // Add user message immediately
    setConversation(prev => [...prev, userMessage]);

    // Fire-and-forget save
    if (user) {
      backgroundSaver.saveMessage(userMessage);
    }

    // Send to AI
    setIsAIResponding(true);
    isAIRespondingRef.current = true;

    try {
      sessionRef.current.sendMessage(messageText);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setIsAIResponding(false);
      isAIRespondingRef.current = false;
    }

    // Clear input
    setTextInput('');
    textInputRef.current?.setNativeProps({ text: '' });
  };

  // Only show tooltip when connected and idle if this is first open or user had recording issues
  useEffect(() => {
    if (isConnected && !isListening && !isAIResponding && isFirstOpen && !hasUserInteracted) {
      const timer = setTimeout(() => {
        setShowWelcomeTooltip(true);
        setTimeout(() => setShowWelcomeTooltip(false), 4000);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, isListening, isAIResponding, isFirstOpen, hasUserInteracted]);

  // Load complexes when user is available for caching
  useEffect(() => {
    const loadComplexesForCache = async () => {
      if (user && cachedComplexes.length === 0) {
        try {
          const complexes = await loadComplexes(user.id);
          setCachedComplexes(complexes);
        } catch (error) {
          console.error('Failed to cache complexes:', error);
        }
      }
    };
    loadComplexesForCache();
  }, [user]);

  // Navigation is now handled directly from save-conversation screen


  // Initialize session when component mounts
  useEffect(() => {
    if (!isConnected && !isLoading) {
      setShowTextInput(false);

      loadVoiceSettingAndInitialize();

      const conversationId = Date.now().toString();
      setDetectionConversationId(conversationId);

      // Only show tooltip on first open
      const showTooltipTimer = setTimeout(() => {
        if (isConnected && !isListening && !isAIResponding && isFirstOpen) {
          setShowWelcomeTooltip(true);
        }
      }, 1000);

      const hideTooltipTimer = setTimeout(() => {
        setShowWelcomeTooltip(false);
        if (isFirstOpen) {
          setIsFirstOpen(false);
        }
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

  // Handle proper cleanup when leaving screen and reload session if settings changed
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔍 ConversationScreen: useFocusEffect - Screen focused');
      console.log('🔍 shouldReloadSessionRef.current:', shouldReloadSessionRef.current);
      console.log('🔍 sessionRef.current exists:', !!sessionRef.current);

      // Reset the navigation flag when screen regains focus
      // This ensures usePreventRemove works on every navigation attempt
      setHasNavigatedToSave(false);

      // Check if we need to reload session after returning from settings
      if (shouldReloadSessionRef.current && sessionRef.current) {
        console.log('🔄 Triggering session reload after returning from settings');
        shouldReloadSessionRef.current = false;

        // Update the selected voice and reload session with new settings
        getSelectedVoice().then(voice => {
          console.log('🎤 Retrieved voice from settings:', voice);
          setSelectedVoice(voice);
          // Reload session with new characteristics and voice
          reloadSessionWithNewSettings(voice);
        });
      }

      // Return cleanup function
      return () => {
        console.log('🔍 ConversationScreen: useFocusEffect - Screen losing focus');
        // The screen is losing focus - don't cleanup yet as user might come back
      };
    }, [])
  );

  // Handle navigation to save conversation screen when closing with content
  usePreventRemove(conversation.length > 0 && !hasNavigatedToSave, ({ data }) => {
    // Set flag to prevent this from triggering again
    setHasNavigatedToSave(true);

    // If opened from a complex detail page, save directly to that complex
    if (presetComplexId) {
      backgroundSaver.forceSaveWithComplex(presetComplexId).then(() => {
        cleanupSession();
        // Dismiss all modals and return to the tabs
        router.dismissAll();
      }).catch((error) => {
        console.error('Failed to auto-save conversation to complex:', error);
        // Fallback to save conversation screen
        router.push({
          pathname: '/save-conversation',
          params: {
            sessionId: conversationSessionId.current,
            topic: selectedTopic,
            messages: JSON.stringify(conversation.filter(msg => msg.text && !msg.isRecording && !msg.isProcessing)),
            complexes: JSON.stringify(cachedComplexes),
            preselectedComplexId: presetComplexId
          }
        });
      });
    } else {
      // Navigate to save conversation screen with session ID and cached complexes
      router.push({
        pathname: '/save-conversation',
        params: {
          sessionId: conversationSessionId.current,
          topic: selectedTopic,
          messages: JSON.stringify(conversation.filter(msg => msg.text && !msg.isRecording && !msg.isProcessing)),
          complexes: JSON.stringify(cachedComplexes)
        }
      });
    }
  });

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (conversation.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversation.length]);

  // Adjust scroll position when mini charts toggle
  useEffect(() => {
    if (conversation.length > 0) {
      // Scroll to end when mini charts visibility changes to keep bottom messages visible
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [showSquareCards]);

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

  // Track keyboard visibility (optional UI reactions)
  useEffect(() => {
    const showEvt = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const hideEvt = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });
    return () => {
      showEvt.remove();
      hideEvt.remove();
    };
  }, []);

  // Recording indicator animation loop for pulsing effect
  useEffect(() => {
    const shouldAnimate =
      isListening || isProcessingUserInput || hasIndicatorMessages;

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
  }, [isListening, isProcessingUserInput, hasIndicatorMessages, recordingIndicatorOpacity]);

  const conversationBottomPadding = showTextInput
    ? (showSquareCards ? 0 : 100) // No padding when mini charts are visible since container is smaller
    : 120; // room for voice controls

  return (
    <GradientBackground>
      <View style={[styles.safeArea, { paddingLeft: insets.left, paddingRight: insets.right }]}>
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={styles.blurContainer}
        >
          <>
            {/* Handle Bar */}
            <View style={styles.handleBarContainer}>
              <View
                style={[
                  styles.handleBar,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }
                ]}
              />
            </View>

            {/* Fixed Header */}
            <View style={styles.pageHeader}>
              <Text style={[styles.pageTitle, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }]}>
                New Conversation
              </Text>
            </View>

            {/* Square Cards Section - only show when dropdown is expanded */}
            {showSquareCards && (
              <View style={styles.collapsibleSection}>
                <View style={styles.squareCardsContainer}>
                  <View style={styles.squareCardsInner}>
                    <View style={styles.squareCardWrapper}>
                      <Text
                        style={[
                          styles.squareCardTitle,
                          {
                            color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                            fontWeight: 'bold'
                          }
                        ]}
                      >
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
                            <Text
                              style={[
                                styles.cardEmptyText,
                                { color: colorScheme === 'dark' ? '#888888' : '#999999' }
                              ]}
                            >
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
                      <Text
                        style={[
                          styles.squareCardTitle,
                          {
                            color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                            fontWeight: 'bold'
                          }
                        ]}
                      >
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
                            <Text
                              style={[
                                styles.cardEmptyText,
                                { color: colorScheme === 'dark' ? '#888888' : '#999999' }
                              ]}
                            >
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
                      <Text
                        style={[
                          styles.squareCardTitle,
                          {
                            color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                            fontWeight: 'bold'
                          }
                        ]}
                      >
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
                            <Text
                              style={[
                                styles.cardEmptyText,
                                { color: colorScheme === 'dark' ? '#888888' : '#999999' }
                              ]}
                            >
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

            {/* Down caret button positioned below mini charts */}
            <View style={styles.dropdownCaretContainer}>
              <Pressable
                style={[
                  styles.dropdownCaret,
                  { marginTop: showSquareCards ? 5 : -20 }
                ]}
                onPress={() => setShowSquareCards(!showSquareCards)}
              >
                <View
                  style={[
                    styles.chevronContainer,
                    { transform: [{ rotate: showSquareCards ? '180deg' : '0deg' }] }
                  ]}
                >
                  <IconSymbol
                    size={32}
                    name="chevron.compact.down"
                    color={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                  />
                </View>
              </Pressable>
            </View>

            {/* Main Content */}
            <View style={[styles.pageScrollView, {
              paddingBottom: showTextInput ? 0 : 0
            }]}>
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
                    <Text
                      style={[
                        styles.incrementalToggleText,
                        { color: showIncrementalFlowchart ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#000000') }
                      ]}
                    >
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
                <View
                  style={[
                    styles.incrementalFlowchartContainer,
                    { backgroundColor: isDark ? '#1A1A1A' : '#F5F5F5' }
                  ]}
                >
                  <Text style={[styles.incrementalFlowchartTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                    🎯 Live Flowchart Analysis
                  </Text>
                  <ScrollView style={styles.incrementalFlowchartContent} horizontal>
                    <View style={styles.flowchartNodes}>
                      {incrementalFlowchart.nodes.map((node) => (
                        <View
                          key={node.id}
                          style={[
                            styles.flowchartNode,
                            { backgroundColor: getNodeColor(node.type, isDark) }
                          ]}
                        >
                          <Text style={[styles.flowchartNodeText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                            {node.label}
                          </Text>
                          <Text style={[styles.flowchartNodeType, { color: isDark ? '#CCCCCC' : '#666666' }]}>
                            {node.type}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Active Conversation Container */}
              <View
                style={[
                  styles.activeConversationContainer,
                  {
                    borderColor: isDark ? '#555555' : '#C7C7CC',
                    marginVertical: 0,
                    marginBottom: showTextInput ? 0 : 0,
                    flex: 1
                  }
                ]}
              >
                {/* Conversation */}
                <ScrollView
                  ref={scrollViewRef}
                  style={[
                    styles.conversationContainer,
                    { flex: showIncrementalFlowchart && incrementalFlowchart ? 0.6 : 1 }
                  ]}
                  contentContainerStyle={{
                    flexGrow: 1,
                    paddingTop: showSquareCards ? 20 : 10,
                    paddingBottom: conversationBottomPadding
                  }}
                  onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                >
                  {conversation.length === 0 ? null : (
                    conversation.map((message) => (
                      <Animated.View
                        key={message.id}
                        style={[
                          styles.messageTextContainer,
                          message.type === 'user' && message.fadeAnim ? { opacity: message.fadeAnim } : {}
                        ]}
                      >
                        {/* Show indicator or message text based on state */}
                        {message.isRecording ? (
                          // User recording indicator with live transcript
                          <View style={[styles.recordingIndicatorContainer, { justifyContent: 'flex-end' }]}>
                            {message.text ? (
                              // Show live transcript text if available
                              <Text
                                style={[
                                  styles.messageText,
                                  {
                                    color: isDark ? '#CCCCCC' : '#555555',
                                    fontWeight: 'normal',
                                    textAlign: 'right',
                                    opacity: 0.8 // Slightly faded to indicate it's still being recorded
                                  }
                                ]}
                              >
                                {message.text}
                              </Text>
                            ) : (
                              // Show recording indicator if no text yet
                              <Animated.View
                                style={[
                                  styles.recordingIndicator,
                                  {
                                    backgroundColor: isDark ? '#CCCCCC' : '#555555',
                                    opacity: recordingIndicatorOpacity
                                  }
                                ]}
                              >
                                <Text style={[styles.recordingText, { color: isDark ? '#000000' : '#FFFFFF' }]}>●</Text>
                              </Animated.View>
                            )}
                          </View>
                        ) : message.isProcessing ? (
                          // User processing indicator with pulsating animation
                          <View style={[styles.recordingIndicatorContainer, { justifyContent: 'flex-end' }]}>
                            <Animated.View
                              style={[
                                styles.recordingIndicator,
                                {
                                  backgroundColor: isDark ? '#999999' : '#777777',
                                  opacity: recordingIndicatorOpacity
                                }
                              ]}
                            >
                              <Text style={[styles.recordingText, { color: isDark ? '#000000' : '#FFFFFF' }]}>●</Text>
                            </Animated.View>
                          </View>
                        ) : message.isThinking ? (
                          // AI thinking indicator
                          <View style={[styles.recordingIndicatorContainer, { justifyContent: 'flex-start' }]}>
                            <Animated.View
                              style={[
                                styles.recordingIndicator,
                                {
                                  backgroundColor: isDark ? '#999999' : '#777777',
                                  opacity: recordingIndicatorOpacity
                                }
                              ]}
                            >
                              <Text style={[styles.recordingText, { color: isDark ? '#000000' : '#FFFFFF' }]}>●</Text>
                            </Animated.View>
                          </View>
                        ) : message.type === 'detection_log' ? (
                          // Detection log message - centered and italicized
                          <View
                            style={[
                              styles.recordingIndicatorContainer,
                              { justifyContent: 'center' }
                            ]}
                          >
                            <Text
                              style={[
                                styles.messageText,
                                {
                                  color: isDark ? '#888888' : '#666666',
                                  fontWeight: 'normal',
                                  textAlign: 'center',
                                  fontStyle: 'italic',
                                  fontSize: 16,
                                  opacity: 0.8
                                }
                              ]}
                            >
                              {message.text}
                            </Text>
                          </View>
                        ) : (
                          // Normal message text
                          <View
                            style={[
                              styles.recordingIndicatorContainer,
                              { justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start' }
                            ]}
                          >
                            <Text
                              style={[
                                styles.messageText,
                                {
                                  color:
                                    message.type === 'user'
                                      ? (isDark ? '#CCCCCC' : '#555555')
                                      : (isDark ? '#FFFFFF' : '#000000'),
                                  fontWeight: 'normal',
                                  textAlign: message.type === 'user' ? 'right' : 'left'
                                }
                              ]}
                            >
                              {message.text}
                            </Text>
                          </View>
                        )}
                      </Animated.View>
                    ))
                  )}
                </ScrollView>
              </View>
            </View>

            {/* Controls Container - Always visible, outside pageScrollView */}
            {showTextInput ? (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
              >
                  <View
                    style={[
                      styles.textInputContainer,
                      {
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        paddingTop: 10,
                        marginBottom: 10,
                        paddingBottom: Platform.OS === 'ios' ? insets.bottom + 10 : 10
                      }
                    ]}
                  >
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

                    {/* Text Input Container */}
                    <View style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: isDark ? '#555555' : '#C7C7CC',
                      paddingLeft: 16,
                      paddingRight: 4,
                      minHeight: 40,
                    }}>
                      <TextInput
                        ref={textInputRef}
                        style={[
                          styles.textInput,
                          {
                            flex: 1,
                            color: isDark ? '#FFFFFF' : '#000000',
                            backgroundColor: 'transparent',
                            paddingVertical: 8,
                            fontSize: 18,
                          }
                        ]}
                        placeholder=""
                        placeholderTextColor={isDark ? '#888888' : '#666666'}
                        value={textInput}
                        onChangeText={setTextInput}
                        multiline={false}
                        editable={isConnected}
                        autoFocus={true}
                        blurOnSubmit={false}
                        returnKeyType="send"
                        onSubmitEditing={handleSubmitEditing}
                      />

                      {/* Send Button */}
                      <Pressable
                        style={[
                          styles.sendButton,
                          {
                            backgroundColor: '#007AFF',
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            marginRight: 0,
                          }
                        ]}
                        onPress={handleSendText}
                        disabled={!isConnected || !textInput?.trim()}
                      >
                        <IconSymbol size={16} name="arrow.up" color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </View>
                </KeyboardAvoidingView>
              ) : (
                <View
                  style={[
                    styles.controlsContainer,
                    {
                      paddingBottom: 34,
                      paddingTop: 15,
                      paddingHorizontal: 20,
                      minHeight: 120,
                      backgroundColor: 'transparent',
                      borderTopWidth: 0,
                    }
                  ]}
                >
                  {/* Voice Controls */}
                  <View style={styles.voiceControlsContainer}>
                    {/* Text Input Toggle Button */}
                    <View style={styles.leftControls}>
                      <View style={{ opacity: isListening ? 0.4 : 1 }}>
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
                            // Don't allow switching to text input while recording
                            if (isListening) return;

                            setShowTextInput(true);
                            setShowWelcomeTooltip(false);
                            setTimeout(() => {
                              textInputRef.current?.focus();
                            }, 150);
                          }}
                          disabled={isListening}
                        >
                          <IconSymbol
                            size={20}
                            name="pencil"
                            color={isListening ? (isDark ? '#666' : '#999') : (isDark ? '#FFFFFF' : '#000000')}
                          />
                        </Pressable>
                      </View>
                    </View>

                    {/* Centered Voice Button */}
                    <View style={styles.centerControls}>
                      <View style={styles.voiceButtonContainer}>
                        {/* Welcome Tooltip */}
                        {showWelcomeTooltip && isConnected && !isListening && !isAIResponding && (
                          <View
                            style={[
                              styles.welcomeTooltip,
                              { backgroundColor: isDark ? '#333333' : '#000000' }
                            ]}
                          >
                            <Text style={styles.welcomeTooltipText}>Tap to{'\n'}record</Text>
                            <View style={styles.tooltipArrowContainer}>
                              <View
                                style={[
                                  styles.tooltipArrow,
                                  { borderTopColor: isDark ? '#333333' : '#000000' }
                                ]}
                              />
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
                              { opacity: isConnected ? 1 : 0.5 }
                            ]}
                            onPress={handleTapToTalk}
                            disabled={!isConnected}
                          >
                            <Image
                              source={require('@/assets/images/Logo.png')}
                              style={[styles.voiceButtonLogo, { tintColor: '#FFF' }]}
                              resizeMode="contain"
                            />
                          </Pressable>
                        </Animated.View>
                      </View>
                    </View>

                    {/* Settings Button */}
                    <View style={styles.rightControls}>
                      <View style={{ opacity: isListening ? 0.4 : 1 }}>
                        <Pressable
                          style={[
                            styles.settingsButton,
                            {
                              backgroundColor: isDark ? '#333333' : '#E0E0E0',
                            }
                          ]}
                          onPress={openSettingsModal}
                          disabled={isListening}
                        >
                          <IconSymbol
                            size={20}
                            name="slider.horizontal.3"
                            color={isListening ? (isDark ? '#666' : '#999') : (isDark ? '#fff' : '#000')}
                          />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              )}
          </>
        </BlurView>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  blurContainer: { flex: 1 },
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
    paddingTop: 8,
    paddingBottom: 15,
    backgroundColor: 'transparent',
    minHeight: 80,
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
    marginBottom: 0,
  },
  dropdownCaret: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronContainer: { justifyContent: 'center', alignItems: 'center' },
  collapsibleSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 140,
    marginTop: -30,
  },
  squareCardsContainer: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  squareCardsInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  squareCardWrapper: { flex: 1 },
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
  cardEmptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  cardEmptyText: { fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
  pageScrollView: { flex: 1 },
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
  incrementalToggleText: { fontSize: 16, fontWeight: '600' },
  analysisStatus: { fontSize: 14, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  incrementalFlowchartContainer: {
    margin: 20,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
  },
  incrementalFlowchartTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  incrementalFlowchartContent: { maxHeight: 150 },
  flowchartNodes: { flexDirection: 'row', gap: 12, paddingHorizontal: 8 },
  flowchartNode: { padding: 12, borderRadius: 8, minWidth: 100, alignItems: 'center' },
  flowchartNodeText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  flowchartNodeType: { fontSize: 12, marginTop: 4, textAlign: 'center' },
  activeConversationContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  conversationContainer: { flex: 1, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 0 },
  emptyConversationContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
  emptyConversationText: { fontSize: 16, textAlign: 'center', fontStyle: 'italic' },
  messageTextContainer: { marginVertical: 12, minHeight: 24, paddingTop: 2 },
  messageText: { fontSize: 19, lineHeight: 24, fontWeight: '400', fontFamily: 'Georgia' },
  recordingIndicatorContainer: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 24, paddingTop: 2 },
  recordingIndicator: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  recordingText: { fontSize: 16, fontWeight: 'bold' },
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
  textInputVoiceButtonLogo: { width: 32, height: 32 },
  textInput: {
    fontSize: 18,
    textAlignVertical: 'center',
    fontFamily: 'Georgia',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsContainer: { paddingHorizontal: 20, paddingTop: 15, minHeight: 120 },
  voiceControlsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leftControls: { width: 50, alignItems: 'flex-start' },
  centerControls: { flex: 1, alignItems: 'center' },
  rightControls: { width: 50, alignItems: 'flex-end' },
  textToggleButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  voiceButtonContainer: { alignItems: 'center' },
  welcomeTooltip: {
    position: 'absolute',
    bottom: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1000,
  },
  welcomeTooltipText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'normal', textAlign: 'center', fontFamily: 'Georgia' },
  tooltipArrowContainer: { position: 'absolute', bottom: -6, width: '100%', height: 6 },
  tooltipArrow: {
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: 6 }],
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
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  voiceButtonLogo: { width: 80, height: 80 },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
