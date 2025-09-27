import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Animated, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { generateTestPartsData, generateTestNeedsData } from '@/lib/utils/partsNeedsTestData';
import { generateTestEmotionData } from '@/lib/utils/testData';
import { PartBubbleData, NeedBubbleData } from '@/lib/types/partsNeedsChart';
import { EmotionBubbleData } from '@/lib/types/bubbleChart';
import { getConversationById, ConversationData } from '@/lib/services/conversationService';

// Import chart components directly (temporarily removing lazy loading to fix error)
import PartsHoneycombMiniBubbleChart from '@/components/PartsHoneycombMiniBubbleChart';
import NeedsHoneycombMiniBubbleChart from '@/components/NeedsHoneycombMiniBubbleChart';
import EmotionsHoneycombMiniBubbleChart from '@/components/EmotionsHoneycombMiniBubbleChart';
import PartsExpandedBubbleChart from '@/components/PartsExpandedBubbleChart';
import NeedsExpandedBubbleChart from '@/components/NeedsExpandedBubbleChart';
import EmotionsExpandedBubbleChart from '@/components/EmotionsExpandedBubbleChart';

export default function ComplexDetailModal() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { id, title, date, description, color } = useLocalSearchParams();

  const handleClose = () => {
    router.back();
  };

  // Convert params to the right types
  const complexData = {
    id: typeof id === 'string' ? parseInt(id) : 0,
    title: typeof title === 'string' ? title : '',
    date: typeof date === 'string' ? date : '',
    description: typeof description === 'string' ? description : '',
    color: typeof color === 'string' ? color : '#888888'
  };

  // Chart state variables
  const [expandedSquareCard, setExpandedSquareCard] = useState<string | null>(null);
  const [partsData, setPartsData] = useState<PartBubbleData[]>([]);
  const [needsData, setNeedsData] = useState<NeedBubbleData[]>([]);
  const [emotionsData, setEmotionsData] = useState<EmotionBubbleData[]>([]);
  const [partsChartDimensions, setPartsChartDimensions] = useState({ width: 110, height: 110 });
  const [needsChartDimensions, setNeedsChartDimensions] = useState({ width: 110, height: 110 });
  const [emotionsChartDimensions, setEmotionsChartDimensions] = useState({ width: 110, height: 110 });
  const [shouldRenderCharts, setShouldRenderCharts] = useState(false);
  const [shouldLoadMiniCharts, setShouldLoadMiniCharts] = useState(false);
  const [loadedExpandedCharts, setLoadedExpandedCharts] = useState<Set<string>>(new Set());
  const [componentsCache, setComponentsCache] = useState<Set<string>>(new Set());
  const [scrollPosition, setScrollPosition] = useState(0);

  // Animated values for chart interactions
  const cardOpacity = useRef({
    emotions: new Animated.Value(1),
    parts: new Animated.Value(1),
    needs: new Animated.Value(1),
  }).current;
  const expandedOpacity = useRef({
    emotions: new Animated.Value(0),
    parts: new Animated.Value(0),
    needs: new Animated.Value(0),
  }).current;
  const titleOpacity = useRef({
    emotions: new Animated.Value(1),
    parts: new Animated.Value(1),
    needs: new Animated.Value(1),
  }).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;

  // Handler functions for chart interactions
  const handlePartPress = (part: PartBubbleData) => {
    console.log('Part pressed:', part.name);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/parts-detail',
      params: {
        data: JSON.stringify(part)
      }
    });
  };

  const handleNeedPress = (need: NeedBubbleData) => {
    console.log('Need pressed:', need.name);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/needs-detail',
      params: {
        data: JSON.stringify(need)
      }
    });
  };

  const handleEmotionPress = (emotion: EmotionBubbleData) => {
    console.log('Emotion pressed:', emotion.emotion);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/emotion-detail',
      params: {
        data: JSON.stringify(emotion)
      }
    });
  };

  const expandCard = (cardType: string) => {
    // Add haptic feedback when expanding mini chart
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setExpandedSquareCard(cardType);

    // Load the expanded chart component for this card type
    setLoadedExpandedCharts(prev => new Set(prev).add(cardType));

    // Fade out all minimized cards, fade in the expanded view, and slide content down
    Animated.parallel([
      // Fade out all minimized cards
      Animated.timing(cardOpacity.emotions, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity.parts, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity.needs, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      // Fade in expanded view
      Animated.timing(expandedOpacity[cardType as keyof typeof expandedOpacity], {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Fade out non-active titles
      Animated.timing(titleOpacity.emotions, {
        toValue: cardType === 'emotions' ? 1 : 0.3,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(titleOpacity.parts, {
        toValue: cardType === 'parts' ? 1 : 0.3,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(titleOpacity.needs, {
        toValue: cardType === 'needs' ? 1 : 0.3,
        duration: 400,
        useNativeDriver: true,
      }),
      // Slide content down to make room for expanded chart
      Animated.timing(contentTranslateY, {
        toValue: Dimensions.get('window').width - 40 - 110 + 1, // Height of expanded card minus minimized card height + small margin
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const collapseCard = () => {
    if (!expandedSquareCard) return;

    // Add haptic feedback when collapsing chart
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const cardType = expandedSquareCard;

    // Fade out expanded view, fade in all minimized cards, and slide content back up
    Animated.parallel([
      // Fade out expanded view
      Animated.timing(expandedOpacity[cardType as keyof typeof expandedOpacity], {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      // Fade in all minimized cards
      Animated.timing(cardOpacity.emotions, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity.parts, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity.needs, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Reset all title opacities
      Animated.timing(titleOpacity.emotions, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(titleOpacity.parts, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(titleOpacity.needs, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Slide content back up
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setExpandedSquareCard(null);
    });
  };

  const cycleToExpandedChart = (targetCardType: string) => {
    if (!expandedSquareCard || expandedSquareCard === targetCardType) {
      return; // No change needed if already showing this chart or no expanded view
    }

    // Load the target expanded chart component
    setLoadedExpandedCharts(prev => new Set(prev).add(targetCardType));

    // Animate transition between expanded views
    Animated.parallel([
      // Fade out current expanded view
      Animated.timing(expandedOpacity[expandedSquareCard as keyof typeof expandedOpacity], {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      // Fade in target expanded view
      Animated.timing(expandedOpacity[targetCardType as keyof typeof expandedOpacity], {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      // Update title opacities
      Animated.timing(titleOpacity.emotions, {
        toValue: targetCardType === 'emotions' ? 1 : 0.3,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(titleOpacity.parts, {
        toValue: targetCardType === 'parts' ? 1 : 0.3,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(titleOpacity.needs, {
        toValue: targetCardType === 'needs' ? 1 : 0.3,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setExpandedSquareCard(targetCardType);
    });
  };

  // Handler for conversation history card presses
  const handleConversationHistoryPress = (conversationId: string) => {
    console.log('🔍 Conversation history pressed:', conversationId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/conversation-history',
      params: { conversationId: conversationId }
    });
  };

  // Full conversation data (same as in complexes.tsx)
  const conversationData = [
    {
      id: 1,
      title: 'Work Stress Discussion',
      date: '12/8/24',
      description: 'Explored feelings of overwhelm at work and discussed comprehensive coping strategies for managing deadlines.'
    },
    {
      id: 2,
      title: 'Relationship Boundaries',
      date: '12/5/24',
      description: 'Talked about setting healthy boundaries with family members and learning to say no without guilt.'
    },
    {
      id: 3,
      title: 'Self-Confidence Building',
      date: '12/1/24',
      description: 'Worked on identifying negative self-talk patterns and developing positive affirmations for daily practice.'
    },
    {
      id: 4,
      title: 'Anxiety Management',
      date: '11/28/24',
      description: 'Discussed breathing techniques and mindfulness exercises to help manage anxiety during social situations.'
    },
    {
      id: 5,
      title: 'Career Transition',
      date: '11/25/24',
      description: 'Explored fears around changing careers and identified steps to move toward a more fulfilling path.'
    }
  ];

  // Initialize chart data on component mount
  useEffect(() => {
    // Load chart data immediately on page load
    setTimeout(() => {
      setShouldLoadMiniCharts(true);
      setShouldRenderCharts(true);

      // Generate test data
      setPartsData(generateTestPartsData(Math.floor(Math.random() * 6) + 1));
      setNeedsData(generateTestNeedsData(Math.floor(Math.random() * 6) + 1));
      setEmotionsData(generateTestEmotionData(Math.floor(Math.random() * 6) + 1));
    }, 100);
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: 'transparent' }]} edges={['top', 'left', 'right']}>
          <BlurView
            intensity={80}
            tint={isDark ? 'dark' : 'light'}
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
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                {complexData.title}
              </Text>
            </View>

        {/* Scrollable Content */}
        <View style={styles.modalScrollView}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
            onScroll={(event) => {
              const yOffset = event.nativeEvent.contentOffset.y;
              setScrollPosition(yOffset);
            }}
            scrollEventThrottle={16}
            bounces={true}
          >
            {/* Three square cards at the top */}
            <View style={styles.squareCardsContainer}>
              <View style={styles.squareCardsInner}>
                {/* Emotions Card */}
                <View style={styles.squareCardWrapper}>
                  <Pressable onPress={() => cycleToExpandedChart('emotions')}>
                    <Animated.Text style={[
                      styles.squareCardTitle,
                      {
                        color: (expandedSquareCard && expandedSquareCard !== 'emotions') ? '#CCCCCC' : '#FFFFFF',
                        opacity: titleOpacity.emotions,
                        fontWeight: 'bold'
                      }
                    ]}>
                      Emotions
                    </Animated.Text>
                  </Pressable>
                  {/* Minimized card */}
                  <Animated.View style={[
                    styles.animatedCardContainer,
                    {
                      opacity: cardOpacity.emotions,
                    }
                  ]}>
                    <Pressable
                      onPress={() => expandCard('emotions')}
                      style={[
                        styles.squareCard,
                        {
                          backgroundColor: isDark
                            ? `${complexData.color}20`
                            : `${complexData.color}15`,
                          borderColor: isDark
                            ? 'rgba(255, 255, 255, 0.2)'
                            : 'rgba(0, 0, 0, 0.1)',
                        }
                      ]}
                    >
                      <View
                        style={styles.chartContainer}
                        onLayout={(event) => {
                          const { width, height } = event.nativeEvent.layout;
                          if (width > 0 && height > 0) {
                            setEmotionsChartDimensions({ width, height });
                          }
                        }}
                      >
                        {shouldRenderCharts && shouldLoadMiniCharts ? (
                          <EmotionsHoneycombMiniBubbleChart
                            data={emotionsData}
                            width={emotionsChartDimensions.width}
                            height={emotionsChartDimensions.height}
                            callbacks={{ onBubblePress: handleEmotionPress }}
                            loading={emotionsData.length === 0}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  </Animated.View>
                </View>

                {/* Parts Card */}
                <View style={styles.squareCardWrapper}>
                  <Pressable onPress={() => cycleToExpandedChart('parts')}>
                    <Animated.Text style={[
                      styles.squareCardTitle,
                      {
                        color: (expandedSquareCard && expandedSquareCard !== 'parts') ? '#CCCCCC' : '#FFFFFF',
                        opacity: titleOpacity.parts,
                        fontWeight: 'bold'
                      }
                    ]}>
                      Parts
                    </Animated.Text>
                  </Pressable>
                  <Animated.View style={[
                    styles.animatedCardContainer,
                    {
                      opacity: cardOpacity.parts,
                    }
                  ]}>
                    <Pressable
                      onPress={() => expandCard('parts')}
                      style={[
                        styles.squareCard,
                        {
                          backgroundColor: isDark
                            ? `${complexData.color}20`
                            : `${complexData.color}15`,
                          borderColor: isDark
                            ? 'rgba(255, 255, 255, 0.2)'
                            : 'rgba(0, 0, 0, 0.1)',
                        }
                      ]}
                    >
                      <View
                        style={styles.chartContainer}
                        onLayout={(event) => {
                          const { width, height } = event.nativeEvent.layout;
                          if (width > 0 && height > 0) {
                            setPartsChartDimensions({ width, height });
                          }
                        }}
                      >
                        {shouldRenderCharts && shouldLoadMiniCharts ? (
                          <PartsHoneycombMiniBubbleChart
                            data={partsData}
                            width={partsChartDimensions.width}
                            height={partsChartDimensions.height}
                            callbacks={{ onBubblePress: handlePartPress }}
                            loading={partsData.length === 0}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  </Animated.View>
                </View>

                {/* Needs Card */}
                <View style={styles.squareCardWrapper}>
                  <Pressable onPress={() => cycleToExpandedChart('needs')}>
                    <Animated.Text style={[
                      styles.squareCardTitle,
                      {
                        color: (expandedSquareCard && expandedSquareCard !== 'needs') ? '#CCCCCC' : '#FFFFFF',
                        opacity: titleOpacity.needs,
                        fontWeight: 'bold'
                      }
                    ]}>
                      Needs
                    </Animated.Text>
                  </Pressable>
                  <Animated.View style={[
                    styles.animatedCardContainer,
                    {
                      opacity: cardOpacity.needs,
                    }
                  ]}>
                    <Pressable
                      onPress={() => expandCard('needs')}
                      style={[
                        styles.squareCard,
                        {
                          backgroundColor: isDark
                            ? `${complexData.color}20`
                            : `${complexData.color}15`,
                          borderColor: isDark
                            ? 'rgba(255, 255, 255, 0.2)'
                            : 'rgba(0, 0, 0, 0.1)',
                        }
                      ]}
                    >
                      <View
                        style={styles.chartContainer}
                        onLayout={(event) => {
                          const { width, height } = event.nativeEvent.layout;
                          if (width > 0 && height > 0) {
                            setNeedsChartDimensions({ width, height });
                          }
                        }}
                      >
                        {shouldRenderCharts && shouldLoadMiniCharts ? (
                          <NeedsHoneycombMiniBubbleChart
                            data={needsData}
                            width={needsChartDimensions.width}
                            height={needsChartDimensions.height}
                            callbacks={{ onBubblePress: handleNeedPress }}
                            loading={needsData.length === 0}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  </Animated.View>
                </View>
              </View>

              {/* Expanded views - positioned at container level for full width */}
              <Animated.View style={[
                styles.expandedCardView,
                { opacity: expandedOpacity.emotions }
              ]}>
                <View
                  style={[
                    styles.expandedCard,
                    {
                      backgroundColor: isDark
                        ? `${complexData.color}20`
                        : `${complexData.color}15`,
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(0, 0, 0, 0.1)',
                    }
                  ]}
                >
                  <Pressable
                    onPress={() => collapseCard()}
                    style={[
                      styles.minimizeButton,
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
                      name="chevron.up"
                      size={18}
                      color={isDark ? '#AAAAAA' : '#666666'}
                    />
                  </Pressable>
                  <View style={styles.chartContainer}>
                    {shouldRenderCharts && loadedExpandedCharts.has('emotions') ? (
                      <EmotionsExpandedBubbleChart
                        data={emotionsData}
                        width={emotionsChartDimensions.width}
                        height={emotionsChartDimensions.height}
                        callbacks={{ onBubblePress: handleEmotionPress }}
                        loading={emotionsData.length === 0}
                      />
                    ) : null}
                  </View>
                </View>
              </Animated.View>

              <Animated.View style={[
                styles.expandedCardView,
                { opacity: expandedOpacity.parts }
              ]}>
                <View
                  style={[
                    styles.expandedCard,
                    {
                      backgroundColor: isDark
                        ? `${complexData.color}20`
                        : `${complexData.color}15`,
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(0, 0, 0, 0.1)',
                    }
                  ]}
                >
                  <Pressable
                    onPress={() => collapseCard()}
                    style={[
                      styles.minimizeButton,
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
                      name="chevron.up"
                      size={18}
                      color={isDark ? '#AAAAAA' : '#666666'}
                    />
                  </Pressable>
                  <View style={styles.chartContainer}>
                    {shouldRenderCharts && loadedExpandedCharts.has('parts') ? (
                      <PartsExpandedBubbleChart
                        data={partsData}
                        width={partsChartDimensions.width}
                        height={partsChartDimensions.height}
                        callbacks={{ onBubblePress: handlePartPress }}
                        loading={partsData.length === 0}
                      />
                    ) : null}
                  </View>
                </View>
              </Animated.View>

              <Animated.View style={[
                styles.expandedCardView,
                { opacity: expandedOpacity.needs }
              ]}>
                <View
                  style={[
                    styles.expandedCard,
                    {
                      backgroundColor: isDark
                        ? `${complexData.color}20`
                        : `${complexData.color}15`,
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(0, 0, 0, 0.1)',
                    }
                  ]}
                >
                  <Pressable
                    onPress={() => collapseCard()}
                    style={[
                      styles.minimizeButton,
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
                      name="chevron.up"
                      size={18}
                      color={isDark ? '#AAAAAA' : '#666666'}
                    />
                  </Pressable>
                  <View style={styles.chartContainer}>
                    {shouldRenderCharts && loadedExpandedCharts.has('needs') ? (
                      <NeedsExpandedBubbleChart
                        data={needsData}
                        width={needsChartDimensions.width}
                        height={needsChartDimensions.height}
                        callbacks={{ onBubblePress: handleNeedPress }}
                        loading={needsData.length === 0}
                      />
                    ) : null}
                  </View>
                </View>
              </Animated.View>
            </View>

            {/* Summary text below charts */}
            <Animated.View style={{
              transform: [{ translateY: contentTranslateY }],
              marginTop: 15
            }}>
              <Text style={[
                styles.modalDescription,
                { color: isDark ? '#DDDDDD' : '#444444' }
              ]}>
                {complexData.description}
              </Text>
            </Animated.View>

            {/* Conversation History Section */}
            <View style={{ position: 'relative', marginBottom: 16, marginTop: 20 }}>
              {/* Count badge in top left */}
              <Animated.View style={[
                styles.countBadge,
                {
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                  borderWidth: 2,
                  backgroundColor: 'transparent',
                  position: 'absolute',
                  top: 8,
                  left: 0,
                  zIndex: 1,
                  transform: [{ translateY: contentTranslateY }],
                }
              ]}>
                <Text style={[
                  styles.countBadgeText,
                  { color: '#FFFFFF' }
                ]}>
                  5
                </Text>
              </Animated.View>

              <Animated.View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginTop: 13,
                marginLeft: 40,
                marginRight: 0,
                marginBottom: -5,
                transform: [{ translateY: contentTranslateY }],
              }}>
                <Text style={[
                  styles.sectionTitle,
                  {
                    color: isDark ? '#FFFFFF' : '#000000',
                    fontSize: 22.5,
                    fontWeight: '600',
                    marginBottom: 0,
                    fontFamily: 'Georgia',
                    paddingHorizontal: 0,
                    marginTop: 0,
                    marginLeft: 0,
                  }
                ]}>
                  Conversation History
                </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    console.log('Add new conversation pressed');
                    router.push('/conversation?topic=general');
                  }}
                  style={[
                    styles.minimizeButton,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.05)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(0, 0, 0, 0.1)',
                      position: 'relative',
                      top: -5,
                      right: 0,
                      zIndex: 1,
                    }
                  ]}
                >
                  <IconSymbol
                    name="plus"
                    size={18}
                    color={isDark ? '#AAAAAA' : '#666666'}
                  />
                </Pressable>
              </Animated.View>

              {/* Conversation history excerpts */}
              <Animated.View style={{
                marginTop: -5,
                transform: [{ translateY: contentTranslateY }],
              }}>
                <View style={styles.conversationList}>
                  {[
                    { id: "550e8400-e29b-41d4-a716-446655440001", excerpt: "Discussed feeling anxious about upcoming job interview and strategies for managing nervousness.", title: "Job Interview Anxiety", date: "9/15/25" },
                    { id: "550e8400-e29b-41d4-a716-446655440002", excerpt: "Explored childhood memories of feeling left out and how they affect current relationships.", title: "Childhood Rejection", date: "9/12/25" },
                    { id: "550e8400-e29b-41d4-a716-446655440003", excerpt: "Talked through frustration with partner's communication style during recent argument.", title: "Partner Communication", date: "9/10/25" },
                    { id: "550e8400-e29b-41d4-a716-446655440004", excerpt: "Reflected on perfectionist tendencies and fear of disappointing family members.", title: "Perfectionism Issues", date: "9/8/25" },
                    { id: "550e8400-e29b-41d4-a716-446655440005", excerpt: "Processed grief over father's death and difficulty accepting support from friends.", title: "Grief Processing", date: "9/5/25" }
                  ].map((item, index) => {
                    return (
                      <View
                        key={index}
                        style={[
                          styles.complexCardSimple,
                          {
                            marginTop: index === 0 ? 0 : -35,
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
                                ? `${complexData.color}30`
                                : `${complexData.color}20`,
                            }
                          ]}
                        >
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              handleConversationHistoryPress(item.id);
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
              </Animated.View>
            </View>
            </ScrollView>
            </View>
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
    paddingTop: 8,
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
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 36,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  squareCardsContainer: {
    marginBottom: 16,
    width: '100%',
  },
  squareCardsInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    position: 'relative',
    overflow: 'hidden',
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
    width: 110,
    height: 110,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  animatedCardContainer: {
    width: 110,
    height: 110,
    alignItems: 'center',
    overflow: 'hidden',
  },
  expandedCardView: {
    position: 'absolute',
    top: 29,
    left: 0,
    right: 4,
    zIndex: 100,
  },
  expandedCard: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
    position: 'relative',
  },
  minimizeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 110,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 22.5,
    fontWeight: '600',
    marginBottom: 6,
    fontFamily: 'Georgia',
  },
  conversationList: {
    marginTop: 12,
  },
  complexCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  complexCardPressable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  complexCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  complexCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
    marginTop: 5,
    fontFamily: 'Georgia',
  },
  complexCardDate: {
    fontSize: 19,
    fontWeight: 'normal',
    fontFamily: 'Georgia',
  },
  complexCardDescription: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'left',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  modalDescription: {
    fontSize: 20,
    lineHeight: 30,
    textAlign: 'left',
    fontFamily: 'Georgia',
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
  complexCardSimple: {
    borderRadius: 16,
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
  complexCardExcerpt: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'left',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    marginBottom: 15,
  },
});