import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { EmotionSliders } from './EmotionSliders';
import { Emotion, getFrequencyColor } from '@/data/sampleEmotions';
import { useColorScheme } from '@/hooks/useColorScheme';

interface EmotionListItemProps {
  emotion: Emotion;
  onPress?: (emotion: Emotion) => void;
}

export function EmotionListItem({ emotion, onPress }: EmotionListItemProps) {
  const colorScheme = useColorScheme();
  const frequencyColor = getFrequencyColor(emotion.frequency);
  const formattedDate = emotion.timestamp.toLocaleDateString();
  const formattedTime = emotion.timestamp.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const borderColor = colorScheme === 'dark' 
    ? 'rgba(255, 255, 255, 0.1)' 
    : 'rgba(0, 0, 0, 0.1)';

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed
      ]}
      onPress={() => onPress?.(emotion)}
    >
      <ThemedView style={[styles.content, { borderColor }]}>
        <View style={styles.header}>
          <View style={styles.labelContainer}>
            <View 
              style={[
                styles.frequencyIndicator, 
                { backgroundColor: frequencyColor }
              ]} 
            />
            <ThemedText type="defaultSemiBold" style={styles.label}>
              {emotion.label || 'Unlabeled'}
            </ThemedText>
          </View>
          <ThemedText type="caption" style={styles.timestamp}>
            {formattedDate} {formattedTime}
          </ThemedText>
        </View>
        
        {emotion.notes && (
          <ThemedText type="caption" style={styles.notes} numberOfLines={2}>
            {emotion.notes}
          </ThemedText>
        )}
        
        <View style={styles.slidersContainer}>
          <EmotionSliders emotion={emotion} />
        </View>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.7,
  },
  content: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  frequencyIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  label: {
    flex: 1,
  },
  timestamp: {
    marginLeft: 8,
    opacity: 0.7,
  },
  slidersContainer: {
    marginTop: 8,
  },
  frequency: {
    opacity: 0.8,
  },
  notes: {
    opacity: 0.7,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});