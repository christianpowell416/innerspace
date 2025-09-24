import { StyleSheet, View, Pressable, Text, ScrollView, TextInput, Animated, Modal, PanResponder, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { VoiceConversationModal } from '@/components/VoiceConversationModal';
import { ConversationHistoryModal } from '@/components/ConversationHistoryModal';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FlowchartStructure } from '@/lib/types/flowchart';
import { createFlowchart, updateFlowchartWithDescription, getUserFlowchartWithId } from '@/lib/services/flowcharts';
import { useAuth } from '@/contexts/AuthContext';
import { Alert } from 'react-native';

// Lazy load ALL bubble chart components to prevent them from loading until needed
const PartsHoneycombMiniBubbleChart = React.lazy(() => import('@/components/PartsHoneycombMiniBubbleChart'));
const NeedsHoneycombMiniBubbleChart = React.lazy(() => import('@/components/NeedsHoneycombMiniBubbleChart'));
const EmotionsHoneycombMiniBubbleChart = React.lazy(() => import('@/components/EmotionsHoneycombMiniBubbleChart'));

// Lazy load expanded charts to prevent them from loading until needed
const PartsExpandedBubbleChart = React.lazy(() => import('@/components/PartsExpandedBubbleChart'));
const NeedsExpandedBubbleChart = React.lazy(() => import('@/components/NeedsExpandedBubbleChart'));
const EmotionsExpandedBubbleChart = React.lazy(() => import('@/components/EmotionsExpandedBubbleChart'));
import { generateTestPartsData, generateTestNeedsData } from '@/lib/utils/partsNeedsTestData';
import { generateTestEmotionData } from '@/lib/utils/testData';
import { PartBubbleData, NeedBubbleData } from '@/lib/types/partsNeedsChart';
import { EmotionBubbleData } from '@/lib/types/bubbleChart';
import { getConversationById, ConversationData } from '@/lib/services/conversationService';

const CARD_BORDER_RADIUS = 24;

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
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [expandedSquareCard, setExpandedSquareCard] = useState<string | null>(null);
  const [conversationHistoryVisible, setConversationHistoryVisible] = useState(false);
  const [selectedHistoryConversation, setSelectedHistoryConversation] = useState<ConversationData | null>(null);
  const [voiceModalOpenedFromDetail, setVoiceModalOpenedFromDetail] = useState(false);
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
  const searchBarTranslateY = useRef(new Animated.Value(-60)).current;
  const searchBarOpacity = useRef(new Animated.Value(0)).current;
  const scrollViewPaddingTop = useRef(new Animated.Value(10)).current;
  const scrollViewRef = useRef<any>(null);
  const lastScrollTime = useRef(Date.now());
  const velocityDecayTimer = useRef<number | null>(null);
  const modalTranslateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const modalTopPosition = 80; // Position below the Loops header

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

  // Note: Data is now preloaded in handleCardPress when chat card opens

  const handleButtonPress = (type: string) => {
    console.log(`${type} button pressed`);
    setSelectedTopic(type);
    setVoiceModalVisible(true);
  };

  const handleVoiceModalClose = () => {
    setVoiceModalVisible(false);
    setSelectedTopic('');

    // If voice modal was opened from detail modal, reopen the detail modal with slide animation
    if (voiceModalOpenedFromDetail) {
      setVoiceModalOpenedFromDetail(false);
      modalTranslateY.setValue(Dimensions.get('window').height);
      setTimeout(() => {
        setModalVisible(true);
        Animated.timing(modalTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 100);
    }
  };

  const handleConversationHistoryPress = (conversationId: number) => {
    const conversationWithMessages = getConversationById(conversationId, conversationData);
    if (conversationWithMessages) {
      // Open history modal immediately
      setSelectedHistoryConversation(conversationWithMessages);
      setConversationHistoryVisible(true);
    }
  };

  const handleConversationHistoryClose = () => {
    setConversationHistoryVisible(false);
    setSelectedHistoryConversation(null);

    // Slide detail modal back up when history modal closes
    modalTranslateY.setValue(Dimensions.get('window').height);
    setTimeout(() => {
      Animated.timing(modalTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 100);
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

  // Handle bubble press events
  const handlePartPress = (part: PartBubbleData) => {
    console.log('Part pressed:', part.name);
    // TODO: Show part detail modal or additional info
  };

  const handleNeedPress = (need: NeedBubbleData) => {
    console.log('Need pressed:', need.name);
    // TODO: Show need detail modal or additional info
  };

  const handleEmotionPress = (emotion: EmotionBubbleData) => {
    console.log('Emotion pressed:', emotion.emotion);
    // TODO: Show emotion detail modal or additional info
  };

  const conversationData = [
    {
      id: 1,
      title: 'Work Stress Discussion',
      date: '12/8/24',
      description: 'Explored feelings of overwhelm at work and discussed comprehensive coping strategies for managing deadlines and expectations. We worked on time management techniques, boundary setting with colleagues, and developing a healthier perspective on workplace pressures that have been affecting sleep and personal relationships. During our session, we delved deep into the root causes of workplace anxiety, examining how perfectionist tendencies and imposter syndrome contribute to chronic stress. We practiced several breathing techniques including box breathing and progressive muscle relaxation to help manage acute stress responses during high-pressure meetings. We also explored cognitive reframing exercises to challenge catastrophic thinking patterns that often emerge when facing tight deadlines. The conversation included practical strategies for communicating boundaries with supervisors and colleagues, including script development for saying no to additional responsibilities when already overloaded. We discussed the importance of creating physical and mental separation between work and personal life, establishing rituals to transition between work and home modes. Time blocking techniques were introduced to help prioritize important tasks while avoiding the trap of busywork that can create false urgency. We also addressed the impact of workplace stress on relationships, exploring how bringing work anxiety home affects family dynamics and romantic partnerships. Strategies for compartmentalization were practiced, along with methods for sharing work challenges with loved ones without overwhelming them. The session concluded with the development of a personalized stress management toolkit including daily check-ins, weekly reflection practices, and emergency protocols for particularly overwhelming days.'
    },
    {
      id: 2,
      title: 'Relationship Boundaries',
      date: '12/5/24',
      description: 'Talked about setting healthy boundaries with family members and learning to say no without guilt. We practiced assertive communication techniques, explored childhood patterns that make boundary-setting difficult, and created specific scripts for challenging conversations with parents and siblings during the holiday season. Our exploration began with identifying the deep-rooted family dynamics that have made boundary-setting feel impossible or selfish. We traced these patterns back to childhood experiences where expressing needs or saying no was met with guilt, punishment, or emotional manipulation. Through role-playing exercises, we practiced different approaches to boundary-setting conversations, starting with low-stakes situations and gradually building confidence for more challenging interactions. We developed a framework for distinguishing between healthy compromise and unhealthy people-pleasing, examining how cultural and family expectations around loyalty and obligation can sometimes conflict with personal well-being. The session included extensive work on managing guilt responses that typically arise when setting boundaries, using cognitive behavioral techniques to challenge thoughts like "I\'m being selfish" or "I\'m disappointing everyone." We created detailed scripts for common boundary-setting scenarios including declining holiday invitations, limiting phone calls or visits, refusing to engage in family drama, and protecting personal time and space. Particular attention was paid to dealing with pushback and manipulation tactics that family members might use when boundaries are first introduced. We discussed the importance of consistency in maintaining boundaries and developed strategies for staying firm even when faced with tears, anger, or silent treatment. The conversation also covered how to communicate boundaries with compassion while still being clear and firm about expectations.'
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

  const handleCardPress = (card: any) => {
    setSelectedCard(card);
    setModalVisible(true);
    setShouldRenderCharts(false); // Ensure charts don't render during animation
    setShouldLoadMiniCharts(false); // Ensure mini charts don't load during animation

    // Reset expanded view state to ensure new card opens with mini charts
    setExpandedSquareCard(null);
    setLoadedExpandedCharts(new Set());

    // Reset all animation states to ensure clean start
    expandedOpacity.emotions.setValue(0);
    expandedOpacity.parts.setValue(0);
    expandedOpacity.needs.setValue(0);
    cardOpacity.emotions.setValue(1);
    cardOpacity.parts.setValue(1);
    cardOpacity.needs.setValue(1);
    titleOpacity.emotions.setValue(1);
    titleOpacity.parts.setValue(1);
    titleOpacity.needs.setValue(1);
    contentTranslateY.setValue(0);

    // Animate modal sliding up from bottom
    Animated.timing(modalTranslateY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      // Enhanced loading sequence with caching for faster subsequent loads
      const hasCachedComponents = componentsCache.has('mini-charts');
      console.log('📊 Animation complete, starting chart loading. Has cached:', hasCachedComponents);

      if (hasCachedComponents) {
        // Fast path for cached components
        console.log('🚀 Using fast path for cached components');
        setShouldLoadMiniCharts(true);
        setShouldRenderCharts(true);
        setTimeout(() => {
          console.log('📈 Loading chart data (cached path)');
          setPartsData(generateTestPartsData(Math.floor(Math.random() * 6) + 1)); // 1-6 bubbles
          setNeedsData(generateTestNeedsData(Math.floor(Math.random() * 6) + 1)); // 1-6 bubbles
          setEmotionsData(generateTestEmotionData(Math.floor(Math.random() * 6) + 1)); // 1-6 bubbles

          // Preload expanded charts after mini charts are loaded
          setTimeout(() => {
            console.log('🚀 Preloading expanded charts');
            setLoadedExpandedCharts(new Set(['emotions', 'parts', 'needs']));
          }, 200); // Small delay to let mini charts settle
        }, 50); // Faster load for cached components
      } else {
        // Slower path for first load with caching
        setTimeout(() => {
          console.log('📥 Loading mini chart components (first time)');
          setShouldLoadMiniCharts(true);
          setComponentsCache(prev => new Set(prev).add('mini-charts'));
          setTimeout(() => {
            console.log('🎨 Enabling chart rendering');
            setShouldRenderCharts(true);
            setTimeout(() => {
              console.log('📈 Loading chart data (first time)');
              setPartsData(generateTestPartsData(Math.floor(Math.random() * 6) + 1)); // 1-6 bubbles
              setNeedsData(generateTestNeedsData(Math.floor(Math.random() * 6) + 1)); // 1-6 bubbles
              setEmotionsData(generateTestEmotionData(Math.floor(Math.random() * 6) + 1)); // 1-6 bubbles

              // Preload expanded charts after mini charts are loaded
              setTimeout(() => {
                console.log('🚀 Preloading expanded charts');
                setLoadedExpandedCharts(new Set(['emotions', 'parts', 'needs']));
              }, 300); // Slightly longer delay for first time load
            }, 100); // Increased delay for component loading
          }, 150); // Increased delay for mini chart loading
        }, 100); // Additional buffer after animation
      }
    });
  };

  const closeModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Animate modal sliding down
    Animated.timing(modalTranslateY, {
      toValue: Dimensions.get('window').height,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      setSelectedCard(null);
      setExpandedSquareCard(null); // Reset expanded view state
      setShouldRenderCharts(false);
      setShouldLoadMiniCharts(false);
      setLoadedExpandedCharts(new Set()); // Clear loaded expanded charts

      // Reset all animation states to default
      expandedOpacity.emotions.setValue(0);
      expandedOpacity.parts.setValue(0);
      expandedOpacity.needs.setValue(0);
      cardOpacity.emotions.setValue(1);
      cardOpacity.parts.setValue(1);
      cardOpacity.needs.setValue(1);
      titleOpacity.emotions.setValue(1);
      titleOpacity.parts.setValue(1);
      titleOpacity.needs.setValue(1);
      contentTranslateY.setValue(0);

      // Clear bubble chart data to show loading state on next open
      setPartsData([]);
      setNeedsData([]);
      setEmotionsData([]);
    });
  };

  const expandCard = (cardType: string) => {
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
      // Slide content down to make room for expanded card
      Animated.timing(contentTranslateY, {
        toValue: Dimensions.get('window').width - 40 - 110 + 1, // Height of expanded card minus minimized card height + small margin
        duration: 400,
        useNativeDriver: true,
      }),
      // Fade title text for non-expanded cards
      Animated.timing(titleOpacity.emotions, {
        toValue: cardType === 'emotions' ? 1 : 0.5,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(titleOpacity.parts, {
        toValue: cardType === 'parts' ? 1 : 0.5,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(titleOpacity.needs, {
        toValue: cardType === 'needs' ? 1 : 0.5,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const collapseCard = () => {
    if (!expandedSquareCard) return;
    
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
      // Slide content back up to original position
      Animated.timing(contentTranslateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      // Fade all title text back to normal
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
    ]).start(() => {
      setExpandedSquareCard(null);
    });
  };

  // Cycle between expanded charts when tapping headers
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
    ]).start(() => {
      setExpandedSquareCard(targetCardType);
    });
  };

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

  // Track scroll position for content dismiss
  const [scrollPosition, setScrollPosition] = useState(0);

  // Create pan responder for content area dismissal
  const contentPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Capture downward swipes when at the top
        const atTop = scrollPosition <= 1;
        const downwardSwipe = gestureState.dy > 10 && gestureState.vy > 0.2;
        return atTop && downwardSwipe;
      },
      onPanResponderGrant: () => {
        // When we capture the gesture, immediately start moving the modal
        console.log('Content pan responder activated');
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          modalTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        console.log('Content gesture release:', { dy: gestureState.dy, vy: gestureState.vy });
        if (gestureState.dy > 100 || gestureState.vy > 1.5) {
          console.log('Closing modal from content');
          closeModal();
        } else {
          console.log('Snapping back to top');
          Animated.timing(modalTranslateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

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
          {conversationData.map((conversation, index) => {
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
      </SafeAreaView>
      
      <VoiceConversationModal
        visible={voiceModalVisible}
        onClose={handleVoiceModalClose}
        onFlowchartCreated={handleFlowchartCreated}
      />

      <ConversationHistoryModal
        visible={conversationHistoryVisible}
        onClose={handleConversationHistoryClose}
        conversationData={selectedHistoryConversation}
      />

      {/* Card Detail Modal */}
      <Modal
        visible={modalVisible && !conversationHistoryVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
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
              {selectedCard && (
                <>
                  {/* Fixed Header - draggable */}
                  <View 
                    style={styles.modalHeader}
                    {...headerPanResponder.panHandlers}
                  >
                    <Text style={[
                      styles.modalTitle,
                      { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }
                    ]}>
                      {selectedCard.title}
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
                        
                        // Only handle overscroll when pulling down from top
                        if (yOffset < 0) {
                          const translation = Math.abs(yOffset) * 1.5; // Amplify movement slightly
                          modalTranslateY.setValue(translation);
                        } else if (yOffset === 0) {
                          // Reset position only when exactly at top
                          modalTranslateY.setValue(0);
                        }
                      }}
                      onScrollEndDrag={(event) => {
                        const yOffset = event.nativeEvent.contentOffset.y;
                        
                        // Only process dismissal if we were overscrolling (pulling down from top)
                        if (yOffset < 0) {
                          const currentTranslation = Math.abs(yOffset) * 1.5;
                          
                          if (currentTranslation > 100) {
                            // Use the same closeModal function for consistent animation
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
                      bounces={true}
                    >
                      {/* Three square cards at the top */}
                      <View style={styles.squareCardsContainer}>
                        <View style={styles.squareCardsInner}>
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
                                    backgroundColor: colorScheme === 'dark'
                                      ? 'rgba(255, 255, 255, 0.1)'
                                      : 'rgba(0, 0, 0, 0.05)',
                                    borderColor: colorScheme === 'dark'
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
                                    <Suspense fallback={<View />}>
                                      <EmotionsHoneycombMiniBubbleChart
                                        data={emotionsData}
                                        width={emotionsChartDimensions.width}
                                        height={emotionsChartDimensions.height}
                                        callbacks={{ onBubblePress: handleEmotionPress }}
                                        loading={emotionsData.length === 0}
                                      />
                                    </Suspense>
                                  ) : null}
                                </View>
                              </Pressable>
                            </Animated.View>
                          </View>
                          
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
                            {/* Minimized card */}
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
                                    backgroundColor: colorScheme === 'dark'
                                      ? 'rgba(255, 255, 255, 0.1)'
                                      : 'rgba(0, 0, 0, 0.05)',
                                    borderColor: colorScheme === 'dark'
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
                                    <Suspense fallback={<View />}>
                                      <PartsHoneycombMiniBubbleChart
                                        data={partsData}
                                        width={partsChartDimensions.width}
                                        height={partsChartDimensions.height}
                                        callbacks={{ onBubblePress: handlePartPress }}
                                        loading={partsData.length === 0}
                                      />
                                    </Suspense>
                                  ) : null}
                                </View>
                              </Pressable>
                            </Animated.View>
                            
                          </View>
                          
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
                            {/* Minimized card */}
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
                                    backgroundColor: colorScheme === 'dark'
                                      ? 'rgba(255, 255, 255, 0.1)'
                                      : 'rgba(0, 0, 0, 0.05)',
                                    borderColor: colorScheme === 'dark'
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
                                    <Suspense fallback={<View />}>
                                      <NeedsHoneycombMiniBubbleChart
                                        data={needsData}
                                        width={needsChartDimensions.width}
                                        height={needsChartDimensions.height}
                                        callbacks={{ onBubblePress: handleNeedPress }}
                                        loading={needsData.length === 0}
                                      />
                                    </Suspense>
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
                                backgroundColor: colorScheme === 'dark'
                                  ? 'rgba(255, 255, 255, 0.1)'
                                  : 'rgba(0, 0, 0, 0.05)',
                                borderColor: colorScheme === 'dark'
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
                                  backgroundColor: colorScheme === 'dark'
                                    ? 'rgba(255, 255, 255, 0.1)'
                                    : 'rgba(0, 0, 0, 0.05)',
                                  borderColor: colorScheme === 'dark'
                                    ? 'rgba(255, 255, 255, 0.2)'
                                    : 'rgba(0, 0, 0, 0.1)',
                                }
                              ]}
                            >
                              <IconSymbol
                                name="chevron.up"
                                size={18}
                                color={colorScheme === 'dark' ? '#AAAAAA' : '#666666'}
                              />
                            </Pressable>
                            <View
                              style={styles.chartContainer}
                              onLayout={(event) => {
                                const { width, height } = event.nativeEvent.layout;
                                if (width > 0 && height > 0) {
                                  setEmotionsChartDimensions({ width, height });
                                }
                              }}
                            >
                              {shouldRenderCharts && loadedExpandedCharts.has('emotions') ? (
                                <Suspense fallback={<View />}>
                                  <EmotionsExpandedBubbleChart
                                    data={emotionsData}
                                    width={emotionsChartDimensions.width}
                                    height={emotionsChartDimensions.height}
                                    callbacks={{ onBubblePress: handleEmotionPress }}
                                    loading={emotionsData.length === 0}
                                  />
                                </Suspense>
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
                                backgroundColor: colorScheme === 'dark'
                                  ? 'rgba(255, 255, 255, 0.1)'
                                  : 'rgba(0, 0, 0, 0.05)',
                                borderColor: colorScheme === 'dark'
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
                                  backgroundColor: colorScheme === 'dark'
                                    ? 'rgba(255, 255, 255, 0.1)'
                                    : 'rgba(0, 0, 0, 0.05)',
                                  borderColor: colorScheme === 'dark'
                                    ? 'rgba(255, 255, 255, 0.2)'
                                    : 'rgba(0, 0, 0, 0.1)',
                                }
                              ]}
                            >
                              <IconSymbol
                                name="chevron.up"
                                size={18}
                                color={colorScheme === 'dark' ? '#AAAAAA' : '#666666'}
                              />
                            </Pressable>
                            <View
                              style={styles.chartContainer}
                              onLayout={(event) => {
                                const { width, height } = event.nativeEvent.layout;
                                if (width > 0 && height > 0) {
                                  setPartsChartDimensions({ width, height });
                                }
                              }}
                            >
                              {shouldRenderCharts && loadedExpandedCharts.has('parts') ? (
                                <Suspense fallback={<View />}>
                                  <PartsExpandedBubbleChart
                                    data={partsData}
                                    width={partsChartDimensions.width}
                                    height={partsChartDimensions.height}
                                    callbacks={{ onBubblePress: handlePartPress }}
                                    loading={partsData.length === 0}
                                  />
                                </Suspense>
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
                                backgroundColor: colorScheme === 'dark'
                                  ? 'rgba(255, 255, 255, 0.1)'
                                  : 'rgba(0, 0, 0, 0.05)',
                                borderColor: colorScheme === 'dark'
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
                                  backgroundColor: colorScheme === 'dark'
                                    ? 'rgba(255, 255, 255, 0.1)'
                                    : 'rgba(0, 0, 0, 0.05)',
                                  borderColor: colorScheme === 'dark'
                                    ? 'rgba(255, 255, 255, 0.2)'
                                    : 'rgba(0, 0, 0, 0.1)',
                                }
                              ]}
                            >
                              <IconSymbol
                                name="chevron.up"
                                size={18}
                                color={colorScheme === 'dark' ? '#AAAAAA' : '#666666'}
                              />
                            </Pressable>
                            <View
                              style={styles.chartContainer}
                              onLayout={(event) => {
                                const { width, height } = event.nativeEvent.layout;
                                if (width > 0 && height > 0) {
                                  setNeedsChartDimensions({ width, height });
                                }
                              }}
                            >
                              {shouldRenderCharts && loadedExpandedCharts.has('needs') ? (
                                <Suspense fallback={<View />}>
                                  <NeedsExpandedBubbleChart
                                    data={needsData}
                                    width={needsChartDimensions.width}
                                    height={needsChartDimensions.height}
                                    callbacks={{ onBubblePress: handleNeedPress }}
                                    loading={needsData.length === 0}
                                  />
                                </Suspense>
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
                          { color: colorScheme === 'dark' ? '#DDDDDD' : '#444444' }
                        ]}>
                          {selectedCard.description}
                        </Text>
                      </Animated.View>

                      {/* Conversation Cards Section */}
                      <View style={{ position: 'relative', marginBottom: 16, marginTop: 20 }}>
                        {/* Count badge in top left */}
                        <Animated.View style={[
                          styles.countBadge,
                          {
                            borderColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
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
                              color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                              fontSize: 22.5,
                              fontWeight: '600',
                              marginBottom: 0,
                              fontFamily: 'Georgia',
                              paddingHorizontal: 0,
                              marginTop: 0,
                              marginLeft: 0,
                            }
                          ]}>
                            Conversations
                          </Text>
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              setModalVisible(false);
                              setVoiceModalOpenedFromDetail(true);
                              setSelectedTopic('general');
                              setVoiceModalVisible(true);
                            }}
                            style={[
                              styles.minimizeButton,
                              {
                                backgroundColor: colorScheme === 'dark'
                                  ? 'rgba(255, 255, 255, 0.1)'
                                  : 'rgba(0, 0, 0, 0.05)',
                                borderColor: colorScheme === 'dark'
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
                              color={colorScheme === 'dark' ? '#AAAAAA' : '#666666'}
                            />
                          </Pressable>
                        </Animated.View>

                        {/* Conversation excerpts */}
                        <Animated.View style={{
                          marginTop: -5,
                          transform: [{ translateY: contentTranslateY }],
                        }}>
                          <View style={styles.conversationList}>
                            {[
                              { id: 4, excerpt: "Discussed feeling anxious about upcoming job interview and strategies for managing nervousness.", title: "Job Interview Anxiety", date: "9/15/25" },
                              { id: 5, excerpt: "Explored childhood memories of feeling left out and how they affect current relationships.", title: "Childhood Rejection", date: "9/12/25" },
                              { id: 2, excerpt: "Talked through frustration with partner's communication style during recent argument.", title: "Partner Communication", date: "9/10/25" },
                              { id: 9, excerpt: "Reflected on perfectionist tendencies and fear of disappointing family members.", title: "Perfectionism Issues", date: "9/8/25" },
                              { id: 7, excerpt: "Processed grief over father's death and difficulty accepting support from friends.", title: "Grief Processing", date: "9/5/25" }
                            ].map((item, index) => {
                              const isDark = colorScheme === 'dark';

                              return (
                                <View
                                  key={index}
                                  style={[
                                    styles.loopCardSimple,
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
                                        handleConversationHistoryPress(item.id);
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
                        </Animated.View>
                      </View>
                    </ScrollView>
                  </View>
                </>
              )}
            </BlurView>
          </Animated.View>
        </View>
      </Modal>
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
    top: 110, // Lowered by 50px from 60 to 110
    left: 0, // Full width
    right: 0, // Full width
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
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20, // Increased padding since no handle bar
    paddingBottom: 15,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    fontSize: 35,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
    fontFamily: 'Georgia',
  },
  modalDate: {
    fontSize: 22,
    fontWeight: 'normal',
    fontFamily: 'Georgia',
  },
  modalDescription: {
    fontSize: 20,
    lineHeight: 30,
    textAlign: 'left',
    fontFamily: 'Georgia',
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
  expandedCardOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 24,
    zIndex: 10,
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
  squareCardLabel: {
    fontSize: 14,
    fontFamily: 'Georgia',
    fontWeight: '500',
  },
  animatedCardContainer: {
    width: 110,
    height: 110,
    alignItems: 'center',
    overflow: 'hidden',
  },
  expandedCardContent: {
    fontSize: 16,
    fontFamily: 'Georgia',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
  },
  expandedCardView: {
    position: 'absolute',
    top: 29, // Aligned with minimized cards (adjusted +2px)
    left: 0,
    right: 4, // Fine-tuned to align with rightmost mini container
    zIndex: 100, // Higher z-index to appear above content text
  },
  expandedCard: {
    width: '100%',
    aspectRatio: 1, // Make it square (width = height)
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2, // Adjust width to match minimized cards
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
  conversationList: {
    marginTop: 12,
  },
  loopCardSimple: {
    borderRadius: 16,
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
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
    fontFamily: 'Georgia',
  },
  loopCardDate: {
    fontSize: 19,
    fontWeight: 'normal',
    fontFamily: 'Georgia',
  },
  loopCardExcerpt: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'left',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    marginBottom: 15,
  },
});