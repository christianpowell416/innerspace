import { supabase } from '../supabase';
import { Database } from '../database.types';
import {
  EmotionBubbleData,
  EmotionFrequency,
  getEmotionCategory,
  getEmotionColor,
  BubbleChartConfig
} from '../types/bubbleChart';
// Simple scaling utilities (replaces d3-scale for React Native compatibility)
const createSqrtScale = (domain: [number, number], range: [number, number]) => {
  const [domainMin, domainMax] = domain;
  const [rangeMin, rangeMax] = range;

  return (value: number): number => {
    const normalizedValue = (value - domainMin) / (domainMax - domainMin);
    const sqrtValue = Math.sqrt(Math.max(0, normalizedValue));
    return rangeMin + sqrtValue * (rangeMax - rangeMin);
  };
};

export type EmotionRow = Database['public']['Tables']['beliefs']['Row'];
export type EmotionInsert = Database['public']['Tables']['beliefs']['Insert'];
export type EmotionUpdate = Database['public']['Tables']['beliefs']['Update'];

export interface EmotionWithScore extends EmotionRow {
  score: number;
}

// Calculate emotion score (average of absolute values)
export const calculateEmotionScore = (emotion: EmotionRow): number => {
  const average = (Math.abs(emotion['feminine-masculine']) + Math.abs(emotion['dark-light']) + Math.abs(emotion['child-parent'])) / 3;
  return Math.round(average * 10) / 10;
};

// Get all emotions for the current user (only non-released ones)
export const getEmotions = async (): Promise<EmotionWithScore[]> => {
  const { data, error } = await supabase
    .from('beliefs')
    .select('*')
    .eq('released', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching emotions:', error);
    throw error;
  }

  // Add calculated score to each emotion
  return data.map(emotion => ({
    ...emotion,
    score: calculateEmotionScore(emotion)
  }));
};

// Get all released emotions for the current user
export const getReleasedEmotions = async (): Promise<EmotionWithScore[]> => {
  const { data, error } = await supabase
    .from('beliefs')
    .select('*')
    .eq('released', true)
    .order('released_at', { ascending: false });

  if (error) {
    console.error('Error fetching released emotions:', error);
    throw error;
  }

  // Add calculated score to each emotion
  return data.map(emotion => ({
    ...emotion,
    score: calculateEmotionScore(emotion)
  }));
};

// Get a single emotion by ID
export const getEmotion = async (id: string): Promise<EmotionWithScore | null> => {
  const { data, error } = await supabase
    .from('beliefs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching emotion:', error);
    throw error;
  }

  return {
    ...data,
    score: calculateEmotionScore(data)
  };
};

// Global sync callback for triggering updates after actions
let globalSyncCallback: (() => void) | null = null;

export const setGlobalSyncCallback = (callback: () => void) => {
  globalSyncCallback = callback;
};

export const clearGlobalSyncCallback = () => {
  globalSyncCallback = null;
};

// Create a new emotion
export const createEmotion = async (emotion: Omit<EmotionInsert, 'user_id'>): Promise<EmotionWithScore> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('beliefs')
    .insert({
      ...emotion,
      user_id: user.id
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating emotion:', error);
    throw error;
  }

  // Trigger sync after creation
  setTimeout(() => globalSyncCallback?.(), 500);

  return {
    ...data,
    score: calculateEmotionScore(data)
  };
};

// Update an emotion
export const updateEmotion = async (id: string, updates: EmotionUpdate): Promise<EmotionWithScore> => {
  const { data, error } = await supabase
    .from('beliefs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating emotion:', error);
    throw error;
  }

  // Trigger sync after update
  setTimeout(() => globalSyncCallback?.(), 500);

  return {
    ...data,
    score: calculateEmotionScore(data)
  };
};

// Delete an emotion
export const deleteEmotion = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('beliefs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting emotion:', error);
    throw error;
  }

  // Trigger sync after deletion
  setTimeout(() => globalSyncCallback?.(), 500);
};

// Release an emotion (mark as released in Supabase)
export const releaseEmotion = async (emotionId: string): Promise<void> => {
  const { error } = await supabase
    .from('beliefs')
    .update({ 
      released: true, 
      released_at: new Date().toISOString() 
    })
    .eq('id', emotionId);

  if (error) {
    console.error('Error releasing emotion:', error);
    throw error;
  }

  // Trigger sync after release
  setTimeout(() => globalSyncCallback?.(), 500);
  
  console.log('🔧 Emotion released and synced with Supabase');
};

// Get emotions sorted by different criteria (only non-released ones)
export const getEmotionsSorted = async (sortBy: 'newest' | 'oldest' | 'frequency' | 'intensity'): Promise<EmotionWithScore[]> => {
  let query = supabase.from('beliefs').select('*').eq('released', false);

  switch (sortBy) {
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'frequency':
      query = query.order('frequency', { ascending: false });
      break;
    case 'intensity':
      // For intensity, we'll need to sort in JavaScript after fetching
      query = query.order('created_at', { ascending: false });
      break;
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching sorted emotions:', error);
    throw error;
  }

  // Add calculated score to each emotion
  const emotionsWithScore = data.map(emotion => ({
    ...emotion,
    score: calculateEmotionScore(emotion)
  }));

  // Sort by intensity if needed (done in JavaScript)
  if (sortBy === 'intensity') {
    emotionsWithScore.sort((a, b) => b.score - a.score);
  }

  return emotionsWithScore;
};

// Subscribe to emotion changes with smart polling fallback
export const subscribeToEmotions = (
  callback: (emotions: EmotionWithScore[]) => void,
  onError?: (error: any) => void,
  onStatusChange?: (status: string) => void
) => {
  let isSubscribed = true;
  let lastDataHash = '';
  let pendingCheck = false;
  let realtimeDisabled = false; // Track if real-time is explicitly disabled
  let realtimeWorking = false;
  let channel: any = null;
  let pollingInterval: NodeJS.Timeout | null = null;
  let reconnectInterval: NodeJS.Timeout | null = null;
  
  // Function to set up real-time subscription
  const setupRealtimeSubscription = () => {
    if (channel) {
      channel.unsubscribe();
    }
    
    channel = supabase.channel('beliefs-realtime-' + Date.now());
    realtimeWorking = false;
  
  // Set up real-time subscription
  channel
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'beliefs' }, 
      async (payload) => {
        if (!isSubscribed) return;
        
        console.log('📡 Real-time change detected:', payload.eventType);
        realtimeWorking = true;
        
        // If we were in smart polling mode, switch back to real-time
        if (realtimeDisabled) {
          console.log('🔄 Real-time is working again! Switching back from smart polling');
          realtimeDisabled = false;
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
          if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
          }
        }
        
        try {
          const emotions = await getEmotions();
          callback(emotions);
          // Confirm real-time is actively working
          if (!realtimeDisabled) {
            onStatusChange?.('REALTIME_ACTIVE');
          }
        } catch (error) {
          console.error('Error fetching emotions after real-time update:', error);
          onError?.(error);
        }
      }
    )
    .on('system', {}, (payload) => {
      console.log('🔌 System event received:', payload);
      
      // Check for specific real-time unavailable error
      if (payload.message?.includes('Unable to subscribe to changes') || 
          payload.message?.includes('check Realtime is enabled')) {
        console.log('⚠️ Real-time is not enabled for this table, using smart polling');
        realtimeDisabled = true;
        onStatusChange?.('SMART_POLLING_ACTIVE');
        startSmartPolling();
        startReconnectAttempts();
      } else if (payload.status === 'error') {
        console.log('⚠️ Real-time error detected, switching to smart polling mode');
        realtimeDisabled = true;
        onStatusChange?.('SMART_POLLING_ACTIVE');
        startSmartPolling();
        startReconnectAttempts();
      }
    });
  };

  // Function to start smart polling
  const startSmartPolling = () => {
    if (pollingInterval) return; // Already running
    
    console.log('🔄 Starting smart polling...');
    pollingInterval = setInterval(() => {
      checkForUpdates();
    }, 3000); // Poll every 3 seconds
  };

  // Function to start reconnect attempts
  const startReconnectAttempts = () => {
    if (reconnectInterval) return; // Already running
    
    console.log('🔄 Starting reconnect attempts...');
    reconnectInterval = setInterval(() => {
      if (!isSubscribed) return;
      
      console.log('🔄 Attempting to reconnect to real-time...');
      setupRealtimeSubscription();
    }, 30000); // Try to reconnect every 30 seconds
  };

  // Smart polling - only check when explicitly triggered
  const checkForUpdates = async () => {
    if (!isSubscribed || realtimeWorking || pendingCheck) return;
    
    pendingCheck = true;
    console.log('🔍 Checking for data updates...');
    
    try {
      const emotions = await getEmotions();
      const dataHash = JSON.stringify(emotions.map(e => ({ id: e.id, updated_at: e.updated_at })));
      
      if (dataHash !== lastDataHash) {
        console.log('📊 Data change detected via smart polling');
        lastDataHash = dataHash;
        callback(emotions);
      } else {
        console.log('✅ No changes detected');
      }
    } catch (error) {
      console.error('Error in smart polling update:', error);
      onError?.(error);
    } finally {
      pendingCheck = false;
    }
  };

  // Initialize the subscription
  setupRealtimeSubscription();

  // Subscribe to real-time, fallback to smart polling if it fails
  const subscription = channel.subscribe((status) => {
    console.log('📡 Subscription status:', status);
    
    if (status === 'SUBSCRIBED') {
      console.log('✅ Real-time subscription established and ready');
      // Start in REALTIME_ACTIVE mode, will stay here unless errors occur
      onStatusChange?.('REALTIME_ACTIVE');
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.log('⚠️ Real-time connection failed, using smart polling fallback');
      realtimeDisabled = true;
      onStatusChange?.('SMART_POLLING_ACTIVE');
    } else if (status === 'CLOSED') {
      onStatusChange?.('DISCONNECTED');
    }
  });

  // Initial data load
  getEmotions().then(emotions => {
    if (isSubscribed) {
      lastDataHash = JSON.stringify(emotions.map(e => ({ id: e.id, updated_at: e.updated_at })));
      callback(emotions);
    }
  }).catch(onError);

  // Return object with cleanup and manual sync functions
  return {
    unsubscribe: () => {
      isSubscribed = false;
      if (channel) {
        channel.unsubscribe();
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
      console.log('🔌 Unsubscribed from emotions sync and cleaned up intervals');
    },
    // Method to trigger manual sync after user actions
    syncAfterAction: () => {
      if (realtimeDisabled) {
        console.log('🎯 Smart polling mode, manual sync triggered after user action');
        setTimeout(checkForUpdates, 500);
      } else {
        console.log('⚡ Real-time is active, no manual sync needed');
      }
    }
  };
};

// ========== BUBBLE CHART FUNCTIONS ==========

/**
 * Aggregate emotions by name and frequency for bubble chart
 */
export const getEmotionFrequencies = async (): Promise<EmotionFrequency[]> => {
  const emotions = await getEmotions();

  // Group emotions by name (case-insensitive)
  const emotionMap = new Map<string, EmotionFrequency>();

  emotions.forEach(emotion => {
    if (!emotion.emotion) return;

    const emotionName = emotion.emotion.toLowerCase().trim();
    const existing = emotionMap.get(emotionName);

    if (existing) {
      existing.count += emotion.frequency;
      existing.averageIntensity = (existing.averageIntensity + emotion.score) / 2;
      existing.conversationIds.push(emotion.id);
      if (new Date(emotion.created_at) > existing.latestDate) {
        existing.latestDate = new Date(emotion.created_at);
      }
    } else {
      emotionMap.set(emotionName, {
        emotion: emotion.emotion, // Keep original case
        count: emotion.frequency,
        averageIntensity: emotion.score,
        latestDate: new Date(emotion.created_at),
        conversationIds: [emotion.id]
      });
    }
  });

  return Array.from(emotionMap.values()).sort((a, b) => b.count - a.count);
};

/**
 * Convert emotion frequencies to bubble chart data
 */
export const createBubbleChartData = async (
  config: BubbleChartConfig,
  isDark: boolean = false
): Promise<EmotionBubbleData[]> => {
  const frequencies = await getEmotionFrequencies();

  if (frequencies.length === 0) {
    return [];
  }

  // Create scales for bubble sizing
  const maxCount = Math.max(...frequencies.map(f => f.count));
  const minCount = Math.min(...frequencies.map(f => f.count));

  const radiusScale = createSqrtScale([minCount, maxCount], [config.minRadius, config.maxRadius]);

  // Convert to bubble data
  return frequencies.map((freq, index) => ({
    id: `emotion-${index}`,
    emotion: freq.emotion,
    frequency: freq.count,
    intensity: freq.averageIntensity,
    color: getEmotionColor(freq.emotion, isDark),
    radius: radiusScale(freq.count),
    category: getEmotionCategory(freq.emotion),
    lastSeen: freq.latestDate,
    conversationIds: freq.conversationIds,
    // D3 simulation will add x, y, vx, vy, fx, fy
  }));
};

/**
 * Get default bubble chart configuration
 */
export const getDefaultBubbleConfig = (width: number, height: number): BubbleChartConfig => ({
  width,
  height,
  minRadius: 20,
  maxRadius: 60,
  padding: 2,
  centerForce: 0.03,
  collisionStrength: 0.8,
  velocityDecay: 0.4
});

/**
 * Filter emotion data by category for bubble chart
 */
export const getEmotionsByCategory = async (categories: string[]): Promise<EmotionBubbleData[]> => {
  const bubbleData = await createBubbleChartData(getDefaultBubbleConfig(400, 400));

  if (categories.length === 0) {
    return bubbleData;
  }

  return bubbleData.filter(bubble =>
    categories.includes(bubble.category)
  );
};

/**
 * Get emotion statistics for insights
 */
export const getEmotionStatistics = async () => {
  const frequencies = await getEmotionFrequencies();

  if (frequencies.length === 0) {
    return {
      totalEmotions: 0,
      totalMentions: 0,
      mostFrequent: null,
      averageIntensity: 0,
      recentEmotions: []
    };
  }

  const totalMentions = frequencies.reduce((sum, freq) => sum + freq.count, 0);
  const averageIntensity = frequencies.reduce((sum, freq) => sum + freq.averageIntensity, 0) / frequencies.length;
  const recentEmotions = frequencies
    .sort((a, b) => b.latestDate.getTime() - a.latestDate.getTime())
    .slice(0, 5);

  return {
    totalEmotions: frequencies.length,
    totalMentions,
    mostFrequent: frequencies[0] || null,
    averageIntensity: Math.round(averageIntensity * 10) / 10,
    recentEmotions
  };
};