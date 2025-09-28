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

// Declare global cache types
declare global {
  var preloadedComplexes: ComplexData[] | null;
  var preloadedComplexesTimestamp: number | null;
}

const CARD_BORDER_RADIUS = 24;

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
  const [searchBarPullProgress, setSearchBarPullProgress] = useState(0);
  const [complexes, setComplexes] = useState<ComplexData[]>([]);
  const [loading, setLoading] = useState(true);
  const searchBarTranslateY = useRef(new Animated.Value(-60));
  const searchBarOpacity = useRef(new Animated.Value(0));
  const scrollViewPaddingTop = useRef(new Animated.Value(10));
  const scrollViewRef = useRef<any>(null);
  const lastScrollTime = useRef(Date.now());
  const velocityDecayTimer = useRef<number | null>(null);

  // Load complexes from database with preloading optimization
  useEffect(() => {
    const loadUserComplexes = async () => {
      if (user) {
        try {
          setLoading(true);

          // Check if we have preloaded data from the home screen
          const preloadedData = global.preloadedComplexes;
          const preloadedTimestamp = global.preloadedComplexesTimestamp;
          const isPreloadedDataFresh = preloadedTimestamp && (Date.now() - preloadedTimestamp < 30000); // 30 seconds

          let userComplexes;
          if (preloadedData && isPreloadedDataFresh) {
            console.log('⚡ Using preloaded complexes data');
            userComplexes = preloadedData;
            // Clear the cache after using it
            global.preloadedComplexes = null;
            global.preloadedComplexesTimestamp = null;
          } else {
            console.log('📶 Loading fresh complexes data');
            userComplexes = await loadComplexes(user.id);
          }

          // Add default colors if not present and filter out complexes with invalid IDs
          console.log('🔍 Raw complex data:', userComplexes.map(c => ({ id: c.id, name: c.name, type: typeof c.id })));

          // Filter out complexes with clearly invalid IDs (null, undefined, empty string, or short numbers)
          const validComplexes = userComplexes.filter(complex => {
            const id = complex.id;
            const isValid = id &&
              typeof id === 'string' &&
              id.length > 10; // UUID should be much longer than short numbers like "2243"

            if (!isValid) {
              console.warn('🚨 Filtering out complex with invalid ID:', id, complex.name);
            }
            return isValid;
          });

          const complexesWithColors = validComplexes.map((complex, index) => ({
            ...complex,
            color: complex.color || ['#FF6B6B', '#4ECDC4', '#FFD700', '#DDA0DD', '#98D8C8', '#FFA07A', '#87CEEB', '#98FB98'][index % 8]
          }));
          setComplexes(complexesWithColors);
          console.log('🔍 Loaded complexes with IDs:', complexesWithColors.map(c => ({ id: c.id, name: c.name, type: typeof c.id })));

          if (validComplexes.length !== userComplexes.length) {
            console.log(`📋 Filtered ${userComplexes.length - validComplexes.length} complexes with invalid IDs`);
          }
        } catch (error) {
          console.error('Error loading complexes:', error);
          Alert.alert('Error', 'Failed to load complexes');
        } finally {
          setLoading(false);
        }
      }
    };
    loadUserComplexes();
  }, [user]);

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

  // Note: Data is now preloaded in handleCardPress when chat card opens

  const handleButtonPress = (type: string) => {
    console.log(`${type} button pressed`);
    // Navigate to conversation page with selected topic
    router.push('/conversation?topic=' + type);
  };


  const handleConversationHistoryPress = (conversationId: number) => {
    const conversationWithMessages = getConversationById(conversationId, conversationData);
    if (conversationWithMessages) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push({
        pathname: '/conversation-history',
        params: { data: JSON.stringify(conversationWithMessages) }
      });
    }
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


  // Removed hardcoded conversationData - now loading from database
  /*
    {
      id: 1,
      title: 'Work Stress Discussion',
      date: '12/8/24',
      color: '#FF6B6B', // Red for stress/anger
      description: 'Explored feelings of overwhelm at work and discussed comprehensive coping strategies for managing deadlines and expectations. We worked on time management techniques, boundary setting with colleagues, and developing a healthier perspective on workplace pressures that have been affecting sleep and personal relationships. During our session, we delved deep into the root causes of workplace anxiety, examining how perfectionist tendencies and imposter syndrome contribute to chronic stress. We practiced several breathing techniques including box breathing and progressive muscle relaxation to help manage acute stress responses during high-pressure meetings. We also explored cognitive reframing exercises to challenge catastrophic thinking patterns that often emerge when facing tight deadlines. The conversation included practical strategies for communicating boundaries with supervisors and colleagues, including script development for saying no to additional responsibilities when already overloaded. We discussed the importance of creating physical and mental separation between work and personal life, establishing rituals to transition between work and home modes. Time blocking techniques were introduced to help prioritize important tasks while avoiding the trap of busywork that can create false urgency. We also addressed the impact of workplace stress on relationships, exploring how bringing work anxiety home affects family dynamics and romantic partnerships. Strategies for compartmentalization were practiced, along with methods for sharing work challenges with loved ones without overwhelming them. The session concluded with the development of a personalized stress management toolkit including daily check-ins, weekly reflection practices, and emergency protocols for particularly overwhelming days.'
    },
    {
      id: 2,
      title: 'Relationship Boundaries',
      date: '12/5/24',
      color: '#4ECDC4', // Teal for emotional/relational
      description: 'Talked about setting healthy boundaries with family members and learning to say no without guilt. We practiced assertive communication techniques, explored childhood patterns that make boundary-setting difficult, and created specific scripts for challenging conversations with parents and siblings during the holiday season. Our exploration began with identifying the deep-rooted family dynamics that have made boundary-setting feel impossible or selfish. We traced these patterns back to childhood experiences where expressing needs or saying no was met with guilt, punishment, or emotional manipulation. Through role-playing exercises, we practiced different approaches to boundary-setting conversations, starting with low-stakes situations and gradually building confidence for more challenging interactions. We developed a framework for distinguishing between healthy compromise and unhealthy people-pleasing, examining how cultural and family expectations around loyalty and obligation can sometimes conflict with personal well-being. The session included extensive work on managing guilt responses that typically arise when setting boundaries, using cognitive behavioral techniques to challenge thoughts like "I\'m being selfish" or "I\'m disappointing everyone." We created detailed scripts for common boundary-setting scenarios including declining holiday invitations, limiting phone calls or visits, refusing to engage in family drama, and protecting personal time and space. Particular attention was paid to dealing with pushback and manipulation tactics that family members might use when boundaries are first introduced. We discussed the importance of consistency in maintaining boundaries and developed strategies for staying firm even when faced with tears, anger, or silent treatment. The conversation also covered how to communicate boundaries with compassion while still being clear and firm about expectations.'
    },
    {
      id: 3,
      title: 'Self-Confidence Building',
      date: '12/1/24',
      color: '#FFD700', // Gold for self/empowerment
      description: 'Worked on identifying negative self-talk patterns and developing positive affirmations for daily practice. We traced these patterns back to early experiences, created personalized confidence-building exercises, and established a morning routine that includes self-compassion practices and achievement recognition to boost overall self-worth.'
    },
    {
      id: 4,
      title: 'Anxiety Management',
      date: '11/28/24',
      color: '#DDA0DD', // Plum for fear/anxiety
      description: 'Discussed breathing techniques and mindfulness exercises to help manage anxiety during social situations. We explored the root causes of social anxiety, practiced grounding techniques using the 5-4-3-2-1 method, and developed a toolkit of discrete calming strategies that can be used in public without drawing attention to yourself.'
    },
    {
      id: 5,
      title: 'Career Transition',
      date: '11/25/24',
      color: '#87CEEB', // Sky blue for growth/change
      description: 'Explored fears around changing careers and identified steps to move toward a more fulfilling professional path. We addressed imposter syndrome, financial concerns about leaving stability, and created a detailed action plan with timelines for networking, skill development, and gradual transition strategies to minimize risk while pursuing meaningful work.'
    },
    {
      id: 6,
      title: 'Sleep and Rest Issues',
      date: '11/22/24',
      color: '#98FB98', // Pale green for calm/rest
      description: 'Discussed chronic sleep difficulties and their impact on daily functioning and emotional regulation. We examined lifestyle factors contributing to insomnia, developed a comprehensive sleep hygiene routine, and explored the connection between racing thoughts at bedtime and unresolved daily stressors that need processing and release.'
    },
    {
      id: 7,
      title: 'Grief Processing',
      date: '11/18/24',
      color: '#87CEEB', // Sky blue for sadness
      description: 'Worked through complicated grief following the recent loss of a close family member. We explored the non-linear nature of grief, discussed healthy ways to honor memories while moving forward, and addressed guilt about experiencing moments of joy during the mourning process and how to navigate family dynamics during this difficult time.'
    },
    {
      id: 8,
      title: 'Financial Stress',
      date: '11/15/24',
      color: '#FFA07A', // Light salmon for worry
      description: 'Addressed anxiety and shame around money management and financial security concerns. We unpacked family patterns around money, developed practical budgeting strategies that feel sustainable, and worked on separating self-worth from net worth while creating realistic financial goals that align with personal values rather than societal expectations.'
    },
    {
      id: 9,
      title: 'Perfectionism Patterns',
      date: '11/12/24',
      color: '#FF6B6B', // Red for critical/perfectionist
      description: 'Examined perfectionist tendencies and their impact on productivity and mental health. We identified triggers that activate all-or-nothing thinking, practiced embracing "good enough" in low-stakes situations, and developed strategies for breaking large tasks into manageable pieces while celebrating progress rather than only focusing on perfect outcomes.'
    },
    {
      id: 10,
      title: 'Social Connection',
      date: '11/8/24',
      color: '#4ECDC4', // Teal for connection
      description: 'Explored feelings of loneliness and difficulty maintaining meaningful friendships as an adult. We discussed the challenges of making connections outside of work environments, identified personal barriers to vulnerability in relationships, and created actionable steps for nurturing existing friendships while remaining open to new social opportunities and community involvement.'
    }
  */

  const handleCardPress = (card: any) => {
    // Navigate to complex detail page with modal presentation
    router.push({
      pathname: '/complex-detail',
      params: {
        id: card.id.toString(),
        title: card.title,
        date: card.date,
        description: card.description,
        color: card.color || '#888888'
      }
    });
  };








  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const currentTime = Date.now();
    const timeDelta = currentTime - lastScrollTime.current;

    setScrollY(currentScrollY);

    // Check if we're in a bounce state (scrolled beyond content bounds)
    const maxScrollY = Math.max(0, contentHeight - scrollViewHeight);
    const inBounceState = currentScrollY < 0 || currentScrollY > maxScrollY;

    // Only calculate velocity when not in bounce state
    if (!inBounceState && timeDelta > 0 && timeDelta < 100) { // Ignore large time gaps
      const scrollDelta = Math.abs(currentScrollY - lastScrollY);
      const instantVelocity = scrollDelta / timeDelta;
      const scaledVelocity = Math.min(instantVelocity * 50, 3); // Scale and cap velocity

      // Smooth velocity with momentum - blend current with previous
      setScrollVelocity(prevVelocity => {
        const smoothedVelocity = prevVelocity * 0.8 + scaledVelocity * 0.2; // More smoothing
        return smoothedVelocity;
      });

      // Clear any existing decay timer and start a new one
      if (velocityDecayTimer.current) {
        clearInterval(velocityDecayTimer.current);
      }

      // Start decay timer to gradually reduce velocity when scrolling stops
      velocityDecayTimer.current = setInterval(() => {
        setScrollVelocity(prevVelocity => {
          const decayedVelocity = prevVelocity * 0.92; // Slower, smoother decay
          if (decayedVelocity < 0.02) { // Lower threshold for smoother finish
            clearInterval(velocityDecayTimer.current!);
            velocityDecayTimer.current = null;
            return 0;
          }
          return decayedVelocity;
        });
      }, 33) as any; // 30fps for smooth animation
    }

    // Pull-to-reveal search bar with sticky behavior
    if (currentScrollY < 0 && !isSearchBarRevealed) {
      // User is pulling down from the top - reveal search bar proportionally
      const pullDistance = Math.abs(currentScrollY);
      setSearchBarPullProgress(Math.min(pullDistance / 40, 1));

      // If pulled down far enough, mark as revealed
      if (pullDistance >= 40 && !isSearchBarRevealed) {
        setIsSearchBarRevealed(true);
        setSearchBarPullProgress(1);
        // Double haptic feedback when search bar is revealed
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }, 100);
      }
    } else if (currentScrollY > 20 && isSearchBarRevealed) {
      // User has scrolled down from top while search bar is revealed - hide it
      setIsSearchBarRevealed(false);
      setSearchBarPullProgress(0);
      // Single haptic feedback when search bar is hidden
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        
        <View style={[
          styles.searchContainerFixed,
          {
            transform: [{
              translateY: isSearchBarRevealed
                ? -5
                : -60 + (searchBarPullProgress * 60)
            }],
            opacity: isSearchBarRevealed
              ? 1
              : searchBarPullProgress > 0.875
                ? (searchBarPullProgress - 0.875) * 8
                : 0,
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
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={[styles.cardsContainer, { marginBottom: -155 }]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: isSearchBarRevealed ? 50 : 10 }
          ]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          bounces={true}
          alwaysBounceVertical={true}
          onContentSizeChange={(width, height) => setContentHeight(height)}
          onLayout={(event) => setScrollViewHeight(event.nativeEvent.layout.height)}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colorScheme === 'dark' ? '#AAAAAA' : '#666666' }]}>
                Loading complexes...
              </Text>
            </View>
          ) : complexes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colorScheme === 'dark' ? '#AAAAAA' : '#666666' }]}>
                No complexes found. Start a conversation to create your first complex.
              </Text>
            </View>
          ) : complexes.map((complex, index) => {
            // Calculate card's position on screen
            // Each card is 350px tall with dynamic margin based on velocity
            const cardTop = index * 140; // Position of card relative to scroll content
            const cardCenter = cardTop + 175; // Center of the card (350/2 = 175)

            // Calculate card's position relative to viewport
            const viewportHeight = 800; // Approximate viewport height
            const cardPositionInViewport = cardCenter - scrollY;

            // Normalize position (0 = top of viewport, 1 = bottom of viewport)
            const normalizedPosition = Math.max(0, Math.min(1, cardPositionInViewport / viewportHeight));

            // Get color for this complex
            const complexColor = complex.color || '#888888';
            const isDark = colorScheme === 'dark';
            const backgroundColor = isDark
              ? `${complexColor}23` // 23% opacity for dark mode (25% less intense)
              : `${complexColor}15`; // 15% opacity for light mode (25% less intense)
            
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
                key={complex.id}
                style={[
                  styles.cardShadowContainer,
                  {
                    zIndex: index + 1,
                    marginTop: index === 0 ? 0 : dynamicMargin,
                    height: 340,
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
                  onPress={() => handleCardPress({
                    id: complex.id,
                    title: complex.name,
                    date: new Date(complex.created_at || '').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }),
                    description: complex.description || 'A collection of related conversations',
                    color: complex.color
                  })}
                  style={styles.cardPressable}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[
                      styles.cardTitle,
                      { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }
                    ]}>
                      {complex.name}
                    </Text>
                    <Text style={[
                      styles.cardDate,
                      { color: colorScheme === 'dark' ? '#CCCCCC' : '#666666' }
                    ]}>
                      {new Date(complex.created_at || '').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={[
                    styles.cardDescription,
                    { color: colorScheme === 'dark' ? '#DDDDDD' : '#444444' }
                  ]}>
                    {complex.description || 'A collection of related conversations'}
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
        </ScrollView>
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
    paddingBottom: 16,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Georgia',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Georgia',
    textAlign: 'center',
  },
});