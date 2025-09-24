/**
 * Test data utilities for bubble chart development
 */

import {
  EmotionBubbleData,
  EmotionCategory,
  getEmotionColor,
  getEmotionCategory
} from '../types/bubbleChart';

export const generateTestEmotionData = (count: number = 20): EmotionBubbleData[] => {
  const emotions = [
    'Happiness', 'Sadness', 'Anger', 'Fear', 'Surprise', 'Disgust',
    'Joy', 'Anxiety', 'Love', 'Excitement', 'Frustration', 'Worry',
    'Contentment', 'Stress', 'Relief', 'Confusion', 'Pride', 'Shame',
    'Gratitude', 'Loneliness', 'Hope', 'Despair', 'Curiosity', 'Boredom',
    'Compassion', 'Envy', 'Optimism', 'Pessimism', 'Trust', 'Betrayal'
  ];

  return emotions.slice(0, count).map((emotion, index) => {
    const frequency = Math.floor(Math.random() * 10) + 1; // 1-10 (same as parts/needs)
    const intensity = Math.random() * 10; // 0-10
    const radius = Math.max(18, Math.min(45, frequency * 3.5 + 10)); // Same scaling as parts/needs

    return {
      id: `test-emotion-${index}`,
      emotion,
      frequency,
      intensity,
      color: getEmotionColor(emotion),
      radius,
      category: getEmotionCategory(emotion),
      lastSeen: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Last 30 days
      conversationIds: Array.from(
        { length: Math.floor(Math.random() * 5) + 1 },
        (_, i) => `conv-${index}-${i}`
      ),
    };
  });
};

export const createEmptyEmotionStats = () => ({
  totalEmotions: 0,
  totalMentions: 0,
  mostFrequent: null,
  averageIntensity: 0,
  recentEmotions: []
});

export const createTestEmotionStats = (emotions: EmotionBubbleData[]) => {
  if (emotions.length === 0) {
    return createEmptyEmotionStats();
  }

  const totalMentions = emotions.reduce((sum, e) => sum + e.frequency, 0);
  const averageIntensity = emotions.reduce((sum, e) => sum + e.intensity, 0) / emotions.length;
  const mostFrequent = emotions.reduce((max, e) =>
    e.frequency > max.frequency ? e : max
  );

  return {
    totalEmotions: emotions.length,
    totalMentions,
    mostFrequent: {
      emotion: mostFrequent.emotion,
      count: mostFrequent.frequency,
      averageIntensity: mostFrequent.intensity,
      latestDate: mostFrequent.lastSeen,
      conversationIds: mostFrequent.conversationIds
    },
    averageIntensity: Math.round(averageIntensity * 10) / 10,
    recentEmotions: emotions
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .slice(0, 5)
      .map(e => ({
        emotion: e.emotion,
        count: e.frequency,
        averageIntensity: e.intensity,
        latestDate: e.lastSeen,
        conversationIds: e.conversationIds
      }))
  };
};