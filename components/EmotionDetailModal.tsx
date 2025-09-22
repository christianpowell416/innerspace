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

                {/* Intensity Slider */}
                <View style={[
                  styles.sectionCard,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'rgba(0, 0, 0, 0.1)',
                  }
                ]}>
                  <Text style={[
                    styles.sectionTitle,
                    { color: isDark ? '#FFFFFF' : '#000000' }
                  ]}>
                    Intensity
                  </Text>
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

                {/* Parts and Needs Row */}
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
                    <Text style={[
                      styles.sectionTitle,
                      { color: isDark ? '#FFFFFF' : '#000000' }
                    ]}>
                      Parts
                    </Text>
                    <View style={styles.tagContainer}>
                      {['Critical', 'Protective', 'Inner Child'].map((part, index) => (
                        <View
                          key={index}
                          style={[
                            styles.tag,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.1)'
                                : 'rgba(0, 0, 0, 0.1)',
                            }
                          ]}
                        >
                          <Text style={[
                            styles.tagText,
                            { color: isDark ? '#CCCCCC' : '#666666' }
                          ]}>
                            {part}
                          </Text>
                        </View>
                      ))}
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
                    <Text style={[
                      styles.sectionTitle,
                      { color: isDark ? '#FFFFFF' : '#000000' }
                    ]}>
                      Needs
                    </Text>
                    <View style={styles.tagContainer}>
                      {['Security', 'Understanding', 'Connection'].map((need, index) => (
                        <View
                          key={index}
                          style={[
                            styles.tag,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.1)'
                                : 'rgba(0, 0, 0, 0.1)',
                            }
                          ]}
                        >
                          <Text style={[
                            styles.tagText,
                            { color: isDark ? '#CCCCCC' : '#666666' }
                          ]}>
                            {need}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Loops Section */}
                <View style={[
                  styles.sectionCard,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'rgba(0, 0, 0, 0.1)',
                  }
                ]}>
                  {/* Count badge in top right */}
                  <View style={[
                    styles.countBadge,
                    {
                      borderColor: emotion.color,
                      borderWidth: 2,
                      backgroundColor: 'transparent'
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
                    { color: isDark ? '#FFFFFF' : '#000000' }
                  ]}>
                    Loops
                  </Text>

                  {/* Conversation excerpts */}
                  <View style={styles.conversationList}>
                    {[
                      { excerpt: "...was surprised when he showed up...", title: "Family Reunion", date: "9/15/25" },
                      { excerpt: "...didn't expect that reaction from her...", title: "Work Meeting", date: "9/12/25" },
                      { excerpt: "...feeling overwhelmed by all the changes...", title: "Life Transitions", date: "9/10/25" },
                      { excerpt: "...couldn't believe what I was hearing...", title: "Personal Discovery", date: "9/8/25" },
                      { excerpt: "...the pressure to make the right decision...", title: "Career Choice", date: "9/5/25" }
                    ].map((item, index) => (
                      <View
                        key={index}
                        style={[
                          styles.conversationItem,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(0, 0, 0, 0.03)',
                          }
                        ]}
                      >
                        <View style={styles.conversationTitleRow}>
                          <Text style={[
                            styles.conversationTitle,
                            { color: '#FFFFFF' }
                          ]}>
                            {item.title}
                          </Text>
                          <Text style={[
                            styles.conversationDate,
                            { color: '#FFFFFF' }
                          ]}>
                            {item.date}
                          </Text>
                        </View>
                        <Text style={[
                          styles.conversationExcerpt,
                          { color: isDark ? '#AAAAAA' : '#999999' }
                        ]}>
                          "{item.excerpt}"
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Emotional Insights Section */}
                <View style={[
                  styles.sectionCard,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.05)',
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'rgba(0, 0, 0, 0.1)',
                  }
                ]}>
                  <Text style={[
                    styles.sectionTitle,
                    { color: isDark ? '#FFFFFF' : '#000000' }
                  ]}>
                    Insights
                  </Text>
                  <Text style={[
                    styles.sectionContent,
                    { color: isDark ? '#CCCCCC' : '#666666' }
                  ]}>
                    {emotion.frequency === 1
                      ? "This emotion appeared once in your conversations."
                      : `This emotion has been a recurring theme, appearing ${emotion.frequency} times.`
                    }
                  </Text>
                  <Text style={[
                    styles.sectionContent,
                    { color: isDark ? '#CCCCCC' : '#666666' }
                  ]}>
                    {emotion.intensity > 7
                      ? "The intensity suggests this emotion was felt quite strongly."
                      : emotion.intensity > 4
                        ? "The intensity indicates moderate emotional engagement."
                        : "The intensity suggests this emotion was felt subtly."
                    }
                  </Text>
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
    marginBottom: 12,
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
    padding: 20,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 14,
    fontFamily: 'Georgia',
  },
});