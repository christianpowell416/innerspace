import React from 'react';
import { CompactBubbleChart } from './CompactBubbleChart';
import {
  NeedBubbleData,
  CompactBubbleChartConfig,
  NeedsBubbleChartCallbacks,
  getCompactBubbleConfig
} from '@/lib/types/partsNeedsChart';

interface NeedsBubbleChartProps {
  data: NeedBubbleData[];
  width: number;
  height: number;
  callbacks?: NeedsBubbleChartCallbacks;
  loading?: boolean;
}

export function NeedsBubbleChart({
  data,
  width,
  height,
  callbacks,
  loading = false
}: NeedsBubbleChartProps) {
  const config = getCompactBubbleConfig(width, height);

  const handleBubblePress = (bubble: any) => {
    callbacks?.onBubblePress?.(bubble as NeedBubbleData);
  };

  return (
    <CompactBubbleChart
      data={data}
      config={config}
      onBubblePress={handleBubblePress}
      loading={loading}
    />
  );
}