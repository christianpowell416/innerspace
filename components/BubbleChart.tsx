import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated, Text } from 'react-native';
import Svg, { Circle, Text as SvgText, G } from 'react-native-svg';
import { forceSimulation, forceCollide, forceCenter, forceManyBody } from 'd3-force';
import * as Haptics from 'expo-haptics';

import {
  EmotionBubbleData,
  BubbleChartConfig,
  BubbleChartCallbacks
} from '@/lib/types/bubbleChart';
import { useColorScheme } from '@/hooks/useColorScheme';

interface BubbleChartProps {
  data: EmotionBubbleData[];
  config: BubbleChartConfig;
  callbacks?: BubbleChartCallbacks;
  loading?: boolean;
}

export function BubbleChart({ data, config, callbacks, loading = false }: BubbleChartProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [bubbles, setBubbles] = useState<EmotionBubbleData[]>([]);
  const [selectedBubble, setSelectedBubble] = useState<string | null>(null);
  const simulationRef = useRef<any>(null);
  const animationRef = useRef<number | null>(null);

  // Animation values for bubble scaling
  const scaleAnimations = useRef<Map<string, Animated.Value>>(new Map());
  const lastUpdateTime = useRef<number>(0);
  const hasLoggedReady = useRef<boolean>(false);

  // Throttled update function to prevent excessive re-renders
  const updateBubbles = useCallback((newBubbles: EmotionBubbleData[]) => {
    const now = Date.now();
    if (now - lastUpdateTime.current > 16) { // ~60fps
      lastUpdateTime.current = now;
      setBubbles([...newBubbles]);
    }
  }, []);

  // Initialize D3 force simulation
  useEffect(() => {
    hasLoggedReady.current = false; // Reset logging flag for new data

    if (data.length === 0) {
      setBubbles([]);
      return;
    }

    // Create a copy of the data with initial positions
    const initialBubbles = data.map(bubble => ({
      ...bubble,
      x: config.width / 2 + (Math.random() - 0.5) * 100,
      y: config.height / 2 + (Math.random() - 0.5) * 100,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
    }));

    console.log('🔄 D3 simulation initialized with', data.length, 'bubbles in', `${config.width}x${config.height}px area`);

    setBubbles(initialBubbles);

    // Create D3 force simulation with boundary constraints
    const simulation = forceSimulation(initialBubbles as any)
      .force('center', forceCenter(config.width / 2, config.height / 2).strength(0.1)) // Stronger center force
      .force('collision', forceCollide((d: any) => d.radius + config.padding).strength(0.5)) // Reduced collision
      .force('charge', forceManyBody().strength(-30)) // Reduced repulsion
      .alphaDecay(0.02)
      .velocityDecay(0.6); // Increased damping

    // Update positions on each tick with boundary constraints
    let tickCount = 0;
    simulation.on('tick', () => {
      // Clamp all bubble positions within SVG bounds
      initialBubbles.forEach(bubble => {
        if (bubble.x !== undefined && bubble.y !== undefined) {
          // Keep bubbles within bounds, accounting for radius
          bubble.x = Math.max(bubble.radius, Math.min(config.width - bubble.radius, bubble.x));
          bubble.y = Math.max(bubble.radius, Math.min(config.height - bubble.radius, bubble.y));
        }
      });

      tickCount++;
      if (tickCount === 1) { // Log only the first tick to confirm simulation starts
        console.log('⚡ D3 simulation started, sample position:',
          initialBubbles[0] ? `${initialBubbles[0].emotion} at (${initialBubbles[0].x?.toFixed(1)}, ${initialBubbles[0].y?.toFixed(1)})` : 'none'
        );
      }
      updateBubbles(initialBubbles);
    });

    simulationRef.current = simulation;

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [data, config, updateBubbles]);

  // Handle bubble press
  const handleBubblePress = (bubble: EmotionBubbleData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSelectedBubble(bubble.id);

    // Animate bubble scale
    const scaleAnim = scaleAnimations.current.get(bubble.id) || new Animated.Value(1);
    scaleAnimations.current.set(bubble.id, scaleAnim);

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();

    // Reset selection after animation
    setTimeout(() => {
      setSelectedBubble(null);
    }, 300);

    callbacks?.onBubblePress?.(bubble);
  };

  // Handle bubble long press
  const handleBubbleLongPress = (bubble: EmotionBubbleData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    callbacks?.onBubbleLongPress?.(bubble);
  };

  // Handle chart background press
  const handleChartPress = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    callbacks?.onChartPress?.(locationX, locationY);
  };

  // Calculate text color for bubble labels
  const getTextColor = (bubbleColor: string): string => {
    // Simple contrast calculation - could be improved
    const hex = bubbleColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#FFFFFF';
  };

  // Get font size based on bubble radius
  const getFontSize = (radius: number): number => {
    return Math.max(10, Math.min(16, radius / 3));
  };

  // Truncate long emotion names
  const truncateText = (text: string, maxLength: number = 12): string => {
    return text.length > maxLength ? text.substring(0, maxLength - 1) + '…' : text;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={[styles.loadingText, { color: isDark ? '#fff' : '#000' }]}>
          Loading emotions...
        </Text>
      </View>
    );
  }

  if (bubbles.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Text style={[styles.emptyText, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }]}>
          No emotions to display
        </Text>
        <Text style={[styles.emptySubtext, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>
          Start a conversation to track your emotions
        </Text>
      </View>
    );
  }

  // Log readiness only once
  if (bubbles.length > 0 && bubbles[0].x !== undefined && !hasLoggedReady.current) {
    hasLoggedReady.current = true;
    console.log('🎯 BubbleChart ready with', bubbles.length, 'positioned bubbles');
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.chartContainer}
        onPress={handleChartPress}
        accessible={false}
      >
        <Svg
          width={config.width}
          height={config.height}
          viewBox={`0 0 ${config.width} ${config.height}`}
        >
          {bubbles.map((bubble) => {
            const isSelected = selectedBubble === bubble.id;
            const x = bubble.x || (config.width / 2);
            const y = bubble.y || (config.height / 2);

            return (
              <G key={bubble.id}>
                {/* Bubble circle */}
                <Circle
                  cx={x}
                  cy={y}
                  r={bubble.radius * (isSelected ? 1.1 : 1)}
                  fill={bubble.color}
                  stroke={isSelected ? (isDark ? '#fff' : '#000') : 'transparent'}
                  strokeWidth={isSelected ? 2 : 0}
                  opacity={0.8}
                  onPress={() => handleBubblePress(bubble)}
                  onLongPress={() => handleBubbleLongPress(bubble)}
                />

                {/* Bubble label */}
                <SvgText
                  x={x}
                  y={y + 2}
                  fontSize={getFontSize(bubble.radius)}
                  fill={getTextColor(bubble.color)}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  fontWeight="600"
                  pointerEvents="none"
                >
                  {truncateText(bubble.emotion)}
                </SvgText>

                {/* Frequency indicator (small circle) */}
                {bubble.frequency > 5 && (
                  <Circle
                    cx={x + bubble.radius * 0.6}
                    cy={y - bubble.radius * 0.6}
                    r={6}
                    fill={isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)'}
                  />
                )}

                {/* Frequency text */}
                {bubble.frequency > 5 && (
                  <SvgText
                    x={x + bubble.radius * 0.6}
                    y={y - bubble.radius * 0.6 + 1}
                    fontSize={8}
                    fill={isDark ? '#000' : '#fff'}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fontWeight="700"
                    pointerEvents="none"
                  >
                    {bubble.frequency}
                  </SvgText>
                )}
              </G>
            );
          })}
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});