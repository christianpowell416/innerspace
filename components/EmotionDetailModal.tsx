import React, { useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  PanResponder,
  Vibration,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import { EmotionBubbleData } from '@/lib/types/bubbleChart';
import { PartsDetailBubbleChart } from '@/components/PartsDetailBubbleChart';
import { NeedsDetailBubbleChart } from '@/components/NeedsDetailBubbleChart';
import { generateTestPartsData, generateTestNeedsData } from '@/lib/utils/partsNeedsTestData';
import { PartBubbleData, NeedBubbleData } from '@/lib/types/partsNeedsChart';

interface EmotionDetailModalProps {
  visible: boolean;
  onClose: () => void;
  emotion: EmotionBubbleData | null;
}

export function EmotionDetailModal({
  visible,
  onClose,
  emotion
}: EmotionDetailModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const modalTranslateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const [scrollPosition, setScrollPosition] = React.useState(0);
  const [internalVisible, setInternalVisible] = React.useState(false);
  const [partsData, setPartsData] = React.useState<PartBubbleData[]>([]);
  const [needsData, setNeedsData] = React.useState<NeedBubbleData[]>([]);
  const [partsChartDimensions, setPartsChartDimensions] = React.useState({ width: 180, height: 140 });
  const [needsChartDimensions, setNeedsChartDimensions] = React.useState({ width: 180, height: 140 });

  // Close modal function with animation
  const closeModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.timing(modalTranslateY, {
      toValue: Dimensions.get('window').height,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      // Hide modal after animation completes
      setInternalVisible(false);
      // Reset modal position for next time
      modalTranslateY.setValue(Dimensions.get('window').height);
      onClose();
    });
  };

  // Handle modal close with animation (for backwards compatibility)
  const handleClose = closeModal;

  // Create pan responder for swipe-down gesture (header)
  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        return true;
      },
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
          closeModal();
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

  // Animate modal in when visible changes
  React.useEffect(() => {
    if (visible) {
      // Show modal immediately and animate in
      setInternalVisible(true);
      modalTranslateY.setValue(Dimensions.get('window').height);
      Animated.timing(modalTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Reset states for next time
      setInternalVisible(false);
      modalTranslateY.setValue(Dimensions.get('window').height);
    }
  }, [visible]);

  // Load parts and needs data when modal opens
  React.useEffect(() => {
    if (visible && emotion) {
      // Generate test data - in a real app, this would come from the emotion's conversation analysis
      setPartsData(generateTestPartsData(5));
      setNeedsData(generateTestNeedsData(5));
    }
  }, [visible, emotion]);

  // Handle bubble press events
  const handlePartPress = (part: PartBubbleData) => {
    console.log('Part pressed:', part.name);
    // TODO: Show part detail modal or additional info
  };

  const handleNeedPress = (need: NeedBubbleData) => {
    console.log('Need pressed:', need.name);
    // TODO: Show need detail modal or additional info
  };

  if (!emotion) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={internalVisible}
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
            {/* Fixed Header */}
            <View
              style={styles.modalHeader}
              {...headerPanResponder.panHandlers}
            >
              <View style={styles.titleContainer}>
                <View
                  style={[
                    styles.emotionColorCircle,
                    { backgroundColor: emotion.color }
                  ]}
                />
                <Text style={[styles.modalTitle, { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }]}>
                  {emotion.emotion}
                </Text>
              </View>
              <View style={styles.headerControls}>
                <Pressable
                  style={styles.closeButton}
                  onPress={handleClose}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </Pressable>
              </View>
            </View>

            {/* Content Container */}
            <ScrollView
              style={styles.modalScrollView}
              onScroll={(event) => {
                const yOffset = event.nativeEvent.contentOffset.y;
                setScrollPosition(yOffset);

                // Only update modal position during overscroll (like Loop cards)
                if (yOffset < 0) {
                  const currentTranslation = Math.abs(yOffset) * 1.5;
                  modalTranslateY.setValue(currentTranslation);
                }
              }}
              onScrollEndDrag={(event) => {
                const yOffset = event.nativeEvent.contentOffset.y;

                // Only process dismissal if we were overscrolling (pulling down from top)
                if (yOffset < 0) {
                  const currentTranslation = Math.abs(yOffset) * 1.5;

                  // Use same thresholds as header pan responder
                  if (currentTranslation > 100) {
                    // Use closeModal for full dismissal animation
                    closeModal();
                  } else {
                    // Snap back to original position
                    Animated.timing(modalTranslateY, {
                      toValue: 0,
                      duration: 200,
                      useNativeDriver: true,
                    }).start();
                  }
                }
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
                            left: `${(emotion.intensity / 10) * 100}%`,
                            backgroundColor: emotion.color
                          }
                        ]}
                      />
                      {/* Score label below the thumb */}
                      <Text
                        style={[
                          styles.sliderScore,
                          {
                            left: `${(emotion.intensity / 10) * 100}%`,
                            color: isDark ? '#FFFFFF' : '#000000'
                          }
                        ]}
                      >
                        {emotion.intensity.toFixed(1)}
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
                  {emotion.frequency === 1
                    ? "This emotion appeared once in your conversations."
                    : `This emotion has been a recurring theme, appearing ${emotion.frequency} times.`
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
                  {emotion.intensity > 7
                    ? "The intensity suggests this emotion was felt quite strongly."
                    : emotion.intensity > 4
                      ? "The intensity indicates moderate emotional engagement."
                      : "The intensity suggests this emotion was felt subtly."
                  }
                </Text>

                {/* Parts and Needs Headers */}
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
                    }
                  ]}>
                    Parts
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
                    }
                  ]}>
                    Needs
                  </Text>
                </View>

                {/* Parts and Needs Charts */}
                <View style={styles.sideBySideContainer}>
                  {/* Parts Section */}
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
                        setPartsChartDimensions({ width, height });
                      }}
                    >
                      <PartsDetailBubbleChart
                        data={partsData}
                        width={partsChartDimensions.width}
                        height={partsChartDimensions.height}
                        callbacks={{ onBubblePress: handlePartPress }}
                      />
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
                      <NeedsDetailBubbleChart
                        data={needsData}
                        width={needsChartDimensions.width}
                        height={needsChartDimensions.height}
                        callbacks={{ onBubblePress: handleNeedPress }}
                      />
                    </View>
                  </View>
                </View>

                {/* Loops Section */}
                <View style={{ position: 'relative', marginBottom: 16 }}>
                  {/* Count badge in top left */}
                  <View style={[
                    styles.countBadge,
                    {
                      borderColor: emotion.color,
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
                      {emotion.conversationIds.length}
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
                    Loops
                  </Text>

                  {/* Conversation excerpts */}
                  <View style={{ marginTop: 0 }}>
                    <View style={styles.conversationList}>
                      {[
                        { excerpt: "...was surprised when he showed up...", title: "Family Reunion", date: "9/15/25" },
                        { excerpt: "...didn't expect that reaction from her...", title: "Work Meeting", date: "9/12/25" },
                        { excerpt: "...feeling overwhelmed by all the changes...", title: "Life Transitions", date: "9/10/25" },
                        { excerpt: "...couldn't believe what I was hearing...", title: "Personal Discovery", date: "9/8/25" },
                        { excerpt: "...the pressure to make the right decision...", title: "Career Choice", date: "9/5/25" }
                      ].map((item, index) => {
                        // Create gradient effect for cards
                        const lightness = isDark
                          ? 0.85 - (0.1 * index) // Dark mode: gradient from lighter to darker
                          : 0.95 - (0.1 * index); // Light mode: gradient from lighter to darker

                        const grayValue = Math.round(255 * lightness);

                        return (
                          <View
                            key={index}
                            style={[
                              styles.loopCardSimple,
                              {
                                marginTop: index === 0 ? 0 : -40, // Increased overlap
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
                                styles.loopCardBlur,
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
                                  console.log('Loop card pressed:', item.title);
                                }}
                                style={styles.loopCardPressable}
                              >
                                <View style={styles.loopCardHeader}>
                                  <Text style={[
                                    styles.loopCardTitle,
                                    { color: isDark ? '#FFFFFF' : '#000000' }
                                  ]}>
                                    {item.title}
                                  </Text>
                                  <Text style={[
                                    styles.loopCardDate,
                                    { color: isDark ? '#CCCCCC' : '#666666' }
                                  ]}>
                                    {item.date}
                                  </Text>
                                </View>
                                <Text style={[
                                  styles.loopCardExcerpt,
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
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: 'transparent',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  emotionColorCircle: {
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
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  modalScrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  overviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  emotionColorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  emotionCategory: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Georgia',
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
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: 'Georgia',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Georgia',
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    position: 'relative',
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
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
    fontFamily: 'Georgia',
  },
  sectionSubcontent: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Georgia',
  },
  conversationList: {
    marginTop: 12,
  },
  conversationItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  conversationExcerpt: {
    fontSize: 16,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    marginTop: 4,
  },
  conversationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationTitle: {
    fontSize: 18,
    fontFamily: 'Georgia',
    flex: 1,
  },
  conversationDate: {
    fontSize: 18,
    fontFamily: 'Georgia',
  },
  moreConversations: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Georgia',
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
  sectionTitleContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  chartContainer: {
    flex: 1,
    marginTop: 2,
    marginBottom: 5,
    marginLeft: 5,
    marginRight: 5,
    padding: 0,
  },
  loopCardSimple: {
    borderRadius: 16, // Match Parts/Needs border radius
    height: 135,
    borderWidth: 1,
    overflow: 'hidden',
  },
  loopCardBlur: {
    flex: 1,
    borderRadius: 16,
    padding: 15,
    paddingBottom: 20,
  },
  loopCardPressable: {
    flex: 1,
    padding: 10,
    paddingBottom: 10,
  },
  loopCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  loopCardTitle: {
    fontSize: 20, // Increased by 2px from 18
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
    fontFamily: 'Georgia',
  },
  loopCardDate: {
    fontSize: 19, // Increased by 2px from 17
    fontWeight: 'normal',
    fontFamily: 'Georgia',
  },
  loopCardExcerpt: {
    fontSize: 16, // Increased by 2px from 14
    lineHeight: 22, // Adjusted proportionally from 20
    textAlign: 'left',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    marginBottom: 15,
  },
});