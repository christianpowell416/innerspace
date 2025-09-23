import React from 'react';
import { MiniBubbleChart } from './MiniBubbleChart';
import {
  EmotionBubbleData,
  BubbleChartConfig
} from '@/lib/types/bubbleChart';

interface EmotionsMiniBubbleChartCallbacks {
  onBubblePress?: (emotion: EmotionBubbleData) => void;
  onBubbleLongPress?: (emotion: EmotionBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

interface EmotionsMiniBubbleChartProps {
  data: EmotionBubbleData[];
  width: number;
  height: number;
  callbacks?: EmotionsMiniBubbleChartCallbacks;
  loading?: boolean;
}

// Config function for mini emotion charts
const getMiniEmotionConfig = (width: number, height: number): BubbleChartConfig => ({
  width,
  height,
  maxRadius: Math.min(width, height) * 0.1,
  minRadius: Math.min(width, height) * 0.02,
  padding: 1, // Minimal padding for tight spaces
  centerForce: 0.02, // Very weak center force to avoid clustering
  collisionStrength: 0.9, // Strong collision prevention
  velocityDecay: 0.7, // Faster settling
});

export function EmotionsMiniBubbleChart({
  data,
  width,
  height,
  callbacks,
  loading = false
}: EmotionsMiniBubbleChartProps) {
  // Memoize config to prevent recreation on every render
  const config = React.useMemo(() =>
    getMiniEmotionConfig(width, height),
    [width, height]
  );

  const handleBubblePress = React.useCallback((bubble: any) => {
    callbacks?.onBubblePress?.(bubble as EmotionBubbleData);
  }, [callbacks]);

  // Transform EmotionBubbleData to match the generic BubbleData interface
  const transformedData = React.useMemo(() => {
    return data.map(emotion => ({
      ...emotion,
      name: emotion.emotion // Map emotion property to name
    }));
  }, [data]);

  return (
    <MiniBubbleChart
      data={transformedData}
      config={config}
      onBubblePress={handleBubblePress}
      loading={loading}
    />
  );
}