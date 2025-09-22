import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated, Text, Platform } from 'react-native';
import { forceSimulation, forceCollide, forceCenter, forceManyBody } from 'd3-force';
import * as Haptics from 'expo-haptics';
import Hypher from 'hypher';
import english from 'hyphenation.en-us';
import { BlurView } from 'expo-blur';

import {
  BubbleChartConfig
} from '@/lib/types/bubbleChart';
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

interface FullBubbleChartProps {
  data: BubbleData[];
  config: BubbleChartConfig;
  onBubblePress?: (bubble: BubbleData) => void;
  loading?: boolean;
}

export function FullBubbleChart({ data, config, onBubblePress, loading = false }: FullBubbleChartProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Initialize hyphenator with English patterns
  const hyphenator = new Hypher(english);

  const [bubbles, setBubbles] = useState<BubbleData[]>([]);
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
  const handleBubblePress = (bubble: BubbleData) => {
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

    onBubblePress?.(bubble);
  };

  // Handle bubble long press
  const handleBubbleLongPress = (bubble: BubbleData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // onBubbleLongPress could be added as a prop if needed
  };

  // Handle chart background press
  const handleChartPress = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    // onChartPress could be added as a prop if needed
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
    // Safety check for text parameter
    const safeText = text || '';

    // Base font size from radius
    const baseFontSize = Math.max(10, Math.min(16, radius / 3));

    // Progressive size multiplier for larger bubbles
    // Small bubbles (≤30): no change, Large bubbles (≥46): 100% larger
    const sizeMultiplier = radius <= 30
      ? 1.0
      : Math.min(2.0, 1.0 + ((radius - 30) / 60) * 1.0);

    const scaledFontSize = baseFontSize * sizeMultiplier;

    // For larger bubbles, be much more generous with space to preserve bigger fonts
    // Small bubbles: normal constraint, Large bubbles: very generous constraint
    const isLargeBubble = radius > 40;
    const availableWidth = isLargeBubble ? radius * 2.2 : radius * 1.7;

    // Estimate character width for Georgia font - more generous for large bubbles
    const charWidth = scaledFontSize * (isLargeBubble ? 0.35 : 0.45);
    const estimatedTextWidth = safeText.length * charWidth;

    // Only apply constraints if text is significantly too wide
    if (estimatedTextWidth > availableWidth) {
      const scaleFactor = availableWidth / estimatedTextWidth;

      // For large bubbles, only apply mild constraint to preserve bigger fonts
      const minConstraintFactor = isLargeBubble ? 0.85 : 0.6;
      const finalScaleFactor = Math.max(minConstraintFactor, scaleFactor);

      const constrainedSize = Math.max(8, scaledFontSize * finalScaleFactor);


      return constrainedSize;
    }


    return scaledFontSize;
  };

  // Intelligent text wrapping for circular bubbles
  const wrapTextForBubble = (text: string, radius: number, fontSize: number): string[] => {
    try {
      // Safety check for text parameter
      const safeText = text || '';

      // Calculate usable width (70% of diameter to account for circular shape)
      const usableWidth = radius * 1.4;

      // Estimate character width (rough approximation for Georgia font)
      const charWidth = fontSize * 0.5;
      const maxCharsPerLine = Math.floor(usableWidth / charWidth);

      // If text fits on one line, return as-is
      if (safeText.length <= maxCharsPerLine) {
        return [safeText];
      }

      // Use hyphenation for better word breaks
      const hyphenatedText = hyphenator.hyphenateText(safeText);
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
      // Fallback to simple truncation
      const safeText = text || '';
      return [safeText.length > 12 ? safeText.substring(0, 11) + '…' : safeText];
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
                  borderWidth: 2,
                  borderColor: bubble.color,
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
                  {/* Inner glow effect for iOS to match web */}
                  {Platform.OS !== 'web' && (
                    <>
                      {/* Primary inner glow */}
                      <View
                        style={{
                          position: 'absolute',
                          width: radius * 2 - 8,
                          height: radius * 2 - 8,
                          borderRadius: radius - 4,
                          backgroundColor: `${bubble.color}15`,
                          borderWidth: 2,
                          borderColor: `${bubble.color}40`,
                          left: '50%',
                          top: '50%',
                          transform: [
                            { translateX: -(radius - 4) },
                            { translateY: -(radius - 4) }
                          ],
                        }}
                      />
                      {/* Secondary inner glow for more intensity */}
                      <View
                        style={{
                          position: 'absolute',
                          width: radius * 2 - 12,
                          height: radius * 2 - 12,
                          borderRadius: radius - 6,
                          backgroundColor: `${bubble.color}08`,
                          borderWidth: 1,
                          borderColor: `${bubble.color}25`,
                          left: '50%',
                          top: '50%',
                          transform: [
                            { translateX: -(radius - 6) },
                            { translateY: -(radius - 6) }
                          ],
                        }}
                      />
                    </>
                  )}
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
                      backgroundColor: 'transparent',
                    }}
                  >
                  {/* Bubble label */}
                  {(() => {
                    const bubbleName = bubble.name || '';
                    const fontSize = getFontSize(bubble.radius, bubbleName);
                    const textLines = wrapTextForBubble(bubbleName, bubble.radius, fontSize);
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
                              color: isDark ? '#FFFFFF' : '#000000',
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