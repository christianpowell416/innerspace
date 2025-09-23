import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated, Text, Platform } from 'react-native';
import { forceSimulation, forceCollide, forceCenter, forceManyBody } from 'd3-force';
import * as Haptics from 'expo-haptics';
import Hypher from 'hypher';
import english from 'hyphenation.en-us';
import { BlurView } from 'expo-blur';

import { BubbleChartConfig } from '@/lib/types/partsNeedsChart';
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

interface DetailBubbleChartProps {
  data: BubbleData[];
  config: BubbleChartConfig;
  onBubblePress?: (bubble: BubbleData) => void;
  loading?: boolean;
}

export function DetailBubbleChart({ data, config, onBubblePress, loading = false }: DetailBubbleChartProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Initialize hyphenator with English patterns
  const hyphenator = new Hypher(english);

  const [bubbles, setBubbles] = useState<BubbleData[]>([]);

  // Ensure data is always an array
  const safeData = data || [];
  const [selectedBubble, setSelectedBubble] = useState<string | null>(null);
  const [isSimulationComplete, setIsSimulationComplete] = useState(false);
  const simulationRef = useRef<any>(null);

  // Animation values for bubble scaling
  const scaleAnimations = useRef<Map<string, Animated.Value>>(new Map());
  const lastUpdateTime = useRef<number>(0);

  // Store settled bubble positions to prevent reset on re-renders
  const settledPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Calculate optimal bubble scaling to prevent overlaps
  const calculateBubbleScaling = useCallback((bubbles: BubbleData[]): number => {
    if (bubbles.length <= 2) return 1.0; // No scaling needed for 1-2 bubbles

    // Calculate total area needed vs available area
    const availableArea = config.width * config.height;
    const usableArea = availableArea * 0.8; // Use 80% of area to account for margins and spacing

    // Calculate total bubble area with padding
    const totalBubbleArea = bubbles.reduce((sum, bubble) => {
      const paddedRadius = bubble.radius + config.padding * 2;
      return sum + Math.PI * paddedRadius * paddedRadius;
    }, 0);

    // If total area exceeds usable area, calculate scale factor
    if (totalBubbleArea > usableArea) {
      const scaleFactor = Math.sqrt(usableArea / totalBubbleArea);
      // Apply minimum scale to prevent bubbles from becoming too small
      return Math.max(0.6, scaleFactor);
    }

    return 1.0;
  }, [config.width, config.height, config.padding]);

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
    if (safeData.length === 0) {
      setBubbles([]);
      setIsSimulationComplete(false);
      settledPositions.current.clear();
      return;
    }

    // Check if we have settled positions for this exact data set
    const dataKey = safeData.map(d => d.id).sort().join(',');
    const hasSettledPositions = safeData.every(d => settledPositions.current.has(d.id));

    // If simulation is complete and we have settled positions, use them
    if (isSimulationComplete && hasSettledPositions) {
      // Calculate scaling factor for static bubbles too
      const scaleFactor = calculateBubbleScaling(safeData);

      const staticBubbles = safeData.map(bubble => ({
        ...bubble,
        radius: Math.max(config.minRadius, bubble.radius * scaleFactor),
        x: settledPositions.current.get(bubble.id)?.x || config.width / 2,
        y: settledPositions.current.get(bubble.id)?.y || config.height / 2,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
      }));
      setBubbles(staticBubbles);
      return;
    }

    // Reset simulation state when starting new simulation
    setIsSimulationComplete(false);

    // Sort bubbles by size (largest first) for better center positioning
    const sortedData = [...safeData].sort((a, b) => b.radius - a.radius);

    // Calculate optimal scaling factor to prevent overlaps
    const scaleFactor = calculateBubbleScaling(sortedData);

    // Create a copy of the data with initial positions and scaled radii
    const initialBubbles = sortedData.map((bubble, index) => {
      // Apply scaling factor to radius
      const scaledRadius = Math.max(config.minRadius, bubble.radius * scaleFactor);

      // Use settled position if available, otherwise calculate new position
      const settledPos = settledPositions.current.get(bubble.id);
      if (settledPos) {
        return {
          ...bubble,
          radius: scaledRadius,
          x: settledPos.x,
          y: settledPos.y,
          vx: 0,
          vy: 0,
          fx: null,
          fy: null,
        };
      }

      // More uniform initial distribution
      const maxDistance = Math.min(config.width, config.height) * 0.25; // Slightly tighter initial spread
      const distanceFromCenter = Math.min(maxDistance, 15 + (index * 6)); // More controlled spacing
      const angle = (index * Math.PI * 0.618) % (2 * Math.PI); // Golden ratio spiral for better distribution

      return {
        ...bubble,
        radius: scaledRadius,
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

        // Balanced pull strength to maintain centering while allowing spread
        const pullStrength = (bubble.radius / config.maxRadius) * 0.03;

        bubble.vx = (bubble.vx || 0) + dx * pullStrength;
        bubble.vy = (bubble.vy || 0) + dy * pullStrength;
      });
    };

    // Create D3 force simulation optimized for full space usage
    const simulation = forceSimulation(initialBubbles)
      .force('charge', forceManyBody().strength(-25)) // Reduced repulsion for better centering
      .force('center', forceCenter(config.width / 2, config.height / 2).strength(config.centerForce)) // Use config center force
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

      // Store settled positions and mark simulation as complete
      initialBubbles.forEach(bubble => {
        if (bubble.x !== undefined && bubble.y !== undefined) {
          settledPositions.current.set(bubble.id, { x: bubble.x, y: bubble.y });
        }
      });
      setIsSimulationComplete(true);
    });

    simulationRef.current = simulation;

    return () => {
      if (simulation) {
        simulation.stop();
      }
    };
  }, [safeData, config.width, config.height]);

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
      // Safety check for text
      const safeText = text || '';

      // For very small bubbles, just show first word
      if (radius < 12) {
        return [safeText.split(' ')[0] || ''];
      }

      // For small bubbles, try to fit in one line
      if (radius < 18) {
        if (safeText.length <= 8) {
          return [safeText];
        }
        // Try hyphenation for longer words
        const hyphenated = hyphenator.hyphenate(safeText).join('-');
        if (hyphenated.length <= 10) {
          return [hyphenated];
        }
        return [safeText.substring(0, 6) + '…'];
      }

      // For larger bubbles, allow 2 lines
      const words = safeText.split(' ');
      if (words.length === 1) {
        const hyphenated = hyphenator.hyphenate(safeText);
        if (hyphenated.length <= 2) {
          return [safeText];
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
      const safeText = text || '';
      return [safeText.length > 8 ? safeText.substring(0, 7) + '…' : safeText];
    }
  }, [hyphenator]);

  // Calculate font size for compact bubbles
  const getFontSize = useCallback((text: string, radius: number): number => {
    // Safety check for text
    const safeText = text || '';

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
    const estimatedTextWidth = safeText.length * charWidth;

    if (estimatedTextWidth > availableWidth) {
      const scaleFactor = availableWidth / estimatedTextWidth;
      const constrainedSize = Math.max(7, scaledFontSize * Math.max(0.75, scaleFactor));
      return constrainedSize;
    }

    return scaledFontSize;
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { width: config.width, height: config.height }]} />
    );
  }

  return (
    <View style={[styles.container, { width: config.width, height: config.height }]}>
      <View style={[styles.chartContainer, { width: config.width, height: config.height }]}>
        {bubbles && bubbles.length > 0 && bubbles.map((bubble) => {
          const radius = bubble?.radius || 10;
          const bubbleName = bubble?.name || '';
          const fontSize = getFontSize(bubbleName, radius);
          const textLines = wrapText(bubbleName, radius);
          const isSelected = selectedBubble === bubble?.id;

          // Get animation value
          const bubbleId = bubble?.id || `bubble-${Math.random()}`;
          const scaleAnim = scaleAnimations.current.get(bubbleId) || new Animated.Value(1);
          if (!scaleAnimations.current.has(bubbleId)) {
            scaleAnimations.current.set(bubbleId, scaleAnim);
          }

          return (
            <Animated.View
              key={bubbleId}
              style={[
                styles.bubble,
                {
                  left: (bubble?.x || 0) - radius,
                  top: (bubble?.y || 0) - radius,
                  width: radius * 2,
                  height: radius * 2,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <Pressable
                onPress={() => bubble && handleBubblePress(bubble)}
                style={{
                  width: radius * 2,
                  height: radius * 2,
                  borderRadius: radius,
                  borderWidth: 2,
                  borderColor: bubble?.color || '#ccc',
                  shadowColor: '#000',
                  shadowOffset: {
                    width: 0,
                    height: 4,
                  },
                  shadowOpacity: 0.3,
                  shadowRadius: 4.65,
                  elevation: 8,
                  overflow: 'hidden',
                }}
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
                          backgroundColor: `${bubble?.color || '#ccc'}15`,
                          borderWidth: 2,
                          borderColor: `${bubble?.color || '#ccc'}40`,
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
                          backgroundColor: `${bubble?.color || '#ccc'}08`,
                          borderWidth: 1,
                          borderColor: `${bubble?.color || '#ccc'}25`,
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
                            fontWeight: 'bold',
                            textAlign: 'center',
                            lineHeight: fontSize * 1.2,
                          }}
                        >
                          {line}
                        </Text>
                      ))}
                    </View>
                  </BlurView>
                </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  chartContainer: {
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    position: 'absolute',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    opacity: 0.6,
  },
});