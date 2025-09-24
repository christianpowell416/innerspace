import React from 'react';
import { HoneycombMiniBubbleChart } from './HoneycombMiniBubbleChart';
import { PartBubbleData } from '@/lib/types/partsNeedsChart';

interface PartsHoneycombMiniBubbleChartCallbacks {
  onBubblePress?: (part: PartBubbleData) => void;
  onBubbleLongPress?: (part: PartBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

interface PartsHoneycombMiniBubbleChartProps {
  data: PartBubbleData[];
  width: number;
  height: number;
  callbacks?: PartsHoneycombMiniBubbleChartCallbacks;
  loading?: boolean;
}

function PartsHoneycombMiniBubbleChart({
  data,
  width,
  height,
  callbacks,
  loading = false
}: PartsHoneycombMiniBubbleChartProps) {
  const handleBubblePress = React.useCallback((bubble: any) => {
    callbacks?.onBubblePress?.(bubble as PartBubbleData);
  }, [callbacks]);

  return (
    <HoneycombMiniBubbleChart
      data={data}
      width={width}
      height={height}
      onBubblePress={handleBubblePress}
      loading={loading}
    />
  );
}

export { PartsHoneycombMiniBubbleChart };
export default PartsHoneycombMiniBubbleChart;