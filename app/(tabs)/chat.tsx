import { StyleSheet, View, Pressable, Text, ScrollView, TextInput, Animated } from 'react-native';
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
  const searchBarTranslateY = useRef(new Animated.Value(-60)).current;
  const searchBarOpacity = useRef(new Animated.Value(0)).current;

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
      date: 'Dec 8',
      description: 'Explored feelings of overwhelm at work and discussed coping strategies for managing deadlines and expectations.'
    },
    {
      id: 2,
      title: 'Relationship Boundaries',
      date: 'Dec 5',
      description: 'Talked about setting healthy boundaries with family members and learning to say no without guilt.'
    },
    {
      id: 3,
      title: 'Self-Confidence Building',
      date: 'Dec 1',
      description: 'Worked on identifying negative self-talk patterns and developing positive affirmations for daily practice.'
    },
    {
      id: 4,
      title: 'Anxiety Management',
      date: 'Nov 28',
      description: 'Discussed breathing techniques and mindfulness exercises to help manage anxiety during social situations.'
    },
    {
      id: 5,
      title: 'Career Transition',
      date: 'Nov 25',
      description: 'Explored fears around changing careers and identified steps to move toward a more fulfilling professional path.'
    }
  ];

  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
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
          })
        ]).start();
      }
    } else if (currentScrollY > 20 && isSearchBarRevealed) {
      // User has scrolled down from top while search bar is revealed - hide it
      setIsSearchBarRevealed(false);
      Animated.parallel([
        Animated.timing(searchBarTranslateY, {
          toValue: -60,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(searchBarOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    }
    
    setLastScrollY(currentScrollY);
  };

  return (
    <GradientBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
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
        <View style={styles.headerContainer}>
          <Text style={{
            fontSize: 42,
            fontWeight: 'bold',
            color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
            textAlign: 'left',
            fontFamily: 'Georgia',
            lineHeight: 50
          }}>Loops</Text>
        </View>

        <ScrollView 
          style={styles.cardsContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: isSearchBarRevealed ? 50 : 10 }
          ]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          bounces={true}
        >
          {conversationData.map((conversation, index) => {
            // Calculate card's position on screen
            // Each card is 320px tall with -170px margin, so effective spacing is 150px
            const cardTop = index * 150; // Position of card relative to scroll content
            const cardCenter = cardTop + 160; // Center of the card (320/2 = 160)
            const screenCenter = scrollY + 400; // Approximate center of visible area
            
            // Calculate relative position (-1 to 1, where 0 is screen center)
            const relativePosition = Math.max(-1, Math.min(1, (cardCenter - screenCenter) / 400));
            
            // Create gradient effect based on screen position
            // Cards at top of screen are lighter, cards at bottom are darker
            const lightness = colorScheme === 'dark' 
              ? 0.3 + (0.3 * -relativePosition) // Dark mode: 0.0 to 0.6
              : 0.5 + (0.4 * -relativePosition); // Light mode: 0.1 to 0.9
            
            const grayValue = Math.round(255 * Math.max(0.1, Math.min(0.9, lightness)));
            const backgroundColor = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
            
            return (
              <View key={conversation.id} style={[
                styles.card,
                { 
                  backgroundColor,
                  zIndex: index + 1,
                  marginTop: index === 0 ? 0 : -170,
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
              </View>
            );
          })}
        </ScrollView>
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
    paddingBottom: 10,
    zIndex: 10,
    position: 'relative',
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
    zIndex: 1,
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
    paddingBottom: 100,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    height: 320,
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
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
    fontFamily: 'Georgia',
  },
  cardDate: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Georgia',
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
    fontFamily: 'Georgia',
  },
});