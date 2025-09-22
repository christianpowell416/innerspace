import React from 'react';
import { FullBubbleChart } from './FullBubbleChart';
import {
  EmotionBubbleData,
  BubbleChartConfig
} from '@/lib/types/bubbleChart';

interface EmotionsFullBubbleChartCallbacks {
  onBubblePress?: (emotion: EmotionBubbleData) => void;
  onBubbleLongPress?: (emotion: EmotionBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

interface EmotionsFullBubbleChartProps {
  data: EmotionBubbleData[];
  config: BubbleChartConfig;
  callbacks?: EmotionsFullBubbleChartCallbacks;
  loading?: boolean;
}

export function EmotionsFullBubbleChart({
  data,
  config,
  callbacks,
  loading = false
}: EmotionsFullBubbleChartProps) {
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
    <FullBubbleChart
      data={transformedData}
      config={config}
      onBubblePress={handleBubblePress}
      loading={loading}
    />
  );
}