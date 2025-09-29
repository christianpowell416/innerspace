/**
 * Valid Emotions from the Emotion Wheel
 * Based on the Plutchik/Geneva Emotion Wheel structure
 *
 * Structure:
 * - Core (7): INVALID - too broad, should trigger clarifying questions
 * - Middle + Outer nested hierarchy: VALID - acceptable specific emotions
 */

/**
 * Core emotions that are TOO BROAD and should not be accepted
 * These should trigger clarifying questions to get more specific
 */
export const INVALID_CORE_EMOTIONS = new Set([
  'Angry',
  'Disgusted',
  'Sad',
  'Happy',
  'Surprised',
  'Bad',
  'Fearful'
]);

/**
 * Full nested hierarchy of valid emotions
 * Each core contains middle emotions, each middle contains outer emotions
 */
export const EMOTION_HIERARCHY = {
  Angry: {
    'Let Down': ['Betrayed', 'Resentful'],
    'Humiliated': ['Disrespected', 'Ridiculed'],
    'Bitter': ['Indignant', 'Violated'],
    'Mad': ['Furious', 'Jealous'],
    'Aggressive': ['Provoked', 'Hostile'],
    'Frustrated': ['Infuriated', 'Annoyed'],
    'Distant': ['Withdrawn', 'Numb'],
    'Critical': ['Skeptical', 'Dismissive']
  },
  Disgusted: {
    'Disapproving': ['Judgmental', 'Embarrassed'],
    'Disappointed': ['Appalled', 'Revolted'],
    'Awful': ['Nauseated', 'Detestable'],
    'Repelled': ['Horrified', 'Hesitant']
  },
  Sad: {
    'Hurt': ['Embarrassed', 'Disappointed'],
    'Depressed': ['Inferior', 'Empty'],
    'Guilty': ['Remorseful', 'Ashamed'],
    'Despair': ['Powerless', 'Grief'],
    'Vulnerable': ['Fragile', 'Victimized'],
    'Lonely': ['Isolated', 'Abandoned']
  },
  Happy: {
    'Optimistic': ['Inspired', 'Hopeful'],
    'Intimate': ['Sensitive', 'Loving'],
    'Peaceful': ['Thankful', 'Content'],
    'Powerful': ['Creative', 'Courageous'],
    'Accepted': ['Valued', 'Respected'],
    'Proud': ['Confident', 'Successful'],
    'Interested': ['Inquisitive', 'Curious'],
    'Joyful': ['Free', 'Excited']
  },
  Surprised: {
    'Startled': ['Shocked', 'Dismayed'],
    'Confused': ['Disillusioned', 'Perplexed'],
    'Amazed': ['Awe', 'Astonished'],
    'Excited': ['Eager', 'Energetic']
  },
  Bad: {
    'Bored': ['Indifferent', 'Apathetic'],
    'Busy': ['Pressured', 'Rushed'],
    'Stressed': ['Overwhelmed', 'Out of control'],
    'Tired': ['Sleepy', 'Unfocussed']
  },
  Fearful: {
    'Scared': ['Helpless', 'Frightened'],
    'Anxious': ['Overwhelmed', 'Worried'],
    'Insecure': ['Inadequate', 'Inferior'],
    'Weak': ['Worthless', 'Insignificant'],
    'Rejected': ['Excluded', 'Persecuted'],
    'Threatened': ['Nervous', 'Exposed']
  }
};

/**
 * Flatten all valid emotions (middle + outer) into a single set for quick validation
 */
export const VALID_SPECIFIC_EMOTIONS = new Set(
  Object.values(EMOTION_HIERARCHY).flatMap(middleObj =>
    Object.entries(middleObj).flatMap(([middle, outers]) => [middle, ...outers])
  )
);

/**
 * Check if an emotion is valid (from middle or outer rings)
 */
export function isValidSpecificEmotion(emotion: string): boolean {
  if (!emotion || typeof emotion !== 'string') {
    return false;
  }

  // Normalize for comparison
  const normalized = emotion.charAt(0).toUpperCase() + emotion.slice(1).toLowerCase();

  // Reject if core
  if (INVALID_CORE_EMOTIONS.has(normalized)) {
    console.log(`❌ Rejected core emotion (too broad): "${emotion}" -> "${normalized}"`);
    return false;
  }

  // Accept if valid
  if (VALID_SPECIFIC_EMOTIONS.has(normalized)) {
    return true;
  }

  // Case-insensitive fallback
  const emotionLower = emotion.toLowerCase();
  for (const validEmotion of VALID_SPECIFIC_EMOTIONS) {
    if (validEmotion.toLowerCase() === emotionLower) {
      return true;
    }
  }

  console.log(`⚠️ Unknown emotion (not in emotion wheel): "${emotion}" -> "${normalized}"`);
  return false;
}

/**
 * Normalize an emotion to its proper form if it's valid
 */
export function normalizeEmotion(emotion: string): string | null {
  if (!emotion || typeof emotion !== 'string') {
    return null;
  }

  const normalized = emotion.charAt(0).toUpperCase() + emotion.slice(1).toLowerCase();

  // TEMPORARILY DISABLED: Reject core emotions
  // if (INVALID_CORE_EMOTIONS.has(normalized)) {
  //   return null;
  // }

  if (VALID_SPECIFIC_EMOTIONS.has(normalized)) {
    return normalized;
  }

  const emotionLower = emotion.toLowerCase();
  for (const validEmotion of VALID_SPECIFIC_EMOTIONS) {
    if (validEmotion.toLowerCase() === emotionLower) {
      return validEmotion;
    }
  }

  // TEMPORARILY: Accept any emotion that wasn't found in the lists
  // This allows emotions like "Fear" that aren't in either list
  return normalized;
  // return null;
}

/**
 * Get emotions to consider for clarifying questions
 * Returns the middle-level emotions for a given core emotion
 * The AI should select 2-3 contextually appropriate ones
 */
export function getEmotionsForClarification(coreEmotion: string): string[] {
  const emotion = coreEmotion.charAt(0).toUpperCase() + coreEmotion.slice(1).toLowerCase();

  if (EMOTION_HIERARCHY[emotion as keyof typeof EMOTION_HIERARCHY]) {
    return Object.keys(EMOTION_HIERARCHY[emotion as keyof typeof EMOTION_HIERARCHY]);
  }

  return [];
}

/**
 * Check if an emotion needs clarification (is a core emotion)
 */
export function needsClarification(emotion: string): boolean {
  const normalized = emotion.charAt(0).toUpperCase() + emotion.slice(1).toLowerCase();
  return INVALID_CORE_EMOTIONS.has(normalized);
}

/**
 * Map of consciousness levels (Hawkins Scale) to colors
 * Based on the provided consciousness scale chart
 */
const CONSCIOUSNESS_COLOR_MAP = {
  // Expanded consciousness (700+) - Purple to deep blue
  enlightenment: '#9B59B6',  // Deep purple
  peace: '#8E44AD',          // Purple
  joy: '#7C3AED',            // Purple-blue

  // Higher consciousness (400-600) - Blue to teal
  love: '#3B82F6',           // Blue
  reason: '#06B6D4',         // Cyan
  acceptance: '#14B8A6',     // Teal
  willingness: '#10B981',    // Emerald green

  // Transition zone (200-350) - Green to yellow-green
  neutrality: '#22C55E',     // Green
  courage: '#84CC16',        // Light green
  pride: '#A3E635',          // Yellow-green

  // Lower consciousness (100-175) - Yellow to orange
  anger: '#EAB308',          // Yellow
  desire: '#F59E0B',         // Amber
  fear: '#FB923C',           // Orange

  // Contracted consciousness (20-75) - Red to dark red
  grief: '#F87171',          // Light red
  apathy: '#EF4444',         // Red
  guilt: '#DC2626',          // Deep red
  shame: '#991B1B'           // Dark red
};

/**
 * Get color for an emotion based on consciousness level
 * Uses the Hawkins Scale of Consciousness to determine color
 */
export function getEmotionColor(emotion: string): string {
  const normalized = emotion.charAt(0).toUpperCase() + emotion.slice(1).toLowerCase();

  // Map specific emotions to consciousness levels and colors
  // Shame-based emotions (20-30)
  if (['Humiliated', 'Embarrassed', 'Ashamed', 'Mortified', 'Worthless', 'Inferior'].includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.shame;
  }

  // Guilt-based emotions (30-50)
  if (['Guilty', 'Remorseful', 'Regretful', 'Apologetic'].includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.guilt;
  }

  // Apathy-based emotions (50-75)
  if (['Apathetic', 'Indifferent', 'Numb', 'Empty', 'Hopeless', 'Depressed'].includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.apathy;
  }

  // Grief-based emotions (75-100)
  if (['Grief', 'Grieving', 'Sorrowful', 'Sad', 'Lonely', 'Abandoned', 'Hurt', 'Disappointed'].includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.grief;
  }

  // Fear-based emotions (100-125)
  if (['Frightened', 'Scared', 'Anxious', 'Worried', 'Nervous', 'Insecure', 'Overwhelmed', 'Helpless', 'Terrified'].includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.fear;
  }

  // Desire-based emotions (125-150)
  if (['Jealous', 'Envious', 'Needy', 'Wanting', 'Craving', 'Obsessed'].includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.desire;
  }

  // Anger-based emotions (150-175)
  if (['Angry', 'Furious', 'Frustrated', 'Irritated', 'Annoyed', 'Resentful', 'Bitter', 'Hostile', 'Aggressive'].includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.anger;
  }

  // Pride-based emotions (175-200)
  if (['Proud', 'Arrogant', 'Superior', 'Critical', 'Judgmental', 'Dismissive', 'Skeptical'].includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.pride;
  }

  // Courage-based emotions (200-250)
  if (['Courageous', 'Confident', 'Determined', 'Empowered', 'Brave', 'Strong'].includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.courage;
  }

  // Neutrality-based emotions (250-310)
  if (['Neutral', 'Balanced', 'Calm', 'Composed', 'Centered', 'Stable'].includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.neutrality;
  }

  // Willingness/Acceptance emotions (310-400)
  if (['Willing', 'Accepting', 'Open', 'Receptive', 'Flexible', 'Understanding', 'Tolerant', 'Patient'].includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.willingness;
  }

  // Reason-based emotions (400-500)
  if (['Curious', 'Interested', 'Thoughtful', 'Analytical', 'Clear', 'Focused'].includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.reason;
  }

  // Love-based emotions (500-540)
  if (['Loving', 'Compassionate', 'Caring', 'Affectionate', 'Warm', 'Grateful', 'Thankful', 'Appreciative'].includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.love;
  }

  // Joy-based emotions (540-600)
  if (['Joyful', 'Happy', 'Excited', 'Enthusiastic', 'Cheerful', 'Playful', 'Elated', 'Ecstatic', 'Delighted'].includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.joy;
  }

  // Peace-based emotions (600-700)
  if (['Peaceful', 'Serene', 'Tranquil', 'Content', 'Satisfied', 'Fulfilled', 'Complete'].includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.peace;
  }

  // Default to grief color for unmatched sad emotions
  if (EMOTION_HIERARCHY.Sad && Object.values(EMOTION_HIERARCHY.Sad).flat().includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.grief;
  }

  // Default to fear color for unmatched fearful emotions
  if (EMOTION_HIERARCHY.Fearful && Object.values(EMOTION_HIERARCHY.Fearful).flat().includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.fear;
  }

  // Default to anger color for unmatched angry emotions
  if (EMOTION_HIERARCHY.Angry && Object.values(EMOTION_HIERARCHY.Angry).flat().includes(normalized)) {
    return CONSCIOUSNESS_COLOR_MAP.anger;
  }

  // Default to neutral gray for unknown emotions
  return '#6B7280';
}

// Export renamed functions for backward compatibility
export const isValidOuterRingEmotion = isValidSpecificEmotion;
