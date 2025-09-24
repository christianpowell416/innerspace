import React from 'react';
import { HoneycombMiniBubbleChart } from './HoneycombMiniBubbleChart';
import { NeedBubbleData } from '@/lib/types/partsNeedsChart';

interface NeedsHoneycombMiniBubbleChartCallbacks {
  onBubblePress?: (need: NeedBubbleData) => void;
  onBubbleLongPress?: (need: NeedBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

interface NeedsHoneycombMiniBubbleChartProps {
  data: NeedBubbleData[];
  width: number;
  height: number;
  callbacks?: NeedsHoneycombMiniBubbleChartCallbacks;
  loading?: boolean;
}

function NeedsHoneycombMiniBubbleChart({
  data,
  width,
  height,
  callbacks,
  loading = false
}: NeedsHoneycombMiniBubbleChartProps) {
  const handleBubblePress = React.useCallback((bubble: any) => {
    callbacks?.onBubblePress?.(bubble as NeedBubbleData);
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

export { NeedsHoneycombMiniBubbleChart };
export default NeedsHoneycombMiniBubbleChart;