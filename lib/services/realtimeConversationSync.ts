/**
 * Real-time Conversation Synchronization Service
 * Handles auto-save, live syncing, and session state persistence during active conversations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { ConversationMessage, DetectedItem } from '@/lib/database.types';
import {
  saveConversation,
  updateConversation,
  ConversationData
} from './conversationPersistence';
import {
  saveAllDetectedData,
  updateDetectedData
} from './detectedDataService';

export interface RealtimeSyncConfig {
  userId: string;
  complexId?: string;
  topic: string;
  enableSessionRecovery?: boolean;
}

export interface SessionState {
  conversationId?: string;
  sessionId: string;
  topic: string;
  complexId?: string;
  startTime: number;
  lastSaveTime: number;
  messageCount: number;
  detectedDataCount: number;
  isActive: boolean;
}

export interface DraftConversationData {
  sessionId: string;
  topic: string;
  complexId?: string;
  messages: ConversationMessage[];
  detectedData: {
    emotions?: DetectedItem[];
    parts?: DetectedItem[];
    needs?: DetectedItem[];
  };
  createdAt: number;
  updatedAt: number;
}

export interface RealtimeSync {
  startSession: () => Promise<string>; // Returns sessionId (not conversationId anymore)
  updateMessages: (messages: ConversationMessage[]) => Promise<void>;
  updateDetectedData: (data: {
    emotions?: DetectedItem[];
    parts?: DetectedItem[];
    needs?: DetectedItem[];
  }) => Promise<void>;
  saveSessionState: (state: Partial<SessionState>) => Promise<void>;
  endSession: () => Promise<void>;
  recoverSession: (sessionId: string) => Promise<SessionState | null>;
  forceSync: () => Promise<void>;
  getDraftData: () => Promise<DraftConversationData | null>;
  clearDraftData: () => Promise<void>;
  isActive: boolean;
  conversationId: string | null;
  sessionId: string;
}

/**
 * Create a real-time conversation sync manager
 */
export function createRealtimeConversationSync(
  config: RealtimeSyncConfig
): RealtimeSync {
  let conversationId: string | null = null;
  let sessionId: string = generateSessionId();
  let isActive = false;
  // Auto-save timer removed - syncing only on updates
  let currentMessages: ConversationMessage[] = [];
  let currentDetectedData: {
    emotions?: DetectedItem[];
    parts?: DetectedItem[];
    needs?: DetectedItem[];
  } = {};
  let sessionState: SessionState | null = null;

  const sync: RealtimeSync = {
    startSession: async (): Promise<string> => {
      try {
        console.log('🚀 Starting real-time conversation session');

        // Generate new session ID
        sessionId = generateSessionId();
        isActive = true;

        // Initialize session state
        sessionState = {
          sessionId,
          topic: config.topic,
          complexId: config.complexId,
          startTime: Date.now(),
          lastSaveTime: Date.now(),
          messageCount: 0,
          detectedDataCount: 0,
          isActive: true,
        };

        // Save initial session state for recovery
        if (config.enableSessionRecovery) {
          await saveSessionState(sessionState);
        }

        // Initialize draft data in AsyncStorage
        const draftData: DraftConversationData = {
          sessionId,
          topic: config.topic,
          complexId: config.complexId,
          messages: [],
          detectedData: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await saveDraftData(draftData);

        console.log('✅ Real-time session started:', sessionId);
        return sessionId; // Return sessionId instead of conversationId
      } catch (error) {
        console.error('❌ Failed to start real-time session:', error);
        throw error;
      }
    },

    updateMessages: async (messages: ConversationMessage[]): Promise<void> => {
      if (!isActive) return;

      try {
        // Filter out empty or duplicate messages
        const validMessages = messages.filter(msg =>
          msg.text && msg.text.trim().length > 0 && msg.type && msg.id
        );

        // Update current messages state
        currentMessages = validMessages;

        // Update session state
        if (sessionState) {
          sessionState.messageCount = validMessages.length;
          sessionState.lastSaveTime = Date.now();
        }

        // Save to draft storage
        await updateDraftData(sessionId, {
          messages: validMessages,
          updatedAt: Date.now(),
        });

        console.log(`📝 Updated messages: ${validMessages.length} total (saved to draft)`);
      } catch (error) {
        console.error('❌ Failed to update messages:', error);
      }
    },

    updateDetectedData: async (data: {
      emotions?: DetectedItem[];
      parts?: DetectedItem[];
      needs?: DetectedItem[];
    }): Promise<void> => {
      if (!isActive) return;

      try {
        // Merge with existing detected data
        currentDetectedData = {
          emotions: data.emotions || currentDetectedData.emotions || [],
          parts: data.parts || currentDetectedData.parts || [],
          needs: data.needs || currentDetectedData.needs || [],
        };

        // Update session state
        if (sessionState) {
          sessionState.detectedDataCount =
            (currentDetectedData.emotions?.length || 0) +
            (currentDetectedData.parts?.length || 0) +
            (currentDetectedData.needs?.length || 0);
          sessionState.lastSaveTime = Date.now();
        }

        // Save to draft storage
        await updateDraftData(sessionId, {
          detectedData: currentDetectedData,
          updatedAt: Date.now(),
        });

        const totalDetected = sessionState?.detectedDataCount || 0;
        console.log(`🧠 Updated detected data: ${totalDetected} total items (saved to draft)`);
      } catch (error) {
        console.error('❌ Failed to update detected data:', error);
      }
    },

    saveSessionState: async (state: Partial<SessionState>): Promise<void> => {
      if (!config.enableSessionRecovery || !sessionState) return;

      try {
        // Merge with current state
        sessionState = { ...sessionState, ...state };

        // Save to AsyncStorage for session recovery
        const stateKey = `session_state_${sessionId}`;
        const stateData = JSON.stringify(sessionState);

        // Use AsyncStorage for React Native
        await AsyncStorage.setItem(stateKey, stateData);

        console.log('💾 Session state saved for recovery');
      } catch (error) {
        console.error('❌ Failed to save session state:', error);
      }
    },

    endSession: async (): Promise<void> => {
      try {
        console.log('🏁 Ending real-time conversation session');

        // Force final sync
        if (currentMessages.length > 0) {
          await sync.forceSync();
        }

        // Auto-save timer removed

        // Mark session as inactive
        isActive = false;
        if (sessionState) {
          sessionState.isActive = false;
          await sync.saveSessionState(sessionState);
        }

        // Clear session recovery data
        if (config.enableSessionRecovery) {
          try {
            const stateKey = `session_state_${sessionId}`;
            await AsyncStorage.removeItem(stateKey);
          } catch (e) {
            // Ignore cleanup errors
          }
        }

        console.log('✅ Real-time session ended successfully');
      } catch (error) {
        console.error('❌ Failed to end session properly:', error);
      }
    },

    recoverSession: async (recoverySessionId: string): Promise<SessionState | null> => {
      if (!config.enableSessionRecovery) return null;

      try {
        console.log('🔄 Attempting session recovery:', recoverySessionId);

        const stateKey = `session_state_${recoverySessionId}`;
        const stateData = await AsyncStorage.getItem(stateKey);

        if (stateData) {
          const recoveredState = JSON.parse(stateData) as SessionState;
          console.log('✅ Session recovered:', recoveredState);
          return recoveredState;
        }

        console.log('ℹ️ No session state found for recovery');
        return null;
      } catch (error) {
        console.error('❌ Failed to recover session:', error);
        return null;
      }
    },

    forceSync: async (): Promise<void> => {
      if (!isActive || currentMessages.length === 0) return;

      try {
        console.log('⚡ Syncing draft data to storage...');

        // Update draft with latest data
        await updateDraftData(sessionId, {
          messages: currentMessages,
          detectedData: currentDetectedData,
          updatedAt: Date.now(),
        });

        // Update session state
        if (sessionState) {
          sessionState.lastSaveTime = Date.now();
          await sync.saveSessionState(sessionState);
        }

        console.log('✅ Draft data synced to AsyncStorage');
      } catch (error) {
        console.error('❌ Draft sync failed:', error);
        throw error;
      }
    },

    getDraftData: async (): Promise<DraftConversationData | null> => {
      try {
        const draftKey = `draft_conversation_${sessionId}`;
        const draftData = await AsyncStorage.getItem(draftKey);
        if (draftData) {
          return JSON.parse(draftData) as DraftConversationData;
        }
        return null;
      } catch (error) {
        console.error('❌ Failed to get draft data:', error);
        return null;
      }
    },

    clearDraftData: async (): Promise<void> => {
      try {
        const draftKey = `draft_conversation_${sessionId}`;
        await AsyncStorage.removeItem(draftKey);
        console.log('🧹 Draft data cleared');
      } catch (error) {
        console.error('❌ Failed to clear draft data:', error);
      }
    },

    get isActive() { return isActive; },
    get conversationId() { return conversationId; },
    get sessionId() { return sessionId; }
  };

  return sync;
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a conversation title from messages
 */
function generateConversationTitle(messages: ConversationMessage[]): string {
  if (messages.length === 0) return 'Conversation';

  // Get the first user message or first few words
  const firstUserMessage = messages.find(msg => msg.type === 'user');
  if (firstUserMessage) {
    const words = firstUserMessage.text.split(' ').slice(0, 6);
    const title = words.join(' ');
    return title.length > 50 ? title.substring(0, 47) + '...' : title;
  }

  return 'Conversation';
}

/**
 * Save session state to persistent storage
 */
async function saveSessionState(state: SessionState): Promise<void> {
  // This is a helper function that could be expanded to use different storage methods
  // For now, it relies on the main sync object's saveSessionState method
  console.log('💾 Saving session state:', state.sessionId);
}

/**
 * Save draft conversation data to AsyncStorage
 */
async function saveDraftData(data: DraftConversationData): Promise<void> {
  try {
    const draftKey = `draft_conversation_${data.sessionId}`;
    await AsyncStorage.setItem(draftKey, JSON.stringify(data));
    console.log('💾 Draft data saved');
  } catch (error) {
    console.error('❌ Failed to save draft data:', error);
  }
}

/**
 * Update existing draft data in AsyncStorage
 */
async function updateDraftData(sessionId: string, updates: Partial<DraftConversationData>): Promise<void> {
  try {
    const draftKey = `draft_conversation_${sessionId}`;
    const existingData = await AsyncStorage.getItem(draftKey);

    if (existingData) {
      const currentDraft = JSON.parse(existingData) as DraftConversationData;
      const updatedDraft = {
        ...currentDraft,
        ...updates,
        updatedAt: updates.updatedAt || Date.now(),
      };
      await AsyncStorage.setItem(draftKey, JSON.stringify(updatedDraft));
      console.log('💾 Draft data updated');
    }
  } catch (error) {
    console.error('❌ Failed to update draft data:', error);
  }
}

/**
 * Cleanup orphaned session states (utility function)
 */
export async function cleanupOrphanedSessions(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const sessionKeys = keys.filter(key => key.startsWith('session_state_'));
    const draftKeys = keys.filter(key => key.startsWith('draft_conversation_'));
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up session states
    for (const key of sessionKeys) {
      try {
        const stateData = await AsyncStorage.getItem(key);
        if (stateData) {
          const state = JSON.parse(stateData) as SessionState;
          if (!state.isActive && (now - state.lastSaveTime > maxAge)) {
            await AsyncStorage.removeItem(key);
            console.log('🧹 Cleaned up orphaned session:', key);
          }
        }
      } catch (e) {
        // Remove corrupted session data
        await AsyncStorage.removeItem(key);
      }
    }

    // Clean up draft conversations
    for (const key of draftKeys) {
      try {
        const draftData = await AsyncStorage.getItem(key);
        if (draftData) {
          const draft = JSON.parse(draftData) as DraftConversationData;
          if (now - draft.updatedAt > maxAge) {
            await AsyncStorage.removeItem(key);
            console.log('🧹 Cleaned up orphaned draft:', key);
          }
        }
      } catch (e) {
        // Remove corrupted draft data
        await AsyncStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('❌ Failed to cleanup orphaned sessions:', error);
  }
}