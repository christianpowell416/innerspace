/**
 * Complex Detection Service
 * Finds complexes that contain specific emotions, parts, or needs
 */

import { supabase } from '@/lib/supabase';
import { DetectedItem } from '@/lib/database.types';

export interface ComplexPreview {
  id: string;
  title: string;
  description: string;
  created_at: string;
  conversation_count: number;
}

/**
 * Find complexes that contain a specific emotion
 */
export async function findComplexesWithEmotion(
  emotionName: string,
  conversationIds: string[] | string | any,
  userId: string
): Promise<ComplexPreview[]> {
  try {
    console.log('🔍 Finding complexes with emotion:', emotionName);
    console.log('ConversationIds type:', typeof conversationIds, 'Value:', conversationIds);
    console.log('Is array?', Array.isArray(conversationIds));
    console.log('Raw conversationIds:', JSON.stringify(conversationIds));

    // Handle both array and string inputs
    let idArray: string[] = [];

    // Check if it's a JSON stringified array
    if (typeof conversationIds === 'string' && conversationIds.startsWith('[')) {
      try {
        const parsed = JSON.parse(conversationIds);
        if (Array.isArray(parsed)) {
          console.log('Parsed JSON string to array');
          idArray = parsed.filter(id => id && typeof id === 'string');
        } else {
          console.log('Parsed JSON but not an array');
          idArray = conversationIds.split(',').map(id => id.trim()).filter(id => id);
        }
      } catch (e) {
        console.log('Failed to parse as JSON, treating as comma-separated string');
        idArray = conversationIds.split(',').map(id => id.trim()).filter(id => id);
      }
    } else if (typeof conversationIds === 'string') {
      // If it's a comma-separated string, split it
      console.log('Processing as comma-separated string...');
      idArray = conversationIds.split(',').map(id => id.trim()).filter(id => id);
    } else if (Array.isArray(conversationIds)) {
      console.log('Processing as array...');
      idArray = conversationIds.filter(id => id && typeof id === 'string');
    }

    if (!idArray || idArray.length === 0) {
      console.log('No conversation IDs provided');
      return [];
    }

    console.log('Final idArray for query:', idArray);
    console.log('idArray length:', idArray.length);
    console.log('First few IDs:', idArray.slice(0, 3));

    // Get conversations that contain this emotion
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, complex_id, topic, created_at')
      .in('id', idArray)
      .eq('user_id', userId)
      .not('complex_id', 'is', null);

    if (convError) {
      console.error('Error finding conversations:', convError);
      return [];
    }

    if (!conversations || conversations.length === 0) {
      console.log('No conversations with complexes found');
      return [];
    }

    // Get unique complex IDs
    const complexIds = [...new Set(conversations.map(c => c.complex_id).filter(id => id))];

    if (complexIds.length === 0) {
      console.log('No complex IDs found');
      return [];
    }

    // Get complex details
    const { data: complexes, error: complexError } = await supabase
      .from('complexes')
      .select('*')
      .in('id', complexIds)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (complexError) {
      console.error('Error loading complexes:', complexError);
      return [];
    }

    // Transform to preview format
    const previews: ComplexPreview[] = complexes?.map(complex => {
      // Count how many conversations in this complex have the emotion
      const complexConversations = conversations.filter(c => c.complex_id === complex.id);

      console.log('Complex data:', {
        id: complex.id,
        name: complex.name,
        description: complex.description,
        created_at: complex.created_at
      });

      return {
        id: complex.id,
        title: complex.name || 'Untitled Complex',
        description: complex.description || `Contains "${emotionName}" in ${complexConversations.length} conversation${complexConversations.length > 1 ? 's' : ''}`,
        created_at: complex.created_at,
        conversation_count: complexConversations.length
      };
    }) || [];

    console.log(`✅ Found ${previews.length} complexes with emotion "${emotionName}"`);
    return previews;

  } catch (error) {
    console.error('Error finding complexes with emotion:', error);
    return [];
  }
}

/**
 * Find complexes that contain a specific part
 */
export async function findComplexesWithPart(
  partName: string,
  conversationIds: string[] | string | any,
  userId: string
): Promise<ComplexPreview[]> {
  try {
    console.log('🔍 Finding complexes with part:', partName);
    console.log('ConversationIds type:', typeof conversationIds, 'Value:', conversationIds);
    console.log('Is array?', Array.isArray(conversationIds));
    console.log('Raw conversationIds:', JSON.stringify(conversationIds));

    // Handle both array and string inputs
    let idArray: string[] = [];

    // Check if it's a JSON stringified array
    if (typeof conversationIds === 'string' && conversationIds.startsWith('[')) {
      try {
        const parsed = JSON.parse(conversationIds);
        if (Array.isArray(parsed)) {
          console.log('Parsed JSON string to array');
          idArray = parsed.filter(id => id && typeof id === 'string');
        } else {
          console.log('Parsed JSON but not an array');
          idArray = conversationIds.split(',').map(id => id.trim()).filter(id => id);
        }
      } catch (e) {
        console.log('Failed to parse as JSON, treating as comma-separated string');
        idArray = conversationIds.split(',').map(id => id.trim()).filter(id => id);
      }
    } else if (typeof conversationIds === 'string') {
      // If it's a comma-separated string, split it
      console.log('Processing as comma-separated string...');
      idArray = conversationIds.split(',').map(id => id.trim()).filter(id => id);
    } else if (Array.isArray(conversationIds)) {
      console.log('Processing as array...');
      idArray = conversationIds.filter(id => id && typeof id === 'string');
    }

    if (!idArray || idArray.length === 0) {
      console.log('No conversation IDs provided');
      return [];
    }

    console.log('Final idArray for query:', idArray);
    console.log('idArray length:', idArray.length);
    console.log('First few IDs:', idArray.slice(0, 3));

    // Get conversations that contain this part
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, complex_id, topic, created_at')
      .in('id', idArray)
      .eq('user_id', userId)
      .not('complex_id', 'is', null);

    if (convError) {
      console.error('Error finding conversations:', convError);
      return [];
    }

    if (!conversations || conversations.length === 0) {
      console.log('No conversations with complexes found');
      return [];
    }

    // Get unique complex IDs
    const complexIds = [...new Set(conversations.map(c => c.complex_id).filter(id => id))];

    if (complexIds.length === 0) {
      console.log('No complex IDs found');
      return [];
    }

    // Get complex details
    const { data: complexes, error: complexError } = await supabase
      .from('complexes')
      .select('*')
      .in('id', complexIds)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (complexError) {
      console.error('Error loading complexes:', complexError);
      return [];
    }

    // Transform to preview format
    const previews: ComplexPreview[] = complexes?.map(complex => {
      // Count how many conversations in this complex have the part
      const complexConversations = conversations.filter(c => c.complex_id === complex.id);

      console.log('Complex data for part:', {
        id: complex.id,
        name: complex.name,
        description: complex.description,
        created_at: complex.created_at
      });

      return {
        id: complex.id,
        title: complex.name || 'Untitled Complex',
        description: complex.description || `Contains "${partName}" in ${complexConversations.length} conversation${complexConversations.length > 1 ? 's' : ''}`,
        created_at: complex.created_at,
        conversation_count: complexConversations.length
      };
    }) || [];

    console.log(`✅ Found ${previews.length} complexes with part "${partName}"`);
    return previews;

  } catch (error) {
    console.error('Error finding complexes with part:', error);
    return [];
  }
}

/**
 * Find complexes that contain a specific need
 */
export async function findComplexesWithNeed(
  needName: string,
  conversationIds: string[] | string | any,
  userId: string
): Promise<ComplexPreview[]> {
  try {
    console.log('🔍 Finding complexes with need:', needName);
    console.log('ConversationIds type:', typeof conversationIds, 'Value:', conversationIds);
    console.log('Is array?', Array.isArray(conversationIds));
    console.log('Raw conversationIds:', JSON.stringify(conversationIds));

    // Handle both array and string inputs
    let idArray: string[] = [];

    // Check if it's a JSON stringified array
    if (typeof conversationIds === 'string' && conversationIds.startsWith('[')) {
      try {
        const parsed = JSON.parse(conversationIds);
        if (Array.isArray(parsed)) {
          console.log('Parsed JSON string to array');
          idArray = parsed.filter(id => id && typeof id === 'string');
        } else {
          console.log('Parsed JSON but not an array');
          idArray = conversationIds.split(',').map(id => id.trim()).filter(id => id);
        }
      } catch (e) {
        console.log('Failed to parse as JSON, treating as comma-separated string');
        idArray = conversationIds.split(',').map(id => id.trim()).filter(id => id);
      }
    } else if (typeof conversationIds === 'string') {
      // If it's a comma-separated string, split it
      console.log('Processing as comma-separated string...');
      idArray = conversationIds.split(',').map(id => id.trim()).filter(id => id);
    } else if (Array.isArray(conversationIds)) {
      console.log('Processing as array...');
      idArray = conversationIds.filter(id => id && typeof id === 'string');
    }

    if (!idArray || idArray.length === 0) {
      console.log('No conversation IDs provided');
      return [];
    }

    console.log('Final idArray for query:', idArray);
    console.log('idArray length:', idArray.length);
    console.log('First few IDs:', idArray.slice(0, 3));

    // Get conversations that contain this need
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, complex_id, topic, created_at')
      .in('id', idArray)
      .eq('user_id', userId)
      .not('complex_id', 'is', null);

    if (convError) {
      console.error('Error finding conversations:', convError);
      return [];
    }

    if (!conversations || conversations.length === 0) {
      console.log('No conversations with complexes found');
      return [];
    }

    // Get unique complex IDs
    const complexIds = [...new Set(conversations.map(c => c.complex_id).filter(id => id))];

    if (complexIds.length === 0) {
      console.log('No complex IDs found');
      return [];
    }

    // Get complex details
    const { data: complexes, error: complexError } = await supabase
      .from('complexes')
      .select('*')
      .in('id', complexIds)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (complexError) {
      console.error('Error loading complexes:', complexError);
      return [];
    }

    // Transform to preview format
    const previews: ComplexPreview[] = complexes?.map(complex => {
      // Count how many conversations in this complex have the need
      const complexConversations = conversations.filter(c => c.complex_id === complex.id);

      console.log('Complex data for need:', {
        id: complex.id,
        name: complex.name,
        description: complex.description,
        created_at: complex.created_at
      });

      return {
        id: complex.id,
        title: complex.name || 'Untitled Complex',
        description: complex.description || `Contains "${needName}" in ${complexConversations.length} conversation${complexConversations.length > 1 ? 's' : ''}`,
        created_at: complex.created_at,
        conversation_count: complexConversations.length
      };
    }) || [];

    console.log(`✅ Found ${previews.length} complexes with need "${needName}"`);
    return previews;

  } catch (error) {
    console.error('Error finding complexes with need:', error);
    return [];
  }
}