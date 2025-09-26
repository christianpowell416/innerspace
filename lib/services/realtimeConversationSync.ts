/**
 * Real-time Conversation Synchronization Service
 * Handles auto-save, live syncing, and session state persistence during active conversations
 */

import { supabase } from '@/lib/supabase';
import { ConversationMessage, DetectedItem } from '@/lib/database.types';
// TEMPORARILY DISABLED - Save conversation functionality
// import {
//   saveConversation,
//   updateConversation,
//   ConversationData
// } from './conversationPersistence';
import {
  saveAllDetectedData,
  updateDetectedData
} from './detectedDataService';

export interface RealtimeSyncConfig {
  userId: string;
  complexId?: string;
  topic: string;
  autoSaveInterval?: number; // milliseconds, default 10000 (10 seconds)
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

export interface RealtimeSync {
  startSession: () => Promise<string>; // Returns conversationId
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
  let autoSaveTimer: NodeJS.Timeout | null = null;
  let currentMessages: ConversationMessage[] = [];
  let currentDetectedData: {
    emotions?: DetectedItem[];
    parts?: DetectedItem[];
    needs?: DetectedItem[];
  } = {};
  let sessionState: SessionState | null = null;

  const autoSaveInterval = config.autoSaveInterval || 10000; // 10 seconds default

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

        // Start auto-save timer
        if (autoSaveTimer) {
          clearInterval(autoSaveTimer);
        }

        autoSaveTimer = setInterval(async () => {
          if (isActive && currentMessages.length > 0) {
            try {
              await sync.forceSync();
              console.log('🔄 Auto-save completed');
            } catch (error) {
              console.error('❌ Auto-save failed:', error);
            }
          }
        }, autoSaveInterval);

        console.log('✅ Real-time session started:', sessionId);
        return conversationId || 'pending';
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

        console.log(`📝 Updated messages: ${validMessages.length} total`);
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

        const totalDetected = sessionState?.detectedDataCount || 0;
        console.log(`🧠 Updated detected data: ${totalDetected} total items`);
      } catch (error) {
        console.error('❌ Failed to update detected data:', error);
      }
    },

    saveSessionState: async (state: Partial<SessionState>): Promise<void> => {
      if (!config.enableSessionRecovery || !sessionState) return;

      try {
        // Merge with current state
        sessionState = { ...sessionState, ...state };

        // Save to localStorage/AsyncStorage for session recovery
        const stateKey = `session_state_${sessionId}`;
        const stateData = JSON.stringify(sessionState);

        // Use a simple storage method that works across platforms
        if (typeof window !== 'undefined') {
          localStorage.setItem(stateKey, stateData);
        }

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

        // Clear auto-save timer
        if (autoSaveTimer) {
          clearInterval(autoSaveTimer);
          autoSaveTimer = null;
        }

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
            if (typeof window !== 'undefined') {
              localStorage.removeItem(stateKey);
            }
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
        let stateData: string | null = null;

        if (typeof window !== 'undefined') {
          stateData = localStorage.getItem(stateKey);
        }

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
        console.log('⚡ Force syncing conversation data...');

        // Generate conversation title from messages
        const title = generateConversationTitle(currentMessages);

        // TEMPORARILY DISABLED - Save conversation functionality
        // if (!conversationId) {
        //   // Create new conversation
        //   const conversationData = await saveConversation(
        //     config.userId,
        //     config.topic,
        //     currentMessages,
        //     {
        //       complexId: config.complexId,
        //       title,
        //       summary: null, // Will be generated later
        //     }
        //   );

        //   conversationId = conversationData.id;
        //   console.log('💾 New conversation created:', conversationId);
        // } else {
        //   // Update existing conversation
        //   await updateConversation(conversationId, config.userId, {
        //     messages: currentMessages,
        //     title,
        //     updated_at: new Date().toISOString(),
        //   });
        //   console.log('💾 Conversation updated:', conversationId);
        // }
        console.log('💾 Conversation persistence temporarily disabled');

        // TEMPORARILY DISABLED - Save detected data functionality (depends on conversationId)
        // if (conversationId && Object.keys(currentDetectedData).length > 0) {
        //   const hasData = (
        //     (currentDetectedData.emotions && currentDetectedData.emotions.length > 0) ||
        //     (currentDetectedData.parts && currentDetectedData.parts.length > 0) ||
        //     (currentDetectedData.needs && currentDetectedData.needs.length > 0)
        //   );

        //   if (hasData) {
        //     await saveAllDetectedData(conversationId, config.userId, currentDetectedData);
        //     console.log('🧠 Detected data synced');
        //   }
        // }
        console.log('🧠 Detected data persistence temporarily disabled');

        // Update session state
        if (sessionState) {
          // sessionState.conversationId = conversationId;
          sessionState.lastSaveTime = Date.now();
          await sync.saveSessionState(sessionState);
        }

        console.log('✅ Force sync completed');
      } catch (error) {
        console.error('❌ Force sync failed:', error);
        throw error;
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
 * Cleanup orphaned session states (utility function)
 */
export async function cleanupOrphanedSessions(): Promise<void> {
  try {
    if (typeof window === 'undefined') return;

    const keys = Object.keys(localStorage);
    const sessionKeys = keys.filter(key => key.startsWith('session_state_'));
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const key of sessionKeys) {
      try {
        const stateData = localStorage.getItem(key);
        if (stateData) {
          const state = JSON.parse(stateData) as SessionState;
          if (!state.isActive && (now - state.lastSaveTime > maxAge)) {
            localStorage.removeItem(key);
            console.log('🧹 Cleaned up orphaned session:', key);
          }
        }
      } catch (e) {
        // Remove corrupted session data
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('❌ Failed to cleanup orphaned sessions:', error);
  }
}