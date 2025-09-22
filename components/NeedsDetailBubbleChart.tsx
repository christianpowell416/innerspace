import React from 'react';
import { DetailBubbleChart } from './DetailBubbleChart';
import {
  NeedBubbleData,
  BubbleChartConfig
} from '@/lib/types/partsNeedsChart';

interface NeedsDetailBubbleChartCallbacks {
  onBubblePress?: (need: NeedBubbleData) => void;
  onBubbleLongPress?: (need: NeedBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

interface NeedsDetailBubbleChartProps {
  data: NeedBubbleData[];
  width: number;
  height: number;
  callbacks?: NeedsDetailBubbleChartCallbacks;
  loading?: boolean;
}

// Config function similar to getCompactBubbleConfig
const getCompactNeedConfig = (width: number, height: number): BubbleChartConfig => ({
  width,
  height,
  maxRadius: Math.min(width, height) * 0.12,
  minRadius: Math.min(width, height) * 0.04,
  padding: 2,
  centerForce: 0.1,
  collisionStrength: 0.8,
  velocityDecay: 0.6,
});

export function NeedsDetailBubbleChart({
  data,
  width,
  height,
  callbacks,
  loading = false
}: NeedsDetailBubbleChartProps) {
  // Memoize config to prevent recreation on every render
  const config = React.useMemo(() =>
    getCompactNeedConfig(width, height),
    [width, height]
  );

  const handleBubblePress = React.useCallback((bubble: any) => {
    callbacks?.onBubblePress?.(bubble as NeedBubbleData);
  }, [callbacks]);

  return (
    <DetailBubbleChart
      data={data}
      config={config}
      onBubblePress={handleBubblePress}
      loading={loading}
    />
  );
}