import React from 'react';
import { MiniBubbleChart } from './MiniBubbleChart';
import {
  PartBubbleData,
  BubbleChartConfig
} from '@/lib/types/partsNeedsChart';

interface PartsMiniBubbleChartCallbacks {
  onBubblePress?: (part: PartBubbleData) => void;
  onBubbleLongPress?: (part: PartBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

interface PartsMiniBubbleChartProps {
  data: PartBubbleData[];
  width: number;
  height: number;
  callbacks?: PartsMiniBubbleChartCallbacks;
  loading?: boolean;
}

// Config function for mini part charts
const getMiniPartConfig = (width: number, height: number): BubbleChartConfig => ({
  width,
  height,
  maxRadius: Math.min(width, height) * 0.1,
  minRadius: Math.min(width, height) * 0.02,
  padding: 1, // Minimal padding for tight spaces
  centerForce: 0.02, // Very weak center force to avoid clustering
  collisionStrength: 0.9, // Strong collision prevention
  velocityDecay: 0.7, // Faster settling
});

export function PartsMiniBubbleChart({
  data,
  width,
  height,
  callbacks,
  loading = false
}: PartsMiniBubbleChartProps) {
  // Memoize config to prevent recreation on every render
  const config = React.useMemo(() =>
    getMiniPartConfig(width, height),
    [width, height]
  );

  const handleBubblePress = React.useCallback((bubble: any) => {
    callbacks?.onBubblePress?.(bubble as PartBubbleData);
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