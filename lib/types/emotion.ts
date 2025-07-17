// Legacy interface for backward compatibility
export interface Emotion {
  id: string;
  timestamp: Date;
  'feminine-masculine': number; // -3 to 3
  'dark-light': number; // -3 to 3
  'child-parent': number; // -3 to 3
  frequency: number; // 1 to 10 scale for color coding
  label?: string;
  notes?: string;
  aiConversationSummary?: string;
  limitingBeliefs?: string;
}

export interface EmotionWithScore extends Emotion {
  score: number;
}

// Convert Supabase emotion to legacy format
export const convertToLegacyEmotion = (emotion: any): Emotion => {
  return {
    id: emotion.id,
    timestamp: new Date(emotion.created_at),
    'feminine-masculine': emotion['feminine-masculine'],
    'dark-light': emotion['dark-light'],
    'child-parent': emotion['child-parent'],
    frequency: emotion.frequency,
    label: emotion.emotion,
    notes: emotion.notes,
    aiConversationSummary: emotion.ai_conversation_summary,
    limitingBeliefs: emotion.belief,
  };
};

// Helper function to get color based on frequency level
export const getFrequencyColor = (level: number): string => {
  const colors = [
    '#8B0000', // 1-2: Dark red
    '#B22222', // 3: Red
    '#DC143C', // 4: Crimson
    '#FF4500', // 5: Orange red
    '#FFA500', // 6: Orange
    '#FFD700', // 7: Gold
    '#ADFF2F', // 8: Green yellow
    '#32CD32', // 9: Lime green
    '#00FF00', // 10: Pure green
  ];
  return colors[Math.max(0, Math.min(8, level - 1))];
};

// Helper function to format emotion vector as string
export const formatEmotionVector = (emotion: Emotion): string => {
  return `(${emotion['feminine-masculine']}, ${emotion['dark-light']}, ${emotion['child-parent']})`;
};

// Helper function to calculate average score of emotion coordinates
export const calculateEmotionScore = (emotion: Emotion | any): number => {
  const average = (Math.abs(emotion['feminine-masculine']) + Math.abs(emotion['dark-light']) + Math.abs(emotion['child-parent'])) / 3;
  return Math.round(average * 10) / 10; // Round to 1 decimal place
};