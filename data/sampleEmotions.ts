export interface Emotion {
  id: string;
  timestamp: Date;
  masculine: number; // -3 to 3
  light: number; // -3 to 3
  child: number; // -3 to 3
  frequency: number; // 1 to 10 scale for color coding
  label?: string;
  notes?: string;
}

export const sampleEmotions: Emotion[] = [
  {
    id: "1",
    timestamp: new Date("2024-01-15T09:30:00Z"),
    masculine: 2,
    light: 1,
    child: -1,
    frequency: 7,
    label: "Confident",
    notes: "Feeling ready to tackle the day ahead"
  },
  {
    id: "2",
    timestamp: new Date("2024-01-15T14:15:00Z"),
    masculine: -1,
    light: -2,
    child: 2,
    frequency: 4,
    label: "Overwhelmed",
    notes: "Too many tasks at once"
  },
  {
    id: "3",
    timestamp: new Date("2024-01-14T20:45:00Z"),
    masculine: 0,
    light: 3,
    child: 1,
    frequency: 9,
    label: "Peaceful",
    notes: "Evening meditation session"
  },
  {
    id: "4",
    timestamp: new Date("2024-01-14T12:00:00Z"),
    masculine: 1,
    light: -1,
    child: -2,
    frequency: 6,
    label: "Frustrated",
    notes: "Meeting didn't go as planned"
  },
  {
    id: "5",
    timestamp: new Date("2024-01-13T18:30:00Z"),
    masculine: -2,
    light: 2,
    child: 3,
    frequency: 8,
    label: "Joyful",
    notes: "Spending time with friends"
  },
  {
    id: "6",
    timestamp: new Date("2024-01-13T07:00:00Z"),
    masculine: 0,
    light: 0,
    child: 0,
    frequency: 5,
    label: "Neutral",
    notes: "Just woke up, feeling balanced"
  },
  {
    id: "7",
    timestamp: new Date("2024-01-12T16:20:00Z"),
    masculine: 3,
    light: -3,
    child: -3,
    frequency: 3,
    label: "Angry",
    notes: "Traffic jam made me late"
  },
  {
    id: "8",
    timestamp: new Date("2024-01-12T10:15:00Z"),
    masculine: -1,
    light: 1,
    child: 2,
    frequency: 7,
    label: "Curious",
    notes: "Learning something new"
  },
  {
    id: "9",
    timestamp: new Date("2024-01-11T22:00:00Z"),
    masculine: -3,
    light: -1,
    child: 1,
    frequency: 6,
    label: "Melancholy",
    notes: "Reflecting on the past"
  },
  {
    id: "10",
    timestamp: new Date("2024-01-11T15:45:00Z"),
    masculine: 2,
    light: 2,
    child: -1,
    frequency: 8,
    label: "Determined",
    notes: "Working on an important project"
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
  return `(${emotion.masculine}, ${emotion.light}, ${emotion.child})`;
};