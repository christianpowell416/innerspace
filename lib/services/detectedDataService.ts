/**
 * Detected Data Service
 * Handles saving and loading detected emotions, parts, and needs to/from Supabase
 */

import { supabase } from '@/lib/supabase';
import { DetectedItem, Database } from '@/lib/database.types';

// Type definitions for detected data operations
export interface DetectedDataResult {
  id: string;
  conversation_id: string;
  user_id: string;
  created_at: string;
}

export interface DetectedEmotionsResult extends DetectedDataResult {
  emotions: DetectedItem[];
}

export interface DetectedPartsResult extends DetectedDataResult {
  parts: DetectedItem[];
}

export interface DetectedNeedsResult extends DetectedDataResult {
  needs: DetectedItem[];
}

/**
 * Save detected emotions for a conversation
 */
export async function saveDetectedEmotions(
  conversationId: string,
  userId: string,
  emotions: DetectedItem[]
) {
  try {
    console.log('💾 Saving detected emotions:', { conversationId, userId, emotionCount: emotions.length });

    const emotionData: Database['public']['Tables']['detected_emotions']['Insert'] = {
      conversation_id: conversationId,
      user_id: userId,
      emotions,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('detected_emotions')
      .insert(emotionData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving detected emotions:', error);
      throw new Error(`Failed to save detected emotions: ${error.message}`);
    }

    console.log('✅ Detected emotions saved successfully:', data.id);
    return data;

  } catch (error) {
    console.error('❌ saveDetectedEmotions error:', error);
    throw error;
  }
}

/**
 * Save detected parts for a conversation
 */
export async function saveDetectedParts(
  conversationId: string,
  userId: string,
  parts: DetectedItem[]
) {
  try {
    console.log('💾 Saving detected parts:', { conversationId, userId, partCount: parts.length });

    const partData: Database['public']['Tables']['detected_parts']['Insert'] = {
      conversation_id: conversationId,
      user_id: userId,
      parts,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('detected_parts')
      .insert(partData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving detected parts:', error);
      throw new Error(`Failed to save detected parts: ${error.message}`);
    }

    console.log('✅ Detected parts saved successfully:', data.id);
    return data;

  } catch (error) {
    console.error('❌ saveDetectedParts error:', error);
    throw error;
  }
}

/**
 * Save detected needs for a conversation
 */
export async function saveDetectedNeeds(
  conversationId: string,
  userId: string,
  needs: DetectedItem[]
) {
  try {
    console.log('💾 Saving detected needs:', { conversationId, userId, needCount: needs.length });

    const needData: Database['public']['Tables']['detected_needs']['Insert'] = {
      conversation_id: conversationId,
      user_id: userId,
      needs,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('detected_needs')
      .insert(needData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving detected needs:', error);
      throw new Error(`Failed to save detected needs: ${error.message}`);
    }

    console.log('✅ Detected needs saved successfully:', data.id);
    return data;

  } catch (error) {
    console.error('❌ saveDetectedNeeds error:', error);
    throw error;
  }
}

/**
 * Save all detected data for a conversation in one operation
 */
export async function saveAllDetectedData(
  conversationId: string,
  userId: string,
  detectedData: {
    emotions?: DetectedItem[];
    parts?: DetectedItem[];
    needs?: DetectedItem[];
  }
) {
  try {
    console.log('💾 Saving all detected data:', {
      conversationId,
      userId,
      emotionCount: detectedData.emotions?.length || 0,
      partCount: detectedData.parts?.length || 0,
      needCount: detectedData.needs?.length || 0,
    });

    const results = {
      emotions: null as DetectedEmotionsResult | null,
      parts: null as DetectedPartsResult | null,
      needs: null as DetectedNeedsResult | null,
    };

    // Save emotions if provided
    if (detectedData.emotions && detectedData.emotions.length > 0) {
      results.emotions = await saveDetectedEmotions(conversationId, userId, detectedData.emotions);
    }

    // Save parts if provided
    if (detectedData.parts && detectedData.parts.length > 0) {
      results.parts = await saveDetectedParts(conversationId, userId, detectedData.parts);
    }

    // Save needs if provided
    if (detectedData.needs && detectedData.needs.length > 0) {
      results.needs = await saveDetectedNeeds(conversationId, userId, detectedData.needs);
    }

    console.log('✅ All detected data saved successfully');
    return results;

  } catch (error) {
    console.error('❌ saveAllDetectedData error:', error);
    throw error;
  }
}

/**
 * Load detected emotions for a conversation
 */
export async function loadDetectedEmotions(conversationId: string, userId: string) {
  try {
    console.log('📖 Loading detected emotions:', { conversationId, userId });

    const { data, error } = await supabase
      .from('detected_emotions')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Error loading detected emotions:', error);
      throw new Error(`Failed to load detected emotions: ${error.message}`);
    }

    console.log('✅ Detected emotions loaded');
    return data;

  } catch (error) {
    console.error('❌ loadDetectedEmotions error:', error);
    throw error;
  }
}

/**
 * Load detected parts for a conversation
 */
export async function loadDetectedParts(conversationId: string, userId: string) {
  try {
    console.log('📖 Loading detected parts:', { conversationId, userId });

    const { data, error } = await supabase
      .from('detected_parts')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Error loading detected parts:', error);
      throw new Error(`Failed to load detected parts: ${error.message}`);
    }

    console.log('✅ Detected parts loaded');
    return data;

  } catch (error) {
    console.error('❌ loadDetectedParts error:', error);
    throw error;
  }
}

/**
 * Load detected needs for a conversation
 */
export async function loadDetectedNeeds(conversationId: string, userId: string) {
  try {
    console.log('📖 Loading detected needs:', { conversationId, userId });

    const { data, error } = await supabase
      .from('detected_needs')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Error loading detected needs:', error);
      throw new Error(`Failed to load detected needs: ${error.message}`);
    }

    console.log('✅ Detected needs loaded');
    return data;

  } catch (error) {
    console.error('❌ loadDetectedNeeds error:', error);
    throw error;
  }
}

/**
 * Load all detected data for a conversation
 */
export async function loadAllDetectedData(conversationId: string, userId: string) {
  try {
    console.log('📖 Loading all detected data:', { conversationId, userId });

    const [emotions, parts, needs] = await Promise.all([
      loadDetectedEmotions(conversationId, userId),
      loadDetectedParts(conversationId, userId),
      loadDetectedNeeds(conversationId, userId),
    ]);

    const result = {
      emotions: emotions?.emotions || [],
      parts: parts?.parts || [],
      needs: needs?.needs || [],
    };

    console.log('✅ All detected data loaded:', {
      emotionCount: result.emotions.length,
      partCount: result.parts.length,
      needCount: result.needs.length,
    });

    return result;

  } catch (error) {
    console.error('❌ loadAllDetectedData error:', error);
    throw error;
  }
}

/**
 * Get aggregated detected data for a user across all conversations
 */
export async function getAggregatedDetectedData(userId: string, limit = 100) {
  try {
    console.log('📊 Getting aggregated detected data for user:', userId);

    // Get all detected data with recent conversations first
    const [emotionsData, partsData, needsData] = await Promise.all([
      supabase
        .from('detected_emotions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('detected_parts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('detected_needs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    if (emotionsData.error || partsData.error || needsData.error) {
      const errors = [emotionsData.error, partsData.error, needsData.error].filter(Boolean);
      console.error('❌ Error loading aggregated data:', errors);
      throw new Error(`Failed to load aggregated data: ${errors[0]?.message}`);
    }

    // Aggregate the data
    const allEmotions: DetectedItem[] = [];
    const allParts: DetectedItem[] = [];
    const allNeeds: DetectedItem[] = [];

    emotionsData.data?.forEach(record => allEmotions.push(...record.emotions));
    partsData.data?.forEach(record => allParts.push(...record.parts));
    needsData.data?.forEach(record => allNeeds.push(...record.needs));

    // Count frequencies
    const emotionCounts = countDetectedItems(allEmotions);
    const partCounts = countDetectedItems(allParts);
    const needCounts = countDetectedItems(allNeeds);

    const result = {
      totalConversations: new Set([
        ...emotionsData.data?.map(d => d.conversation_id) || [],
        ...partsData.data?.map(d => d.conversation_id) || [],
        ...needsData.data?.map(d => d.conversation_id) || [],
      ]).size,
      emotions: {
        items: allEmotions,
        counts: emotionCounts,
        totalDetections: allEmotions.length,
      },
      parts: {
        items: allParts,
        counts: partCounts,
        totalDetections: allParts.length,
      },
      needs: {
        items: allNeeds,
        counts: needCounts,
        totalDetections: allNeeds.length,
      },
    };

    console.log('✅ Aggregated data loaded:', {
      conversations: result.totalConversations,
      emotions: result.emotions.totalDetections,
      parts: result.parts.totalDetections,
      needs: result.needs.totalDetections,
    });

    return result;

  } catch (error) {
    console.error('❌ getAggregatedDetectedData error:', error);
    throw error;
  }
}

/**
 * Helper function to count detected items by name
 */
function countDetectedItems(items: DetectedItem[]): Record<string, number> {
  return items.reduce((counts, item) => {
    counts[item.name] = (counts[item.name] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
}

/**
 * Delete detected data for a conversation (cascade delete when conversation is deleted)
 */
export async function deleteDetectedDataForConversation(conversationId: string, userId: string) {
  try {
    console.log('🗑️ Deleting detected data for conversation:', conversationId);

    const [emotionsResult, partsResult, needsResult] = await Promise.all([
      supabase
        .from('detected_emotions')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId),
      supabase
        .from('detected_parts')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId),
      supabase
        .from('detected_needs')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId),
    ]);

    const errors = [emotionsResult.error, partsResult.error, needsResult.error].filter(Boolean);
    if (errors.length > 0) {
      console.error('❌ Error deleting detected data:', errors);
      throw new Error(`Failed to delete detected data: ${errors[0]?.message}`);
    }

    console.log('✅ Detected data deleted for conversation');

  } catch (error) {
    console.error('❌ deleteDetectedDataForConversation error:', error);
    throw error;
  }
}