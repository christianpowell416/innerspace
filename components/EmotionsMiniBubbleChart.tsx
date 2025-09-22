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
  maxRadius: Math.min(width, height) * 0.08, // Much smaller for mini charts
  minRadius: Math.min(width, height) * 0.02,
  padding: 1, // Minimal padding for tight spaces
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

  return (
    <MiniBubbleChart
      data={data}
      config={config}
      onBubblePress={handleBubblePress}
      loading={loading}
    />
  );
}