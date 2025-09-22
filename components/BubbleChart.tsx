import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated, Text, Platform } from 'react-native';
import { forceSimulation, forceCollide, forceCenter, forceManyBody } from 'd3-force';
import * as Haptics from 'expo-haptics';
import Hypher from 'hypher';
import english from 'hyphenation.en-us';
import { BlurView } from 'expo-blur';

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

  // Initialize hyphenator with English patterns
  const hyphenator = new Hypher(english);

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

    // Sort bubbles by size (largest first) for better center positioning
    const sortedData = [...data].sort((a, b) => b.radius - a.radius);

    // Create a copy of the data with initial positions
    const initialBubbles = sortedData.map((bubble, index) => {
      // Position larger bubbles closer to center
      const distanceFromCenter = Math.min(100, 20 + (index * 8));
      const angle = (index * 2.4) % (2 * Math.PI); // Spiral pattern

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

    console.log('🔄 D3 simulation initialized with', data.length, 'bubbles in', `${config.width}x${config.height}px area`);

    setBubbles(initialBubbles);

    // Custom force to pull larger bubbles toward center
    const centerPullForce = () => {
      initialBubbles.forEach(bubble => {
        if (!bubble.x || !bubble.y) return;

        // Calculate distance from center
        const centerX = config.width / 2;
        const centerY = config.height / 2;
        const dx = centerX - bubble.x;
        const dy = centerY - bubble.y;

        // Stronger pull for larger bubbles (higher frequency emotions)
        const pullStrength = (bubble.radius / config.maxRadius) * 0.02;

        bubble.vx = (bubble.vx || 0) + dx * pullStrength;
        bubble.vy = (bubble.vy || 0) + dy * pullStrength;
      });
    };

    // Create D3 force simulation with boundary constraints
    const simulation = forceSimulation(initialBubbles as any)
      .force('center', forceCenter(config.width / 2, config.height / 2).strength(0.05)) // Reduced general center force
      .force('collision', forceCollide((d: any) => d.radius + config.padding).strength(0.5))
      .force('charge', forceManyBody().strength(-20)) // Reduced repulsion
      .force('centerPull', centerPullForce) // Custom center pull for large bubbles
      .alphaDecay(0.015) // Slower decay for more settling time
      .velocityDecay(0.7); // Higher damping for stability

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

  // Smart font sizing based on bubble radius and text length
  const getFontSize = (radius: number, text: string): number => {
    // Base font size from radius
    const baseFontSize = Math.max(10, Math.min(16, radius / 3));

    // Progressive size multiplier for larger bubbles
    // Small bubbles (≤30): no change, Large bubbles (≥46): 35% larger
    const sizeMultiplier = radius <= 30
      ? 1.0
      : Math.min(1.35, 1.0 + ((radius - 30) / 60) * 0.35);

    const scaledFontSize = baseFontSize * sizeMultiplier;

    // Calculate available width (70% of diameter for circular shape)
    const availableWidth = radius * 1.4;

    // Estimate character width for Georgia font
    const charWidth = scaledFontSize * 0.5;
    const estimatedTextWidth = text.length * charWidth;

    // If text is too wide, scale down the font
    if (estimatedTextWidth > availableWidth) {
      const scaleFactor = availableWidth / estimatedTextWidth;
      return Math.max(8, scaledFontSize * scaleFactor); // Minimum 8px font
    }

    return scaledFontSize;
  };

  // Intelligent text wrapping for circular bubbles
  const wrapTextForBubble = (text: string, radius: number, fontSize: number): string[] => {
    try {
      // Calculate usable width (70% of diameter to account for circular shape)
      const usableWidth = radius * 1.4;

      // Estimate character width (rough approximation for Georgia font)
      const charWidth = fontSize * 0.5;
      const maxCharsPerLine = Math.floor(usableWidth / charWidth);

      // If text fits on one line, return as-is
      if (text.length <= maxCharsPerLine) {
        return [text];
      }

      // Use hyphenation for better word breaks
      const hyphenatedText = hyphenator.hyphenateText(text);
      const words = hyphenatedText.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;

        if (testLine.length <= maxCharsPerLine) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            // Word is too long for one line, break it
            if (word.length > maxCharsPerLine) {
              lines.push(word.substring(0, maxCharsPerLine - 1) + '-');
              currentLine = word.substring(maxCharsPerLine - 1);
            } else {
              currentLine = word;
            }
          }
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      // Limit to 2 lines for bubble readability
      if (lines.length > 2) {
        lines[1] = lines[1].substring(0, Math.max(0, maxCharsPerLine - 1)) + '…';
        return lines.slice(0, 2);
      }

      return lines;
    } catch (error) {
      console.warn('Text wrapping failed, using fallback:', error);
      // Fallback to simple truncation
      return [text.length > 12 ? text.substring(0, 11) + '…' : text];
    }
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
        <View
          style={{
            width: config.width,
            height: config.height,
            position: 'relative',
          }}
        >
          {bubbles.map((bubble) => {
            const isSelected = selectedBubble === bubble.id;
            const x = bubble.x || (config.width / 2);
            const y = bubble.y || (config.height / 2);
            const radius = bubble.radius * (isSelected ? 1.1 : 1);

            return (
              <Pressable
                key={bubble.id}
                style={{
                  position: 'absolute',
                  left: x - radius,
                  top: y - radius,
                  width: radius * 2,
                  height: radius * 2,
                  borderRadius: radius,
                  borderWidth: 3,
                  borderColor: isSelected
                    ? 'rgba(46, 125, 50, 0.5)'
                    : isDark
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'rgba(0, 0, 0, 0.15)',
                  shadowColor: '#000',
                  shadowOffset: {
                    width: 0,
                    height: 4,
                  },
                  shadowOpacity: 0.3,
                  shadowRadius: 4.65,
                  elevation: 8,
                  overflow: 'hidden', // Ensure circular clipping at container level
                }}
                onPress={() => handleBubblePress(bubble)}
                onLongPress={() => handleBubbleLongPress(bubble)}
              >
                <View style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <BlurView
                    intensity={20}
                    tint="systemMaterial"
                    style={{
                      position: 'absolute',
                      width: (radius * 2) + 6,
                      height: (radius * 2) + 6,
                      borderRadius: radius + 3,
                      left: '50%',
                      top: '50%',
                      transform: [
                        { translateX: -(radius + 3) },
                        { translateY: -(radius + 3) }
                      ],
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: isSelected
                        ? 'rgba(46, 125, 50, 0.6)'
                        : `${bubble.color}50`, // Original opacity with blur
                    }}
                  >
                  {/* Bubble label */}
                  {(() => {
                    const fontSize = getFontSize(bubble.radius, bubble.emotion);
                    const textLines = wrapTextForBubble(bubble.emotion, bubble.radius, fontSize);
                    const lineHeight = fontSize * 1.2;

                    return (
                      <View style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {textLines.map((line, index) => (
                          <Text
                            key={index}
                            style={{
                              fontSize,
                              color: '#FFFFFF',
                              fontWeight: 'normal',
                              fontFamily: 'Georgia',
                              textAlign: 'center',
                              lineHeight,
                            }}
                          >
                            {line}
                          </Text>
                        ))}
                      </View>
                    );
                  })()}
                  </BlurView>
                </View>
              </Pressable>
            );
          })}
        </View>
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
    fontFamily: 'Georgia',
  },
  emptyContainer: {
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Georgia',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Georgia',
  },
});