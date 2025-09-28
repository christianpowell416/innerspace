/**
 * Emotions, Parts, and Needs Service
 * Handles CRUD operations for user emotions, IFS parts, and human needs
 */

import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';

// Type definitions
export interface UserEmotion {
  id?: string;
  user_id: string;
  emotion_name: string;
  intensity: number;
  frequency?: number;
  category?: string;
  color?: string;
  notes?: string;
  last_experienced?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserPart {
  id?: string;
  user_id: string;
  part_name: string;
  part_type: 'protector' | 'exile' | 'firefighter' | 'self';
  intensity: number;
  frequency?: number;
  description?: string;
  role?: string;
  triggers?: string[];
  color?: string;
  notes?: string;
  last_active?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserNeed {
  id?: string;
  user_id: string;
  need_name: string;
  category?: string;
  current_level?: number;
  desired_level?: number;
  priority?: number;
  strategies?: string[];
  color?: string;
  notes?: string;
  last_assessed?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmotionLog {
  id?: string;
  user_id: string;
  emotion_id?: string;
  emotion_name: string;
  intensity: number;
  context?: string;
  triggers?: string[];
  duration_minutes?: number;
  coping_strategies?: string[];
  logged_at?: string;
  created_at?: string;
}

export interface PartSession {
  id?: string;
  user_id: string;
  part_id?: string;
  part_name: string;
  session_type?: string;
  intensity_before?: number;
  intensity_after?: number;
  notes?: string;
  insights?: string;
  next_steps?: string;
  session_duration_minutes?: number;
  logged_at?: string;
  created_at?: string;
}

export interface NeedAssessment {
  id?: string;
  user_id: string;
  need_id?: string;
  need_name: string;
  current_level: number;
  satisfaction?: number;
  strategies_used?: string[];
  barriers?: string[];
  support_received?: string;
  reflection?: string;
  assessed_at?: string;
  created_at?: string;
}

// ============================================================================
// EMOTIONS SERVICE
// ============================================================================

/**
 * Load all emotions for a user
 */
export async function loadUserEmotions(userId: string) {
  try {
    console.log('📊 Loading user emotions:', { userId });

    const { data, error } = await supabase
      .from('user_emotions')
      .select('*')
      .eq('user_id', userId)
      .order('last_experienced', { ascending: false })
;

    if (error) {
      console.error('❌ Error loading user emotions:', error);
      throw new Error(`Failed to load emotions: ${error.message}`);
    }

    console.log('✅ User emotions loaded:', data?.length || 0);
    return data || [];

  } catch (error) {
    console.error('❌ loadUserEmotions error:', error);
    throw error;
  }
}

/**
 * Save or update a user emotion
 */
export async function saveUserEmotion(emotion: UserEmotion) {
  try {
    console.log('💾 Saving user emotion:', emotion.emotion_name);

    const emotionData = {
      ...emotion,
      updated_at: new Date().toISOString(),
    };

    if (emotion.id) {
      // Update existing emotion
      const { data, error } = await supabase
        .from('user_emotions')
        .update(emotionData)
        .eq('id', emotion.id)
        .eq('user_id', emotion.user_id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating emotion:', error);
        throw new Error(`Failed to update emotion: ${error.message}`);
      }

      console.log('✅ Emotion updated successfully');
      return data;
    } else {
      // Insert new emotion
      const { data, error } = await supabase
        .from('user_emotions')
        .insert(emotionData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error inserting emotion:', error);
        throw new Error(`Failed to save emotion: ${error.message}`);
      }

      console.log('✅ Emotion saved successfully');
      return data;
    }

  } catch (error) {
    console.error('❌ saveUserEmotion error:', error);
    throw error;
  }
}

/**
 * Log an emotion experience
 */
export async function logEmotionExperience(emotionLog: EmotionLog) {
  try {
    console.log('📝 Logging emotion experience:', emotionLog.emotion_name);

    const { data, error } = await supabase
      .from('emotion_logs')
      .insert({
        ...emotionLog,
        logged_at: emotionLog.logged_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error logging emotion:', error);
      throw new Error(`Failed to log emotion: ${error.message}`);
    }

    console.log('✅ Emotion logged successfully');
    return data;

  } catch (error) {
    console.error('❌ logEmotionExperience error:', error);
    throw error;
  }
}

// ============================================================================
// PARTS SERVICE
// ============================================================================

/**
 * Load all parts for a user
 */
export async function loadUserParts(userId: string) {
  try {
    console.log('🧩 Loading user parts:', { userId });

    const { data, error } = await supabase
      .from('user_parts')
      .select('*')
      .eq('user_id', userId)
      .order('last_active', { ascending: false })
;

    if (error) {
      console.error('❌ Error loading user parts:', error);
      throw new Error(`Failed to load parts: ${error.message}`);
    }

    console.log('✅ User parts loaded:', data?.length || 0);
    return data || [];

  } catch (error) {
    console.error('❌ loadUserParts error:', error);
    throw error;
  }
}

/**
 * Save or update a user part
 */
export async function saveUserPart(part: UserPart) {
  try {
    console.log('💾 Saving user part:', part.part_name);

    const partData = {
      ...part,
      updated_at: new Date().toISOString(),
    };

    if (part.id) {
      // Update existing part
      const { data, error } = await supabase
        .from('user_parts')
        .update(partData)
        .eq('id', part.id)
        .eq('user_id', part.user_id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating part:', error);
        throw new Error(`Failed to update part: ${error.message}`);
      }

      console.log('✅ Part updated successfully');
      return data;
    } else {
      // Insert new part
      const { data, error } = await supabase
        .from('user_parts')
        .insert(partData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error inserting part:', error);
        throw new Error(`Failed to save part: ${error.message}`);
      }

      console.log('✅ Part saved successfully');
      return data;
    }

  } catch (error) {
    console.error('❌ saveUserPart error:', error);
    throw error;
  }
}

/**
 * Log a parts work session
 */
export async function logPartSession(partSession: PartSession) {
  try {
    console.log('📝 Logging part session:', partSession.part_name);

    const { data, error } = await supabase
      .from('parts_sessions')
      .insert({
        ...partSession,
        logged_at: partSession.logged_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error logging part session:', error);
      throw new Error(`Failed to log part session: ${error.message}`);
    }

    console.log('✅ Part session logged successfully');
    return data;

  } catch (error) {
    console.error('❌ logPartSession error:', error);
    throw error;
  }
}

// ============================================================================
// NEEDS SERVICE
// ============================================================================

/**
 * Load all needs for a user
 */
export async function loadUserNeeds(userId: string) {
  try {
    console.log('🎯 Loading user needs:', { userId });

    const { data, error } = await supabase
      .from('user_needs')
      .select('*')
      .eq('user_id', userId)
      .order('priority', { ascending: false })
;

    if (error) {
      console.error('❌ Error loading user needs:', error);
      throw new Error(`Failed to load needs: ${error.message}`);
    }

    console.log('✅ User needs loaded:', data?.length || 0);
    return data || [];

  } catch (error) {
    console.error('❌ loadUserNeeds error:', error);
    throw error;
  }
}

/**
 * Save or update a user need
 */
export async function saveUserNeed(need: UserNeed) {
  try {
    console.log('💾 Saving user need:', need.need_name);

    const needData = {
      ...need,
      updated_at: new Date().toISOString(),
    };

    if (need.id) {
      // Update existing need
      const { data, error } = await supabase
        .from('user_needs')
        .update(needData)
        .eq('id', need.id)
        .eq('user_id', need.user_id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating need:', error);
        throw new Error(`Failed to update need: ${error.message}`);
      }

      console.log('✅ Need updated successfully');
      return data;
    } else {
      // Insert new need
      const { data, error } = await supabase
        .from('user_needs')
        .insert(needData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error inserting need:', error);
        throw new Error(`Failed to save need: ${error.message}`);
      }

      console.log('✅ Need saved successfully');
      return data;
    }

  } catch (error) {
    console.error('❌ saveUserNeed error:', error);
    throw error;
  }
}

/**
 * Log a needs assessment
 */
export async function logNeedAssessment(needAssessment: NeedAssessment) {
  try {
    console.log('📝 Logging need assessment:', needAssessment.need_name);

    const { data, error } = await supabase
      .from('needs_assessments')
      .insert({
        ...needAssessment,
        assessed_at: needAssessment.assessed_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error logging need assessment:', error);
      throw new Error(`Failed to log need assessment: ${error.message}`);
    }

    console.log('✅ Need assessment logged successfully');
    return data;

  } catch (error) {
    console.error('❌ logNeedAssessment error:', error);
    throw error;
  }
}

// ============================================================================
// ANALYTICS AND INSIGHTS
// ============================================================================

/**
 * Get emotion statistics for a user
 */
export async function getEmotionStatistics(userId: string, timeRange = '30 days') {
  try {
    console.log('📊 Getting emotion statistics:', { userId, timeRange });

    // Calculate date threshold
    const daysAgo = timeRange === '7 days' ? 7 : timeRange === '30 days' ? 30 : 90;
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysAgo);

    // Get emotion logs within time range
    const { data: logs, error } = await supabase
      .from('emotion_logs')
      .select('emotion_name, intensity, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', dateThreshold.toISOString())
      .order('logged_at', { ascending: false });

    if (error) {
      console.error('❌ Error loading emotion statistics:', error);
      throw new Error(`Failed to load emotion statistics: ${error.message}`);
    }

    // Calculate statistics
    const emotionCounts: Record<string, number> = {};
    const emotionIntensities: Record<string, number[]> = {};
    let totalLogs = 0;

    logs?.forEach(log => {
      const emotion = log.emotion_name;
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
      emotionIntensities[emotion] = emotionIntensities[emotion] || [];
      emotionIntensities[emotion].push(log.intensity);
      totalLogs++;
    });

    // Calculate averages
    const emotionAverages: Record<string, number> = {};
    Object.keys(emotionIntensities).forEach(emotion => {
      const intensities = emotionIntensities[emotion];
      emotionAverages[emotion] = intensities.reduce((sum, val) => sum + val, 0) / intensities.length;
    });

    const stats = {
      timeRange,
      totalLogs,
      emotionCounts,
      emotionAverages,
      mostCommonEmotion: Object.keys(emotionCounts).reduce((a, b) =>
        emotionCounts[a] > emotionCounts[b] ? a : b, ''),
      averageIntensity: logs?.reduce((sum, log) => sum + log.intensity, 0) / (logs?.length || 1) || 0,
    };

    console.log('✅ Emotion statistics calculated');
    return stats;

  } catch (error) {
    console.error('❌ getEmotionStatistics error:', error);
    throw error;
  }
}

/**
 * Delete a user emotion
 */
export async function deleteUserEmotion(emotionId: string, userId: string) {
  try {
    console.log('🗑️ Deleting user emotion:', emotionId);

    const { error } = await supabase
      .from('user_emotions')
      .delete()
      .eq('id', emotionId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error deleting emotion:', error);
      throw new Error(`Failed to delete emotion: ${error.message}`);
    }

    console.log('✅ Emotion deleted successfully');

  } catch (error) {
    console.error('❌ deleteUserEmotion error:', error);
    throw error;
  }
}

/**
 * Delete a user part
 */
export async function deleteUserPart(partId: string, userId: string) {
  try {
    console.log('🗑️ Deleting user part:', partId);

    const { error } = await supabase
      .from('user_parts')
      .delete()
      .eq('id', partId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error deleting part:', error);
      throw new Error(`Failed to delete part: ${error.message}`);
    }

    console.log('✅ Part deleted successfully');

  } catch (error) {
    console.error('❌ deleteUserPart error:', error);
    throw error;
  }
}

/**
 * Delete a user need
 */
export async function deleteUserNeed(needId: string, userId: string) {
  try {
    console.log('🗑️ Deleting user need:', needId);

    const { error } = await supabase
      .from('user_needs')
      .delete()
      .eq('id', needId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error deleting need:', error);
      throw new Error(`Failed to delete need: ${error.message}`);
    }

    console.log('✅ Need deleted successfully');

  } catch (error) {
    console.error('❌ deleteUserNeed error:', error);
    throw error;
  }
}