import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { EmotionSliders } from './EmotionSliders';
import { Emotion, getFrequencyColor, calculateEmotionScore } from '@/data/sampleEmotions';
import { useColorScheme } from '@/hooks/useColorScheme';

interface EmotionListItemProps {
  emotion: Emotion;
  onPress?: (emotion: Emotion) => void;
}

export function EmotionListItem({ emotion, onPress }: EmotionListItemProps) {
  const colorScheme = useColorScheme();
  const frequencyColor = getFrequencyColor(emotion.frequency);
  const emotionScore = calculateEmotionScore(emotion);
  const formattedDate = emotion.timestamp.toLocaleDateString();

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
          <View style={styles.leftSection}>
            <View 
              style={[
                styles.frequencyIndicator, 
                { backgroundColor: frequencyColor }
              ]} 
            />
            <ThemedText type="defaultSemiBold" style={styles.score}>
              {emotionScore}
            </ThemedText>
          </View>
          <View style={styles.titleContainer}>
            <ThemedText type="defaultSemiBold" style={styles.title}>
              {emotion.label || 'Unlabeled'}
            </ThemedText>
          </View>
          <ThemedText type="default" style={styles.timestamp}>
            {formattedDate}
          </ThemedText>
        </View>
        
        {emotion.notes && (
          <ThemedText type="default" style={styles.notes} numberOfLines={2}>
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
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    left: 0,
    zIndex: 1,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frequencyIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  score: {
    fontWeight: '600',
  },
  title: {
    textAlign: 'center',
    fontSize: 20,
  },
  timestamp: {
    position: 'absolute',
    right: 0,
    opacity: 0.7,
    zIndex: 1,
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