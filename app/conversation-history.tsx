import React, { useState, useEffect, useRef, Suspense } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  PanResponder,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import { router, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { EmotionBubbleData } from '@/lib/types/bubbleChart';
import { PartBubbleData, NeedBubbleData } from '@/lib/types/partsNeedsChart';
import { useAuth } from '@/contexts/AuthContext';
import {
  loadConversation,
  ConversationData as DatabaseConversationData
} from '@/lib/services/conversationPersistence';
import {
  loadAllDetectedData
} from '@/lib/services/detectedDataService';
import {
  transformDetectedEmotions,
  transformDetectedParts,
  transformDetectedNeeds
} from '@/lib/utils/detectionDataTransform';
import { ConversationMessage } from '@/lib/database.types';

// Lazy load bubble chart components
const PartsHoneycombMiniBubbleChart = React.lazy(() => import('@/components/PartsHoneycombMiniBubbleChart'));
const NeedsHoneycombMiniBubbleChart = React.lazy(() => import('@/components/NeedsHoneycombMiniBubbleChart'));
const EmotionsHoneycombMiniBubbleChart = React.lazy(() => import('@/components/EmotionsHoneycombMiniBubbleChart'));

export default function ConversationHistoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { conversationId } = useLocalSearchParams();
  const { user } = useAuth();

  // State management
  const [conversationData, setConversationData] = useState<DatabaseConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSquareCards, setShowSquareCards] = useState(true);
  const [isConversationMaximized, setIsConversationMaximized] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Chart data state
  const [detectedEmotionsData, setDetectedEmotionsData] = useState<EmotionBubbleData[]>([]);
  const [detectedPartsData, setDetectedPartsData] = useState<PartBubbleData[]>([]);
  const [detectedNeedsData, setDetectedNeedsData] = useState<NeedBubbleData[]>([]);

  // Chart dimensions state
  const [emotionsChartDimensions] = useState({ width: 110, height: 110 });
  const [partsChartDimensions] = useState({ width: 110, height: 110 });
  const [needsChartDimensions] = useState({ width: 110, height: 110 });

  // Load conversation and detected data
  useEffect(() => {
    if (!user || !conversationId || typeof conversationId !== 'string') {
      setError('Missing conversation ID or user not authenticated');
      setLoading(false);
      return;
    }

    loadConversationData();
  }, [user, conversationId]);

  const loadConversationData = async () => {
    if (!user || !conversationId || typeof conversationId !== 'string') return;

    try {
      setLoading(true);
      setError(null);

      // Load conversation data
      const conversation = await loadConversation(conversationId, user.id);
      if (!conversation) {
        setError('Conversation not found');
        return;
      }

      setConversationData(conversation);

      // Load detected data for this conversation
      const detectedData = await loadAllDetectedData(conversationId, user.id);

      // Transform detected data to bubble chart format
      if (detectedData.emotions.length > 0) {
        setDetectedEmotionsData(transformDetectedEmotions(detectedData.emotions, conversationId));
      }
      if (detectedData.parts.length > 0) {
        setDetectedPartsData(transformDetectedParts(detectedData.parts, conversationId));
      }
      if (detectedData.needs.length > 0) {
        setDetectedNeedsData(transformDetectedNeeds(detectedData.needs, conversationId));
      }

    } catch (err) {
      console.error('Error loading conversation data:', err);
      setError('Failed to load conversation data');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.back();
  };

  // Handle loading, error, and missing data states
  if (loading || error || !conversationData) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: 'transparent' }]} edges={['top', 'left', 'right']}>
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={styles.blurContainer}
        >
          <View style={styles.errorContainer}>
            {loading ? (
              <>
                <Text style={[styles.errorText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                  Loading conversation...
                </Text>
              </>
            ) : error ? (
              <>
                <Text style={[styles.errorText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                  {error}
                </Text>
                <Pressable onPress={handleClose} style={styles.errorButton}>
                  <Text style={styles.errorButtonText}>Go Back</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.errorText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                  Conversation not found
                </Text>
                <Pressable onPress={handleClose} style={styles.errorButton}>
                  <Text style={styles.errorButtonText}>Go Back</Text>
                </Pressable>
              </>
            )}
          </View>
        </BlurView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: 'transparent' }]} edges={['top', 'left', 'right']}>
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
            <View style={styles.modalHeader}>
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
                  {conversationData.title || 'Conversation'}
                </Text>
              </View>
            </View>

            {/* Square Cards Section */}
            {!isConversationMaximized && (
              <View style={styles.collapsibleSection}>
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
            )}

            {/* Conversation Summary */}
            {!isConversationMaximized && (
              <View style={styles.summaryContainer}>
                <Text style={[
                  styles.summaryText,
                  { color: isDark ? '#DDDDDD' : '#444444' }
                ]}>
                  {conversationData.summary || 'No summary available'}
                </Text>
              </View>
            )}

            {/* Content Container */}
            <View style={styles.modalScrollView}>
              {/* Active Conversation Container */}
              <View style={[
                styles.activeConversationContainer,
                { borderColor: isDark ? '#555555' : '#C7C7CC' },
                isConversationMaximized && styles.maximizedContainer
              ]}>
                {/* Floating Maximize Button */}
                <Pressable
                  onPress={() => setIsConversationMaximized(!isConversationMaximized)}
                  style={[
                    styles.floatingMaximizeButton,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.05)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(0, 0, 0, 0.1)',
                    }
                  ]}
                >
                  <IconSymbol
                    name={isConversationMaximized ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right"}
                    size={18}
                    color={isDark ? '#AAAAAA' : '#666666'}
                  />
                </Pressable>

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
                          {message.text}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </BlurView>
      </SafeAreaView>
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    marginBottom: 5,
  },
  modalTitle: {
    fontSize: 35,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
    fontFamily: 'Georgia',
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
  maximizedContainer: {
    position: 'absolute',
    top: 0, // No gap above expanded container
    left: 0,
    right: 0,
    bottom: 0,
    margin: 0,
    marginHorizontal: 20,
    zIndex: 1000,
  },
  floatingMaximizeButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    marginBottom: 20,
    fontFamily: 'Georgia',
  },
  errorButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Georgia',
  },
});