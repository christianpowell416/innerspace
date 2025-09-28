/**
 * Conversation Persistence Service
 * Handles saving and loading conversation data to/from Supabase
 */

import { supabase } from '@/lib/supabase';
import { ConversationMessage, Database } from '@/lib/database.types';

// Type definitions for conversation data
export interface ConversationData {
  id?: string;
  user_id: string;
  complex_id?: string | null;
  topic: string;
  title?: string | null;
  messages: ConversationMessage[];
  summary?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SaveConversationOptions {
  complexId?: string | null;
  title?: string | null;
  summary?: string | null;
}

/**
 * Save a conversation to the database
 */
export async function saveConversation(
  userId: string,
  topic: string,
  messages: ConversationMessage[],
  options: SaveConversationOptions = {}
) {
  try {
    console.log('💾 Saving conversation');

    // Filter out detection_log messages - they should not be saved to database
    const saveableMessages = messages.filter(msg => msg.type !== 'detection_log');

    // Prepare conversation data
    const conversationData: Database['public']['Tables']['conversations']['Insert'] = {
      user_id: userId,
      complex_id: options.complexId || null,
      topic,
      title: options.title || generateConversationTitle(messages),
      messages: saveableMessages,
      summary: options.summary || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Insert conversation into database
    const { data, error } = await supabase
      .from('conversations')
      .insert(conversationData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save conversation: ${error.message}`);
    }

    console.log('✅ Conversation saved');
    return data;

  } catch (error) {
    // Re-throw the error without additional logging since the caller will handle it
    throw error;
  }
}

/**
 * Load conversations for a user
 */
export async function loadConversations(
  userId: string,
  complexId?: string | null,
  offset = 0
) {
  try {

    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Filter by complex if specified
    if (complexId !== undefined) {
      query = complexId === null
        ? query.is('complex_id', null)
        : query.eq('complex_id', complexId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to load conversations: ${error.message}`);
    }

    return data || [];

  } catch (error) {
    throw error;
  }
}

/**
 * Load a single conversation by ID
 */
export async function loadConversation(conversationId: string, userId: string) {
  try {

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw new Error(`Failed to load conversation: ${error.message}`);
    }

    return data;

  } catch (error) {
    throw error;
  }
}

/**
 * Update an existing conversation
 */
export async function updateConversation(
  conversationId: string,
  userId: string,
  updates: Partial<Database['public']['Tables']['conversations']['Update']>
) {
  try {

    const { data, error } = await supabase
      .from('conversations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update conversation: ${error.message}`);
    }

    return data;

  } catch (error) {
    throw error;
  }
}

/**
 * Update an existing conversation with new messages
 */
export async function updateConversationWithMessages(
  conversationId: string,
  userId: string,
  messages: ConversationMessage[]
) {
  // Filter out detection_log messages - they should not be saved to database
  const saveableMessages = messages.filter(msg => msg.type !== 'detection_log');

  return updateConversation(conversationId, userId, {
    messages: saveableMessages,
  });
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: string, userId: string) {
  try {

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }


  } catch (error) {
    throw error;
  }
}

/**
 * Get conversation statistics for a user
 */
export async function getConversationStats(userId: string) {
  try {

    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      throw new Error(`Failed to get conversation stats: ${countError.message}`);
    }

    // Get conversations by complex
    const { data: complexData, error: complexError } = await supabase
      .from('conversations')
      .select('complex_id')
      .eq('user_id', userId);

    if (complexError) {
      throw new Error(`Failed to get complex stats: ${complexError.message}`);
    }

    // Count by complex
    const complexCounts = complexData?.reduce((acc, conv) => {
      const complexId = conv.complex_id || 'uncategorized';
      acc[complexId] = (acc[complexId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const stats = {
      totalConversations: totalCount || 0,
      conversationsByComplex: complexCounts,
    };

    return stats;

  } catch (error) {
    throw error;
  }
}

/**
 * Helper function to generate a conversation title from messages
 */
function generateConversationTitle(messages: ConversationMessage[]): string {
  if (messages.length === 0) {
    return 'Empty Conversation';
  }

  // Find the first substantial user message
  const firstUserMessage = messages.find(
    msg => msg.type === 'user' && msg.text.trim().length > 0
  );

  if (!firstUserMessage) {
    return 'New Conversation';
  }

  // Take first 50 characters and add ellipsis if needed
  const text = firstUserMessage.text.trim();
  return text.length > 50 ? text.substring(0, 50) + '...' : text;
}

/**
 * Helper function to get recent conversations for quick access
 */
export async function getRecentConversations(userId: string) {
  try {
    return await loadConversations(userId, undefined, 0);
  } catch (error) {
    throw error;
  }
}