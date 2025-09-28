/**
 * Innerspace Data Service
 * Aggregates detected emotions, parts, and needs from conversations for the Innerspace page
 */

import { getAggregatedDetectedData } from './detectedDataService';
import { DetectedItem } from '@/lib/database.types';
import { EmotionBubbleData } from '@/lib/types/bubbleChart';
import { PartBubbleData, NeedBubbleData } from '@/lib/types/partsNeedsChart';
import { getEmotionColor, getPartColor, getNeedColor } from '@/lib/utils/dataColors';
import { supabase } from '@/lib/supabase';

/**
 * Load all emotions for a user from detected_emotions table
 * Aggregates emotions across all conversations
 */
export async function loadInnerspaceEmotions(userId: string): Promise<EmotionBubbleData[]> {
  try {
    console.log('🎯 Loading innerspace emotions for user:', userId);

    // Get all detected emotions for this user
    const { data, error } = await supabase
      .from('detected_emotions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error loading innerspace emotions:', error);
      throw error;
    }

    // Aggregate emotions across all conversations
    const emotionMap = new Map<string, {
      name: string;
      intensity: number;
      frequency: number;
      conversationIds: string[];
      lastSeen: Date;
    }>();

    data?.forEach(record => {
      if (record.emotions && Array.isArray(record.emotions)) {
        record.emotions.forEach((emotion: DetectedItem) => {
          const existing = emotionMap.get(emotion.name) || {
            name: emotion.name,
            intensity: 0,
            frequency: 0,
            conversationIds: [],
            lastSeen: new Date(record.created_at || Date.now()),
          };

          // Update aggregated data
          existing.intensity = Math.max(existing.intensity, emotion.intensity || 50);
          existing.frequency += 1;
          existing.conversationIds.push(record.conversation_id);

          // Keep most recent date
          const recordDate = new Date(record.created_at || Date.now());
          if (recordDate > existing.lastSeen) {
            existing.lastSeen = recordDate;
          }

          emotionMap.set(emotion.name, existing);
        });
      }
    });

    // Transform to bubble chart format
    const bubbles: EmotionBubbleData[] = Array.from(emotionMap.values()).map(emotion => ({
      id: `emotion-${emotion.name}`,
      emotion: emotion.name,
      frequency: emotion.frequency,
      intensity: emotion.intensity,
      color: getEmotionColor(emotion.name),
      radius: Math.max(18, Math.min(45, emotion.frequency * 3 + emotion.intensity * 0.2)),
      category: 'detected',
      lastSeen: emotion.lastSeen,
      conversationIds: [...new Set(emotion.conversationIds)], // Remove duplicates
    }));

    console.log('✅ Loaded innerspace emotions:', bubbles.length);
    return bubbles;

  } catch (error) {
    console.error('❌ loadInnerspaceEmotions error:', error);
    return [];
  }
}

/**
 * Load all parts for a user from detected_parts table
 * Aggregates parts across all conversations
 */
export async function loadInnerspaceParts(userId: string): Promise<PartBubbleData[]> {
  try {
    console.log('🎯 Loading innerspace parts for user:', userId);

    // Get all detected parts for this user
    const { data, error } = await supabase
      .from('detected_parts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error loading innerspace parts:', error);
      throw error;
    }

    // Aggregate parts across all conversations
    const partMap = new Map<string, {
      name: string;
      type: string;
      intensity: number;
      frequency: number;
      conversationIds: string[];
      lastSeen: Date;
    }>();

    data?.forEach(record => {
      if (record.parts && Array.isArray(record.parts)) {
        record.parts.forEach((part: DetectedItem) => {
          const existing = partMap.get(part.name) || {
            name: part.name,
            type: part.type || 'protector',
            intensity: 0,
            frequency: 0,
            conversationIds: [],
            lastSeen: new Date(record.created_at || Date.now()),
          };

          // Update aggregated data
          existing.intensity = Math.max(existing.intensity, part.intensity || 50);
          existing.frequency += 1;
          existing.conversationIds.push(record.conversation_id);

          // Keep most recent date
          const recordDate = new Date(record.created_at || Date.now());
          if (recordDate > existing.lastSeen) {
            existing.lastSeen = recordDate;
          }

          partMap.set(part.name, existing);
        });
      }
    });

    // Transform to bubble chart format
    const bubbles: PartBubbleData[] = Array.from(partMap.values()).map(part => ({
      id: `part-${part.name}`,
      name: part.name,
      frequency: part.frequency,
      intensity: part.intensity,
      color: getPartColor(part.name),
      radius: Math.max(18, Math.min(45, part.frequency * 3 + part.intensity * 0.2)),
      category: part.type as 'protector' | 'exile' | 'firefighter' | 'self',
      lastSeen: part.lastSeen,
      conversationIds: [...new Set(part.conversationIds)], // Remove duplicates
    }));

    console.log('✅ Loaded innerspace parts:', bubbles.length);
    return bubbles;

  } catch (error) {
    console.error('❌ loadInnerspaceParts error:', error);
    return [];
  }
}

/**
 * Load all needs for a user from detected_needs table
 * Aggregates needs across all conversations
 */
export async function loadInnerspaceNeeds(userId: string): Promise<NeedBubbleData[]> {
  try {
    console.log('🎯 Loading innerspace needs for user:', userId);

    // Get all detected needs for this user
    const { data, error } = await supabase
      .from('detected_needs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error loading innerspace needs:', error);
      throw error;
    }

    // Aggregate needs across all conversations
    const needMap = new Map<string, {
      name: string;
      intensity: number;
      frequency: number;
      conversationIds: string[];
      lastSeen: Date;
    }>();

    data?.forEach(record => {
      if (record.needs && Array.isArray(record.needs)) {
        record.needs.forEach((need: DetectedItem) => {
          const existing = needMap.get(need.name) || {
            name: need.name,
            intensity: 0,
            frequency: 0,
            conversationIds: [],
            lastSeen: new Date(record.created_at || Date.now()),
          };

          // Update aggregated data
          existing.intensity = Math.max(existing.intensity, need.intensity || 50);
          existing.frequency += 1;
          existing.conversationIds.push(record.conversation_id);

          // Keep most recent date
          const recordDate = new Date(record.created_at || Date.now());
          if (recordDate > existing.lastSeen) {
            existing.lastSeen = recordDate;
          }

          needMap.set(need.name, existing);
        });
      }
    });

    // Transform to bubble chart format
    const bubbles: NeedBubbleData[] = Array.from(needMap.values()).map(need => ({
      id: `need-${need.name}`,
      name: need.name,
      frequency: need.frequency,
      intensity: need.intensity,
      color: getNeedColor(need.name),
      radius: Math.max(18, Math.min(45, need.frequency * 3 + need.intensity * 0.2)),
      category: 'detected',
      lastSeen: need.lastSeen,
      conversationIds: [...new Set(need.conversationIds)], // Remove duplicates
    }));

    console.log('✅ Loaded innerspace needs:', bubbles.length);
    return bubbles;

  } catch (error) {
    console.error('❌ loadInnerspaceNeeds error:', error);
    return [];
  }
}

/**
 * Get statistics for emotions from detected data
 */
export async function getInnerspaceEmotionStats(userId: string) {
  try {
    const emotions = await loadInnerspaceEmotions(userId);

    if (emotions.length === 0) {
      return {
        totalEmotions: 0,
        avgIntensity: 0,
        mostFrequent: null,
        mostIntense: null,
        recentTrends: [],
      };
    }

    // Calculate statistics
    const totalEmotions = emotions.length;
    const avgIntensity = emotions.reduce((sum, e) => sum + e.intensity, 0) / totalEmotions;
    const mostFrequent = emotions.reduce((max, e) => e.frequency > max.frequency ? e : max);
    const mostIntense = emotions.reduce((max, e) => e.intensity > max.intensity ? e : max);

    return {
      totalEmotions,
      avgIntensity: Math.round(avgIntensity),
      mostFrequent: mostFrequent.emotion,
      mostIntense: mostIntense.emotion,
      recentTrends: emotions.slice(0, 5).map(e => e.emotion),
    };

  } catch (error) {
    console.error('Error calculating emotion stats:', error);
    return {
      totalEmotions: 0,
      avgIntensity: 0,
      mostFrequent: null,
      mostIntense: null,
      recentTrends: [],
    };
  }
}