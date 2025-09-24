import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { forceSimulation, forceCollide, forceCenter, forceManyBody } from 'd3-force';
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

interface MiniBubbleChartProps {
  data: BubbleData[];
  config: BubbleChartConfig;
  onBubblePress?: (bubble: BubbleData) => void;
  loading?: boolean;
}

export function MiniBubbleChart({ data, config, onBubblePress, loading = false }: MiniBubbleChartProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Initialize hyphenator with English patterns
  const hyphenator = new Hypher(english);

  // Use container and configuration dimensions without scaling
  const containerWidth = config.width;
  const containerHeight = config.height;
  const scaledConfig = {
    ...config,
    // Remove 150% scaling to fit within containers
  };

  const [bubbles, setBubbles] = useState<BubbleData[]>([]);

  // Ensure data is always an array, shuffle randomly, and limit to 7 bubbles - memoized to prevent re-render complexes
  const safeData = React.useMemo(() => {
    const dataArray = data || [];
    // Create a copy and shuffle it randomly
    const shuffled = [...dataArray].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 7);
  }, [data]);
  const [isSimulationComplete, setIsSimulationComplete] = useState(false);
  const simulationRef = useRef<any>(null);
  const lastUpdateTime = useRef<number>(0);

  // Store settled bubble positions to prevent reset on re-renders
  const settledPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Calculate uniform bubble size for mini charts - all bubbles same size
  const calculateUniformBubbleRadius = useCallback((bubbles: BubbleData[]): number => {
    if (bubbles.length === 0) return config.minRadius;

    // Calculate optimal uniform radius based on container size and number of bubbles
    const availableArea = config.width * config.height;
    const targetAreaPerBubble = (availableArea * 0.6) / bubbles.length; // 60% total utilization for better spacing
    const idealRadius = Math.sqrt(targetAreaPerBubble / Math.PI);

    // Constrain within min/max bounds
    const maxAllowedRadius = Math.min(
      (config.width / 4) - config.padding * 2, // Ensure multiple bubbles fit horizontally
      (config.height / 4) - config.padding * 2, // Ensure multiple bubbles fit vertically
      config.maxRadius * 0.8 // Use 80% of max radius for mini charts
    );

    const minAllowedRadius = Math.max(config.minRadius, 8); // Minimum readable size

    const baseRadius = Math.max(minAllowedRadius, Math.min(maxAllowedRadius, idealRadius));

    // Make bubbles 14.75% larger (was 27.5%, now 10% smaller: 1.275 * 0.9 = 1.1475)
    return baseRadius * 1.1475;
  }, [config.width, config.height, config.padding, config.maxRadius, config.minRadius]);

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
      // Calculate uniform radius for all bubbles
      const uniformRadius = calculateUniformBubbleRadius(safeData);

      const staticBubbles = safeData.map(bubble => ({
        ...bubble,
        radius: uniformRadius, // All bubbles same size
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

    // Keep original data order since all bubbles will be same size
    const sortedData = [...safeData];

    // Calculate uniform radius for all bubbles
    const uniformRadius = calculateUniformBubbleRadius(sortedData);

    // Create a copy of the data with initial positions and uniform radius
    const initialBubbles = sortedData.map((bubble, index) => {
      // All bubbles use the same uniform radius
      const scaledRadius = uniformRadius;

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

      // Start all bubbles very close to center for tight clustering
      let distanceFromCenter, angle;

      if (index === 0) {
        // First bubble goes exactly in the center
        distanceFromCenter = 0;
        angle = 0;
      } else {
        // Other bubbles start very close to center in a tight formation
        const tightRadius = scaledRadius * 1.5; // Just slightly more than one bubble radius
        const angleStep = (2 * Math.PI) / (sortedData.length - 1); // Evenly distribute around circle
        angle = (index - 1) * angleStep; // Start from index-1 since index 0 is center
        distanceFromCenter = tightRadius;
      }

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

    // Create D3 force simulation optimized for mini charts with tight clustering
    const simulation = forceSimulation(initialBubbles)
      .force('charge', forceManyBody().strength(-1)) // Almost no repulsion
      .force('center', forceCenter(config.width / 2, config.height / 2).strength(0.7)) // Maximum center pull
      .force('collision', forceCollide().radius((d: any) => d.radius * 1.0).strength(1.0)) // Exact bubble radius for touching
      .velocityDecay(0.4) // Higher velocity decay for faster settling
      .alpha(0.8) // High initial alpha
      .alphaDecay(0.1); // Faster decay for quicker settling

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


  // Calculate font size for mini bubbles - adjusted for proper scaling
  const getFontSize = useCallback((radius: number): number => {
    // Scale font size more conservatively to fit within bubbles
    const baseFontSize = Math.max(8, Math.min(16, radius / 2.2));
    return baseFontSize;
  }, []);

  // Intelligent text wrapping with hyphenation for mini bubbles - returns array of lines
  const wrapText = useCallback((text: string, radius: number): string[] => {
    const safeText = text || '';
    if (!safeText) return [''];

    // For very small mini bubbles (single line only)
    if (radius < 12) {
      if (safeText.length <= 6) {
        return [safeText];
      }
      // Try hyphenation for longer words
      const hyphenated = hyphenator.hyphenate(safeText).join('-');
      if (hyphenated.length <= 8) {
        return [hyphenated];
      }
      return [safeText.substring(0, 4) + '…'];
    }

    // For larger mini bubbles, allow 2 lines
    const words = safeText.split(' ');
    if (words.length === 1) {
      // Single word - use hyphenation to break across lines
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
    if (words.length <= 2) {
      return words.length === 2 ? words : [safeText];
    }

    // For more than 2 words, try to balance the lines
    const midpoint = Math.ceil(words.length / 2);
    return [
      words.slice(0, midpoint).join(' '),
      words.slice(midpoint).join(' ')
    ];
  }, [hyphenator]);

  if (loading) {
    return (
      <View style={[styles.container, { width: containerWidth, height: containerHeight }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: isDark ? '#fff' : '#000' }]}>...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: containerWidth, height: containerHeight, overflow: 'hidden' }]}>
      <View style={[styles.chartContainer, { width: containerWidth, height: containerHeight, overflow: 'hidden' }]}>
        {bubbles && bubbles.length > 0 && bubbles.map((bubble) => {
          const radius = bubble?.radius || 5;
          const bubbleName = bubble?.name || '';
          const fontSize = getFontSize(radius);
          const textLines = wrapText(bubbleName, radius);

          const bubbleId = bubble?.id || `bubble-${Math.random()}`;

          return (
            <View
              key={bubbleId}
              style={[
                styles.bubble,
                {
                  left: (bubble?.x || 0) - radius,
                  top: (bubble?.y || 0) - radius,
                  width: radius * 2,
                  height: radius * 2,
                },
              ]}
            >
              <View
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
                        color: bubble?.color || '#666',
                        fontWeight: 'normal',
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