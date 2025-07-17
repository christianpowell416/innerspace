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

// Convert Supabase emotion to legacy format
export const convertToLegacyEmotion = (emotion: any): Emotion => {
  return {
    id: emotion.id,
    timestamp: new Date(emotion.created_at),
    'feminine-masculine': emotion['feminine-masculine'],
    'dark-light': emotion['dark-light'],
    'child-parent': emotion['child-parent'],
    frequency: emotion.frequency,
    label: emotion.label,
    notes: emotion.notes,
    aiConversationSummary: emotion.ai_conversation_summary,
    limitingBeliefs: emotion.limiting_beliefs,
  };
};

export const sampleEmotions: Emotion[] = [
  {
    id: "1",
    timestamp: new Date("2024-01-15T09:30:00Z"),
    'feminine-masculine': 2,
    'dark-light': 1,
    'child-parent': -1,
    frequency: 7,
    label: "Confident",
    notes: "Feeling ready to tackle the day ahead",
    aiConversationSummary: "You expressed feeling energized and prepared for upcoming challenges. We explored how your inner strength (masculine energy) and optimism (light) are balancing with some protective awareness (slight child energy). This confidence seems rooted in recent accomplishments and self-trust.",
    limitingBeliefs: "I need to prove my worth through achievements to be valuable"
  },
  {
    id: "2",
    timestamp: new Date("2024-01-15T14:15:00Z"),
    'feminine-masculine': -1,
    'dark-light': -2,
    'child-parent': 2,
    frequency: 4,
    label: "Overwhelmed",
    notes: "Too many tasks at once",
    aiConversationSummary: "We discussed how multiple demands are creating internal chaos. Your feminine energy is seeking flow and connection, while the darker emotions reflect feeling lost. The child part is trying to play and feel safe. We identified breaking tasks into smaller pieces as a path forward.",
    limitingBeliefs: "I must handle everything perfectly or I'll disappoint everyone"
  },
  {
    id: "3",
    timestamp: new Date("2024-01-14T20:45:00Z"),
    'feminine-masculine': 0,
    'dark-light': 3,
    'child-parent': 1,
    frequency: 9,
    label: "Peaceful",
    notes: "Evening meditation session",
    aiConversationSummary: "Your meditation practice created a beautiful balance between all parts of yourself. The light energy is strong, indicating clarity and spiritual connection. The gentle child energy suggests openness and wonder. This state represents harmony between your inner masculine and feminine aspects.",
    limitingBeliefs: "I must constantly seek inner peace or I'll lose myself to chaos"
  },
  {
    id: "4",
    timestamp: new Date("2024-01-14T12:00:00Z"),
    'feminine-masculine': 1,
    'dark-light': -1,
    'child-parent': -2,
    frequency: 6,
    label: "Frustrated",
    notes: "Meeting didn't go as planned",
    limitingBeliefs: "When things don't go as planned, it means I'm not good enough"
  },
  {
    id: "5",
    timestamp: new Date("2024-01-13T18:30:00Z"),
    'feminine-masculine': -2,
    'dark-light': 2,
    'child-parent': 3,
    frequency: 8,
    label: "Joyful",
    notes: "Spending time with friends",
    limitingBeliefs: "I need others' approval and company to feel truly happy"
  },
  {
    id: "6",
    timestamp: new Date("2024-01-13T07:00:00Z"),
    'feminine-masculine': 0,
    'dark-light': 0,
    'child-parent': 0,
    frequency: 5,
    label: "Neutral",
    notes: "Just woke up, feeling balanced",
    limitingBeliefs: "Being emotionally neutral means I'm not living life fully"
  },
  {
    id: "7",
    timestamp: new Date("2024-01-12T16:20:00Z"),
    'feminine-masculine': 3,
    'dark-light': -3,
    'child-parent': -3,
    frequency: 3,
    label: "Angry",
    notes: "Traffic jam made me late",
    limitingBeliefs: "External circumstances have complete control over my emotional state"
  },
  {
    id: "8",
    timestamp: new Date("2024-01-12T10:15:00Z"),
    'feminine-masculine': -1,
    'dark-light': 1,
    'child-parent': 2,
    frequency: 7,
    label: "Curious",
    notes: "Learning something new",
    limitingBeliefs: "I must understand everything immediately or I'm not smart enough"
  },
  {
    id: "9",
    timestamp: new Date("2024-01-11T22:00:00Z"),
    'feminine-masculine': -3,
    'dark-light': -1,
    'child-parent': 1,
    frequency: 6,
    label: "Melancholy",
    notes: "Reflecting on the past",
    limitingBeliefs: "My past defines who I am and limits what I can become"
  },
  {
    id: "10",
    timestamp: new Date("2024-01-11T15:45:00Z"),
    'feminine-masculine': 2,
    'dark-light': 2,
    'child-parent': -1,
    frequency: 8,
    label: "Determined",
    notes: "Working on an important project",
    limitingBeliefs: "I must achieve success at all costs or I'm a failure"
  }
];

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
export const calculateEmotionScore = (emotion: Emotion): number => {
  const average = (Math.abs(emotion['feminine-masculine']) + Math.abs(emotion['dark-light']) + Math.abs(emotion['child-parent'])) / 3;
  return Math.round(average * 10) / 10; // Round to 1 decimal place
};