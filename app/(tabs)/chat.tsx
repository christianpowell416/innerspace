import { StyleSheet, View, Pressable, Text, ScrollView, TextInput, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { VoiceFlowchartCreator } from '@/components/VoiceFlowchartCreator';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FlowchartStructure } from '@/lib/types/flowchart';
import { createFlowchart, updateFlowchartWithDescription, getUserFlowchartWithId } from '@/lib/services/flowcharts';
import { useAuth } from '@/contexts/AuthContext';
import { Alert } from 'react-native';

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const { newChat } = useLocalSearchParams();
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [scrollY, setScrollY] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isSearchBarRevealed, setIsSearchBarRevealed] = useState(false);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const searchBarTranslateY = useRef(new Animated.Value(-60)).current;
  const searchBarOpacity = useRef(new Animated.Value(0)).current;
  const scrollViewPaddingTop = useRef(new Animated.Value(10)).current;
  const lastScrollTime = useRef(Date.now());
  const velocityDecayTimer = useRef<number | null>(null);

  // Listen for new chat trigger
  useEffect(() => {
    if (newChat === 'true') {
      // Start a new general chat
      setSelectedTopic('general');
      setVoiceModalVisible(true);
      // Clear the parameter by navigating without it
      router.replace('/(tabs)/chat');
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
  
  const handleButtonPress = (type: string) => {
    console.log(`${type} button pressed`);
    setSelectedTopic(type);
    setVoiceModalVisible(true);
  };

  const handleVoiceModalClose = () => {
    setVoiceModalVisible(false);
    setSelectedTopic('');
  };

  const handleFlowchartCreated = async (flowchart: FlowchartStructure) => {
    console.log('Flowchart created from chat:', flowchart);
    
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to save your flowchart');
      setVoiceModalVisible(false);
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
    
    setVoiceModalVisible(false);
    setSelectedTopic('');
  };

  const conversationData = [
    {
      id: 1,
      title: 'Work Stress Discussion',
      date: '12/8/24',
      description: 'Explored feelings of overwhelm at work and discussed comprehensive coping strategies for managing deadlines and expectations. We worked on time management techniques, boundary setting with colleagues, and developing a healthier perspective on workplace pressures that have been affecting sleep and personal relationships.'
    },
    {
      id: 2,
      title: 'Relationship Boundaries',
      date: '12/5/24',
      description: 'Talked about setting healthy boundaries with family members and learning to say no without guilt. We practiced assertive communication techniques, explored childhood patterns that make boundary-setting difficult, and created specific scripts for challenging conversations with parents and siblings during the holiday season.'
    },
    {
      id: 3,
      title: 'Self-Confidence Building',
      date: '12/1/24',
      description: 'Worked on identifying negative self-talk patterns and developing positive affirmations for daily practice. We traced these patterns back to early experiences, created personalized confidence-building exercises, and established a morning routine that includes self-compassion practices and achievement recognition to boost overall self-worth.'
    },
    {
      id: 4,
      title: 'Anxiety Management',
      date: '11/28/24',
      description: 'Discussed breathing techniques and mindfulness exercises to help manage anxiety during social situations. We explored the root causes of social anxiety, practiced grounding techniques using the 5-4-3-2-1 method, and developed a toolkit of discrete calming strategies that can be used in public without drawing attention to yourself.'
    },
    {
      id: 5,
      title: 'Career Transition',
      date: '11/25/24',
      description: 'Explored fears around changing careers and identified steps to move toward a more fulfilling professional path. We addressed imposter syndrome, financial concerns about leaving stability, and created a detailed action plan with timelines for networking, skill development, and gradual transition strategies to minimize risk while pursuing meaningful work.'
    },
    {
      id: 6,
      title: 'Sleep and Rest Issues',
      date: '11/22/24',
      description: 'Discussed chronic sleep difficulties and their impact on daily functioning and emotional regulation. We examined lifestyle factors contributing to insomnia, developed a comprehensive sleep hygiene routine, and explored the connection between racing thoughts at bedtime and unresolved daily stressors that need processing and release.'
    },
    {
      id: 7,
      title: 'Grief Processing',
      date: '11/18/24',
      description: 'Worked through complicated grief following the recent loss of a close family member. We explored the non-linear nature of grief, discussed healthy ways to honor memories while moving forward, and addressed guilt about experiencing moments of joy during the mourning process and how to navigate family dynamics during this difficult time.'
    },
    {
      id: 8,
      title: 'Financial Stress',
      date: '11/15/24',
      description: 'Addressed anxiety and shame around money management and financial security concerns. We unpacked family patterns around money, developed practical budgeting strategies that feel sustainable, and worked on separating self-worth from net worth while creating realistic financial goals that align with personal values rather than societal expectations.'
    },
    {
      id: 9,
      title: 'Perfectionism Patterns',
      date: '11/12/24',
      description: 'Examined perfectionist tendencies and their impact on productivity and mental health. We identified triggers that activate all-or-nothing thinking, practiced embracing "good enough" in low-stakes situations, and developed strategies for breaking large tasks into manageable pieces while celebrating progress rather than only focusing on perfect outcomes.'
    },
    {
      id: 10,
      title: 'Social Connection',
      date: '11/8/24',
      description: 'Explored feelings of loneliness and difficulty maintaining meaningful friendships as an adult. We discussed the challenges of making connections outside of work environments, identified personal barriers to vulnerability in relationships, and created actionable steps for nurturing existing friendships while remaining open to new social opportunities and community involvement.'
    }
  ];

  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const currentTime = Date.now();
    const timeDelta = currentTime - lastScrollTime.current;
    
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
            if (velocityDecayTimer.current) {
              clearInterval(velocityDecayTimer.current);
              velocityDecayTimer.current = null;
            }
            return 0;
          }
          return decayedVelocity;
        });
      }, 16); // 60fps decay - smooth updates
    } else if (inBounceState) {
      // Immediately start decaying velocity when in bounce state
      if (velocityDecayTimer.current) {
        clearInterval(velocityDecayTimer.current);
      }
      setScrollVelocity(0); // Immediately stop bouncy effect
    }
    
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <Text style={{
            fontSize: 42,
            fontWeight: 'bold',
            color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
            textAlign: 'left',
            fontFamily: 'Georgia',
            lineHeight: 50
          }}>Loops</Text>
          
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
          {conversationData.map((conversation, index) => {
            // Calculate card's position on screen
            // Each card is 350px tall with dynamic margin based on velocity
            const cardTop = index * 140; // Position of card relative to scroll content
            const cardCenter = cardTop + 175; // Center of the card (350/2 = 175)
            const screenCenter = scrollY + 400; // Approximate center of visible area
            
            // Calculate relative position (-1 to 1, where 0 is screen center)
            const relativePosition = Math.max(-1, Math.min(1, (cardCenter - screenCenter) / 400));
            
            // Create gradient effect based on screen position
            // Cards at bottom of screen are darker, cards at top are darker than before
            const lightness = colorScheme === 'dark' 
              ? 0.2 + (0.3 * -relativePosition) // Dark mode: 0.0 to 0.5 (darker range)
              : 0.3 + (0.4 * -relativePosition); // Light mode: 0.0 to 0.7 (darker range)
            
            const grayValue = Math.round(255 * Math.max(0.1, Math.min(0.9, lightness)));
            const backgroundColor = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
            
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
              <View key={conversation.id} style={[
                styles.card,
                { 
                  backgroundColor,
                  zIndex: index + 1,
                  marginTop: index === 0 ? 0 : dynamicMargin,
                }
              ]}>
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
                {/* Create smooth gradient effect with more layers - from bottom to 3/4 up (262px) */}
                <View style={[styles.gradientLayer, { backgroundColor: backgroundColor, bottom: 0, height: 20, opacity: 1.0 }]} />
                <View style={[styles.gradientLayer, { backgroundColor: backgroundColor, bottom: 20, height: 20, opacity: 1.0 }]} />
                <View style={[styles.gradientLayer, { backgroundColor: backgroundColor, bottom: 40, height: 20, opacity: 0.98 }]} />
                <View style={[styles.gradientLayer, { backgroundColor: backgroundColor, bottom: 60, height: 20, opacity: 0.96 }]} />
                <View style={[styles.gradientLayer, { backgroundColor: backgroundColor, bottom: 80, height: 20, opacity: 0.94 }]} />
                <View style={[styles.gradientLayer, { backgroundColor: backgroundColor, bottom: 100, height: 20, opacity: 0.92 }]} />
                <View style={[styles.gradientLayer, { backgroundColor: backgroundColor, bottom: 120, height: 20, opacity: 0.9 }]} />
                <View style={[styles.gradientLayer, { backgroundColor: backgroundColor, bottom: 140, height: 20, opacity: 0.85 }]} />
                <View style={[styles.gradientLayer, { backgroundColor: backgroundColor, bottom: 160, height: 20, opacity: 0.8 }]} />
                <View style={[styles.gradientLayer, { backgroundColor: backgroundColor, bottom: 180, height: 20, opacity: 0.75 }]} />
                <View style={[styles.gradientLayer, { backgroundColor: backgroundColor, bottom: 200, height: 20, opacity: 0.65 }]} />
                <View style={[styles.gradientLayer, { backgroundColor: backgroundColor, bottom: 220, height: 20, opacity: 0.5 }]} />
                <View style={[styles.gradientLayer, { backgroundColor: backgroundColor, bottom: 240, height: 15, opacity: 0.3 }]} />
                <View style={[styles.gradientLayer, { backgroundColor: backgroundColor, bottom: 255, height: 7, opacity: 0.1 }]} />
              </View>
            );
          })}
        </Animated.ScrollView>
      </SafeAreaView>
      
      <VoiceFlowchartCreator
        visible={voiceModalVisible}
        onClose={handleVoiceModalClose}
        onFlowchartCreated={handleFlowchartCreated}
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 0,
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
    paddingTop: 20,
    paddingBottom: 20,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    paddingBottom: 30,
    height: 350,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
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