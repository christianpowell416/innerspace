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
import { SafeAreaView } from 'react-native-safe-area-context';
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
import * as DocumentPicker from 'expo-document-picker';

// Direct imports for bubble chart components
import { PartsHoneycombMiniBubbleChart } from '@/components/PartsHoneycombMiniBubbleChart';
import { NeedsHoneycombMiniBubbleChart } from '@/components/NeedsHoneycombMiniBubbleChart';
import { EmotionsHoneycombMiniBubbleChart } from '@/components/EmotionsHoneycombMiniBubbleChart';

export default function ConversationScreen() {
  const { topic } = useLocalSearchParams();
  const selectedTopic = typeof topic === 'string' ? topic : 'general';
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [showSquareCards, setShowSquareCards] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [modalMode, setModalMode] = useState<'conversation' | 'settings'>('conversation');
  const [selectedVoice, setSelectedVoiceState] = useState<VoiceType>('alloy');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [conversation, setConversation] = useState<Array<{
    id: string;
    text: string;
    type: 'user' | 'ai';
    timestamp: Date;
    isRecording?: boolean;
    isProcessing?: boolean;
    isThinking?: boolean;
    fadeAnim?: Animated.Value;
  }>>([]);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [showWelcomeTooltip, setShowWelcomeTooltip] = useState(false);
  const [incrementalFlowchart, setIncrementalFlowchart] = useState<FlowchartStructure | null>(null);
  const [showIncrementalFlowchart, setShowIncrementalFlowchart] = useState(true);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');

  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  const colorPulseAnim = useRef(new Animated.Value(0)).current;
  const recordingIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const textInputMarginBottom = useRef(new Animated.Value(10)).current;

  const handleFlowchartCreated = async (flowchart: FlowchartStructure) => {
    console.log('Flowchart created from conversation:', flowchart);
    router.back();
  };

  const handleClose = () => {
    router.back();
  };

  const handleTapToTalk = () => {
    console.log('Tap to talk pressed');
    // Voice recording logic will be implemented here
  };

  const openSettingsModal = () => {
    setModalMode('settings');
    setShowVoiceSettings(true);
  };

  const closeSettingsModal = () => {
    setModalMode('conversation');
    setShowVoiceSettings(false);
  };

  const handleSendText = () => {
    if (textInput.trim() && isConnected) {
      console.log('Sending text:', textInput);
      setTextInput('');
      setShowTextInput(false);
    }
  };

  const handleTextEndEditing = () => {
    // Handle text input end editing
  };

  const getNodeColor = (nodeType: string, isDark: boolean) => {
    // Color mapping for flowchart nodes
    const colors = {
      'emotion': isDark ? '#FF6B6B' : '#FF4757',
      'part': isDark ? '#4ECDC4' : '#00CEC9',
      'need': isDark ? '#45B7D1' : '#0984E3',
    };
    return colors[nodeType as keyof typeof colors] || (isDark ? '#666666' : '#CCCCCC');
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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
          {/* Fixed Header */}
          <View style={styles.modalHeader}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              flex: 1,
            }}>
              {/* Dropdown button */}
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
                          padding: 0,
                        }
                      ]}
                    >
                      <View style={styles.cardEmptyContainer}>
                        <Text style={[
                          styles.cardEmptyText,
                          { color: colorScheme === 'dark' ? '#888888' : '#999999' }
                        ]}>
                          No emotions detected yet...
                        </Text>
                      </View>
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
                    >
                      <View style={styles.cardEmptyContainer}>
                        <Text style={[
                          styles.cardEmptyText,
                          { color: colorScheme === 'dark' ? '#888888' : '#999999' }
                        ]}>
                          No parts detected yet...
                        </Text>
                      </View>
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
                    >
                      <View style={styles.cardEmptyContainer}>
                        <Text style={[
                          styles.cardEmptyText,
                          { color: colorScheme === 'dark' ? '#888888' : '#999999' }
                        ]}>
                          No needs detected yet...
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Main Content */}
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
                {conversation.length === 0 ? (
                  <View style={styles.emptyConversationContainer}>
                    <Text style={[styles.emptyConversationText, { color: isDark ? '#888888' : '#666666' }]}>
                      Start a conversation by tapping the microphone or typing a message...
                    </Text>
                  </View>
                ) : (
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
                      <Text style={[
                        styles.messageText,
                        {
                          color: isDark ? '#FFFFFF' : '#000000',
                          textAlign: message.type === 'user' ? 'right' : 'left',
                          backgroundColor: message.type === 'user'
                            ? (isDark ? '#0066CC' : '#007AFF')
                            : (isDark ? '#333333' : '#E8E8E8'),
                          alignSelf: message.type === 'user' ? 'flex-end' : 'flex-start'
                        }
                      ]}>
                        {message.text}
                      </Text>
                    </Animated.View>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Text Input - positioned above controls */}
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
                    setShowTextInput(false);
                    setTextInput('');
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
                      style={[
                        styles.textToggleButton,
                        { backgroundColor: isDark ? '#333333' : '#E0E0E0' }
                      ]}
                      onPress={() => {
                        setShowTextInput(true);
                        setShowWelcomeTooltip(false);
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
                          style={styles.circularVoiceButton}
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
      </SafeAreaView>

      {/* Voice Settings Modal */}
      <Modal
        animationType="none"
        transparent={false}
        visible={modalMode === 'settings'}
        onRequestClose={closeSettingsModal}
      >
        <GradientBackground>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.voiceSettingsModal}>
              {/* Settings Header */}
              <View style={styles.settingsHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                  <Pressable onPress={closeSettingsModal} style={styles.backArrow}>
                    <Text style={[styles.backArrowText, { color: isDark ? '#FFFFFF' : '#000000' }]}>‹</Text>
                  </Pressable>
                  <Text style={[
                    styles.settingsTitle,
                    { color: isDark ? '#FFFFFF' : '#000000' }
                  ]}>
                    Voice Settings
                  </Text>
                </View>
              </View>

              {/* Settings Content */}
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
                  <Text style={[styles.sectionLabel, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                    Select Voice:
                  </Text>
                  <View style={styles.voiceGrid}>
                    {getAllVoices().map((voice) => (
                      <Pressable
                        key={voice}
                        style={[
                          styles.voiceOption,
                          {
                            backgroundColor: selectedVoice === voice
                              ? (isDark ? '#4A90E2' : '#007AFF')
                              : (isDark ? '#2A2A2A' : '#F0F0F0'),
                            borderColor: selectedVoice === voice
                              ? (isDark ? '#6BB6FF' : '#0056CC')
                              : 'transparent',
                          }
                        ]}
                        onPress={() => {
                          setSelectedVoiceState(voice);
                          setSelectedVoice(voice);
                        }}
                      >
                        <Text style={[
                          styles.voiceOptionText,
                          {
                            color: selectedVoice === voice
                              ? '#FFFFFF'
                              : (isDark ? '#FFFFFF' : '#000000')
                          }
                        ]}>
                          {voice}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>
          </SafeAreaView>
        </GradientBackground>
      </Modal>
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
  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  minimizeButton: {
    borderRadius: 8,
    borderWidth: 1,
  },
  collapsibleArrow: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  collapsibleSection: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  squareCardsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  squareCardsInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  squareCardWrapper: {
    flex: 1,
  },
  squareCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  squareCard: {
    height: 110,
    borderRadius: 12,
    borderWidth: 1,
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
  modalScrollView: {
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
    marginVertical: 6,
  },
  messageText: {
    fontSize: 16,
    padding: 12,
    borderRadius: 18,
    maxWidth: '80%',
    lineHeight: 22,
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  textInputVoiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInputVoiceButtonLogo: {
    width: 20,
    height: 20,
  },
  textInputWithButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  controlsContainer: {
    paddingHorizontal: 20,
    paddingTop: 15,
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
    bottom: 90,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1000,
  },
  welcomeTooltipText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  tooltipArrowContainer: {
    alignItems: 'center',
    marginTop: 2,
  },
  tooltipArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  circularVoiceButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonLogo: {
    width: 30,
    height: 30,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Voice Settings Modal Styles
  voiceSettingsModal: {
    flex: 1,
  },
  settingsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  backArrow: {
    marginRight: 15,
  },
  backArrowText: {
    fontSize: 30,
    fontWeight: '300',
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  voiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  voiceOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    minWidth: 80,
    alignItems: 'center',
  },
  voiceOptionText: {
    fontSize: 16,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});