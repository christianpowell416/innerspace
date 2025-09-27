/**
 * Background Saver Service
 * Fire-and-forget message persistence with zero impact on conversation flow
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConversationMessage, DetectedItem } from '@/lib/database.types';
import { saveConversation, updateConversation } from './conversationPersistence';
import { saveAllDetectedData } from './detectedDataService';

interface SavedMessage {
  id: string;
  message: ConversationMessage;
  timestamp: number;
  synced: boolean;
}

interface ConversationMetadata {
  conversationId?: string;
  sessionId: string;
  userId: string;
  topic: string;
  complexId?: string;
  startTime: number;
  lastSaveTime: number;
  messageCount: number;
}

class BackgroundSaver {
  private metadata: ConversationMetadata | null = null;
  private messageCache = new Map<string, SavedMessage>();
  private pendingSaves: Set<string> = new Set();
  private saveTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  /**
   * Initialize the saver for a new conversation session
   */
  initialize(metadata: {
    sessionId: string;
    userId: string;
    topic: string;
    complexId?: string;
  }): void {
    this.metadata = {
      ...metadata,
      startTime: Date.now(),
      lastSaveTime: Date.now(),
      messageCount: 0,
    };

    // Clear any previous session data
    this.messageCache.clear();
    this.pendingSaves.clear();

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  /**
   * Save a message (fire-and-forget, returns immediately)
   */
  saveMessage(message: ConversationMessage): void {
    if (!this.metadata) {
      console.warn('BackgroundSaver not initialized');
      return;
    }

    // Add to cache immediately (synchronous)
    const savedMessage: SavedMessage = {
      id: message.id,
      message,
      timestamp: Date.now(),
      synced: false,
    };

    this.messageCache.set(message.id, savedMessage);
    this.pendingSaves.add(message.id);
    this.metadata.messageCount++;

    // Write to AsyncStorage immediately (non-blocking)
    this.writeToAsyncStorage(message);

    // Schedule batch save to Supabase
    this.scheduleBatchSave();
  }

  /**
   * Save detected data (emotions, parts, needs)
   */
  saveDetectedData(data: {
    emotions?: DetectedItem[];
    parts?: DetectedItem[];
    needs?: DetectedItem[];
  }): void {
    if (!this.metadata) return;

    // Save to AsyncStorage cache immediately
    const cacheKey = `detected_${this.metadata.sessionId}`;

    // Non-blocking save
    AsyncStorage.getItem(cacheKey)
      .then(existing => {
        const current = existing ? JSON.parse(existing) : {};
        const updated = {
          ...current,
          emotions: data.emotions || current.emotions || [],
          parts: data.parts || current.parts || [],
          needs: data.needs || current.needs || [],
          updatedAt: Date.now(),
        };
        return AsyncStorage.setItem(cacheKey, JSON.stringify(updated));
      })
      .catch(() => {}); // Silent fail - don't impact conversation
  }

  /**
   * Write message to AsyncStorage cache (non-blocking)
   */
  private writeToAsyncStorage(message: ConversationMessage): void {
    if (!this.metadata) return;

    const cacheKey = `msg_${this.metadata.sessionId}_${message.id}`;

    // Fire and forget - no await
    AsyncStorage.setItem(cacheKey, JSON.stringify({
      message,
      metadata: this.metadata,
      timestamp: Date.now(),
    })).catch(() => {}); // Silent fail
  }

  /**
   * Schedule batch save to Supabase
   */
  private scheduleBatchSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    // Batch saves every 2 seconds
    this.saveTimer = setTimeout(() => {
      this.processBatchSave();
    }, 2000);
  }

  /**
   * Process batch save to Supabase (runs in background)
   */
  private async processBatchSave(): Promise<void> {
    if (this.isProcessing || this.pendingSaves.size === 0 || !this.metadata) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get all pending messages
      const messagesToSave: ConversationMessage[] = [];

      for (const messageId of this.pendingSaves) {
        const saved = this.messageCache.get(messageId);
        if (saved && !saved.synced) {
          messagesToSave.push(saved.message);
        }
      }

      if (messagesToSave.length === 0) {
        this.isProcessing = false;
        return;
      }

      // Attempt to save to Supabase
      try {
        if (!this.metadata.conversationId) {
          // First save - create new conversation
          const result = await saveConversation(
            this.metadata.userId,
            this.metadata.topic,
            messagesToSave,
            { complexId: this.metadata.complexId }
          );

          if (result?.id) {
            this.metadata.conversationId = result.id;
          }
        } else {
          // Update existing conversation
          await updateConversation(
            this.metadata.conversationId,
            messagesToSave
          );
        }

        // Mark as synced
        for (const messageId of this.pendingSaves) {
          const saved = this.messageCache.get(messageId);
          if (saved) {
            saved.synced = true;
          }
        }

        // Clear pending saves
        this.pendingSaves.clear();

        // Clean up AsyncStorage cache for synced messages
        this.cleanupSyncedCache();

      } catch (error) {
        // Save failed - will retry
        console.warn('Background save failed, will retry:', error);
        this.scheduleRetry();
      }

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Schedule retry for failed saves
   */
  private scheduleRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    // Retry in 5 seconds
    this.retryTimer = setTimeout(() => {
      this.processBatchSave();
    }, 5000);
  }

  /**
   * Clean up synced messages from AsyncStorage
   */
  private async cleanupSyncedCache(): Promise<void> {
    if (!this.metadata) return;

    // Run in background - don't await
    setTimeout(async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const sessionPrefix = `msg_${this.metadata!.sessionId}_`;
        const keysToRemove = keys.filter(key => {
          if (!key.startsWith(sessionPrefix)) return false;

          const messageId = key.replace(sessionPrefix, '');
          const saved = this.messageCache.get(messageId);
          return saved?.synced === true;
        });

        if (keysToRemove.length > 0) {
          await AsyncStorage.multiRemove(keysToRemove);
        }
      } catch (error) {
        // Silent fail - cleanup is not critical
      }
    }, 0);
  }

  /**
   * Force save all pending messages (used when conversation ends)
   */
  async forceSave(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    await this.processBatchSave();
  }

  /**
   * Get all messages from cache
   */
  getAllMessages(): ConversationMessage[] {
    return Array.from(this.messageCache.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(s => s.message);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.metadata = null;
    this.messageCache.clear();
    this.pendingSaves.clear();

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}

// Singleton instance
export const backgroundSaver = new BackgroundSaver();