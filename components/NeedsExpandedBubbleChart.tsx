import React from 'react';
import { ExpandedBubbleChart } from './ExpandedBubbleChart';
import {
  NeedBubbleData,
  BubbleChartConfig
} from '@/lib/types/partsNeedsChart';

interface NeedsExpandedBubbleChartCallbacks {
  onBubblePress?: (need: NeedBubbleData) => void;
  onBubbleLongPress?: (need: NeedBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

interface NeedsExpandedBubbleChartProps {
  data: NeedBubbleData[];
  width: number;
  height: number;
  callbacks?: NeedsExpandedBubbleChartCallbacks;
  loading?: boolean;
}

// Config function for expanded need charts
const getExpandedNeedConfig = (width: number, height: number): BubbleChartConfig => ({
  width,
  height,
  maxRadius: Math.min(width, height) * 0.15, // Larger than mini, smaller than detail
  minRadius: Math.min(width, height) * 0.04,
  padding: 3, // More padding for expanded view
  centerForce: 0.05, // Moderate center force
  collisionStrength: 0.8, // Strong collision prevention
  velocityDecay: 0.6, // Good settling speed
});

function NeedsExpandedBubbleChart({
  data,
  width,
  height,
  callbacks,
  loading = false
}: NeedsExpandedBubbleChartProps) {
  // Memoize config to prevent recreation on every render
  const config = React.useMemo(() =>
    getExpandedNeedConfig(width, height),
    [width, height]
  );

  const handleBubblePress = React.useCallback((bubble: any) => {
    callbacks?.onBubblePress?.(bubble as NeedBubbleData);
  }, [callbacks]);

  return (
    <ExpandedBubbleChart
      data={data}
      config={config}
      onBubblePress={handleBubblePress}
      loading={loading}
    />
  );
}

export { NeedsExpandedBubbleChart };
export default NeedsExpandedBubbleChart;