import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Animated,
  Dimensions,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { GradientBackground } from '@/components/ui/GradientBackground';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { BubbleChart } from '@/components/BubbleChart';
import {
  createBubbleChartData,
  getDefaultBubbleConfig,
  getEmotionStatistics
} from '@/lib/services/emotions';
import {
  EmotionBubbleData,
  BubbleChartConfig,
  BubbleChartCallbacks
} from '@/lib/types/bubbleChart';
import { generateTestEmotionData, createTestEmotionStats } from '@/lib/utils/testData';

const { width: screenWidth } = Dimensions.get('window');

type TabType = 'emotions' | 'parts' | 'needs';

// Development mode - set to true to use test data
const USE_TEST_DATA = __DEV__ && true; // Set to true for testing

export default function InnerspaceScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [activeTab, setActiveTab] = useState<TabType>('emotions');

  // Animation values for tab indicator
  const tabIndicatorPosition = useRef(new Animated.Value(0)).current;

  // Bubble chart state
  const [emotionBubbles, setEmotionBubbles] = useState<EmotionBubbleData[]>([]);
  const { height: screenHeight } = Dimensions.get('window');
  const availableHeight = screenHeight - 354; // Account for header, stats, tab bar, and padding
  const [bubbleConfig, setBubbleConfig] = useState<BubbleChartConfig>(
    getDefaultBubbleConfig(screenWidth, availableHeight)
  );
  const [emotionsLoading, setEmotionsLoading] = useState(true);
  const [emotionStats, setEmotionStats] = useState<any>(null);

  const loadEmotionData = useCallback(async () => {
    try {
      setEmotionsLoading(true);

      // Update bubble config to use available screen height
      const { height: screenHeight } = Dimensions.get('window');
      // Account for header, stats, tab bar, and padding
      const availableHeight = screenHeight - 354;
      const config = getDefaultBubbleConfig(screenWidth, availableHeight);
      setBubbleConfig(config);

      if (USE_TEST_DATA) {
        // Use test data for development
        console.log('🧪 Using test emotion data for development');
        const testBubbles = generateTestEmotionData(15);
        const testStats = createTestEmotionStats(testBubbles);
        console.log('📊 Generated test bubbles:', testBubbles.length, testBubbles.slice(0, 2));

        // Simulate loading delay
        await new Promise(resolve => setTimeout(resolve, 500));

        setEmotionBubbles(testBubbles);
        setEmotionStats(testStats);
      } else {
        // Load real data from Supabase
        const [bubbleData, stats] = await Promise.all([
          createBubbleChartData(config, isDark),
          getEmotionStatistics()
        ]);

        setEmotionBubbles(bubbleData);
        setEmotionStats(stats);
      }
    } catch (error) {
      console.error('Error loading emotion data:', error);
      Alert.alert('Error', 'Failed to load emotion data');
    } finally {
      setEmotionsLoading(false);
    }
  }, [isDark]);

  // Load emotion data
  useEffect(() => {
    loadEmotionData();
  }, [loadEmotionData]);

  // Bubble chart callbacks
  const bubbleCallbacks: BubbleChartCallbacks = {
    onBubblePress: (bubble) => {
      Alert.alert(
        bubble.emotion,
        `Mentioned ${bubble.frequency} times\nAverage intensity: ${bubble.intensity.toFixed(1)}\nLast seen: ${bubble.lastSeen.toLocaleDateString()}`,
        [{ text: 'OK' }]
      );
    },
    onBubbleLongPress: (bubble) => {
      Alert.alert(
        'Emotion Details',
        `${bubble.emotion}\n\nFrequency: ${bubble.frequency}\nIntensity: ${bubble.intensity.toFixed(1)}\nCategory: ${bubble.category}\nConversations: ${bubble.conversationIds.length}`,
        [{ text: 'OK' }]
      );
    },
  };

  const handleTabPress = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);

    // Animate tab indicator
    const tabIndex = tab === 'emotions' ? 0 : tab === 'parts' ? 1 : 2;
    Animated.spring(tabIndicatorPosition, {
      toValue: tabIndex * (screenWidth / 3),
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();
  };


  const renderEmotionsContent = () => {
    console.log('🎨 Rendering emotions content, bubbles:', emotionBubbles.length, 'loading:', emotionsLoading);
    return (
      <View style={[styles.tabContent, { width: screenWidth }]}>
        <View style={styles.contentContainer}>

        {/* Bubble Chart */}
        <View style={styles.chartContainer}>
          <BubbleChart
            data={emotionBubbles}
            config={bubbleConfig}
            callbacks={bubbleCallbacks}
            loading={emotionsLoading}
          />

          {/* Refresh Button */}
          {!emotionsLoading && emotionBubbles.length > 0 && (
            <Pressable
              style={[styles.refreshButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
              onPress={loadEmotionData}
            >
              <IconSymbol
                name="arrow.clockwise"
                size={16}
                color={isDark ? '#fff' : '#000'}
              />
            </Pressable>
          )}
        </View>

      </View>
    </View>
    );
  };

  const renderPartsContent = () => (
    <View style={[styles.tabContent, { width: screenWidth }]}>
      <View style={styles.contentContainer}>
        <View style={styles.emptyStateContainer}>
          <IconSymbol
            name="person.3.fill"
            size={64}
            color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}
          />
          <Text style={[styles.emptyStateTitle, { color: isDark ? '#fff' : '#000' }]}>
            Your Parts
          </Text>
          <Text style={[styles.emptyStateText, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }]}>
            Identify your internal family system
          </Text>
          <Text style={[styles.emptyStateSubtext, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>
            Managers, Firefighters, and Exiles
          </Text>
        </View>
      </View>
    </View>
  );

  const renderNeedsContent = () => (
    <View style={[styles.tabContent, { width: screenWidth }]}>
      <View style={styles.contentContainer}>
        <View style={styles.emptyStateContainer}>
          <IconSymbol
            name="star.fill"
            size={64}
            color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}
          />
          <Text style={[styles.emptyStateTitle, { color: isDark ? '#fff' : '#000' }]}>
            Your Needs
          </Text>
          <Text style={[styles.emptyStateText, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }]}>
            Understand your core human needs
          </Text>
          <Text style={[styles.emptyStateSubtext, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>
            Safety, Connection, Autonomy, and more
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerContainer}>
            <Text style={[styles.headerText, { color: isDark ? '#fff' : '#000' }]}>
              My Innerspace
            </Text>
          </View>

          {/* Tab Bar */}
          <View style={styles.tabBarContainer}>
            <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
              {/* Tab Indicator */}
              <Animated.View
                style={[
                  styles.tabIndicator,
                  {
                    transform: [{ translateX: tabIndicatorPosition }],
                    backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                  },
                ]}
              />

              {/* Tab Buttons */}
              <Pressable
                style={styles.tabButton}
                onPress={() => handleTabPress('emotions')}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'emotions' && styles.tabTextActive,
                  { color: activeTab === 'emotions'
                    ? (isDark ? '#fff' : '#000')
                    : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)')
                  }
                ]}>
                  Emotions
                </Text>
              </Pressable>

              <Pressable
                style={styles.tabButton}
                onPress={() => handleTabPress('parts')}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'parts' && styles.tabTextActive,
                  { color: activeTab === 'parts'
                    ? (isDark ? '#fff' : '#000')
                    : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)')
                  }
                ]}>
                  Parts
                </Text>
              </Pressable>

              <Pressable
                style={styles.tabButton}
                onPress={() => handleTabPress('needs')}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'needs' && styles.tabTextActive,
                  { color: activeTab === 'needs'
                    ? (isDark ? '#fff' : '#000')
                    : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)')
                  }
                ]}>
                  Needs
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Tab Content */}
          <View style={styles.contentContainer}>
            {activeTab === 'emotions' && renderEmotionsContent()}
            {activeTab === 'parts' && renderPartsContent()}
            {activeTab === 'needs' && renderNeedsContent()}
          </View>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerText: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.374,
  },
  tabBarContainer: {
    paddingHorizontal: 20,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    width: (screenWidth - 48) / 3, // Account for padding
    height: 40,
    borderRadius: 12,
    top: 4,
    left: 4,
  },
  tabButton: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  tabContent: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  statsContainer: {
    paddingBottom: 20,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartContainer: {
    flex: 1,
    position: 'relative',
    marginTop: 20, // Space from statistics header
    paddingBottom: 90, // Space for bottom tab bar
  },
  refreshButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  insightContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.7,
  },
  insightEmotion: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  insightDetail: {
    fontSize: 12,
    fontWeight: '500',
  },
});