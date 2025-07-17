import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { EmotionSliders } from './EmotionSliders';
import { Emotion, getFrequencyColor, calculateEmotionScore } from '@/lib/types/emotion';
import { useColorScheme } from '@/hooks/useColorScheme';

interface BeliefListItemProps {
  emotion: Emotion;
  onPress?: (emotion: Emotion) => void;
}

export function BeliefListItem({ emotion, onPress }: BeliefListItemProps) {
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
        {emotion.limitingBeliefs && (
          <View style={styles.topRow}>
            <ThemedText type="defaultSemiBold" style={styles.limitingBeliefs} numberOfLines={2}>
              {emotion.limitingBeliefs}
            </ThemedText>
            <View style={[
              styles.scoreCircle,
              { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                borderColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
              }
            ]}>
              <ThemedText type="defaultSemiBold" style={styles.score}>
                {emotionScore}
              </ThemedText>
            </View>
          </View>
        )}
        
        <View style={styles.header}>
          <View style={styles.leftSection}>
            <View 
              style={[
                styles.frequencyIndicator, 
                { backgroundColor: frequencyColor }
              ]} 
            />
            <ThemedText type="default" style={styles.title}>
              {emotion.label || 'Unlabeled'}
            </ThemedText>
          </View>
          <ThemedText type="default" style={styles.timestamp}>
            {formattedDate}
          </ThemedText>
        </View>
        
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scoreCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginLeft: 12,
    marginTop: -8,
    marginBottom: 8,
    flexShrink: 0,
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
  frequencyIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  score: {
    fontWeight: '600',
    fontSize: 14,
  },
  title: {
    textAlign: 'center',
    opacity: 0.7,
    fontStyle: 'italic',
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
  limitingBeliefs: {
    textAlign: 'left',
    fontSize: 20,
    flex: 1,
    marginTop: -2,
  },
});