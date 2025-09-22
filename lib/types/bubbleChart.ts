/**
 * Bubble Chart Types and Interfaces
 *
 * Defines the data structures for emotion bubble chart visualization
 */

export enum EmotionCategory {
  JOY = 'joy',
  SADNESS = 'sadness',
  FEAR = 'fear',
  ANGER = 'anger',
  SURPRISE = 'surprise',
  DISGUST = 'disgust',
  LOVE = 'love',
  ANTICIPATION = 'anticipation',
  NEUTRAL = 'neutral'
}

export interface EmotionBubbleData {
  id: string;
  emotion: string;
  frequency: number;
  intensity: number;
  color: string;
  radius: number;
  category: EmotionCategory;
  lastSeen: Date;
  conversationIds: string[];
  // D3 simulation properties (added by force simulation)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface BubbleChartConfig {
  width: number;
  height: number;
  minRadius: number;
  maxRadius: number;
  padding: number;
  centerForce: number;
  collisionStrength: number;
  velocityDecay: number;
}

export interface EmotionFrequency {
  emotion: string;
  count: number;
  averageIntensity: number;
  latestDate: Date;
  conversationIds: string[];
}

export interface BubbleChartCallbacks {
  onBubblePress?: (bubble: EmotionBubbleData) => void;
  onBubbleLongPress?: (bubble: EmotionBubbleData) => void;
  onChartPress?: (x: number, y: number) => void;
}

// Color palette for emotion categories
export const EMOTION_COLORS = {
  [EmotionCategory.JOY]: '#FFD700',        // Gold
  [EmotionCategory.SADNESS]: '#4682B4',    // Steel Blue
  [EmotionCategory.FEAR]: '#8A2BE2',       // Blue Violet
  [EmotionCategory.ANGER]: '#DC143C',      // Crimson
  [EmotionCategory.SURPRISE]: '#FF8C00',   // Dark Orange
  [EmotionCategory.DISGUST]: '#9ACD32',    // Yellow Green
  [EmotionCategory.LOVE]: '#FF69B4',       // Hot Pink
  [EmotionCategory.ANTICIPATION]: '#00CED1', // Dark Turquoise
  [EmotionCategory.NEUTRAL]: '#808080',    // Gray
} as const;

// Emotion categorization mapping
export const EMOTION_CATEGORIZATION: Record<string, EmotionCategory> = {
  // Joy/Happiness
  'joy': EmotionCategory.JOY,
  'happiness': EmotionCategory.JOY,
  'delight': EmotionCategory.JOY,
  'bliss': EmotionCategory.JOY,
  'contentment': EmotionCategory.JOY,
  'elation': EmotionCategory.JOY,
  'euphoria': EmotionCategory.JOY,
  'excitement': EmotionCategory.JOY,
  'cheerfulness': EmotionCategory.JOY,
  'gratitude': EmotionCategory.JOY,

  // Sadness
  'sadness': EmotionCategory.SADNESS,
  'sorrow': EmotionCategory.SADNESS,
  'grief': EmotionCategory.SADNESS,
  'melancholy': EmotionCategory.SADNESS,
  'despair': EmotionCategory.SADNESS,
  'depression': EmotionCategory.SADNESS,
  'loneliness': EmotionCategory.SADNESS,
  'disappointment': EmotionCategory.SADNESS,
  'hurt': EmotionCategory.SADNESS,
  'pain': EmotionCategory.SADNESS,

  // Fear
  'fear': EmotionCategory.FEAR,
  'anxiety': EmotionCategory.FEAR,
  'worry': EmotionCategory.FEAR,
  'nervousness': EmotionCategory.FEAR,
  'panic': EmotionCategory.FEAR,
  'terror': EmotionCategory.FEAR,
  'apprehension': EmotionCategory.FEAR,
  'dread': EmotionCategory.FEAR,
  'overwhelm': EmotionCategory.FEAR,
  'stress': EmotionCategory.FEAR,

  // Anger
  'anger': EmotionCategory.ANGER,
  'rage': EmotionCategory.ANGER,
  'fury': EmotionCategory.ANGER,
  'irritation': EmotionCategory.ANGER,
  'annoyance': EmotionCategory.ANGER,
  'frustration': EmotionCategory.ANGER,
  'resentment': EmotionCategory.ANGER,
  'hostility': EmotionCategory.ANGER,
  'indignation': EmotionCategory.ANGER,
  'outrage': EmotionCategory.ANGER,

  // Surprise
  'surprise': EmotionCategory.SURPRISE,
  'astonishment': EmotionCategory.SURPRISE,
  'amazement': EmotionCategory.SURPRISE,
  'wonder': EmotionCategory.SURPRISE,
  'bewilderment': EmotionCategory.SURPRISE,
  'confusion': EmotionCategory.SURPRISE,
  'shock': EmotionCategory.SURPRISE,

  // Disgust
  'disgust': EmotionCategory.DISGUST,
  'revulsion': EmotionCategory.DISGUST,
  'loathing': EmotionCategory.DISGUST,
  'contempt': EmotionCategory.DISGUST,
  'disdain': EmotionCategory.DISGUST,
  'aversion': EmotionCategory.DISGUST,

  // Love
  'love': EmotionCategory.LOVE,
  'affection': EmotionCategory.LOVE,
  'compassion': EmotionCategory.LOVE,
  'tenderness': EmotionCategory.LOVE,
  'fondness': EmotionCategory.LOVE,
  'adoration': EmotionCategory.LOVE,
  'warmth': EmotionCategory.LOVE,
  'caring': EmotionCategory.LOVE,

  // Anticipation
  'anticipation': EmotionCategory.ANTICIPATION,
  'hope': EmotionCategory.ANTICIPATION,
  'expectation': EmotionCategory.ANTICIPATION,
  'eagerness': EmotionCategory.ANTICIPATION,
  'optimism': EmotionCategory.ANTICIPATION,
  'curiosity': EmotionCategory.ANTICIPATION,
  'interest': EmotionCategory.ANTICIPATION,
};

export const getEmotionCategory = (emotion: string): EmotionCategory => {
  const normalizedEmotion = emotion.toLowerCase().trim();
  return EMOTION_CATEGORIZATION[normalizedEmotion] || EmotionCategory.NEUTRAL;
};

export const getEmotionColor = (emotion: string, isDark: boolean = false): string => {
  const category = getEmotionCategory(emotion);
  const baseColor = EMOTION_COLORS[category];

  // Adjust color for dark mode if needed
  if (isDark) {
    // You could implement color adjustments for dark mode here
    return baseColor;
  }

  return baseColor;
};