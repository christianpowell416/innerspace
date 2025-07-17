import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { Emotion } from '@/lib/types/emotion';
import { useColorScheme } from '@/hooks/useColorScheme';

interface EmotionSlidersProps {
  emotion: Emotion;
}

interface SliderProps {
  value: number; // -3 to 3
  leftLabel: string;
  rightLabel: string;
}

function EmotionSlider({ value, leftLabel, rightLabel }: SliderProps) {
  const colorScheme = useColorScheme();
  
  // Convert value from -3 to 3 range to 0 to 1 range for positioning
  const position = (value + 3) / 6;
  
  const lineColor = colorScheme === 'dark' 
    ? 'rgba(255, 255, 255, 0.3)' 
    : 'rgba(0, 0, 0, 0.3)';
    
  const tickColor = colorScheme === 'dark' 
    ? 'rgba(255, 255, 255, 0.4)' 
    : 'rgba(0, 0, 0, 0.4)';
  
  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderRow}>
        <ThemedText type="default" style={styles.leftLabel}>
          {leftLabel}
        </ThemedText>
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderLine, { backgroundColor: lineColor }]} />
          {/* Render tick marks for increments */}
          {[-3, -2, -1, 0, 1, 2, 3].map((tick) => {
            const tickPosition = (tick + 3) / 6;
            return (
              <View
                key={tick}
                style={[
                  styles.tickMark,
                  { left: `${tickPosition * 100}%`, backgroundColor: tickColor }
                ]}
              />
            );
          })}
          <View 
            style={[
              styles.sliderThumb,
              { left: `${position * 100}%` }
            ]} 
          />
        </View>
        <ThemedText type="default" style={styles.rightLabel}>
          {rightLabel}
        </ThemedText>
      </View>
    </View>
  );
}

export function EmotionSliders({ emotion }: EmotionSlidersProps) {
  return (
    <View style={styles.container}>
      <EmotionSlider 
        value={emotion['feminine-masculine']} 
        leftLabel="Feminine" 
        rightLabel="Masculine" 
      />
      <EmotionSlider 
        value={emotion['dark-light']} 
        leftLabel="Dark" 
        rightLabel="Light" 
      />
      <EmotionSlider 
        value={emotion['child-parent']} 
        leftLabel="Child" 
        rightLabel="Parent" 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  sliderContainer: {
    paddingVertical: 4,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leftLabel: {
    width: 60,
    textAlign: 'left',
    fontSize: 11,
    opacity: 0.8,
  },
  rightLabel: {
    width: 60,
    textAlign: 'right',
    fontSize: 11,
    opacity: 0.8,
  },
  sliderTrack: {
    flex: 1,
    height: 20,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderLine: {
    height: 2,
    borderRadius: 1,
  },
  tickMark: {
    position: 'absolute',
    width: 1,
    height: 8,
    marginLeft: -0.5, // Center the tick on the line
    top: 6, // Center vertically
  },
  sliderThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6366F1',
    marginLeft: -6, // Center the thumb on the line
    top: 4, // Center vertically
  },
});