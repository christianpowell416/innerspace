import React from 'react';
import { ExpandedBubbleChart } from './ExpandedBubbleChart';
import {
  EmotionBubbleData,
  BubbleChartConfig
} from '@/lib/types/bubbleChart';

interface EmotionsExpandedBubbleChartCallbacks {
  onBubblePress?: (emotion: EmotionBubbleData) => void;
  onBubbleLongPress?: (emotion: EmotionBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

interface EmotionsExpandedBubbleChartProps {
  data: EmotionBubbleData[];
  width: number;
  height: number;
  callbacks?: EmotionsExpandedBubbleChartCallbacks;
  loading?: boolean;
}

// Config function for expanded emotion charts
const getExpandedEmotionConfig = (width: number, height: number): BubbleChartConfig => ({
  width,
  height,
  maxRadius: Math.min(width, height) * 0.15, // Larger than mini, smaller than detail
  minRadius: Math.min(width, height) * 0.04,
  padding: 3, // More padding for expanded view
  centerForce: 0.05, // Moderate center force
  collisionStrength: 0.8, // Strong collision prevention
  velocityDecay: 0.6, // Good settling speed
});

export function EmotionsExpandedBubbleChart({
  data,
  width,
  height,
  callbacks,
  loading = false
}: EmotionsExpandedBubbleChartProps) {
  // Memoize config to prevent recreation on every render
  const config = React.useMemo(() =>
    getExpandedEmotionConfig(width, height),
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
    <ExpandedBubbleChart
      data={transformedData}
      config={config}
      onBubblePress={handleBubblePress}
      loading={loading}
    />
  );
}