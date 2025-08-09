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
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { FlowchartStructure } from '@/lib/types/flowchart';
import { 
  createVoiceFlowchartSession, 
  VoiceFlowchartSession,
  loadFlowchartTemplate,
  generateVoiceInstructions 
} from '@/lib/services/voiceFlowchartGenerator';
import { 
  incrementalFlowchartGenerator, 
  ConversationMessage, 
  IncrementalFlowchartCallbacks 
} from '@/lib/services/incrementalFlowchartGenerator';
import { getSelectedVoice, VoiceType } from '@/lib/services/voiceSettings';
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
  
  // Debug wrapper for setIsListening to track state changes
  const setIsListeningWithLogging = (value: boolean) => {
    console.log(`🔄 setIsListening: ${isListening} → ${value}`, new Error().stack?.split('\n')[2]);
    setIsListening(value);
  };
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState<Array<{
    type: 'user' | 'assistant', 
    text: string,
    id: string,
    fadeAnim?: Animated.Value
  }>>([]);
  const [textInput, setTextInput] = useState('');
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState<VoiceType>('alloy'); // Will be loaded from settings
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [incrementalFlowchart, setIncrementalFlowchart] = useState<FlowchartStructure | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [showIncrementalFlowchart, setShowIncrementalFlowchart] = useState(true);
  const [showTextInput, setShowTextInput] = useState(false);
  const [showWelcomeTooltip, setShowWelcomeTooltip] = useState(false);
  
  const sessionRef = useRef<VoiceFlowchartSession | null>(null);
  const textInputRef = useRef<any>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const colorPulseAnim = useRef(new Animated.Value(0)).current;

  // Helper function to add user message with fade-in animation
  const addUserMessageWithAnimation = (text: string) => {
    const fadeAnim = new Animated.Value(0);
    const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    setConversation(prev => {
      // Check for immediate duplicates
      const lastMessage = prev[prev.length - 1];
      const isImmediateDuplicate = lastMessage && 
        lastMessage.type === 'user' && 
        lastMessage.text === text;
      
      if (isImmediateDuplicate) {
        console.log('🚫 Skipping immediate duplicate user message:', text);
        return prev;
      }
      
      const newMessage = { 
        type: 'user' as const, 
        text, 
        id: messageId,
        fadeAnim 
      };
      
      // Start fade-in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      
      return [...prev, newMessage];
    });
  };

  // Helper function to add assistant message without animation
  const addAssistantMessage = (text: string) => {
    const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    setConversation(prev => {
      const newMessage = { 
        type: 'assistant' as const, 
        text, 
        id: messageId
      };
      return [...prev, newMessage];
    });
  };

  // Helper function to get node colors
  const getNodeColor = (type: string, isDark: boolean) => {
    const colors = {
      'Self': isDark ? '#4CAF50' : '#81C784',
      'Manager': isDark ? '#2196F3' : '#64B5F6', 
      'Firefighter': isDark ? '#FF5722' : '#FF8A65',
      'Exile': isDark ? '#9C27B0' : '#BA68C8',
      'Need': isDark ? '#FF9800' : '#FFB74D'
    };
    return colors[type as keyof typeof colors] || (isDark ? '#666666' : '#CCCCCC');
  };

  useEffect(() => {
    if (visible) {
      // Always start with voice mode (big green button)
      setShowTextInput(false);
      setShowWelcomeTooltip(false);
      
      loadVoiceSettingAndInitialize();
      
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
    }
    
    return () => cleanupSession();
  }, [visible]);

  // Debug effect to monitor button state
  useEffect(() => {
    const color = isListening ? 'RED' : (isAIResponding ? 'BLUE' : 'GREEN');
    console.log(`🎨 Button Color: ${color} (isListening=${isListening}, isAIResponding=${isAIResponding})`);
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

  const loadVoiceSettingAndInitialize = async () => {
    const voice = await getSelectedVoice();
    setSelectedVoice(voice);
    
    // Add small delay to ensure any previous session cleanup is complete
    setTimeout(() => {
      initializeSession();
    }, 500);
  };

  // Setup incremental flowchart callbacks
  // These are COMPLETELY ISOLATED from the voice conversation system
  const incrementalCallbacks: IncrementalFlowchartCallbacks = {
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
      
      // Load the flowchart template
      const template = await loadFlowchartTemplate();
      
      // Generate instructions from the centralized prompt file
      const sessionInstructions = await generateVoiceInstructions(template);
      
      const session = createVoiceFlowchartSession(
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
            console.log('🎤 VOICE: Started recording');
            console.log('🔵 Button State: isListening=true, isAIResponding=false → RED');
            setIsListeningWithLogging(true);
            // Clear AI responding state when we start listening for user input
            setIsAIResponding(false);
          },
          onListeningStop: () => {
            console.log('🛑 VOICE: Stopped recording');
            console.log('🔵 Button State: isListening=false, isAIResponding=true → BLUE');
            setIsListeningWithLogging(false);
            setIsAIResponding(true); // Set AI responding immediately when recording stops
            // Clear any lingering transcript when recording stops
            setTimeout(() => setTranscript(''), 500);
          },
          onTranscript: (transcriptText, isFinal) => {
            if (isFinal) {
              console.log('📝 TRANSCRIPTION:', transcriptText);
              
              // Immediately clear transcript
              setTranscript('');
              
              // Set pending message to ensure it's added before response
              setPendingUserMessage(transcriptText);
              
              // Add user message to conversation with fade-in animation
              addUserMessageWithAnimation(transcriptText);
              
              // Clear pending after a short delay
              setTimeout(() => setPendingUserMessage(null), 1000);
            } else {
              // Show partial transcript while speaking
              setTranscript(transcriptText);
            }
          },
          onResponse: (response) => {
            if (!response) return;
            
            // Don't start AI response if user is actively recording
            if (isListening) {
              console.log('🎤 User is recording - suppressing AI response and audio');
              return;
            }
            
            // Mark AI as responding when we start receiving response
            console.log('💬 AI Response started - Setting button to BLUE');
            setIsAIResponding(true);
            
            setConversation(prev => {
              const lastMessage = prev[prev.length - 1];
              
              let newConversation;
              if (lastMessage && lastMessage.type === 'assistant') {
                // Append to existing assistant message (streaming)
                newConversation = [...prev.slice(0, -1), { 
                  type: 'assistant', 
                  text: lastMessage.text + response,
                  id: lastMessage.id // Keep the same ID for streaming updates
                }];
              } else {
                // Create new assistant message
                const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                newConversation = [...prev, { 
                  type: 'assistant', 
                  text: response, 
                  id: messageId
                }];
              }
              
              // Incremental flowchart generation disabled
              // // Add complete assistant message to incremental flowchart generator (ISOLATED)
              // // Only track complete messages when streaming finishes
              // if (!lastMessage || lastMessage.type !== 'assistant') {
              //   // This is a new assistant message
              //   setTimeout(() => {
              //     try {
              //       // Wait a bit for streaming to complete, then add the full message
              //       const fullMessage = newConversation[newConversation.length - 1]?.text;
              //       if (fullMessage) {
              //         const message: ConversationMessage = {
              //           role: 'assistant', 
              //           content: fullMessage,
              //           timestamp: new Date()
              //         };
              //         incrementalFlowchartGenerator.addMessage(message, incrementalCallbacks);
              //       }
              //     } catch (analyzerError) {
              //       // Silently handle analyzer errors - they won't affect voice conversation
              //     }
              //   }, 2000); // Wait 2 seconds for streaming to complete
              // }
              
              return newConversation;
            });
          },
          onResponseComplete: () => {
            console.log('✅ AI Response complete - Setting button to GREEN');
            console.log('🔵 Button State: isListening=false, isAIResponding=false → GREEN');
            setIsAIResponding(false);
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
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    // Reset incremental flowchart generator
    incrementalFlowchartGenerator.reset();
    setIncrementalFlowchart(null);
    setAnalysisStatus('');
    
    setIsConnected(false);
    setIsListeningWithLogging(false);
    setConversation([]);
    setTranscript('');
    setRecordingDuration(0);
    setRecordingStartTime(null);
    setIsAIResponding(false);
    
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
    
    console.log('🚨🚨🚨 HANDLE_TAP_TO_TALK_CALLED 🚨🚨🚨');
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
        
        console.log('✅ Recording stopped successfully');
        
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
        
        console.log('✅ UI: Recording setup complete');
      } catch (error) {
        console.error('❌ UI: Error starting recording:', error);
        // Reset visual state if recording fails
        setIsListeningWithLogging(false);
      }
    }
  };

  const toggleContinuousMode = () => {
    if (sessionRef.current && isConnected) {
      if (isContinuousMode) {
        sessionRef.current.stopContinuousListening();
        setIsContinuousMode(false);
      } else {
        sessionRef.current.startContinuousListening();
        setIsContinuousMode(true);
      }
    }
  };


  const handleSendText = () => {
    if (sessionRef.current && isConnected && textInput.trim()) {
      const messageText = textInput.trim();
      
      // Add user message to conversation with fade-in animation
      addUserMessageWithAnimation(messageText);
      
      // Incremental flowchart generation disabled
      // try {
      //   const message: ConversationMessage = {
      //     role: 'user',
      //     content: messageText,
      //     timestamp: new Date()
      //   };
      //   incrementalFlowchartGenerator.addMessage(message, incrementalCallbacks);
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
                backgroundColor: isListening ? '#FF5722' : (isConnected ? '#4CAF50' : '#666666')
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
          <View style={styles.headerButtons}>
            <Pressable
              style={styles.minimizeButton}
              onPress={() => setIsMinimized(true)}
            >
              <Text style={styles.minimizeButtonText}>−</Text>
            </Pressable>
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>
        </View>




        {/* Incremental Flowchart Toggle */}
        {incrementalFlowchart && (
          <View style={styles.incrementalToggleSection}>
            <Pressable
              style={[
                styles.incrementalToggle,
                { backgroundColor: showIncrementalFlowchart ? '#4CAF50' : (isDark ? '#333333' : '#E0E0E0') }
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
                styles.messageBubbleContainer,
                message.type === 'user' ? styles.userBubbleContainer : styles.assistantBubbleContainer,
                message.type === 'user' && message.fadeAnim ? {
                  opacity: message.fadeAnim
                } : {}
              ]}
            >
              <View
                style={[
                  styles.messageContainer,
                  message.type === 'user' 
                    ? styles.userMessage 
                    : [
                        styles.assistantMessage,
                        { backgroundColor: isDark ? '#2C2C2E' : '#E9E9EB' }
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
              
              {/* Tail for user message (bottom right) */}
              {message.type === 'user' && (
                <View style={[
                  styles.messageTail,
                  styles.userTail,
                  { borderLeftColor: '#0084FF' }
                ]} />
              )}
              
              {/* Tail for assistant message (bottom left) */}
              {message.type === 'assistant' && (
                <View style={[
                  styles.messageTail,
                  styles.assistantTail,
                  { borderRightColor: isDark ? '#2C2C2E' : '#E9E9EB' }
                ]} />
              )}
            </Animated.View>
          ))}
          
        </ScrollView>

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
                        Tap to begin conversation
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
                          : ['#4CAF50', '#4CAF50'], // Green stays the same when idle (no pulsing)
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

            {/* Right side placeholder for symmetry */}
            <View style={styles.rightControls}>
              {/* Empty space for visual balance */}
            </View>
          </View>

          {/* Conditional Text Input */}
          {showTextInput && (
            <View style={[
              styles.textInputContainer,
              { paddingBottom: 10 } // Override the large bottom padding when keyboard is visible
            ]}>
              <Pressable
                style={[
                  styles.textInputVoiceButton,
                  { backgroundColor: '#4CAF50' }
                ]}
                onPress={() => {
                  // Hide text input and clear it
                  setShowTextInput(false);
                  setTextInput('');
                  
                  // Immediately start voice recording
                  if (sessionRef.current && isConnected) {
                    console.log('🎤 Text input voice button - immediately starting recording');
                    handleTapToTalk();
                  }
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
                  <IconSymbol 
                    size={18} 
                    name="arrow.up" 
                    color="#FFFFFF" 
                  />
                </Pressable>
              </View>
            </View>
          )}
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
    fontFamily: 'Georgia',
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
  messageBubbleContainer: {
    marginVertical: 2,
    position: 'relative',
  },
  userBubbleContainer: {
    alignItems: 'flex-end',
    marginLeft: '15%',
  },
  assistantBubbleContainer: {
    alignItems: 'flex-start',
    marginRight: '15%',
  },
  messageContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: '85%',
  },
  userMessage: {
    backgroundColor: '#0084FF',
  },
  assistantMessage: {
    backgroundColor: '#E9E9EB', // Light mode default, overridden in component
  },
  messageTail: {
    position: 'absolute',
    bottom: 0,
    width: 0,
    height: 0,
    borderStyle: 'solid',
  },
  userTail: {
    right: -6,
    borderWidth: 8,
    borderColor: 'transparent',
    borderTopWidth: 12,
    borderBottomWidth: 0,
  },
  assistantTail: {
    left: -6,
    borderWidth: 8,
    borderColor: 'transparent',
    borderTopWidth: 12,
    borderBottomWidth: 0,
  },
  transcriptMessage: {
    backgroundColor: '#FFF3CD',
    alignSelf: 'flex-end',
    opacity: 0.8,
  },
  messageText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: 'Georgia',
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
    alignItems: 'flex-end',
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
    right: 6,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
});