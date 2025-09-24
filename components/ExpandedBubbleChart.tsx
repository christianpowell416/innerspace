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

      // Cached bubbles are already visible, no need to set opacity
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

      // Bubbles are already visible, D3 simulation will handle positioning animation
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
      opacityAnimations.current.set(bubbleId, new Animated.Value(1)); // Start visible for immediate D3 animation
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

  // Intelligent text wrapping for circular bubbles (matches FullBubbleChart)
  const wrapTextForBubble = useCallback((text: string, radius: number, fontSize: number): string[] => {
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
  }, [hyphenator]);

  // Smart font sizing based on bubble radius and text length (matches FullBubbleChart)
  const getFontSize = useCallback((text: string, radius: number): number => {
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
          const textLines = wrapTextForBubble(bubbleName, radius, fontSize);
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