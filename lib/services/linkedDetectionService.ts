/**
 * Linked Detection Service
 * Loads related emotions, parts, and needs from the same conversations
 */

import { supabase } from '@/lib/supabase';
import { DetectedItem } from '@/lib/database.types';
import { EmotionBubbleData } from '@/lib/types/bubbleChart';
import { PartBubbleData, NeedBubbleData } from '@/lib/types/partsNeedsChart';
import {
  transformDetectedEmotions,
  transformDetectedParts,
  transformDetectedNeeds
} from '@/lib/utils/detectionDataTransform';

export interface LinkedDetectionData {
  emotions: EmotionBubbleData[];
  parts: PartBubbleData[];
  needs: NeedBubbleData[];
  conversationIds: string[];
}

/**
 * Load linked detection data from the same conversations
 * @param conversationIds Array of conversation IDs to load data from
 * @param userId User ID
 * @returns Linked emotions, parts, and needs from those conversations
 */
export async function loadLinkedDetectionData(
  conversationIds: string[],
  userId: string
): Promise<LinkedDetectionData> {
  try {
    if (!conversationIds || conversationIds.length === 0) {
      console.log('No conversation IDs provided for linked detection');
      return { emotions: [], parts: [], needs: [], conversationIds: [] };
    }

    // Filter out any invalid conversation IDs (like "user-xxx" format)
    const validConversationIds = conversationIds.filter(id =>
      id && !id.startsWith('user-') && id.length > 10
    );

    if (validConversationIds.length === 0) {
      console.log('No valid conversation IDs for linked detection');
      return { emotions: [], parts: [], needs: [], conversationIds: [] };
    }

    console.log('Loading linked detection data for conversations:', validConversationIds);

    // Load all detected data for these conversations in parallel
    const [emotionsResponse, partsResponse, needsResponse] = await Promise.all([
      supabase
        .from('detected_emotions')
        .select('*')
        .in('conversation_id', validConversationIds)
        .eq('user_id', userId),
      supabase
        .from('detected_parts')
        .select('*')
        .in('conversation_id', validConversationIds)
        .eq('user_id', userId),
      supabase
        .from('detected_needs')
        .select('*')
        .in('conversation_id', validConversationIds)
        .eq('user_id', userId),
    ]);

    // Handle errors
    if (emotionsResponse.error) {
      console.error('Error loading linked emotions:', emotionsResponse.error);
    }
    if (partsResponse.error) {
      console.error('Error loading linked parts:', partsResponse.error);
    }
    if (needsResponse.error) {
      console.error('Error loading linked needs:', needsResponse.error);
    }

    // Aggregate and deduplicate detected items by name
    const emotionMap = new Map<string, DetectedItem>();
    const partMap = new Map<string, DetectedItem>();
    const needMap = new Map<string, DetectedItem>();

    // Process emotions with deduplication
    if (emotionsResponse.data) {
      emotionsResponse.data.forEach(record => {
        if (record.emotions && Array.isArray(record.emotions)) {
          record.emotions.forEach((emotion: DetectedItem) => {
            if (emotion && emotion.name) {
              const key = emotion.name.toLowerCase().trim();
              if (emotionMap.has(key)) {
                // Increment frequency for existing item
                const existing = emotionMap.get(key)!;
                existing.frequency = (existing.frequency || 1) + (emotion.frequency || 1);
              } else {
                // Add new item with frequency
                emotionMap.set(key, {
                  ...emotion,
                  frequency: emotion.frequency || 1
                });
              }
            }
          });
        }
      });
    }

    // Process parts with deduplication
    if (partsResponse.data) {
      partsResponse.data.forEach(record => {
        if (record.parts && Array.isArray(record.parts)) {
          record.parts.forEach((part: DetectedItem) => {
            if (part && part.name) {
              const key = part.name.toLowerCase().trim();
              if (partMap.has(key)) {
                // Increment frequency for existing item
                const existing = partMap.get(key)!;
                existing.frequency = (existing.frequency || 1) + (part.frequency || 1);
              } else {
                // Add new item with frequency
                partMap.set(key, {
                  ...part,
                  frequency: part.frequency || 1
                });
              }
            }
          });
        }
      });
    }

    // Process needs with deduplication
    if (needsResponse.data) {
      needsResponse.data.forEach(record => {
        if (record.needs && Array.isArray(record.needs)) {
          record.needs.forEach((need: DetectedItem) => {
            if (need && need.name) {
              const key = need.name.toLowerCase().trim();
              if (needMap.has(key)) {
                // Increment frequency for existing item
                const existing = needMap.get(key)!;
                existing.frequency = (existing.frequency || 1) + (need.frequency || 1);
              } else {
                // Add new item with frequency
                needMap.set(key, {
                  ...need,
                  frequency: need.frequency || 1
                });
              }
            }
          });
        }
      });
    }

    // Convert maps back to arrays
    const allEmotions: DetectedItem[] = Array.from(emotionMap.values());
    const allParts: DetectedItem[] = Array.from(partMap.values());
    const allNeeds: DetectedItem[] = Array.from(needMap.values());

    console.log('Aggregated linked data:', {
      emotions: allEmotions.length,
      parts: allParts.length,
      needs: allNeeds.length
    });

    // Transform to bubble chart format
    const transformedEmotions = allEmotions.length > 0
      ? transformDetectedEmotions(allEmotions, validConversationIds)
      : [];

    const transformedParts = allParts.length > 0
      ? transformDetectedParts(allParts, validConversationIds)
      : [];

    const transformedNeeds = allNeeds.length > 0
      ? transformDetectedNeeds(allNeeds, validConversationIds)
      : [];

    return {
      emotions: transformedEmotions,
      parts: transformedParts,
      needs: transformedNeeds,
      conversationIds: validConversationIds
    };

  } catch (error) {
    console.error('Error loading linked detection data:', error);
    return { emotions: [], parts: [], needs: [], conversationIds: [] };
  }
}

/**
 * Load linked parts and needs for a given emotion
 * @param emotion Emotion data containing conversation IDs
 * @param userId User ID
 * @returns Linked parts and needs from the same conversations
 */
export async function loadLinkedDataForEmotion(
  emotion: EmotionBubbleData,
  userId: string
): Promise<{ parts: PartBubbleData[], needs: NeedBubbleData[] }> {
  const linkedData = await loadLinkedDetectionData(emotion.conversationIds, userId);
  return {
    parts: linkedData.parts,
    needs: linkedData.needs
  };
}

/**
 * Load linked emotions and needs for a given part
 * @param part Part data containing conversation IDs
 * @param userId User ID
 * @returns Linked emotions and needs from the same conversations
 */
export async function loadLinkedDataForPart(
  part: PartBubbleData,
  userId: string
): Promise<{ emotions: EmotionBubbleData[], needs: NeedBubbleData[] }> {
  const linkedData = await loadLinkedDetectionData(part.conversationIds, userId);
  return {
    emotions: linkedData.emotions,
    needs: linkedData.needs
  };
}

/**
 * Load linked emotions and parts for a given need
 * @param need Need data containing conversation IDs
 * @param userId User ID
 * @returns Linked emotions and parts from the same conversations
 */
export async function loadLinkedDataForNeed(
  need: NeedBubbleData,
  userId: string
): Promise<{ emotions: EmotionBubbleData[], parts: PartBubbleData[] }> {
  const linkedData = await loadLinkedDetectionData(need.conversationIds, userId);
  return {
    emotions: linkedData.emotions,
    parts: linkedData.parts
  };
}