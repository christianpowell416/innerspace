import React from 'react';
import { CompactBubbleChart } from './CompactBubbleChart';
import {
  PartBubbleData,
  CompactBubbleChartConfig,
  PartsBubbleChartCallbacks,
  getCompactBubbleConfig
} from '@/lib/types/partsNeedsChart';

interface PartsBubbleChartProps {
  data: PartBubbleData[];
  width: number;
  height: number;
  callbacks?: PartsBubbleChartCallbacks;
  loading?: boolean;
}

export function PartsBubbleChart({
  data,
  width,
  height,
  callbacks,
  loading = false
}: PartsBubbleChartProps) {
  const config = getCompactBubbleConfig(width, height);

  const handleBubblePress = (bubble: any) => {
    callbacks?.onBubblePress?.(bubble as PartBubbleData);
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