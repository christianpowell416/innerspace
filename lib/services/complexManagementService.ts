/**
 * Complex Management Service
 * Handles CRUD operations for user complexes (emotional complexes/categories)
 */

import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';

// Type definitions for complex operations
export interface ComplexData {
  id?: string;
  user_id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateComplexOptions {
  description?: string | null;
  color?: string | null;
}

export interface UpdateComplexOptions {
  name?: string;
  description?: string | null;
  color?: string | null;
}

// Predefined colors for complexes
export const COMPLEX_COLORS = [
  '#FF6B6B', // Coral
  '#4ECDC4', // Turquoise
  '#45B7D1', // Blue
  '#96CEB4', // Mint
  '#FECA57', // Orange
  '#FF9FF3', // Pink
  '#54A0FF', // Light Blue
  '#5F27CD', // Purple
  '#00D2D3', // Cyan
  '#FF9F43', // Amber
  '#EE5A24', // Red Orange
  '#0FB9B1', // Teal
  '#3742FA', // Indigo
  '#2ED573', // Green
  '#FFA502', // Orange Yellow
] as const;

/**
 * Create a new complex
 */
export async function createComplex(
  userId: string,
  name: string,
  options: CreateComplexOptions = {}
) {
  try {
    console.log('➕ Creating complex:', { userId, name });

    // Assign a random color if none provided
    const color = options.color || COMPLEX_COLORS[Math.floor(Math.random() * COMPLEX_COLORS.length)];

    const complexData: Database['public']['Tables']['complexes']['Insert'] = {
      user_id: userId,
      name: name.trim(),
      description: options.description?.trim() || null,
      color,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('complexes')
      .insert(complexData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating complex:', error);
      throw new Error(`Failed to create complex: ${error.message}`);
    }

    console.log('✅ Complex created successfully:', data.id);
    return data;

  } catch (error) {
    console.error('❌ createComplex error:', error);
    throw error;
  }
}

/**
 * Load all complexes for a user
 */
export async function loadComplexes(userId: string) {
  try {
    console.log('📖 Loading complexes for user:', userId);

    const { data, error } = await supabase
      .from('complexes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error loading complexes:', error);
      throw new Error(`Failed to load complexes: ${error.message}`);
    }

    console.log('✅ Complexes loaded:', data?.length || 0);
    return data || [];

  } catch (error) {
    console.error('❌ loadComplexes error:', error);
    throw error;
  }
}

/**
 * Load a single complex by ID
 */
export async function loadComplex(complexId: string, userId: string) {
  try {
    console.log('📖 Loading complex:', complexId);

    const { data, error } = await supabase
      .from('complexes')
      .select('*')
      .eq('id', complexId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('❌ Error loading complex:', error);
      throw new Error(`Failed to load complex: ${error.message}`);
    }

    console.log('✅ Complex loaded');
    return data;

  } catch (error) {
    console.error('❌ loadComplex error:', error);
    throw error;
  }
}

/**
 * Update an existing complex
 */
export async function updateComplex(
  complexId: string,
  userId: string,
  updates: UpdateComplexOptions
) {
  try {
    console.log('✏️ Updating complex:', complexId);

    // Prepare update data
    const updateData: Database['public']['Tables']['complexes']['Update'] = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) {
      updateData.name = updates.name.trim();
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description?.trim() || null;
    }
    if (updates.color !== undefined) {
      updateData.color = updates.color;
    }

    const { data, error } = await supabase
      .from('complexes')
      .update(updateData)
      .eq('id', complexId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating complex:', error);
      throw new Error(`Failed to update complex: ${error.message}`);
    }

    console.log('✅ Complex updated');
    return data;

  } catch (error) {
    console.error('❌ updateComplex error:', error);
    throw error;
  }
}

/**
 * Delete a complex and handle related conversations
 */
export async function deleteComplex(complexId: string, userId: string) {
  try {
    console.log('🗑️ Deleting complex:', complexId);

    // Note: Conversations will have their complex_id set to NULL due to ON DELETE SET NULL
    // This preserves conversation history while removing the complex categorization

    const { error } = await supabase
      .from('complexes')
      .delete()
      .eq('id', complexId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error deleting complex:', error);
      throw new Error(`Failed to delete complex: ${error.message}`);
    }

    console.log('✅ Complex deleted (related conversations preserved)');

  } catch (error) {
    console.error('❌ deleteComplex error:', error);
    throw error;
  }
}

/**
 * Get complex statistics including conversation count
 */
export async function getComplexStats(userId: string) {
  try {
    console.log('📊 Getting complex stats for user:', userId);

    // Get complexes with conversation counts
    const { data: complexes, error: complexError } = await supabase
      .from('complexes')
      .select('*')
      .eq('user_id', userId);

    if (complexError) {
      console.error('❌ Error loading complexes for stats:', complexError);
      throw new Error(`Failed to load complex stats: ${complexError.message}`);
    }

    // Get conversation counts for each complex
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('complex_id')
      .eq('user_id', userId);

    if (convError) {
      console.error('❌ Error loading conversations for stats:', convError);
      throw new Error(`Failed to load conversation stats: ${convError.message}`);
    }

    // Count conversations by complex
    const conversationCounts = conversations?.reduce((acc, conv) => {
      const complexId = conv.complex_id || 'uncategorized';
      acc[complexId] = (acc[complexId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Add conversation counts to complexes
    const complexesWithStats = complexes?.map(complex => ({
      ...complex,
      conversationCount: conversationCounts[complex.id] || 0,
    })) || [];

    const stats = {
      totalComplexes: complexes?.length || 0,
      totalConversations: conversations?.length || 0,
      uncategorizedConversations: conversationCounts['uncategorized'] || 0,
      complexes: complexesWithStats,
      conversationCounts,
    };

    console.log('✅ Complex stats loaded:', {
      complexes: stats.totalComplexes,
      conversations: stats.totalConversations,
      uncategorized: stats.uncategorizedConversations,
    });

    return stats;

  } catch (error) {
    console.error('❌ getComplexStats error:', error);
    throw error;
  }
}

/**
 * Search complexes by name
 */
export async function searchComplexes(userId: string, searchQuery: string) {
  try {
    console.log('🔍 Searching complexes:', { userId, searchQuery });

    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return await loadComplexes(userId);
    }

    const { data, error } = await supabase
      .from('complexes')
      .select('*')
      .eq('user_id', userId)
      .ilike('name', `%${query}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error searching complexes:', error);
      throw new Error(`Failed to search complexes: ${error.message}`);
    }

    console.log('✅ Complex search completed:', data?.length || 0, 'results');
    return data || [];

  } catch (error) {
    console.error('❌ searchComplexes error:', error);
    throw error;
  }
}

/**
 * Get the most recently used complexes
 */
export async function getRecentComplexes(userId: string, limit = 5) {
  try {
    console.log('📖 Getting recent complexes for user:', userId);

    // Get complexes ordered by most recent conversation
    const { data, error } = await supabase
      .from('complexes')
      .select(`
        *,
        conversations!inner(created_at)
      `)
      .eq('user_id', userId)
      .order('conversations.created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error loading recent complexes:', error);
      throw new Error(`Failed to load recent complexes: ${error.message}`);
    }

    console.log('✅ Recent complexes loaded:', data?.length || 0);
    return data || [];

  } catch (error) {
    console.error('❌ getRecentComplexes error:', error);
    throw error;
  }
}

/**
 * Validate complex name (helper function)
 */
export function validateComplexName(name: string): { valid: boolean; error?: string } {
  const trimmedName = name?.trim();

  if (!trimmedName) {
    return { valid: false, error: 'Complex name is required' };
  }

  if (trimmedName.length < 2) {
    return { valid: false, error: 'Complex name must be at least 2 characters long' };
  }

  if (trimmedName.length > 100) {
    return { valid: false, error: 'Complex name must be less than 100 characters' };
  }

  return { valid: true };
}

/**
 * Get a random color for a new complex
 */
export function getRandomComplexColor(): string {
  return COMPLEX_COLORS[Math.floor(Math.random() * COMPLEX_COLORS.length)];
}