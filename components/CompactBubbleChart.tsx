import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated, Text, Platform } from 'react-native';
import { forceSimulation, forceCollide, forceCenter, forceManyBody } from 'd3-force';
import * as Haptics from 'expo-haptics';
import Hypher from 'hypher';
import english from 'hyphenation.en-us';
import { BlurView } from 'expo-blur';

import { CompactBubbleChartConfig } from '@/lib/types/partsNeedsChart';
import { useColorScheme } from '@/hooks/useColorScheme';

interface BubbleData {
  id: string;
  name: string;
  frequency: number;
  intensity: number;
  color: string;
  radius: number;
  conversationIds: string[];
  // D3 simulation properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface CompactBubbleChartProps {
  data: BubbleData[];
  config: CompactBubbleChartConfig;
  onBubblePress?: (bubble: BubbleData) => void;
  loading?: boolean;
}

export function CompactBubbleChart({ data, config, onBubblePress, loading = false }: CompactBubbleChartProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Initialize hyphenator with English patterns
  const hyphenator = new Hypher(english);

  const [bubbles, setBubbles] = useState<BubbleData[]>([]);
  const [selectedBubble, setSelectedBubble] = useState<string | null>(null);
  const simulationRef = useRef<any>(null);

  // Animation values for bubble scaling
  const scaleAnimations = useRef<Map<string, Animated.Value>>(new Map());
  const lastUpdateTime = useRef<number>(0);

  // Throttled update function to prevent excessive re-renders
  const updateBubbles = useCallback((newBubbles: BubbleData[]) => {
    const now = Date.now();
    if (now - lastUpdateTime.current > 16) { // ~60fps
      lastUpdateTime.current = now;
      setBubbles([...newBubbles]);
    }
  }, []);

  // Initialize D3 force simulation
  useEffect(() => {
    if (data.length === 0) {
      setBubbles([]);
      return;
    }

    // Sort bubbles by size (largest first) for better center positioning
    const sortedData = [...data].sort((a, b) => b.radius - a.radius);

    // Create a copy of the data with initial positions
    const initialBubbles = sortedData.map((bubble, index) => {
      // Spread bubbles across more of the available space
      const maxDistance = Math.min(config.width, config.height) * 0.3; // Use up to 30% of space for initial spread
      const distanceFromCenter = Math.min(maxDistance, 10 + (index * 8)); // Wider initial spread
      const angle = (index * 1.5) % (2 * Math.PI); // More gradual spiral pattern

      return {
        ...bubble,
        x: config.width / 2 + Math.cos(angle) * distanceFromCenter,
        y: config.height / 2 + Math.sin(angle) * distanceFromCenter,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
      };
    });

    setBubbles(initialBubbles);

    // Custom force to gently guide bubbles toward center while allowing spread
    const centerPullForce = () => {
      initialBubbles.forEach(bubble => {
        if (!bubble.x || !bubble.y) return;

        const centerX = config.width / 2;
        const centerY = config.height / 2;
        const dx = centerX - bubble.x;
        const dy = centerY - bubble.y;

        // Much gentler pull to allow better space usage
        const pullStrength = (bubble.radius / config.maxRadius) * 0.01;

        bubble.vx = (bubble.vx || 0) + dx * pullStrength;
        bubble.vy = (bubble.vy || 0) + dy * pullStrength;
      });
    };

    // Create D3 force simulation optimized for full space usage
    const simulation = forceSimulation(initialBubbles)
      .force('charge', forceManyBody().strength(-35)) // Increased repulsion to spread bubbles out
      .force('center', forceCenter(config.width / 2, config.height / 2).strength(0.05)) // Weaker center force
      .force('collision', forceCollide().radius((d: any) => d.radius + config.padding).strength(config.collisionStrength))
      .force('centerPull', centerPullForce)
      .velocityDecay(config.velocityDecay)
      .alpha(0.8) // Higher alpha for quicker settling
      .alphaDecay(0.05); // Faster decay

    // Boundary constraint function
    const applyBoundaryConstraints = () => {
      initialBubbles.forEach(bubble => {
        if (!bubble.x || !bubble.y) return;

        const minX = bubble.radius + config.padding;
        const maxX = config.width - bubble.radius - config.padding;
        const minY = bubble.radius + config.padding;
        const maxY = config.height - bubble.radius - config.padding;

        if (bubble.x < minX) {
          bubble.x = minX;
          bubble.vx = Math.abs(bubble.vx || 0) * 0.3;
        } else if (bubble.x > maxX) {
          bubble.x = maxX;
          bubble.vx = -Math.abs(bubble.vx || 0) * 0.3;
        }

        if (bubble.y < minY) {
          bubble.y = minY;
          bubble.vy = Math.abs(bubble.vy || 0) * 0.3;
        } else if (bubble.y > maxY) {
          bubble.y = maxY;
          bubble.vy = -Math.abs(bubble.vy || 0) * 0.3;
        }
      });
    };

    let tickCount = 0;
    simulation.on('tick', () => {
      applyBoundaryConstraints();
      tickCount++;
      updateBubbles(initialBubbles);
    });

    simulation.on('end', () => {
      applyBoundaryConstraints();
      updateBubbles(initialBubbles);
    });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
  }, [data, config, updateBubbles]);

  // Handle bubble press
  const handleBubblePress = useCallback((bubble: BubbleData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSelectedBubble(bubble.id);

    // Create or get animation value
    if (!scaleAnimations.current.has(bubble.id)) {
      scaleAnimations.current.set(bubble.id, new Animated.Value(1));
    }

    const scaleAnim = scaleAnimations.current.get(bubble.id)!;

    // Scale animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.15,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedBubble(null);
    });

    onBubblePress?.(bubble);
  }, [onBubblePress]);

  // Text wrapping for compact bubbles
  const wrapText = useCallback((text: string, radius: number): string[] => {
    try {
      // For very small bubbles, just show first word
      if (radius < 12) {
        return [text.split(' ')[0]];
      }

      // For small bubbles, try to fit in one line
      if (radius < 18) {
        if (text.length <= 8) {
          return [text];
        }
        // Try hyphenation for longer words
        const hyphenated = hyphenator.hyphenate(text).join('-');
        if (hyphenated.length <= 10) {
          return [hyphenated];
        }
        return [text.substring(0, 6) + '…'];
      }

      // For larger bubbles, allow 2 lines
      const words = text.split(' ');
      if (words.length === 1) {
        const hyphenated = hyphenator.hyphenate(text);
        if (hyphenated.length <= 2) {
          return [text];
        }
        const midpoint = Math.ceil(hyphenated.length / 2);
        return [
          hyphenated.slice(0, midpoint).join('') + '-',
          hyphenated.slice(midpoint).join('')
        ];
      }

      // Multiple words - split across lines
      const midpoint = Math.ceil(words.length / 2);
      return [
        words.slice(0, midpoint).join(' '),
        words.slice(midpoint).join(' ')
      ];
    } catch (error) {
      // Fallback to simple truncation
      return [text.length > 8 ? text.substring(0, 7) + '…' : text];
    }
  }, [hyphenator]);

  // Calculate font size for compact bubbles
  const getFontSize = useCallback((text: string, radius: number): number => {
    // More aggressive base font size scaling with radius
    const baseFontSize = Math.max(7, Math.min(16, radius / 2.2));

    // Enhanced progressive scaling for larger bubbles
    let sizeMultiplier = 1.0;
    if (radius > 18) {
      // For bubbles larger than minimum size, scale more aggressively
      const extraSize = radius - 18;
      sizeMultiplier = 1.0 + (extraSize / 30) * 0.8; // Scale up to 80% more for very large bubbles
      sizeMultiplier = Math.min(2.0, sizeMultiplier); // Cap at 2x the base size
    }

    const scaledFontSize = baseFontSize * sizeMultiplier;

    // Calculate available width with more generous spacing for larger bubbles
    const availableWidth = radius * 1.6;
    const charWidth = scaledFontSize * 0.45;
    const estimatedTextWidth = text.length * charWidth;

    if (estimatedTextWidth > availableWidth) {
      const scaleFactor = availableWidth / estimatedTextWidth;
      const constrainedSize = Math.max(7, scaledFontSize * Math.max(0.75, scaleFactor));
      return constrainedSize;
    }

    return scaledFontSize;
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { width: config.width, height: config.height }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: isDark ? '#fff' : '#000' }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: config.width, height: config.height }]}>
      <View style={[styles.chartContainer, { width: config.width, height: config.height }]}>
        {bubbles.map((bubble) => {
          const radius = bubble.radius;
          const fontSize = getFontSize(bubble.name, radius);
          const textLines = wrapText(bubble.name, radius);
          const isSelected = selectedBubble === bubble.id;

          // Get animation value
          const scaleAnim = scaleAnimations.current.get(bubble.id) || new Animated.Value(1);
          if (!scaleAnimations.current.has(bubble.id)) {
            scaleAnimations.current.set(bubble.id, scaleAnim);
          }

          return (
            <Animated.View
              key={bubble.id}
              style={[
                styles.bubble,
                {
                  left: (bubble.x || 0) - radius,
                  top: (bubble.y || 0) - radius,
                  width: radius * 2,
                  height: radius * 2,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <Pressable
                onPress={() => handleBubblePress(bubble)}
                style={[
                  styles.bubblePressable,
                  {
                    width: radius * 2,
                    height: radius * 2,
                    borderRadius: radius,
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOffset: {
                      width: 0,
                      height: 1,
                    },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                  },
                ]}
              >
                {/* Border outline */}
                <View
                  style={[
                    styles.borderOutline,
                    {
                      position: 'absolute',
                      width: radius * 2,
                      height: radius * 2,
                      borderRadius: radius,
                      borderWidth: 2,
                      borderColor: bubble.color,
                      zIndex: 2,
                    },
                  ]}
                />

                {/* Background blur view */}
                <BlurView
                  intensity={15}
                  tint="systemMaterial"
                  style={[
                    styles.blurContainer,
                    {
                      position: 'absolute',
                      width: radius * 2 - 4,
                      height: radius * 2 - 4,
                      borderRadius: radius - 2,
                      top: 2,
                      left: 2,
                      zIndex: 0,
                      overflow: 'hidden',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.bubbleContent,
                      {
                        width: radius * 2 - 4,
                        height: radius * 2 - 4,
                        borderRadius: radius - 2,
                        backgroundColor: 'transparent',
                      },
                    ]}
                  >
                    {/* Bubble label */}
                    <View style={[styles.labelContainer, { zIndex: 1 }]}>
                      {textLines.map((line, index) => (
                        <Text
                          key={index}
                          style={{
                            fontSize,
                            color: isDark ? '#FFFFFF' : '#000000',
                            fontWeight: 'normal',
                            fontFamily: 'Georgia',
                            textAlign: 'center',
                          }}
                        >
                          {line}
                        </Text>
                      ))}
                    </View>
                  </View>
                </BlurView>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  chartContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
  },
  bubblePressable: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  borderOutline: {
    backgroundColor: 'transparent',
  },
  blurContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    fontFamily: 'Georgia',
    opacity: 0.6,
  },
});