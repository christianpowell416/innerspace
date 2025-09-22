import React from 'react';
import { DetailBubbleChart } from './DetailBubbleChart';
import {
  EmotionBubbleData,
  BubbleChartConfig
} from '@/lib/types/bubbleChart';

interface EmotionsDetailBubbleChartCallbacks {
  onBubblePress?: (emotion: EmotionBubbleData) => void;
  onBubbleLongPress?: (emotion: EmotionBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

interface EmotionsDetailBubbleChartProps {
  data: EmotionBubbleData[];
  width: number;
  height: number;
  callbacks?: EmotionsDetailBubbleChartCallbacks;
  loading?: boolean;
}

// Config function similar to getCompactBubbleConfig
const getCompactEmotionConfig = (width: number, height: number): BubbleChartConfig => ({
  width,
  height,
  maxRadius: Math.min(width, height) * 0.12,
  minRadius: Math.min(width, height) * 0.04,
  padding: 2,
  centerForce: 0.1,
  collisionStrength: 0.8,
  velocityDecay: 0.6,
});

export function EmotionsDetailBubbleChart({
  data,
  width,
  height,
  callbacks,
  loading = false
}: EmotionsDetailBubbleChartProps) {
  // Memoize config to prevent recreation on every render
  const config = React.useMemo(() =>
    getCompactEmotionConfig(width, height),
    [width, height]
  );

  return (
    <DetailBubbleChart
      data={data}
      config={config}
      onBubblePress={callbacks?.onBubblePress}
      loading={loading}
    />
  );
}