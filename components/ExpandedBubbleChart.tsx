import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated, Text, Platform } from 'react-native';
import { forceSimulation, forceCollide, forceCenter, forceManyBody } from 'd3-force';
import * as Haptics from 'expo-haptics';
import Hypher from 'hypher';
import english from 'hyphenation.en-us';

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

interface ExpandedBubbleChartProps {
  data: BubbleData[];
  config: BubbleChartConfig;
  onBubblePress?: (bubble: BubbleData) => void;
  loading?: boolean;
}

export function ExpandedBubbleChart({ data, config, onBubblePress, loading = false }: ExpandedBubbleChartProps) {
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

  // Animation values for bubble scaling and opacity
  const scaleAnimations = useRef<Map<string, Animated.Value>>(new Map());
  const opacityAnimations = useRef<Map<string, Animated.Value>>(new Map());
  const lastUpdateTime = useRef<number>(0);

  // Store settled bubble positions to prevent reset on re-renders
  const settledPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Calculate optimal bubble scaling for expanded square containers
  const calculateBubbleScaling = useCallback((bubbles: BubbleData[]): number => {
    if (bubbles.length <= 2) return 1.0; // No scaling needed for 1-2 bubbles

    // For square containers, use minimum dimension
    const containerSize = Math.min(config.width, config.height);
    const usableArea = containerSize * containerSize * 0.75; // Use 75% of square area

    // Calculate total bubble area with padding
    const totalBubbleArea = bubbles.reduce((sum, bubble) => {
      const paddedRadius = bubble.radius + config.padding * 2;
      return sum + Math.PI * paddedRadius * paddedRadius;
    }, 0);

    // If total area exceeds usable area, calculate scale factor
    if (totalBubbleArea > usableArea) {
      const scaleFactor = Math.sqrt(usableArea / totalBubbleArea);
      // Apply minimum scale to prevent bubbles from becoming too small in expanded view
      return Math.max(0.7, scaleFactor);
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

  // Initialize D3 force simulation optimized for square containers
  useEffect(() => {
    if (safeData.length === 0) {
      setBubbles([]);
      setIsSimulationComplete(false);
      settledPositions.current.clear();
      return;
    }

    // Check if we have settled positions for this exact data set
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

      // Fade in cached bubbles immediately
      staticBubbles.forEach((bubble, index) => {
        const delay = index * 50; // Stagger the fade-in
        setTimeout(() => {
          const opacityAnim = getOpacityAnimation(bubble.id);
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }, delay);
      });
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

      // Tighter initial distribution for square containers
      const maxDistance = Math.min(config.width, config.height) * 0.2; // Tighter for square
      const distanceFromCenter = Math.min(maxDistance, 10 + (index * 4)); // Closer spacing
      const angle = (index * Math.PI * 0.618) % (2 * Math.PI); // Golden ratio spiral

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

    // Custom force to gently guide bubbles toward center
    const centerPullForce = () => {
      initialBubbles.forEach(bubble => {
        if (!bubble.x || !bubble.y) return;

        const centerX = config.width / 2;
        const centerY = config.height / 2;
        const dx = centerX - bubble.x;
        const dy = centerY - bubble.y;

        // Balanced pull strength for expanded view
        const pullStrength = (bubble.radius / config.maxRadius) * 0.04;

        bubble.vx = (bubble.vx || 0) + dx * pullStrength;
        bubble.vy = (bubble.vy || 0) + dy * pullStrength;
      });
    };

    // Create D3 force simulation optimized for square expanded containers
    const simulation = forceSimulation(initialBubbles)
      .force('charge', forceManyBody().strength(-20)) // Moderate repulsion for expanded view
      .force('center', forceCenter(config.width / 2, config.height / 2).strength(config.centerForce)) // Use config center force
      .force('collision', forceCollide().radius((d: any) => d.radius + config.padding).strength(config.collisionStrength))
      .force('centerPull', centerPullForce)
      .velocityDecay(config.velocityDecay)
      .alpha(1.0) // Higher alpha for faster simulation
      .alphaDecay(0.15); // Faster decay for quicker settling

    // Boundary constraint function for square containers
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

      // Fade in all bubbles once positioned
      initialBubbles.forEach((bubble, index) => {
        const delay = index * 50; // Stagger the fade-in
        setTimeout(() => {
          const opacityAnim = getOpacityAnimation(bubble.id);
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }, delay);
      });
    });

    simulationRef.current = simulation;

    return () => {
      if (simulation) {
        simulation.stop();
      }
    };
  }, [safeData, config.width, config.height]);

  // Helper function to get or create opacity animation
  const getOpacityAnimation = useCallback((bubbleId: string): Animated.Value => {
    if (!opacityAnimations.current.has(bubbleId)) {
      opacityAnimations.current.set(bubbleId, new Animated.Value(0)); // Start invisible
    }
    return opacityAnimations.current.get(bubbleId)!;
  }, []);

  // Reset opacity animations when data changes
  useEffect(() => {
    opacityAnimations.current.clear();
    // Initialize opacity animations for new data
    safeData.forEach(bubble => {
      getOpacityAnimation(bubble.id);
    });
  }, [safeData, getOpacityAnimation]);

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

  // Text wrapping optimized for expanded view bubbles
  const wrapText = useCallback((text: string, radius: number): string[] => {
    try {
      // Safety check for text
      const safeText = text || '';

      // For small bubbles in expanded view, show first word
      if (radius < 14) {
        return [safeText.split(' ')[0] || ''];
      }

      // For medium bubbles, try to fit in one line
      if (radius < 22) {
        if (safeText.length <= 10) {
          return [safeText];
        }
        // Try hyphenation for longer words
        const hyphenated = hyphenator.hyphenate(safeText).join('-');
        if (hyphenated.length <= 12) {
          return [hyphenated];
        }
        return [safeText.substring(0, 8) + '…'];
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

  // Calculate font size for expanded view bubbles
  const getFontSize = useCallback((text: string, radius: number): number => {
    // Safety check for text
    const safeText = text || '';

    // Base font size scaling optimized for expanded square containers
    const baseFontSize = Math.max(8, Math.min(18, radius / 2.0)); // Slightly larger for expanded view

    // Progressive scaling for larger bubbles
    let sizeMultiplier = 1.0;
    if (radius > 20) {
      const extraSize = radius - 20;
      sizeMultiplier = 1.0 + (extraSize / 35) * 0.9; // Scale up for larger bubbles
      sizeMultiplier = Math.min(2.2, sizeMultiplier); // Cap at 2.2x
    }

    const scaledFontSize = baseFontSize * sizeMultiplier;

    // Calculate available width
    const availableWidth = radius * 1.7;
    const charWidth = scaledFontSize * 0.45;
    const estimatedTextWidth = safeText.length * charWidth;

    if (estimatedTextWidth > availableWidth) {
      const scaleFactor = availableWidth / estimatedTextWidth;
      const constrainedSize = Math.max(8, scaledFontSize * Math.max(0.8, scaleFactor));
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

          // Get animation values
          const bubbleId = bubble?.id || `bubble-${Math.random()}`;
          const scaleAnim = scaleAnimations.current.get(bubbleId) || new Animated.Value(1);
          const opacityAnim = getOpacityAnimation(bubbleId);
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
                  opacity: opacityAnim,
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
                  <View
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
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.15)'
                        : 'rgba(255, 255, 255, 0.9)',
                      borderWidth: 1,
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(0, 0, 0, 0.1)',
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
                  </View>
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