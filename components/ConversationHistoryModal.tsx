import React, { useState, useEffect, useRef, Suspense } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ConversationData } from '@/lib/services/conversationService';
import { generateTestEmotionData } from '@/lib/utils/testData';
import { generateTestPartsData, generateTestNeedsData } from '@/lib/utils/partsNeedsTestData';
import { EmotionBubbleData } from '@/lib/types/bubbleChart';
import { PartBubbleData, NeedBubbleData } from '@/lib/types/partsNeedsChart';

// Lazy load bubble chart components
const PartsHoneycombMiniBubbleChart = React.lazy(() => import('@/components/PartsHoneycombMiniBubbleChart'));
const NeedsHoneycombMiniBubbleChart = React.lazy(() => import('@/components/NeedsHoneycombMiniBubbleChart'));
const EmotionsHoneycombMiniBubbleChart = React.lazy(() => import('@/components/EmotionsHoneycombMiniBubbleChart'));

interface ConversationHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  conversationData: ConversationData | null;
}

export function ConversationHistoryModal({
  visible,
  onClose,
  conversationData
}: ConversationHistoryModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const modalTranslateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const [showSquareCards, setShowSquareCards] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

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

  // Create pan responder for mini charts area
  const chartsPanResponder = useRef(
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

  // Chart dimensions state
  const [emotionsChartDimensions] = useState({ width: 110, height: 110 });
  const [partsChartDimensions] = useState({ width: 110, height: 110 });
  const [needsChartDimensions] = useState({ width: 110, height: 110 });

  // Generate sample chart data (in a real app, this would come from the conversation)
  const [detectedEmotionsData] = useState<EmotionBubbleData[]>(generateTestEmotionData(4));
  const [detectedPartsData] = useState<PartBubbleData[]>(generateTestPartsData(3));
  const [detectedNeedsData] = useState<NeedBubbleData[]>(generateTestNeedsData(3));

  // Modal animation
  useEffect(() => {
    if (visible) {
      modalTranslateY.setValue(Dimensions.get('window').height);
      Animated.timing(modalTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, conversationData]);

  const handleClose = () => {
    Animated.timing(modalTranslateY, {
      toValue: Dimensions.get('window').height,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  if (!conversationData) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
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
          tint={isDark ? 'dark' : 'light'}
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
                <Text style={[
                  styles.modalTitle,
                  { color: isDark ? '#FFFFFF' : '#000000' }
                ]}>
                  {conversationData.title}
                </Text>
              </View>
            </View>

            {/* Square Cards Section */}
              <View
                style={styles.collapsibleSection}
                {...chartsPanResponder.panHandlers}
              >
                <View style={styles.squareCardsContainer}>
                  <View style={styles.squareCardsInner}>
                    {/* Emotions Card */}
                    <View style={styles.squareCardWrapper}>
                      <Text style={[
                        styles.squareCardTitle,
                        {
                          color: isDark ? '#FFFFFF' : '#000000',
                          fontWeight: 'bold'
                        }
                      ]}>
                        Emotions
                      </Text>
                      <View
                        style={[
                          styles.squareCard,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.1)'
                              : 'rgba(0, 0, 0, 0.05)',
                            borderColor: isDark
                              ? 'rgba(255, 255, 255, 0.2)'
                              : 'rgba(0, 0, 0, 0.1)',
                            padding: 0,
                          }
                        ]}
                      >
                        {detectedEmotionsData.length === 0 ? (
                          <View style={styles.cardEmptyContainer}>
                            <Text style={[
                              styles.cardEmptyText,
                              { color: isDark ? '#888888' : '#999999' }
                            ]}>
                              No emotions detected...
                            </Text>
                          </View>
                        ) : (
                          <Suspense fallback={<View style={styles.cardEmptyContainer} />}>
                            <EmotionsHoneycombMiniBubbleChart
                              data={detectedEmotionsData}
                              width={emotionsChartDimensions.width}
                              height={emotionsChartDimensions.height}
                              loading={false}
                            />
                          </Suspense>
                        )}
                      </View>
                    </View>

                    {/* Parts Card */}
                    <View style={styles.squareCardWrapper}>
                      <Text style={[
                        styles.squareCardTitle,
                        {
                          color: isDark ? '#FFFFFF' : '#000000',
                          fontWeight: 'bold'
                        }
                      ]}>
                        Parts
                      </Text>
                      <View
                        style={[
                          styles.squareCard,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.1)'
                              : 'rgba(0, 0, 0, 0.05)',
                            borderColor: isDark
                              ? 'rgba(255, 255, 255, 0.2)'
                              : 'rgba(0, 0, 0, 0.1)',
                            padding: 0,
                          }
                        ]}
                      >
                        {detectedPartsData.length === 0 ? (
                          <View style={styles.cardEmptyContainer}>
                            <Text style={[
                              styles.cardEmptyText,
                              { color: isDark ? '#888888' : '#999999' }
                            ]}>
                              No parts detected...
                            </Text>
                          </View>
                        ) : (
                          <Suspense fallback={<View style={styles.cardEmptyContainer} />}>
                            <PartsHoneycombMiniBubbleChart
                              data={detectedPartsData}
                              width={partsChartDimensions.width}
                              height={partsChartDimensions.height}
                              loading={false}
                            />
                          </Suspense>
                        )}
                      </View>
                    </View>

                    {/* Needs Card */}
                    <View style={styles.squareCardWrapper}>
                      <Text style={[
                        styles.squareCardTitle,
                        {
                          color: isDark ? '#FFFFFF' : '#000000',
                          fontWeight: 'bold'
                        }
                      ]}>
                        Needs
                      </Text>
                      <View
                        style={[
                          styles.squareCard,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.1)'
                              : 'rgba(0, 0, 0, 0.05)',
                            borderColor: isDark
                              ? 'rgba(255, 255, 255, 0.2)'
                              : 'rgba(0, 0, 0, 0.1)',
                            padding: 0,
                          }
                        ]}
                      >
                        {detectedNeedsData.length === 0 ? (
                          <View style={styles.cardEmptyContainer}>
                            <Text style={[
                              styles.cardEmptyText,
                              { color: isDark ? '#888888' : '#999999' }
                            ]}>
                              No needs detected...
                            </Text>
                          </View>
                        ) : (
                          <Suspense fallback={<View style={styles.cardEmptyContainer} />}>
                            <NeedsHoneycombMiniBubbleChart
                              data={detectedNeedsData}
                              width={needsChartDimensions.width}
                              height={needsChartDimensions.height}
                              loading={false}
                            />
                          </Suspense>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              </View>

            {/* Conversation Summary */}
            <View
              style={styles.summaryContainer}
              {...chartsPanResponder.panHandlers}
            >
              <Text style={[
                styles.summaryText,
                { color: isDark ? '#DDDDDD' : '#444444' }
              ]}>
                {conversationData.description}
              </Text>
            </View>

            {/* Content Container */}
            <View style={styles.modalScrollView}>
              {/* Active Conversation Container */}
              <View style={[
                styles.activeConversationContainer,
                { borderColor: isDark ? '#555555' : '#C7C7CC' }
              ]}>
                {/* Conversation */}
                <ScrollView
                  ref={scrollViewRef}
                  style={styles.conversationContainer}
                  onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                >
                  {conversationData.messages.map((message, index) => (
                    <View
                      key={message.id}
                      style={styles.messageTextContainer}
                    >
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
                          {message.content}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingTop: 50,
    zIndex: 99999,
  },
  blurContainer: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 35,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
    fontFamily: 'Georgia',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
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
  minimizeButton: {
    borderRadius: 14,
    borderWidth: 1,
  },
  collapsibleArrow: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  collapsibleSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  squareCardsContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  squareCardsInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
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
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardEmptyText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  summaryContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  summaryText: {
    fontSize: 20,
    lineHeight: 30,
    textAlign: 'left',
    fontFamily: 'Georgia',
  },
  modalScrollView: {
    flex: 1,
  },
  activeConversationContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  conversationContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messageTextContainer: {
    marginVertical: 12,
    minHeight: 24,
    paddingTop: 2,
  },
  recordingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 24,
    paddingTop: 2,
  },
  messageText: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '400',
    fontFamily: 'Georgia',
  },
});