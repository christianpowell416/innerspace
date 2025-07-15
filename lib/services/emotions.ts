import { supabase } from '../supabase';
import { Database } from '../database.types';

export type EmotionRow = Database['public']['Tables']['emotions']['Row'];
export type EmotionInsert = Database['public']['Tables']['emotions']['Insert'];
export type EmotionUpdate = Database['public']['Tables']['emotions']['Update'];

export interface EmotionWithScore extends EmotionRow {
  score: number;
}

// Calculate emotion score (average of absolute values)
export const calculateEmotionScore = (emotion: EmotionRow): number => {
  const average = (Math.abs(emotion['feminine-masculine']) + Math.abs(emotion['dark-light']) + Math.abs(emotion['child-parent'])) / 3;
  return Math.round(average * 10) / 10;
};

// Get all emotions for the current user
export const getEmotions = async (): Promise<EmotionWithScore[]> => {
  const { data, error } = await supabase
    .from('emotions')
    .select('*')
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

// Get a single emotion by ID
export const getEmotion = async (id: string): Promise<EmotionWithScore | null> => {
  const { data, error } = await supabase
    .from('emotions')
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
    .from('emotions')
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
    .from('emotions')
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
    .from('emotions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting emotion:', error);
    throw error;
  }

  // Trigger sync after deletion
  setTimeout(() => globalSyncCallback?.(), 500);
};

// Get emotions sorted by different criteria
export const getEmotionsSorted = async (sortBy: 'newest' | 'oldest' | 'frequency' | 'intensity'): Promise<EmotionWithScore[]> => {
  let query = supabase.from('emotions').select('*');

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
  
  // Try real-time subscription first
  const channel = supabase.channel('emotions-realtime-' + Date.now());
  let realtimeWorking = false;
  
  // Set up real-time subscription
  channel
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'emotions' }, 
      async (payload) => {
        if (!isSubscribed) return;
        
        console.log('📡 Real-time change detected:', payload.eventType);
        realtimeWorking = true;
        
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
      } else if (payload.status === 'error') {
        console.log('⚠️ Real-time error detected, switching to smart polling mode');
        realtimeDisabled = true;
        onStatusChange?.('SMART_POLLING_ACTIVE');
      }
    });

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
      channel.unsubscribe();
      console.log('🔌 Unsubscribed from emotions sync');
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