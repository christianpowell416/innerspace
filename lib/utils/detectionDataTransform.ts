/**
 * Data Transformation Utilities for Detection to Bubble Chart Conversion
 *
 * Transforms simple string arrays from emotion/parts/needs detection
 * into rich bubble chart data objects for visualization
 */

import {
  EmotionBubbleData,
  getEmotionColor,
  getEmotionCategory
} from '../types/bubbleChart';
import {
  PartBubbleData,
  NeedBubbleData,
  getPartColor,
  getNeedColor,
  getPartCategory,
  getNeedCategory
} from '../types/partsNeedsChart';
import { DetectedItem } from '../database.types';
import { getEmotionColor as getConsciousnessColor } from '../constants/validEmotions';

/**
 * Convert text to title case (first letter of each word uppercase)
 */
const toTitleCase = (text: string): string => {
  return text.toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Tracks frequency and metadata for detected items across a conversation session
 */
interface DetectionTracker {
  count: number;
  firstDetected: Date;
  lastDetected: Date;
  conversationId: string;
}

/**
 * Session-based tracking for detection frequency
 * Resets when conversation resets
 */
class DetectionSessionTracker {
  private emotionTracking = new Map<string, DetectionTracker>();
  private partTracking = new Map<string, DetectionTracker>();
  private needTracking = new Map<string, DetectionTracker>();
  private currentConversationId: string = '';

  setConversationId(id: string) {
    this.currentConversationId = id;
  }

  reset() {
    this.emotionTracking.clear();
    this.partTracking.clear();
    this.needTracking.clear();
    this.currentConversationId = '';
  }

  private updateTracker(
    map: Map<string, DetectionTracker>,
    item: string | DetectedItem
  ): DetectionTracker {
    // Handle DetectedItem objects or string format
    const itemName = typeof item === 'string' ? item : item?.name;

    // Handle undefined or null items
    if (!itemName) {
      console.warn('DetectionSessionTracker: Received undefined or null item');
      return {
        count: 0,
        firstDetected: new Date(),
        lastDetected: new Date(),
        conversationId: this.currentConversationId
      };
    }

    const normalizedItem = itemName.toLowerCase().trim();
    const existing = map.get(normalizedItem);
    const now = new Date();

    if (existing) {
      existing.count += 1;
      existing.lastDetected = now;
      return existing;
    } else {
      const tracker: DetectionTracker = {
        count: 1,
        firstDetected: now,
        lastDetected: now,
        conversationId: this.currentConversationId
      };
      map.set(normalizedItem, tracker);
      return tracker;
    }
  }

  trackEmotion(emotion: string | DetectedItem): DetectionTracker {
    return this.updateTracker(this.emotionTracking, emotion);
  }

  trackPart(part: string | DetectedItem): DetectionTracker {
    return this.updateTracker(this.partTracking, part);
  }

  trackNeed(need: string | DetectedItem): DetectionTracker {
    return this.updateTracker(this.needTracking, need);
  }
}

// Global session tracker instance
const sessionTracker = new DetectionSessionTracker();

/**
 * Calculate bubble radius based on frequency and intensity
 */
const calculateRadius = (frequency: number, intensity: number): number => {
  // Base radius on frequency, with intensity as a modifier
  const baseRadius = Math.max(18, Math.min(45, frequency * 3.5 + 10));
  const intensityModifier = intensity * 0.5; // Small intensity adjustment
  return Math.max(18, Math.min(45, baseRadius + intensityModifier));
};

/**
 * Calculate intensity based on frequency and context
 */
const calculateIntensity = (frequency: number): number => {
  // Higher frequency suggests stronger presence/intensity
  return Math.min(10, frequency * 2 + Math.random() * 2);
};

/**
 * Transform detected emotions array to EmotionBubbleData array
 */
export const transformDetectedEmotions = (
  emotions: DetectedItem[],
  conversationIds?: string | string[]
): EmotionBubbleData[] => {
  // Handle both string and array formats for conversationIds
  const idsArray = Array.isArray(conversationIds)
    ? conversationIds
    : conversationIds ? [conversationIds] : [];

  // Use the first conversation ID for session tracking (backward compatibility)
  const primaryConversationId = idsArray[0] || `conv-${Date.now()}`;
  sessionTracker.setConversationId(primaryConversationId);

  // Filter out invalid items and map valid ones
  return emotions
    .filter(emotionItem => emotionItem && emotionItem.name)
    .map((emotionItem, index) => {
    const emotion = emotionItem.name;
    const tracker = sessionTracker.trackEmotion(emotionItem);  // Pass the full item

    // Use the intensity from the DetectedItem if available, otherwise calculate it
    const intensity = emotionItem.intensity !== undefined
      ? emotionItem.intensity
      : calculateIntensity(tracker.count);

    const radius = calculateRadius(tracker.count, intensity);

    return {
      id: `detected-emotion-${emotion.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`,
      emotion: toTitleCase(emotion), // Title case for headings
      frequency: tracker.count,
      intensity,
      // Use the color from DetectedItem if available, otherwise use consciousness-based color
      color: emotionItem.color || getConsciousnessColor(emotion) || getEmotionColor(emotion),
      radius,
      category: getEmotionCategory(emotion),
      lastSeen: tracker.lastDetected,
      conversationIds: idsArray.length > 0 ? idsArray : [`conv-${Date.now()}`],
    };
  });
};

/**
 * Transform detected parts array to PartBubbleData array
 */
export const transformDetectedParts = (
  parts: DetectedItem[],
  conversationIds?: string | string[]
): PartBubbleData[] => {
  // Handle both string and array formats for conversationIds
  const idsArray = Array.isArray(conversationIds)
    ? conversationIds
    : conversationIds ? [conversationIds] : [];

  // Use the first conversation ID for session tracking (backward compatibility)
  const primaryConversationId = idsArray[0] || `conv-${Date.now()}`;
  sessionTracker.setConversationId(primaryConversationId);

  // Filter out invalid items and map valid ones
  return parts
    .filter(partItem => partItem && partItem.name)
    .map((partItem, index) => {
    const part = partItem.name;
    const tracker = sessionTracker.trackPart(partItem);  // Pass the full item
    const intensity = calculateIntensity(tracker.count);
    const radius = calculateRadius(tracker.count, intensity);

    return {
      id: `detected-part-${part.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`,
      name: toTitleCase(part), // Title case for headings
      frequency: tracker.count,
      intensity,
      color: getPartColor(part),
      radius,
      category: getPartCategory(part),
      lastSeen: tracker.lastDetected,
      conversationIds: idsArray.length > 0 ? idsArray : [`conv-${Date.now()}`],
    };
  });
};

/**
 * Transform detected needs array to NeedBubbleData array
 */
export const transformDetectedNeeds = (
  needs: DetectedItem[],
  conversationIds?: string | string[]
): NeedBubbleData[] => {
  // Handle both string and array formats for conversationIds
  const idsArray = Array.isArray(conversationIds)
    ? conversationIds
    : conversationIds ? [conversationIds] : [];

  // Use the first conversation ID for session tracking (backward compatibility)
  const primaryConversationId = idsArray[0] || `conv-${Date.now()}`;
  sessionTracker.setConversationId(primaryConversationId);

  // Filter out invalid items and map valid ones
  return needs
    .filter(needItem => needItem && needItem.name)
    .map((needItem, index) => {
    const need = needItem.name;
    const tracker = sessionTracker.trackNeed(needItem);  // Pass the full item
    const intensity = calculateIntensity(tracker.count);
    const radius = calculateRadius(tracker.count, intensity);

    return {
      id: `detected-need-${need.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`,
      name: toTitleCase(need), // Title case for headings
      frequency: tracker.count,
      intensity,
      color: getNeedColor(need),
      radius,
      category: getNeedCategory(need),
      lastSeen: tracker.lastDetected,
      conversationIds: idsArray.length > 0 ? idsArray : [`conv-${Date.now()}`],
    };
  });
};

/**
 * Reset session tracking (call when conversation resets)
 */
export const resetDetectionTracking = () => {
  sessionTracker.reset();
};

/**
 * Set conversation ID for tracking
 */
export const setDetectionConversationId = (id: string) => {
  sessionTracker.setConversationId(id);
};

/**
 * Get current tracking stats for debugging
 */
export const getDetectionStats = () => {
  return {
    emotionCount: sessionTracker['emotionTracking'].size,
    partCount: sessionTracker['partTracking'].size,
    needCount: sessionTracker['needTracking'].size,
  };
};