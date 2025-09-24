import React from 'react';
import { ExpandedBubbleChart } from './ExpandedBubbleChart';
import {
  PartBubbleData,
  BubbleChartConfig
} from '@/lib/types/partsNeedsChart';

interface PartsExpandedBubbleChartCallbacks {
  onBubblePress?: (part: PartBubbleData) => void;
  onBubbleLongPress?: (part: PartBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

interface PartsExpandedBubbleChartProps {
  data: PartBubbleData[];
  width: number;
  height: number;
  callbacks?: PartsExpandedBubbleChartCallbacks;
  loading?: boolean;
}

// Config function for expanded part charts
const getExpandedPartConfig = (width: number, height: number): BubbleChartConfig => ({
  width,
  height,
  maxRadius: Math.min(width, height) * 0.15, // Larger than mini, smaller than detail
  minRadius: Math.min(width, height) * 0.04,
  padding: 3, // More padding for expanded view
  centerForce: 0.05, // Moderate center force
  collisionStrength: 0.8, // Strong collision prevention
  velocityDecay: 0.6, // Good settling speed
});

function PartsExpandedBubbleChart({
  data,
  width,
  height,
  callbacks,
  loading = false
}: PartsExpandedBubbleChartProps) {
  // Memoize config to prevent recreation on every render
  const config = React.useMemo(() =>
    getExpandedPartConfig(width, height),
    [width, height]
  );

  const handleBubblePress = React.useCallback((bubble: any) => {
    callbacks?.onBubblePress?.(bubble as PartBubbleData);
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

export { PartsExpandedBubbleChart };
export default PartsExpandedBubbleChart;