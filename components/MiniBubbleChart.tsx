import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated, Text } from 'react-native';
import { forceSimulation, forceCollide, forceCenter, forceManyBody } from 'd3-force';
import * as Haptics from 'expo-haptics';

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

interface MiniBubbleChartProps {
  data: BubbleData[];
  config: BubbleChartConfig;
  onBubblePress?: (bubble: BubbleData) => void;
  loading?: boolean;
}

export function MiniBubbleChart({ data, config, onBubblePress, loading = false }: MiniBubbleChartProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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

  // Calculate optimal bubble scaling for mini charts (more aggressive scaling)
  const calculateBubbleScaling = useCallback((bubbles: BubbleData[]): number => {
    if (bubbles.length <= 1) return 0.8; // Smaller scaling for mini charts

    // Calculate total area needed vs available area
    const availableArea = config.width * config.height;
    const usableArea = availableArea * 0.6; // Use less area for mini charts

    // Calculate total bubble area with padding
    const totalBubbleArea = bubbles.reduce((sum, bubble) => {
      const paddedRadius = bubble.radius + config.padding * 2;
      return sum + Math.PI * paddedRadius * paddedRadius;
    }, 0);

    // If total area exceeds usable area, calculate scale factor
    if (totalBubbleArea > usableArea) {
      const scaleFactor = Math.sqrt(usableArea / totalBubbleArea);
      // Apply more aggressive minimum scale for mini charts
      return Math.max(0.3, scaleFactor);
    }

    return 0.8; // Default smaller scale for mini charts
  }, [config.width, config.height, config.padding]);

  // Throttled update function to prevent excessive re-renders
  const updateBubbles = useCallback((newBubbles: BubbleData[]) => {
    const now = Date.now();
    if (now - lastUpdateTime.current > 16) { // ~60fps
      lastUpdateTime.current = now;
      setBubbles([...newBubbles]);
    }
  }, []);

  // Initialize D3 force simulation optimized for mini charts
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
        radius: Math.max(config.minRadius * 0.6, bubble.radius * scaleFactor), // Smaller min radius for mini
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
      // Apply scaling factor to radius with mini chart adjustments
      const scaledRadius = Math.max(config.minRadius * 0.6, bubble.radius * scaleFactor);

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

      // Tighter initial distribution for mini charts
      const maxDistance = Math.min(config.width, config.height) * 0.15; // Much tighter spread
      const distanceFromCenter = Math.min(maxDistance, 8 + (index * 3)); // Closer spacing
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

        // Stronger pull for mini charts
        const pullStrength = (bubble.radius / config.maxRadius) * 0.05;

        bubble.vx = (bubble.vx || 0) + dx * pullStrength;
        bubble.vy = (bubble.vy || 0) + dy * pullStrength;
      });
    };

    // Create D3 force simulation optimized for mini charts
    const simulation = forceSimulation(initialBubbles)
      .force('charge', forceManyBody().strength(-15)) // Reduced repulsion for tighter packing
      .force('center', forceCenter(config.width / 2, config.height / 2).strength(0.2)) // Stronger center force
      .force('collision', forceCollide().radius((d: any) => d.radius + config.padding * 0.5).strength(config.collisionStrength))
      .force('centerPull', centerPullForce)
      .velocityDecay(config.velocityDecay)
      .alpha(0.6) // Lower alpha for quicker settling
      .alphaDecay(0.08); // Faster decay

    // Boundary constraint function for mini charts
    const applyBoundaryConstraints = () => {
      initialBubbles.forEach(bubble => {
        if (!bubble.x || !bubble.y) return;

        const minX = bubble.radius + config.padding * 0.5;
        const maxX = config.width - bubble.radius - config.padding * 0.5;
        const minY = bubble.radius + config.padding * 0.5;
        const maxY = config.height - bubble.radius - config.padding * 0.5;

        if (bubble.x < minX) {
          bubble.x = minX;
          bubble.vx = Math.abs(bubble.vx || 0) * 0.2;
        } else if (bubble.x > maxX) {
          bubble.x = maxX;
          bubble.vx = -Math.abs(bubble.vx || 0) * 0.2;
        }

        if (bubble.y < minY) {
          bubble.y = minY;
          bubble.vy = Math.abs(bubble.vy || 0) * 0.2;
        } else if (bubble.y > maxY) {
          bubble.y = maxY;
          bubble.vy = -Math.abs(bubble.vy || 0) * 0.2;
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
        toValue: 1.1,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedBubble(null);
    });

    onBubblePress?.(bubble);
  }, [onBubblePress]);

  // Calculate font size for mini bubbles
  const getFontSize = useCallback((radius: number): number => {
    // Much smaller font sizes for mini charts
    const baseFontSize = Math.max(4, Math.min(8, radius / 3));
    return baseFontSize;
  }, []);

  // Simplified text for mini bubbles - just first few characters
  const getSimplifiedText = useCallback((text: string, radius: number): string => {
    const safeText = text || '';

    // For very small bubbles, show just first character
    if (radius < 6) {
      return safeText.charAt(0).toUpperCase();
    }

    // For small bubbles, show first 2-3 characters
    if (radius < 10) {
      return safeText.substring(0, 2).toUpperCase();
    }

    // For larger bubbles, show first 4 characters
    return safeText.substring(0, 4);
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { width: config.width, height: config.height }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: isDark ? '#fff' : '#000' }]}>...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: config.width, height: config.height }]}>
      <View style={[styles.chartContainer, { width: config.width, height: config.height }]}>
        {bubbles && bubbles.length > 0 && bubbles.map((bubble) => {
          const radius = bubble?.radius || 5;
          const bubbleName = bubble?.name || '';
          const fontSize = getFontSize(radius);
          const displayText = getSimplifiedText(bubbleName, radius);
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
                  borderWidth: 1,
                  borderColor: bubble?.color || '#ccc',
                  backgroundColor: `${bubble?.color || '#ccc'}20`,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize,
                    color: bubble?.color || '#666',
                    fontWeight: 'bold',
                    textAlign: 'center',
                  }}
                >
                  {displayText}
                </Text>
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
    fontSize: 8,
    opacity: 0.6,
  },
});