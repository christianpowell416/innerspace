import React, { useRef, Suspense } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  Vibration,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import { router, useLocalSearchParams } from 'expo-router';
import { PartBubbleData } from '@/lib/types/partsNeedsChart';
import { generateTestEmotionData } from '@/lib/utils/testData';
import { generateTestNeedsData } from '@/lib/utils/partsNeedsTestData';
import { EmotionBubbleData } from '@/lib/types/bubbleChart';
import { NeedBubbleData } from '@/lib/types/partsNeedsChart';
import { useAuth } from '@/contexts/AuthContext';
import {
  loadUserEmotions,
  loadUserNeeds,
  UserEmotion,
  UserNeed
} from '@/lib/services/emotionsPartsNeedsService';
import { getEmotionColor, getNeedColor } from '@/lib/utils/dataColors';
import { loadLinkedDataForPart } from '@/lib/services/linkedDetectionService';
import { findComplexesWithPart, ComplexPreview } from '@/lib/services/complexDetectionService';

// Lazy load detail chart components
const EmotionsDetailBubbleChart = React.lazy(() => import('@/components/EmotionsDetailBubbleChart').then(module => ({ default: module.EmotionsDetailBubbleChart })));
const NeedsDetailBubbleChart = React.lazy(() => import('@/components/NeedsDetailBubbleChart').then(module => ({ default: module.NeedsDetailBubbleChart })));

// Configuration
const USE_TEST_DATA = false;

// Helper function to convert text to title case
const toTitleCase = (text: string): string => {
  return text.toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function PartsDetailScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { data } = useLocalSearchParams();
  const { user } = useAuth();

  // Parse part data from URL parameter
  const part: PartBubbleData | null = React.useMemo(() => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (error) {
        console.error('Error parsing part data:', error);
        return null;
      }
    }
    return null;
  }, [data]);

  const [scrollPosition, setScrollPosition] = React.useState(0);
  const [emotionsData, setEmotionsData] = React.useState<EmotionBubbleData[]>([]);
  const [needsData, setNeedsData] = React.useState<NeedBubbleData[]>([]);
  const [emotionsChartDimensions, setEmotionsChartDimensions] = React.useState({ width: 180, height: 140 });
  const [needsChartDimensions, setNeedsChartDimensions] = React.useState({ width: 180, height: 140 });
  const [shouldLoadDetailCharts, setShouldLoadDetailCharts] = React.useState(false);
  const [shouldRenderCharts, setShouldRenderCharts] = React.useState(false);
  const [complexes, setComplexes] = React.useState<ComplexPreview[]>([]);

  // Data transformation functions
  const transformEmotionToChartData = React.useCallback((emotion: UserEmotion): EmotionBubbleData => {
    return {
      id: emotion.id || `emotion-${Date.now()}-${Math.random()}`,
      emotion: emotion.emotion_name,
      frequency: emotion.frequency || 1,
      intensity: emotion.intensity,
      color: emotion.color || getEmotionColor(emotion.emotion_name),
      radius: Math.max(18, Math.min(45, (emotion.frequency || 1) * 3 + emotion.intensity * 2)),
      category: emotion.category || 'general',
      lastSeen: new Date(emotion.last_experienced || Date.now()),
      conversationIds: [],  // User's general emotions/needs don't have specific conversation IDs
    };
  }, [user?.id]);

  const transformNeedToChartData = React.useCallback((need: UserNeed): NeedBubbleData => {
    const currentLevel = need.current_level || 5;
    const desiredLevel = need.desired_level || 8;
    const gap = Math.max(0, desiredLevel - currentLevel);

    return {
      id: need.id || `need-${Date.now()}-${Math.random()}`,
      name: need.need_name,
      category: need.category || 'general',
      currentLevel,
      desiredLevel,
      priority: need.priority || 5,
      gap,
      color: need.color || getNeedColor(need.need_name),
      radius: Math.max(18, Math.min(45, gap * 6 + (need.priority || 5) * 2)),
      lastAssessed: new Date(need.last_assessed || Date.now()),
      conversationIds: [],  // User's general emotions/needs don't have specific conversation IDs
      strategies: need.strategies || [],
    };
  }, [user?.id]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.back();
  };

  // Load linked data from the same conversations
  const loadLinkedData = React.useCallback(async () => {
    if (!user?.id || !part) return;

    try {
      if (USE_TEST_DATA) {
        setEmotionsData(generateTestEmotionData(5));
        setNeedsData(generateTestNeedsData(5));
      } else {
        // Load emotions and needs from the same conversations where this part was detected
        console.log('Loading linked data for part:', part.name, 'from conversations:', part.conversationIds);
        const linkedData = await loadLinkedDataForPart(part, user.id);

        if (linkedData.emotions.length > 0) {
          setEmotionsData(linkedData.emotions);
          console.log('Loaded linked emotions:', linkedData.emotions.length);
        } else {
          // Fallback to user's general emotions if no linked data
          const emotions = await loadUserEmotions(user.id);
          const bubbles = emotions.map(transformEmotionToChartData);
          setEmotionsData(bubbles);
        }

        if (linkedData.needs.length > 0) {
          setNeedsData(linkedData.needs);
          console.log('Loaded linked needs:', linkedData.needs.length);
        } else {
          // Fallback to user's general needs if no linked data
          const needs = await loadUserNeeds(user.id);
          const bubbles = needs.map(transformNeedToChartData);
          setNeedsData(bubbles);
        }

        // Load complexes that contain this part
        const relatedComplexes = await findComplexesWithPart(
          part.name,
          part.conversationIds,
          user.id
        );
        setComplexes(relatedComplexes);
        console.log('Loaded complexes:', relatedComplexes.length);
      }
    } catch (error) {
      console.error('Error loading linked data:', error);
      // Fallback to test data
      setEmotionsData(generateTestEmotionData(5));
      setNeedsData(generateTestNeedsData(5));
    }
  }, [user?.id, part, transformEmotionToChartData, transformNeedToChartData]);

  // Initialize chart loading on component mount
  React.useEffect(() => {
    if (part && user?.id) {
      // Load linked data from the same conversations
      loadLinkedData();

      // Start loading charts after a brief delay
      setTimeout(() => {
        setShouldLoadDetailCharts(true);
        setShouldRenderCharts(true);
      }, 100);
    }
  }, [part, user?.id, loadLinkedData]);

  // Handle bubble press events
  const handleEmotionPress = (emotion: EmotionBubbleData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/emotion-detail',
      params: { data: JSON.stringify(emotion) }
    });
  };

  const handleNeedPress = (need: NeedBubbleData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/needs-detail',
      params: { data: JSON.stringify(need) }
    });
  };

  if (!part) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: 'transparent' }]} edges={['top', 'left', 'right']}>
          <BlurView
            intensity={80}
            tint={isDark ? 'dark' : 'light'}
            style={styles.blurContainer}
          >
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                Error loading part data
              </Text>
              <Pressable onPress={handleClose} style={styles.errorButton}>
                <Text style={styles.errorButtonText}>Go Back</Text>
              </Pressable>
            </View>
          </BlurView>
        </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: 'transparent' }]} edges={['top', 'left', 'right']}>
        <BlurView
          intensity={80}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={styles.blurContainer}
        >
          {/* Handle Bar */}
          <View style={styles.handleBarContainer}>
            <View style={[
              styles.handleBar,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }
            ]} />
          </View>

          {/* Header */}
          <View style={[styles.modalHeader, { justifyContent: 'flex-start', alignItems: 'center' }]}>
            <View
              style={[
                styles.partColorCircle,
                { backgroundColor: part.color }
              ]}
            />
            <Text style={[styles.modalTitle, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000', marginLeft: 2, flex: 0, marginRight: 0 }]}>
              {toTitleCase(part.name)}
            </Text>
          </View>


          {/* Content Container */}
          <ScrollView
            style={styles.modalScrollView}
            onScroll={(event) => {
              const yOffset = event.nativeEvent.contentOffset.y;
              setScrollPosition(yOffset);
            }}
            scrollEventThrottle={16}
          >
            <View style={styles.contentContainer}>

              {/* Intensity Header */}
              <Text style={[
                styles.sectionTitle,
                {
                  color: isDark ? '#FFFFFF' : '#000000',
                  fontSize: 22.5,
                  fontWeight: '600',
                  marginBottom: 6,
                  fontFamily: 'Georgia',
                  paddingHorizontal: 0,
                  marginTop: 0,
                }
              ]}>
                Intensity
              </Text>

              {/* Intensity Slider */}
              <View style={{ marginBottom: 16 }}>
                <View style={styles.sliderContainer}>
                  <View style={styles.sliderTrack}>
                    <View style={[
                      styles.sliderLine,
                      { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }
                    ]} />
                    {/* Render tick marks for 0-10 scale */}
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((tick) => {
                      const tickPosition = tick / 10;
                      return (
                        <View
                          key={tick}
                          style={[
                            styles.tickMark,
                            {
                              left: `${tickPosition * 100}%`,
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'
                            }
                          ]}
                        />
                      );
                    })}
                    <View
                      style={[
                        styles.sliderThumb,
                        {
                          left: `${(part.intensity / 10) * 100}%`,
                          backgroundColor: part.color
                        }
                      ]}
                    />
                    {/* Score label below the thumb */}
                    <Text
                      style={[
                        styles.sliderScore,
                        {
                          left: `${(part.intensity / 10) * 100}%`,
                          color: isDark ? '#FFFFFF' : '#000000'
                        }
                      ]}
                    >
                      {part.intensity.toFixed(1)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Insights Section */}
              <Text style={[
                styles.sectionTitle,
                {
                  color: isDark ? '#FFFFFF' : '#000000',
                  fontSize: 22.5,
                  fontWeight: '600',
                  marginBottom: 12,
                  fontFamily: 'Georgia',
                  paddingHorizontal: 0,
                  marginTop: 10,
                }
              ]}>
                Insights
              </Text>
              <Text style={[
                styles.sectionContent,
                {
                  color: isDark ? '#CCCCCC' : '#666666',
                  marginBottom: 8,
                  paddingHorizontal: 0,
                }
              ]}>
                {part.frequency === 1
                  ? "This part appeared once in your conversations."
                  : `This part has been a recurring theme, appearing ${part.frequency} times.`
                }
              </Text>
              <Text style={[
                styles.sectionContent,
                {
                  color: isDark ? '#CCCCCC' : '#666666',
                  marginBottom: 20,
                  paddingHorizontal: 0,
                }
              ]}>
                {part.intensity > 7
                  ? "The intensity suggests this part was felt quite strongly."
                  : part.intensity > 4
                    ? "The intensity indicates moderate engagement with this part."
                    : "The intensity suggests this part was felt subtly."
                }
              </Text>

              {/* Emotions and Needs Headers */}
              <View style={[styles.sideBySideContainer, { marginBottom: 6 }]}>
                <Text style={[
                  styles.sectionTitle,
                  {
                    color: isDark ? '#FFFFFF' : '#000000',
                    fontSize: 22.5,
                    fontWeight: '600',
                    marginBottom: 0,
                    fontFamily: 'Georgia',
                    paddingHorizontal: 0,
                    marginTop: 10,
                    flex: 1,
                    textAlign: 'center',
                  }
                ]}>
                  Emotions
                </Text>
                <Text style={[
                  styles.sectionTitle,
                  {
                    color: isDark ? '#FFFFFF' : '#000000',
                    fontSize: 22.5,
                    fontWeight: '600',
                    marginBottom: 0,
                    fontFamily: 'Georgia',
                    paddingHorizontal: 0,
                    marginTop: 10,
                    flex: 1,
                    textAlign: 'center',
                  }
                ]}>
                  Needs
                </Text>
              </View>

              {/* Emotions and Needs Charts */}
              <View style={styles.sideBySideContainer}>
                {/* Emotions Section */}
                <View style={[
                  styles.halfSectionCard,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'rgba(0, 0, 0, 0.1)',
                  }
                ]}>
                  <View
                    style={[styles.chartContainer, { marginTop: 5 }]}
                    onLayout={(event) => {
                      const { width, height } = event.nativeEvent.layout;
                      setEmotionsChartDimensions({ width, height });
                    }}
                  >
                    {shouldRenderCharts && shouldLoadDetailCharts ? (
                      <Suspense fallback={null}>
                        <EmotionsDetailBubbleChart
                          data={emotionsData}
                          width={emotionsChartDimensions.width}
                          height={emotionsChartDimensions.height}
                          callbacks={{ onBubblePress: handleEmotionPress }}
                        />
                      </Suspense>
                    ) : null}
                  </View>
                </View>

                {/* Needs Section */}
                <View style={[
                  styles.halfSectionCard,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'rgba(0, 0, 0, 0.1)',
                  }
                ]}>
                  <View
                    style={[styles.chartContainer, { marginTop: 5 }]}
                    onLayout={(event) => {
                      const { width, height } = event.nativeEvent.layout;
                      setNeedsChartDimensions({ width, height });
                    }}
                  >
                    {shouldRenderCharts && shouldLoadDetailCharts ? (
                      <Suspense fallback={null}>
                        <NeedsDetailBubbleChart
                          data={needsData}
                          width={needsChartDimensions.width}
                          height={needsChartDimensions.height}
                          callbacks={{ onBubblePress: handleNeedPress }}
                        />
                      </Suspense>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Complexes Section */}
              <View style={{ position: 'relative', marginBottom: 16 }}>
                {/* Count badge in top left */}
                <View style={[
                  styles.countBadge,
                  {
                    borderColor: part.color,
                    borderWidth: 2,
                    backgroundColor: 'transparent',
                    position: 'absolute',
                    top: 8, // Moved down to center align with text
                    left: 0,
                    zIndex: 1,
                  }
                ]}>
                  <Text style={[
                    styles.countBadgeText,
                    { color: '#FFFFFF' }
                  ]}>
                    {complexes.length}
                  </Text>
                </View>

                <Text style={[
                  styles.sectionTitle,
                  {
                    color: isDark ? '#FFFFFF' : '#000000',
                    fontSize: 22.5,
                    fontWeight: '600',
                    marginBottom: 0, // Decreased by 4 more px from 4
                    fontFamily: 'Georgia',
                    paddingHorizontal: 0,
                    marginTop: 13, // Moved down 3px from 10
                    marginLeft: 40, // Moved left by 2 more px from 42
                  }
                ]}>
                  Complexes
                </Text>

                {/* Conversation excerpts */}
                <View style={{ marginTop: 0 }}>
                  <View style={styles.conversationList}>
                    {(complexes.length > 0 ? complexes.slice(0, 5).map(c => ({
                      title: c.title,
                      excerpt: c.description,
                      date: new Date(c.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }),
                      id: c.id
                    })) : [
                      { title: "No complexes found", excerpt: "No complexes contain this part yet. Create a complex from a conversation to see it here.", date: "N/A", id: "placeholder" }
                    ]).map((item, index) => {
                      // Create gradient effect for cards
                      const lightness = isDark
                        ? 0.85 - (0.1 * index) // Dark mode: gradient from lighter to darker
                        : 0.95 - (0.1 * index); // Light mode: gradient from lighter to darker

                      const grayValue = Math.round(255 * lightness);

                      return (
                        <View
                          key={index}
                          style={[
                            styles.complexCardSimple,
                            {
                              marginTop: index === 0 ? 0 : -35, // Increased overlap
                              borderColor: isDark
                                ? 'rgba(255, 255, 255, 0.2)'
                                : 'rgba(0, 0, 0, 0.1)',
                            }
                          ]}
                        >
                          <BlurView
                            intensity={50}
                            tint={isDark ? 'dark' : 'light'}
                            style={[
                              styles.complexCardBlur,
                              {
                                backgroundColor: isDark
                                  ? 'rgba(255, 255, 255, 0.1)'
                                  : 'rgba(0, 0, 0, 0.05)',
                              }
                            ]}
                          >
                            <Pressable
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                if (item.id !== 'placeholder') {
                                  router.push({
                                    pathname: '/complex-detail',
                                    params: {
                                      id: item.id,
                                      title: item.title,
                                      date: item.date,
                                      description: item.excerpt
                                    }
                                  });
                                }
                              }}
                              style={styles.complexCardPressable}
                            >
                              <View style={styles.complexCardHeader}>
                                <Text style={[
                                  styles.complexCardTitle,
                                  { color: isDark ? '#FFFFFF' : '#000000' }
                                ]}>
                                  {item.title}
                                </Text>
                                <Text style={[
                                  styles.complexCardDate,
                                  { color: isDark ? '#CCCCCC' : '#666666' }
                                ]}>
                                  {item.date}
                                </Text>
                              </View>
                              <Text style={[
                                styles.complexCardExcerpt,
                                { color: isDark ? '#DDDDDD' : '#444444' }
                              ]}>
                                {item.excerpt}
                              </Text>
                            </Pressable>
                          </BlurView>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>

            </View>
          </ScrollView>
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
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 15,
    backgroundColor: 'transparent',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  partColorCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 35,
    fontWeight: 'bold',
    fontFamily: 'Georgia',
  },
  modalScrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  sliderContainer: {
    paddingHorizontal: 0,
  },
  sliderTrack: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderLine: {
    height: 2,
    borderRadius: 1,
  },
  tickMark: {
    position: 'absolute',
    width: 1,
    height: 8,
    marginLeft: -0.5,
    top: 16,
  },
  sliderThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    top: 14,
  },
  sliderScore: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Georgia',
    marginLeft: -15,
    top: 28,
    textAlign: 'center',
    width: 30,
  },
  countBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '600',
    fontFamily: 'Georgia',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: -1,
  },
  sectionTitle: {
    fontSize: 22.5,
    fontWeight: '600',
    marginBottom: 6,
    fontFamily: 'Georgia',
  },
  sectionContent: {
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 8,
    fontFamily: 'Georgia',
  },
  conversationList: {
    marginTop: 12,
  },
  sideBySideContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  halfSectionCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 0,
    minHeight: 180, // Ensure enough height for the bubble chart
    overflow: 'hidden', // Ensure content respects border radius
  },
  chartContainer: {
    flex: 1,
    marginTop: 2,
    marginBottom: 5,
    marginLeft: 5,
    marginRight: 5,
    padding: 0,
  },
  complexCardSimple: {
    borderRadius: 16, // Match Emotions/Needs border radius
    height: 135,
    borderWidth: 1,
    overflow: 'hidden',
  },
  complexCardBlur: {
    flex: 1,
    borderRadius: 16,
    padding: 15,
    paddingBottom: 20,
  },
  complexCardPressable: {
    flex: 1,
    padding: 10,
    paddingBottom: 10,
  },
  complexCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  complexCardTitle: {
    fontSize: 20, // Increased by 2px from 18
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
    fontFamily: 'Georgia',
  },
  complexCardDate: {
    fontSize: 19, // Increased by 2px from 17
    fontWeight: 'normal',
    fontFamily: 'Georgia',
  },
  complexCardExcerpt: {
    fontSize: 16, // Increased by 2px from 14
    lineHeight: 22, // Adjusted proportionally from 20
    textAlign: 'left',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    marginBottom: 15,
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