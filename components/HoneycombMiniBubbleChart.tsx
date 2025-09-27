import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { forceSimulation, forceCollide, forceCenter, forceManyBody } from 'd3-force';
import Hypher from 'hypher';
import english from 'hyphenation.en-us';

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

interface HoneycombMiniBubbleChartProps {
  data: BubbleData[];
  width: number;
  height: number;
  onBubblePress?: (bubble: BubbleData) => void;
  loading?: boolean;
}


export function HoneycombMiniBubbleChart({
  data,
  width,
  height,
  onBubblePress,
  loading = false
}: HoneycombMiniBubbleChartProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Initialize hyphenator with English patterns
  const hyphenator = new Hypher(english);

  // Prepare data - shuffle randomly (already limited to 1-6 by data generation)
  const safeData = React.useMemo(() => {
    const dataArray = data || [];
    const shuffled = [...dataArray].sort(() => Math.random() - 0.5);
    return shuffled; // No need to slice since data is already 1-6 bubbles
  }, [data]);

  // D3 simulation state
  const [bubbles, setBubbles] = useState<BubbleData[]>([]);
  const [isSimulationComplete, setIsSimulationComplete] = useState(false);
  const simulationRef = useRef<any>(null);
  const lastUpdateTime = useRef<number>(0);
  const settledPositions = useRef<Map<string, { x: number; y: number }>>(new Map());


  // Throttled update function to prevent excessive re-renders
  const updateBubbles = useCallback((newBubbles: BubbleData[]) => {
    const now = Date.now();
    if (now - lastUpdateTime.current > 16) { // ~60fps
      lastUpdateTime.current = now;
      setBubbles([...newBubbles]);
    }
  }, []);

  // Calculate uniform bubble size
  const calculateUniformRadius = useCallback((bubbleCount: number): number => {
    if (bubbleCount === 0) return 12;

    // Calculate optimal radius based on container size and number of bubbles
    const availableArea = width * height;
    const targetAreaPerBubble = (availableArea * 0.5) / bubbleCount; // 50% utilization
    const idealRadius = Math.sqrt(targetAreaPerBubble / Math.PI);

    // Constrain within reasonable bounds for mini charts
    const maxRadius = Math.min(width / 4, height / 4, 20);
    const minRadius = 8;

    const baseRadius = Math.max(minRadius, Math.min(maxRadius, idealRadius));
    // Reduce by 10%
    return baseRadius * 0.9;
  }, [width, height]);

  // D3 Force Simulation Effect
  useEffect(() => {
    if (safeData.length === 0) {
      setBubbles([]);
      setIsSimulationComplete(false);
      settledPositions.current.clear();
      return;
    }

    // Check if we have settled positions for this data set
    const hasSettledPositions = safeData.every(d => settledPositions.current.has(d.id));

    // If simulation is complete and we have settled positions, use them
    if (isSimulationComplete && hasSettledPositions) {
      const uniformRadius = calculateUniformRadius(safeData.length);
      const staticBubbles = safeData.map(bubble => ({
        ...bubble,
        radius: uniformRadius,
        x: settledPositions.current.get(bubble.id)?.x || width / 2,
        y: settledPositions.current.get(bubble.id)?.y || height / 2,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
      }));
      setBubbles(staticBubbles);
      return;
    }

    // Reset simulation state
    setIsSimulationComplete(false);

    const uniformRadius = calculateUniformRadius(safeData.length);

    // Create initial bubbles with tight starting positions
    const initialBubbles = safeData.map((bubble, index) => {
      const settledPos = settledPositions.current.get(bubble.id);
      if (settledPos) {
        return {
          ...bubble,
          radius: uniformRadius,
          x: settledPos.x,
          y: settledPos.y,
          vx: 0,
          vy: 0,
          fx: null,
          fy: null,
        };
      }

      // Start bubbles in tight formation around center
      let distanceFromCenter, angle;
      if (index === 0) {
        distanceFromCenter = 0;
        angle = 0;
      } else {
        const tightRadius = uniformRadius * 1.5;
        const angleStep = (2 * Math.PI) / (safeData.length - 1);
        angle = (index - 1) * angleStep;
        distanceFromCenter = tightRadius;
      }

      return {
        ...bubble,
        radius: uniformRadius,
        x: width / 2 + Math.cos(angle) * distanceFromCenter,
        y: height / 2 + Math.sin(angle) * distanceFromCenter,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
      };
    });

    setBubbles(initialBubbles);

    // Create D3 force simulation
    const simulation = forceSimulation(initialBubbles)
      .force('charge', forceManyBody().strength(-1))
      .force('center', forceCenter(width / 2, height / 2).strength(0.7))
      .force('collision', forceCollide().radius((d: any) => d.radius * 1.0).strength(1.0))
      .velocityDecay(0.6)
      .alphaDecay(0.1)
      .on('tick', () => {
        updateBubbles(simulation.nodes());
      })
      .on('end', () => {
        console.log('🎯 D3 simulation completed');
        setIsSimulationComplete(true);
        // Store settled positions
        simulation.nodes().forEach(node => {
          if (node.x && node.y) {
            settledPositions.current.set(node.id, { x: node.x, y: node.y });
          }
        });
      });

    simulationRef.current = simulation;

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [safeData, width, height, calculateUniformRadius, updateBubbles]);


  // Calculate font size for bubbles
  const getFontSize = useCallback((radius: number): number => {
    return Math.max(8, Math.min(16, radius / 2.2));
  }, []);

  // Intelligent text wrapping with hyphenation
  const wrapText = useCallback((text: string, radius: number): string[] => {
    const safeText = text || '';
    if (!safeText) return [''];

    // For very small bubbles (single line only)
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

    // For larger bubbles, allow 2 lines
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
      <View style={[styles.container, { width, height }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={isDark ? '#fff' : '#007AFF'} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <View style={[styles.chartContainer, { width, height }]}>
        {bubbles.map((bubble) => {
          const radius = bubble.radius;
          const fontSize = getFontSize(radius);
          const textLines = wrapText(bubble.name, radius);

          return (
            <View
              key={bubble.id}
              style={[
                styles.bubble,
                {
                  left: bubble.x - radius,
                  top: bubble.y - radius,
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
                  borderColor: bubble.color,
                  backgroundColor: `${bubble.color}20`,
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
                        color: bubble.color,
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