import React from 'react';
import { HoneycombMiniBubbleChart } from './HoneycombMiniBubbleChart';
import { EmotionBubbleData } from '@/lib/types/bubbleChart';

interface EmotionsHoneycombMiniBubbleChartCallbacks {
  onBubblePress?: (emotion: EmotionBubbleData) => void;
  onBubbleLongPress?: (emotion: EmotionBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

interface EmotionsHoneycombMiniBubbleChartProps {
  data: EmotionBubbleData[];
  width: number;
  height: number;
  callbacks?: EmotionsHoneycombMiniBubbleChartCallbacks;
  loading?: boolean;
}

function EmotionsHoneycombMiniBubbleChart({
  data,
  width,
  height,
  callbacks,
  loading = false
}: EmotionsHoneycombMiniBubbleChartProps) {
  // Transform emotion data to match the expected interface
  const transformedData = React.useMemo(() => {
    return data.map(emotion => ({
      ...emotion,
      name: emotion.emotion // Map emotion property to name
    }));
  }, [data]);

  const handleBubblePress = React.useCallback((bubble: any) => {
    // Transform back to emotion format
    const emotionBubble = {
      ...bubble,
      emotion: bubble.name
    };
    callbacks?.onBubblePress?.(emotionBubble as EmotionBubbleData);
  }, [callbacks]);

  return (
    <HoneycombMiniBubbleChart
      data={transformedData}
      width={width}
      height={height}
      onBubblePress={handleBubblePress}
      loading={loading}
    />
  );
}

export { EmotionsHoneycombMiniBubbleChart };
export default EmotionsHoneycombMiniBubbleChart;