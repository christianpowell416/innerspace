/**
 * Data Colors Utility
 * Provides consistent color schemes for emotions, parts, and needs
 */

// Emotion color mapping
const EMOTION_COLORS: Record<string, string> = {
  // Primary emotions
  'Joy': '#4ECDC4',
  'Sadness': '#87CEEB',
  'Anger': '#FF4500',
  'Fear': '#DDA0DD',
  'Surprise': '#FFD700',
  'Disgust': '#9ACD32',

  // Secondary emotions
  'Anxiety': '#FF6B6B',
  'Excitement': '#FFD700',
  'Frustration': '#FFA07A',
  'Contentment': '#98FB98',
  'Overwhelm': '#DDA0DD',
  'Happiness': '#4ECDC4',
  'Worry': '#FF6B6B',
  'Calm': '#98FB98',
  'Stress': '#FF4500',
  'Peace': '#87CEEB',

  // Default fallback colors
  'primary': '#4ECDC4',
  'secondary': '#FFA07A',
  'complex': '#DDA0DD',
  'general': '#87CEEB',
};

// Part color mapping based on IFS types
const PART_COLORS: Record<string, string> = {
  // Part types
  'protector': '#FF6B6B',
  'exile': '#4ECDC4',
  'firefighter': '#DDA0DD',
  'self': '#FFD700',

  // Common part names
  'The Perfectionist': '#FF6B6B',
  'Inner Child': '#4ECDC4',
  'The Caretaker': '#98FB98',
  'The Critic': '#FF4500',
  'The Rebel': '#DDA0DD',
  'Wise Self': '#FFD700',
  'The Achiever': '#87CEEB',
  'The Worrier': '#FFA07A',
  'The People Pleaser': '#98FB98',
  'The Controller': '#FF6B6B',

  // Default fallback
  'default': '#87CEEB',
};

// Need color mapping based on categories
const NEED_COLORS: Record<string, string> = {
  // Need categories
  'physical': '#98FB98',
  'emotional': '#4ECDC4',
  'social': '#FFD700',
  'spiritual': '#DDA0DD',
  'intellectual': '#87CEEB',
  'creative': '#FFA07A',

  // Common needs
  'Connection': '#4ECDC4',
  'Autonomy': '#FFD700',
  'Rest': '#98FB98',
  'Creativity': '#DDA0DD',
  'Safety': '#FF6B6B',
  'Growth': '#87CEEB',
  'Fun': '#FFA07A',
  'Purpose': '#FF4500',
  'Love': '#FF69B4',
  'Recognition': '#FFD700',
  'Understanding': '#4ECDC4',
  'Peace': '#98FB98',

  // Default fallback
  'general': '#87CEEB',
};

/**
 * Get color for an emotion
 */
export function getEmotionColor(emotionName: string): string {
  const normalizedName = emotionName.toLowerCase();

  // Try exact match first
  for (const [key, color] of Object.entries(EMOTION_COLORS)) {
    if (key.toLowerCase() === normalizedName) {
      return color;
    }
  }

  // Try partial match
  for (const [key, color] of Object.entries(EMOTION_COLORS)) {
    if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
      return color;
    }
  }

  // Default color based on hash of name for consistency
  return getHashColor(emotionName, [
    '#4ECDC4', '#FF6B6B', '#FFD700', '#98FB98', '#FFA07A', '#87CEEB', '#DDA0DD'
  ]);
}

/**
 * Get color for a part
 */
export function getPartColor(partName: string): string {
  const normalizedName = partName.toLowerCase();

  // Try exact match first
  for (const [key, color] of Object.entries(PART_COLORS)) {
    if (key.toLowerCase() === normalizedName) {
      return color;
    }
  }

  // Try partial match
  for (const [key, color] of Object.entries(PART_COLORS)) {
    if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
      return color;
    }
  }

  // Default color based on hash of name for consistency
  return getHashColor(partName, [
    '#FF6B6B', '#4ECDC4', '#DDA0DD', '#FFD700', '#98FB98', '#87CEEB', '#FFA07A'
  ]);
}

/**
 * Get color for a need
 */
export function getNeedColor(needName: string): string {
  const normalizedName = needName.toLowerCase();

  // Try exact match first
  for (const [key, color] of Object.entries(NEED_COLORS)) {
    if (key.toLowerCase() === normalizedName) {
      return color;
    }
  }

  // Try partial match
  for (const [key, color] of Object.entries(NEED_COLORS)) {
    if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
      return color;
    }
  }

  // Default color based on hash of name for consistency
  return getHashColor(needName, [
    '#98FB98', '#4ECDC4', '#FFD700', '#DDA0DD', '#87CEEB', '#FFA07A', '#FF6B6B'
  ]);
}

/**
 * Generate a consistent color based on string hash
 */
function getHashColor(str: string, colorPalette: string[]): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  const index = Math.abs(hash) % colorPalette.length;
  return colorPalette[index];
}

/**
 * Get all available emotion colors
 */
export function getEmotionColorPalette(): Record<string, string> {
  return { ...EMOTION_COLORS };
}

/**
 * Get all available part colors
 */
export function getPartColorPalette(): Record<string, string> {
  return { ...PART_COLORS };
}

/**
 * Get all available need colors
 */
export function getNeedColorPalette(): Record<string, string> {
  return { ...NEED_COLORS };
}