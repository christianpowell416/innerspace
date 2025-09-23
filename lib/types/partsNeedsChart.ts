/**
 * Parts and Needs Bubble Chart Types and Interfaces
 *
 * Defines the data structures for parts and needs bubble chart visualization
 */

export enum PartCategory {
  MANAGER = 'manager',
  FIREFIGHTER = 'firefighter',
  EXILE = 'exile'
}

export enum NeedCategory {
  SAFETY = 'safety',
  CONNECTION = 'connection',
  AUTONOMY = 'autonomy',
  RECOGNITION = 'recognition',
  MEANING = 'meaning',
  GROWTH = 'growth'
}

export interface PartBubbleData {
  id: string;
  name: string;
  frequency: number;
  intensity: number;
  color: string;
  radius: number;
  category: PartCategory;
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

export interface NeedBubbleData {
  id: string;
  name: string;
  frequency: number;
  intensity: number;
  color: string;
  radius: number;
  category: NeedCategory;
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

export interface CompactBubbleChartConfig {
  width: number;
  height: number;
  minRadius: number;
  maxRadius: number;
  padding: number;
  centerForce: number;
  collisionStrength: number;
  velocityDecay: number;
}

export interface PartsBubbleChartCallbacks {
  onBubblePress?: (bubble: PartBubbleData) => void;
  onBubbleLongPress?: (bubble: PartBubbleData) => void;
}

export interface NeedsBubbleChartCallbacks {
  onBubblePress?: (bubble: NeedBubbleData) => void;
  onBubbleLongPress?: (bubble: NeedBubbleData) => void;
}

// Color palette for part categories (warm tones)
export const PART_COLORS = {
  [PartCategory.MANAGER]: '#FF6B35',     // Orange-red (controlling, organizing)
  [PartCategory.FIREFIGHTER]: '#E74C3C', // Red (reactive, protective)
  [PartCategory.EXILE]: '#9B59B6',       // Purple (wounded, vulnerable)
} as const;

// Color palette for need categories (cool/neutral tones)
export const NEED_COLORS = {
  [NeedCategory.SAFETY]: '#3498DB',      // Blue (security, stability)
  [NeedCategory.CONNECTION]: '#2ECC71',  // Green (relationships, belonging)
  [NeedCategory.AUTONOMY]: '#F39C12',    // Orange (freedom, choice)
  [NeedCategory.RECOGNITION]: '#E67E22', // Orange (appreciation, acknowledgment)
  [NeedCategory.MEANING]: '#9B59B6',     // Purple (purpose, significance)
  [NeedCategory.GROWTH]: '#1ABC9C',      // Teal (learning, development)
} as const;

// Parts categorization mapping (IFS-based)
export const PART_CATEGORIZATION: Record<string, PartCategory> = {
  // Manager Parts
  'critical': PartCategory.MANAGER,
  'perfectionist': PartCategory.MANAGER,
  'controller': PartCategory.MANAGER,
  'caretaker': PartCategory.MANAGER,
  'achiever': PartCategory.MANAGER,
  'pleaser': PartCategory.MANAGER,
  'organizer': PartCategory.MANAGER,
  'responsible': PartCategory.MANAGER,
  'logical': PartCategory.MANAGER,

  // Firefighter Parts
  'rebellious': PartCategory.FIREFIGHTER,
  'addictive': PartCategory.FIREFIGHTER,
  'aggressive': PartCategory.FIREFIGHTER,
  'impulsive': PartCategory.FIREFIGHTER,
  'escapist': PartCategory.FIREFIGHTER,
  'reactive': PartCategory.FIREFIGHTER,
  'protective': PartCategory.FIREFIGHTER,

  // Exile Parts
  'inner child': PartCategory.EXILE,
  'wounded': PartCategory.EXILE,
  'abandoned': PartCategory.EXILE,
  'rejected': PartCategory.EXILE,
  'hurt': PartCategory.EXILE,
  'vulnerable': PartCategory.EXILE,
  'creative': PartCategory.EXILE,
  'playful': PartCategory.EXILE,
  'innocent': PartCategory.EXILE,
};

// Needs categorization mapping
export const NEED_CATEGORIZATION: Record<string, NeedCategory> = {
  // Safety Needs
  'security': NeedCategory.SAFETY,
  'stability': NeedCategory.SAFETY,
  'predictability': NeedCategory.SAFETY,
  'protection': NeedCategory.SAFETY,
  'trust': NeedCategory.SAFETY,

  // Connection Needs
  'love': NeedCategory.CONNECTION,
  'belonging': NeedCategory.CONNECTION,
  'intimacy': NeedCategory.CONNECTION,
  'community': NeedCategory.CONNECTION,
  'understanding': NeedCategory.CONNECTION,
  'acceptance': NeedCategory.CONNECTION,
  'companionship': NeedCategory.CONNECTION,

  // Autonomy Needs
  'freedom': NeedCategory.AUTONOMY,
  'independence': NeedCategory.AUTONOMY,
  'choice': NeedCategory.AUTONOMY,
  'space': NeedCategory.AUTONOMY,
  'authenticity': NeedCategory.AUTONOMY,
  'self-expression': NeedCategory.AUTONOMY,

  // Recognition Needs
  'appreciation': NeedCategory.RECOGNITION,
  'acknowledgment': NeedCategory.RECOGNITION,
  'respect': NeedCategory.RECOGNITION,
  'validation': NeedCategory.RECOGNITION,
  'visibility': NeedCategory.RECOGNITION,

  // Meaning Needs
  'purpose': NeedCategory.MEANING,
  'contribution': NeedCategory.MEANING,
  'legacy': NeedCategory.MEANING,
  'spirituality': NeedCategory.MEANING,
  'values': NeedCategory.MEANING,

  // Growth Needs
  'learning': NeedCategory.GROWTH,
  'challenge': NeedCategory.GROWTH,
  'creativity': NeedCategory.GROWTH,
  'discovery': NeedCategory.GROWTH,
  'progress': NeedCategory.GROWTH,
};

export const getPartCategory = (partName: string): PartCategory => {
  const normalizedName = partName.toLowerCase().trim();
  return PART_CATEGORIZATION[normalizedName] || PartCategory.MANAGER;
};

export const getNeedCategory = (needName: string): NeedCategory => {
  const normalizedName = needName.toLowerCase().trim();
  return NEED_CATEGORIZATION[normalizedName] || NeedCategory.CONNECTION;
};

export const getPartColor = (partName: string): string => {
  const category = getPartCategory(partName);
  return PART_COLORS[category];
};

export const getNeedColor = (needName: string): string => {
  const category = getNeedCategory(needName);
  return NEED_COLORS[category];
};

export const getCompactBubbleConfig = (width: number, height: number): CompactBubbleChartConfig => ({
  width,
  height,
  minRadius: 18, // Increased minimum radius to prevent text cutoff
  maxRadius: Math.min(width, height) * 0.25, // Dynamic max radius based on chart size, up to 25% of smaller dimension
  padding: 1,
  centerForce: 0.1,
  collisionStrength: 0.8,
  velocityDecay: 0.6,
});