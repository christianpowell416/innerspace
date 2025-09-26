import { StyleSheet, View, Pressable, Text, ScrollView, TextInput, Animated, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FlowchartStructure } from '@/lib/types/flowchart';
import { createFlowchart, updateFlowchartWithDescription, getUserFlowchartWithId } from '@/lib/services/flowcharts';
import { useAuth } from '@/contexts/AuthContext';
import { Alert } from 'react-native';

import { getConversationById, ConversationData } from '@/lib/services/conversationService';
import { loadComplexes, ComplexData } from '@/lib/services/complexManagementService';

const CARD_BORDER_RADIUS = 24;

// Local interface for component display data
interface ComplexCardData {
  id: number;
  title: string;
  date: string;
  description: string;
  color?: string;
}

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const { newChat } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [scrollY, setScrollY] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isSearchBarRevealed, setIsSearchBarRevealed] = useState(false);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [voiceModalOpenedFromDetail, setVoiceModalOpenedFromDetail] = useState(false);
  const [complexes, setComplexes] = useState<ComplexCardData[]>([]);
  const [isLoadingComplexes, setIsLoadingComplexes] = useState(true);
  const searchBarTranslateY = useRef(new Animated.Value(-60)).current;
  const searchBarOpacity = useRef(new Animated.Value(0)).current;
  const scrollViewPaddingTop = useRef(new Animated.Value(10)).current;
  const scrollViewRef = useRef<any>(null);
  const lastScrollTime = useRef(Date.now());
  const velocityDecayTimer = useRef<number | null>(null);

  // Listen for new chat trigger
  useEffect(() => {
    if (newChat === 'true') {
      // Start a new general chat
      // Navigate to conversation page with general topic
      router.push('/conversation?topic=general');
      // Clear the parameter by navigating without it
      router.replace('/(tabs)/complexes');
    }
  }, [newChat]);

  // Cleanup velocity decay timer on unmount
  useEffect(() => {
    return () => {
      if (velocityDecayTimer.current) {
        clearInterval(velocityDecayTimer.current);
      }
    };
  }, []);

  // Load complexes from Supabase when component mounts or user changes
  useEffect(() => {
    async function fetchComplexes() {
      if (!user?.id) {
        setIsLoadingComplexes(false);
        return;
      }

      try {
        setIsLoadingComplexes(true);
        const complexesData = await loadComplexes(user.id);

        // Transform database data to match component expectations
        const transformedData = complexesData.map((complex, index) => ({
          id: index + 1, // Sequential ID for component compatibility
          title: complex.name,
          date: new Date(complex.created_at || '').toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: '2-digit'
          }),
          description: complex.description || '',
          color: complex.color || '#4ECDC4'
        }));

        setComplexes(transformedData);
      } catch (error) {
        console.error('Error loading complexes:', error);
        // Fall back to empty array on error
        setComplexes([]);
      } finally {
        setIsLoadingComplexes(false);
      }
    }

    fetchComplexes();
  }, [user?.id]);

  // Note: Data is now preloaded in handleCardPress when chat card opens

  const handleButtonPress = (type: string) => {
    console.log(`${type} button pressed`);
    // Navigate to conversation page with selected topic
    router.push('/conversation?topic=' + type);
  };


  const handleConversationHistoryPress = (conversationId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/conversation-history',
      params: { conversationId: conversationId }
    });
  };

  const handleFlowchartCreated = async (flowchart: FlowchartStructure) => {
    console.log('Flowchart created from chat:', flowchart);
    
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to save your flowchart');
      setSelectedTopic('');
      return;
    }

    try {
      // Check if user has an existing default flowchart
      const { structure: existingFlowchart, id: existingId } = await getUserFlowchartWithId();
      
      if (existingId) {
        // Update existing flowchart
        await updateFlowchartWithDescription(
          existingId,
          flowchart,
          `Generated flowchart via voice conversation about ${selectedTopic}`
        );
        console.log('✅ Updated existing flowchart with voice-generated content');
      } else {
        // Create new flowchart
        const newFlowchart = await createFlowchart(
          `${selectedTopic} Conversation Flowchart`,
          flowchart,
          true // Set as default
        );
        console.log('✅ Created new flowchart:', newFlowchart.id);
      }
      
      Alert.alert('Success', 'Your flowchart has been saved! View it on the Body page.');
    } catch (error) {
      console.error('❌ Error saving flowchart:', error);
      Alert.alert('Error', 'Failed to save your flowchart. Please try again.');
    }

    setSelectedTopic('');
  };


  // Data is now loaded from Supabase in useEffect above

  const handleCardPress = (card: any) => {
    // Add haptic feedback when opening complex detail
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Navigate to complex detail page with modal presentation
    router.push({
      pathname: '/complex-detail',
      params: {
        id: card.id.toString(),
        title: card.title,
        date: card.date,
        description: card.description
      }
    });
  };








  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const currentTime = Date.now();
    const timeDelta = currentTime - lastScrollTime.current;

    setScrollY(currentScrollY);

    // Pull-to-reveal search bar with sticky behavior
    if (currentScrollY < 0 && !isSearchBarRevealed) {
      // User is pulling down from the top - reveal search bar proportionally
      const pullDistance = Math.abs(currentScrollY);
      const revealAmount = Math.min(pullDistance, 60);
      const translateY = -60 + revealAmount;
      // Only start fading in when very close to the end (after 35px of 40px pull)
      const opacity = pullDistance > 35 ? Math.min((pullDistance - 35) / 5, 1) : 0;

      searchBarTranslateY.setValue(translateY);
      searchBarOpacity.setValue(opacity);

      // If pulled down far enough, mark as revealed
      if (pullDistance >= 40) {
        setIsSearchBarRevealed(true);
        // Double haptic feedback when search bar is revealed
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }, 100);
        Animated.parallel([
          Animated.timing(searchBarTranslateY, {
            toValue: -5,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(searchBarOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(scrollViewPaddingTop, {
            toValue: 50,
            duration: 200,
            useNativeDriver: false, // Can't use native driver for non-transform properties
          })
        ]).start();
      }
    } else if (currentScrollY > 20 && isSearchBarRevealed) {
      // User has scrolled down from top while search bar is revealed - hide it
      setIsSearchBarRevealed(false);
      // Single haptic feedback when search bar is hidden
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Ensure we start from the revealed position
      searchBarTranslateY.setValue(-5);
      searchBarOpacity.setValue(1);
      scrollViewPaddingTop.setValue(50);

      // All animations start together
      // Fade completes quickly (200ms) while slide continues (400ms)
      Animated.parallel([
        Animated.timing(searchBarTranslateY, {
          toValue: -60,
          duration: 400, // Slide takes 400ms
          useNativeDriver: true,
        }),
        Animated.timing(searchBarOpacity, {
          toValue: 0,
          duration: 200, // Fade completes in 200ms
          useNativeDriver: true,
        }),
        Animated.timing(scrollViewPaddingTop, {
          toValue: 10,
          duration: 400, // Match slide duration
          useNativeDriver: false,
        })
      ]).start();
    }

    setLastScrollY(currentScrollY);
    lastScrollTime.current = currentTime;
  };

  return (
    <GradientBackground style={styles.container}>
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <View style={styles.headerContainer}>
          <Text style={{
            fontSize: 42,
            fontWeight: 'bold',
            color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
            textAlign: 'left',
            fontFamily: 'Georgia',
            lineHeight: 50
          }}>Complexes</Text>

          {/* Gradient blur at bottom of header - hidden when search bar is active */}
          {!isSearchBarRevealed && (
            <LinearGradient
              colors={[
                colorScheme === 'dark' ? '#0a0a0a' : '#f8f8f8',
                'transparent'
              ]}
              style={styles.headerGradientBlur}
            />
          )}
        </View>
        
        <Animated.View style={[
          styles.searchContainerFixed,
          {
            transform: [{ translateY: searchBarTranslateY }],
            opacity: searchBarOpacity,
          }
        ]}>
          <View style={styles.searchBarWrapper}>
            <View style={styles.searchInputContainer}>
              <IconSymbol 
                size={20} 
                name="magnifyingglass" 
                color={colorScheme === 'dark' ? '#AAAAAA' : '#666666'} 
                style={styles.searchIcon}
              />
              <TextInput
                style={[
                  styles.searchInputField,
                  {
                    backgroundColor: 'transparent',
                    color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                  }
                ]}
                placeholder=""
                placeholderTextColor={colorScheme === 'dark' ? '#AAAAAA' : '#666666'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <Pressable style={styles.filterButton}>
              <IconSymbol 
                size={20} 
                name="line.horizontal.3.decrease" 
                color={colorScheme === 'dark' ? '#AAAAAA' : '#666666'} 
              />
            </Pressable>
          </View>
        </Animated.View>

        <Animated.ScrollView 
          ref={scrollViewRef}
          style={[styles.cardsContainer, { marginBottom: -155 }]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: scrollViewPaddingTop }
          ]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          bounces={true}
          onContentSizeChange={(width, height) => setContentHeight(height)}
          onLayout={(event) => setScrollViewHeight(event.nativeEvent.layout.height)}
        >
          {isLoadingComplexes ? (
            // Loading state
            <View style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: 100
            }}>
              <Text style={{
                fontSize: 16,
                color: colorScheme === 'dark' ? '#AAAAAA' : '#666666',
                fontFamily: 'Georgia'
              }}>
                Loading complexes...
              </Text>
            </View>
          ) : complexes.length === 0 ? (
            // Empty state
            <View style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: 100
            }}>
              <Text style={{
                fontSize: 16,
                color: colorScheme === 'dark' ? '#AAAAAA' : '#666666',
                fontFamily: 'Georgia',
                textAlign: 'center',
                paddingHorizontal: 20
              }}>
                No complexes found.{'\n'}Start a conversation to create your first complex!
              </Text>
            </View>
          ) : complexes.map((conversation, index) => {
            // Calculate card's position on screen
            // Each card is 350px tall with dynamic margin based on velocity
            const cardTop = index * 140; // Position of card relative to scroll content
            const cardCenter = cardTop + 175; // Center of the card (350/2 = 175)
            
            // Calculate card's position relative to viewport
            const viewportHeight = 800; // Approximate viewport height
            const cardPositionInViewport = cardCenter - scrollY;
            
            // Normalize position (0 = top of viewport, 1 = bottom of viewport)
            const normalizedPosition = Math.max(0, Math.min(1, cardPositionInViewport / viewportHeight));
            
            // Create gradient effect based on screen position
            // Cards at top of viewport are lighter, cards at bottom are darker
            const lightness = 0.9 - (0.8 * normalizedPosition); // 0.9 at top to 0.1 at bottom
            
            const grayValue = Math.round(255 * lightness);
            const backgroundColor = `rgba(${grayValue}, ${grayValue}, ${grayValue}, 0.25)`;
            
            // Cards spread farther apart when scrolling fast (subtle bounce)
            const baseMargin = -210;
            
            // Check if we're near scroll bounds to prevent stuttering
            const maxScrollY = Math.max(0, contentHeight - scrollViewHeight);
            const nearTop = scrollY < 50;
            const nearBottom = scrollY > maxScrollY - 50;
            const atBounds = nearTop || nearBottom;
            
            // Only apply bounce effect when not at scroll bounds
            const velocitySpread = atBounds ? 0 : Math.min(scrollVelocity * 3, 10);
            const dynamicMargin = baseMargin + velocitySpread; // Less negative = more space
            
            return (
              <View 
                key={conversation.id}
                style={[
                  styles.cardShadowContainer,
                  {
                    zIndex: index + 1,
                    marginTop: index === 0 ? 0 : dynamicMargin,
                    height: 350,
                  }
                ]}
              >
                <BlurView
                  intensity={50}
                  tint={colorScheme === 'dark' ? 'dark' : 'light'}
                  style={[
                    styles.card,
                    {
                      backgroundColor,
                      height: 340,
                      overflow: 'hidden',
                    }
                  ]}
                >
                <Pressable 
                  onPress={() => handleCardPress(conversation)}
                  style={styles.cardPressable}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[
                      styles.cardTitle,
                      { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }
                    ]}>
                      {conversation.title}
                    </Text>
                    <Text style={[
                      styles.cardDate,
                      { color: colorScheme === 'dark' ? '#CCCCCC' : '#666666' }
                    ]}>
                      {conversation.date}
                    </Text>
                  </View>
                  <Text style={[
                    styles.cardDescription,
                    { color: colorScheme === 'dark' ? '#DDDDDD' : '#444444' }
                  ]}>
                    {conversation.description}
                  </Text>
                </Pressable>
                </BlurView>
                {/* Border overlay */}
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: CARD_BORDER_RADIUS,
                    borderWidth: 1,
                    borderColor: colorScheme === 'dark'
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'rgba(0, 0, 0, 0.1)',
                    pointerEvents: 'none',
                  }}
                />
              </View>
            );
          })}
        </Animated.ScrollView>
      </View>



    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    overflow: 'hidden',
  },
  container: {
    flex: 1,
  },
  headerContainer: {
    alignItems: 'flex-start',
    paddingTop: -5,
    paddingHorizontal: 20,
    paddingBottom: 15, // Increased by 5px
    zIndex: 100,
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.01)', // Minimal background to create stacking context
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    marginTop: -100,
    paddingTop: 20,
  },
  searchContainerFixed: {
    position: 'absolute',
    top: 115, // Position below header
    left: 0,
    right: 0,
    zIndex: 5,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  searchInput: {
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Georgia',
    borderWidth: 1,
    borderColor: '#888888',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInputField: {
    flex: 1,
    height: 44,
    fontSize: 16,
    fontFamily: 'Georgia',
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  searchInputContainer: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#888888',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flex: 1,
  },
  filterButton: {
    marginLeft: 12,
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#888888',
  },
  headerText: {
    fontSize: 42,
    fontWeight: 'bold',
    textAlign: 'left',
    fontFamily: 'Georgia',
    lineHeight: 50,
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 20,
    marginTop: -40,
  },
  description: {
    textAlign: 'center',
    marginBottom: 10,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    gap: 16,
  },
  gridButton: {
    width: 140,
    height: 140,
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
  buttonText: {
    fontSize: 16,
    textAlign: 'center',
  },
  cardsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 20,
  },
  cardShadowContainer: {
    borderRadius: CARD_BORDER_RADIUS,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -8,
    },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 15,
  },
  card: {
    borderRadius: CARD_BORDER_RADIUS,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 30,
    height: 340,
  },
  cardText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: 'Georgia',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
    fontFamily: 'Georgia',
  },
  cardDate: {
    fontSize: 21,
    fontWeight: 'normal',
    fontFamily: 'Georgia',
  },
  cardDescription: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'left',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    marginBottom: 15,
  },
  gradientLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  cardPressable: {
    flex: 1,
    padding: 10,
    paddingBottom: 10,
  },
  cardBlurFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 24,
  },
  searchBarMask: {
    position: 'absolute',
    top: -120, // Cover the area where search bar appears
    left: 0,
    right: 0,
    height: 80, // Height to cover search bar area
    zIndex: 50, // Above search bar
  },
  gradientMask: {
    flex: 1,
    width: '100%',
  },
  headerGradientBlur: {
    position: 'absolute',
    bottom: -35, // Position it below the header container
    left: 0,
    right: 0,
    height: 35, // 35px gradient blur
    zIndex: 1,
  },
});