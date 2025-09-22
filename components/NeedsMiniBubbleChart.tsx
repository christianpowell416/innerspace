import React from 'react';
import { MiniBubbleChart } from './MiniBubbleChart';
import {
  NeedBubbleData,
  BubbleChartConfig
} from '@/lib/types/partsNeedsChart';

interface NeedsMiniBubbleChartCallbacks {
  onBubblePress?: (need: NeedBubbleData) => void;
  onBubbleLongPress?: (need: NeedBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

interface NeedsMiniBubbleChartProps {
  data: NeedBubbleData[];
  width: number;
  height: number;
  callbacks?: NeedsMiniBubbleChartCallbacks;
  loading?: boolean;
}

// Config function for mini need charts
const getMiniNeedConfig = (width: number, height: number): BubbleChartConfig => ({
  width,
  height,
  maxRadius: Math.min(width, height) * 0.08, // Much smaller for mini charts
  minRadius: Math.min(width, height) * 0.02,
  padding: 1, // Minimal padding for tight spaces
});

export function NeedsMiniBubbleChart({
  data,
  width,
  height,
  callbacks,
  loading = false
}: NeedsMiniBubbleChartProps) {
  // Memoize config to prevent recreation on every render
  const config = React.useMemo(() =>
    getMiniNeedConfig(width, height),
    [width, height]
  );

  const handleBubblePress = React.useCallback((bubble: any) => {
    callbacks?.onBubblePress?.(bubble as NeedBubbleData);
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