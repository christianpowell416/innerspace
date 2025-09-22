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
import { ThemedText } from '@/components/ThemedText';
import { EmotionsFullBubbleChart } from '@/components/EmotionsFullBubbleChart';
import { PartsFullBubbleChart } from '@/components/PartsFullBubbleChart';
import { NeedsFullBubbleChart } from '@/components/NeedsFullBubbleChart';
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
import {
  PartBubbleData,
  NeedBubbleData,
  PartsBubbleChartCallbacks,
  NeedsBubbleChartCallbacks
} from '@/lib/types/partsNeedsChart';
import { generateTestEmotionData, createTestEmotionStats } from '@/lib/utils/testData';
import { generateTestPartsData, generateTestNeedsData } from '@/lib/utils/partsNeedsTestData';
import { EmotionDetailModal } from '@/components/EmotionDetailModal';

const { width: screenWidth } = Dimensions.get('window');

type TabType = 'emotions' | 'parts' | 'needs';
type SortType = 'frequency' | 'intensity' | 'recency';

// Development mode - set to true to use test data
const USE_TEST_DATA = __DEV__ && true; // Set to true for testing

export default function InnerspaceScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [activeTab, setActiveTab] = useState<TabType>('emotions');
  const [sortBy, setSortBy] = useState<SortType>('frequency');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionBubbleData | null>(null);
  const [showEmotionDetail, setShowEmotionDetail] = useState(false);

  // Animation values for tab indicator
  const tabIndicatorPosition = useRef(new Animated.Value(0)).current;

  // Bubble chart state
  const [emotionBubbles, setEmotionBubbles] = useState<EmotionBubbleData[]>([]);
  const [partsBubbles, setPartsBubbles] = useState<PartBubbleData[]>([]);
  const [needsBubbles, setNeedsBubbles] = useState<NeedBubbleData[]>([]);
  const { height: screenHeight } = Dimensions.get('window');
  const availableHeight = screenHeight - 354; // Account for header, stats, tab bar, and padding
  const [bubbleConfig, setBubbleConfig] = useState<EmotionsFullBubbleChartConfig>(
    getDefaultBubbleConfig(screenWidth, availableHeight)
  );
  const [emotionsLoading, setEmotionsLoading] = useState(true);
  const [partsLoading, setPartsLoading] = useState(true);
  const [needsLoading, setNeedsLoading] = useState(true);
  const [emotionStats, setEmotionStats] = useState<any>(null);

  // Function to recalculate bubble sizes based on sort type
  const recalculateBubbleSizes = useCallback((bubbles: EmotionBubbleData[], sortType: SortType, config: BubbleChartConfig) => {
    if (bubbles.length === 0) return bubbles;

    // Extract values for the selected sort type
    const values = bubbles.map(bubble => {
      switch (sortType) {
        case 'intensity':
          return bubble.intensity;
        case 'recency':
          return Date.now() - bubble.lastSeen.getTime(); // Lower = more recent
        case 'frequency':
        default:
          return bubble.frequency;
      }
    });

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // Create custom scaling function
    const createScale = (domain: [number, number], range: [number, number]) => {
      const [domainMin, domainMax] = domain;
      const [rangeMin, rangeMax] = range;
      return (value: number): number => {
        if (domainMax === domainMin) return rangeMin;
        let normalizedValue = (value - domainMin) / (domainMax - domainMin);

        // For recency, invert the scale (more recent = larger)
        if (sortType === 'recency') {
          normalizedValue = 1 - normalizedValue;
        }

        const sqrtValue = Math.sqrt(Math.max(0, normalizedValue));
        return rangeMin + sqrtValue * (rangeMax - rangeMin);
      };
    };

    const radiusScale = createScale([minValue, maxValue], [config.minRadius, config.maxRadius]);

    // Return bubbles with recalculated radii
    return bubbles.map(bubble => {
      let value;
      switch (sortType) {
        case 'intensity':
          value = bubble.intensity;
          break;
        case 'recency':
          value = Date.now() - bubble.lastSeen.getTime();
          break;
        case 'frequency':
        default:
          value = bubble.frequency;
          break;
      }

      return {
        ...bubble,
        radius: radiusScale(value)
      };
    });
  }, []);

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

        const sortedBubbles = recalculateBubbleSizes(testBubbles, sortBy, config);
        setEmotionBubbles(sortedBubbles);
        setEmotionStats(testStats);
      } else {
        // Load real data from Supabase
        const [bubbleData, stats] = await Promise.all([
          createBubbleChartData(config, isDark),
          getEmotionStatistics()
        ]);

        const sortedBubbles = recalculateBubbleSizes(bubbleData, sortBy, config);
        setEmotionBubbles(sortedBubbles);
        setEmotionStats(stats);
      }
    } catch (error) {
      console.error('Error loading emotion data:', error);
      Alert.alert('Error', 'Failed to load emotion data');
    } finally {
      setEmotionsLoading(false);
    }
  }, [isDark, sortBy, recalculateBubbleSizes]);

  // Load parts data
  const loadPartsData = useCallback(async () => {
    try {
      setPartsLoading(true);
      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 300));
      const testParts = generateTestPartsData(12);
      setPartsBubbles(testParts);
    } catch (error) {
      console.error('Error loading parts data:', error);
      Alert.alert('Error', 'Failed to load parts data');
    } finally {
      setPartsLoading(false);
    }
  }, []);

  // Load needs data
  const loadNeedsData = useCallback(async () => {
    try {
      setNeedsLoading(true);
      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 400));
      const testNeeds = generateTestNeedsData(10);
      setNeedsBubbles(testNeeds);
    } catch (error) {
      console.error('Error loading needs data:', error);
      Alert.alert('Error', 'Failed to load needs data');
    } finally {
      setNeedsLoading(false);
    }
  }, []);

  // Load all data
  useEffect(() => {
    loadEmotionData();
    loadPartsData();
    loadNeedsData();
  }, [loadEmotionData, loadPartsData, loadNeedsData]);

  // Handle sort change
  const handleSortChange = (newSortType: SortType) => {
    setSortBy(newSortType);
    setShowSortMenu(false);

    // Recalculate bubble sizes with current data
    if (emotionBubbles.length > 0) {
      const sortedBubbles = recalculateBubbleSizes(emotionBubbles, newSortType, bubbleConfig);
      setEmotionBubbles(sortedBubbles);
    }
  };

  // Bubble chart callbacks
  const bubbleCallbacks: BubbleChartCallbacks = {
    onBubblePress: (bubble) => {
      setSelectedEmotion(bubble);
      setShowEmotionDetail(true);
    },
    onBubbleLongPress: (bubble) => {
      setSelectedEmotion(bubble);
      setShowEmotionDetail(true);
    },
  };

  // Parts bubble chart callbacks
  const partsCallbacks: PartsBubbleChartCallbacks = {
    onBubblePress: (part) => {
      console.log('Parts bubble pressed:', part.name);
      // TODO: Implement parts detail modal
    },
  };

  // Needs bubble chart callbacks
  const needsCallbacks: NeedsBubbleChartCallbacks = {
    onBubblePress: (need) => {
      console.log('Needs bubble pressed:', need.name);
      // TODO: Implement needs detail modal
    },
  };

  const handleTabPress = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);

    // Animate tab indicator
    const tabIndex = tab === 'emotions' ? 0 : tab === 'parts' ? 1 : 2;
    Animated.spring(tabIndicatorPosition, {
      toValue: tabIndex * ((screenWidth - 48) / 3),
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
          <EmotionsFullBubbleChart
            data={emotionBubbles}
            config={bubbleConfig}
            callbacks={bubbleCallbacks}
            loading={emotionsLoading}
          />

          {/* Filter Button */}
          {!emotionsLoading && emotionBubbles.length > 0 && (
            <View style={styles.filterContainer}>
              <Pressable
                style={[styles.filterButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
                onPress={() => setShowSortMenu(!showSortMenu)}
              >
                <IconSymbol
                  name="slider.horizontal.3"
                  size={16}
                  color={isDark ? '#fff' : '#000'}
                />
              </Pressable>

              {/* Sort Menu */}
              {showSortMenu && (
                <View style={[styles.sortMenu, { backgroundColor: isDark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.95)' }]}>
                  <Pressable
                    style={[styles.sortOption, sortBy === 'frequency' && styles.sortOptionActive]}
                    onPress={() => handleSortChange('frequency')}
                  >
                    <ThemedText style={[styles.sortOptionText, { color: isDark ? '#fff' : '#000' }]}>Frequency</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.sortOption, sortBy === 'intensity' && styles.sortOptionActive]}
                    onPress={() => handleSortChange('intensity')}
                  >
                    <ThemedText style={[styles.sortOptionText, { color: isDark ? '#fff' : '#000' }]}>Intensity</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.sortOption, sortBy === 'recency' && styles.sortOptionActive]}
                    onPress={() => handleSortChange('recency')}
                  >
                    <ThemedText style={[styles.sortOptionText, { color: isDark ? '#fff' : '#000' }]}>Recency</ThemedText>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>

      </View>
    </View>
    );
  };

  const renderPartsContent = () => (
    <View style={[styles.tabContent, { width: screenWidth }]}>
      <View style={styles.contentContainer}>
        <View style={styles.chartContainer}>
          <PartsFullBubbleChart
            data={partsBubbles}
            config={bubbleConfig}
            callbacks={partsCallbacks}
            loading={partsLoading}
          />
        </View>
      </View>
    </View>
  );

  const renderNeedsContent = () => (
    <View style={[styles.tabContent, { width: screenWidth }]}>
      <View style={styles.contentContainer}>
        <View style={styles.chartContainer}>
          <NeedsFullBubbleChart
            data={needsBubbles}
            config={bubbleConfig}
            callbacks={needsCallbacks}
            loading={needsLoading}
          />
        </View>
      </View>
    </View>
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerContainer}>
            <Text style={{
              fontSize: 42,
              fontWeight: 'bold',
              color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
              textAlign: 'left',
              fontFamily: 'Georgia',
              lineHeight: 50
            }}>My innerspace</Text>
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
                <ThemedText style={[
                  styles.tabText,
                  activeTab === 'emotions' && styles.tabTextActive,
                  { color: activeTab === 'emotions'
                    ? (isDark ? '#fff' : '#000')
                    : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)')
                  }
                ]}>
                  Emotions
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.tabButton}
                onPress={() => handleTabPress('parts')}
              >
                <ThemedText style={[
                  styles.tabText,
                  activeTab === 'parts' && styles.tabTextActive,
                  { color: activeTab === 'parts'
                    ? (isDark ? '#fff' : '#000')
                    : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)')
                  }
                ]}>
                  Parts
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.tabButton}
                onPress={() => handleTabPress('needs')}
              >
                <ThemedText style={[
                  styles.tabText,
                  activeTab === 'needs' && styles.tabTextActive,
                  { color: activeTab === 'needs'
                    ? (isDark ? '#fff' : '#000')
                    : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)')
                  }
                ]}>
                  Needs
                </ThemedText>
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

      {/* Emotion Detail Modal */}
      <EmotionDetailModal
        visible={showEmotionDetail}
        onClose={() => {
          setShowEmotionDetail(false);
          setSelectedEmotion(null);
        }}
        emotion={selectedEmotion}
      />
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
    alignItems: 'flex-start',
    paddingTop: -5,
    paddingHorizontal: 20,
    paddingBottom: 15,
    zIndex: 100,
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  headerText: {
    letterSpacing: 0.374,
  },
  tabBarContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
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
    fontWeight: '400',
    fontFamily: 'Georgia',
  },
  tabTextActive: {
    fontWeight: '400',
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
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateText: {
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    fontFamily: 'Georgia',
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
  filterContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  filterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    borderRadius: 8,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  sortOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginVertical: 2,
    marginHorizontal: 4,
  },
  sortOptionActive: {
    backgroundColor: 'rgba(0,122,255,0.2)',
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Georgia',
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