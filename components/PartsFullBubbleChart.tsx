import React from 'react';
import { FullBubbleChart } from './FullBubbleChart';
import {
  PartBubbleData,
  BubbleChartConfig
} from '@/lib/types/partsNeedsChart';

interface PartsFullBubbleChartCallbacks {
  onBubblePress?: (part: PartBubbleData) => void;
  onBubbleLongPress?: (part: PartBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

interface PartsFullBubbleChartProps {
  data: PartBubbleData[];
  config: BubbleChartConfig;
  callbacks?: PartsFullBubbleChartCallbacks;
  loading?: boolean;
}

export function PartsFullBubbleChart({
  data,
  config,
  callbacks,
  loading = false
}: PartsFullBubbleChartProps) {
  const handleBubblePress = React.useCallback((bubble: any) => {
    callbacks?.onBubblePress?.(bubble as PartBubbleData);
  }, [callbacks]);

  return (
    <FullBubbleChart
      data={data}
      config={config}
      onBubblePress={handleBubblePress}
      loading={loading}
    />
  );
}