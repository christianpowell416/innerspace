import React from 'react';
import { DetailBubbleChart } from './DetailBubbleChart';
import {
  PartBubbleData,
  BubbleChartConfig
} from '@/lib/types/partsNeedsChart';

interface PartsDetailBubbleChartCallbacks {
  onBubblePress?: (part: PartBubbleData) => void;
  onBubbleLongPress?: (part: PartBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

interface PartsDetailBubbleChartProps {
  data: PartBubbleData[];
  width: number;
  height: number;
  callbacks?: PartsDetailBubbleChartCallbacks;
  loading?: boolean;
}

// Config function similar to getCompactBubbleConfig
const getCompactPartConfig = (width: number, height: number): BubbleChartConfig => ({
  width,
  height,
  maxRadius: Math.min(width, height) * 0.12,
  minRadius: Math.min(width, height) * 0.04,
  padding: 2,
  centerForce: 0.1,
  collisionStrength: 0.8,
  velocityDecay: 0.6,
});

export function PartsDetailBubbleChart({
  data,
  width,
  height,
  callbacks,
  loading = false
}: PartsDetailBubbleChartProps) {
  // Memoize config to prevent recreation on every render
  const config = React.useMemo(() =>
    getCompactPartConfig(width, height),
    [width, height]
  );

  const handleBubblePress = React.useCallback((bubble: any) => {
    callbacks?.onBubblePress?.(bubble as PartBubbleData);
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