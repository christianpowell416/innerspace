import React from 'react';
import { FullBubbleChart } from './FullBubbleChart';
import {
  NeedBubbleData,
  BubbleChartConfig
} from '@/lib/types/partsNeedsChart';

interface NeedsFullBubbleChartCallbacks {
  onBubblePress?: (need: NeedBubbleData) => void;
  onBubbleLongPress?: (need: NeedBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

interface NeedsFullBubbleChartProps {
  data: NeedBubbleData[];
  config: BubbleChartConfig;
  callbacks?: NeedsFullBubbleChartCallbacks;
  loading?: boolean;
}

export function NeedsFullBubbleChart({
  data,
  config,
  callbacks,
  loading = false
}: NeedsFullBubbleChartProps) {
  const handleBubblePress = React.useCallback((bubble: any) => {
    callbacks?.onBubblePress?.(bubble as NeedBubbleData);
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