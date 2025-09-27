/**
 * Lightweight Message Queue Service
 * Handles parallel, non-blocking message persistence with zero latency
 */

import { ConversationMessage, DetectedItem } from '@/lib/database.types';

export interface QueuedMessage {
  id: string;
  timestamp: number;
  message: ConversationMessage;
  detectedData?: {
    emotions?: DetectedItem[];
    parts?: DetectedItem[];
    needs?: DetectedItem[];
  };
  retries: number;
}

export interface MessageQueueConfig {
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  onBatchProcess?: (batch: QueuedMessage[]) => Promise<void>;
}

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private processing = false;
  private config: Required<MessageQueueConfig>;
  private flushTimer: NodeJS.Timeout | null = null;
  private messageCache = new Map<string, QueuedMessage>();

  constructor(config: MessageQueueConfig = {}) {
    this.config = {
      batchSize: config.batchSize || 10,
      flushInterval: config.flushInterval || 100, // Process every 100ms
      maxRetries: config.maxRetries || 3,
      onBatchProcess: config.onBatchProcess || (async () => {}),
    };
  }

  /**
   * Add a message to the queue (instant, non-blocking)
   */
  enqueue(message: ConversationMessage, detectedData?: QueuedMessage['detectedData']): void {
    const queuedMessage: QueuedMessage = {
      id: message.id,
      timestamp: Date.now(),
      message,
      detectedData,
      retries: 0,
    };

    // Instant memory cache
    this.messageCache.set(message.id, queuedMessage);

    // Add to processing queue
    this.queue.push(queuedMessage);

    // Start flush timer if not already running
    if (!this.flushTimer) {
      this.scheduleFlush();
    }
  }

  /**
   * Get a message from cache immediately
   */
  getMessage(id: string): QueuedMessage | undefined {
    return this.messageCache.get(id);
  }

  /**
   * Get all cached messages
   */
  getAllMessages(): ConversationMessage[] {
    return Array.from(this.messageCache.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(q => q.message);
  }

  /**
   * Schedule a batch flush
   */
  private scheduleFlush(): void {
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.processBatch().catch(error => {
        console.error('❌ Message queue batch processing failed:', error);
      });
    }, this.config.flushInterval);
  }

  /**
   * Process a batch of messages (non-blocking)
   */
  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Take a batch from the queue
      const batch = this.queue.splice(0, this.config.batchSize);

      // Process in parallel without blocking
      Promise.resolve().then(async () => {
        try {
          await this.config.onBatchProcess(batch);
        } catch (error) {
          console.error('❌ Batch processing error:', error);

          // Re-queue failed messages with retry count
          batch.forEach(msg => {
            if (msg.retries < this.config.maxRetries) {
              msg.retries++;
              this.queue.push(msg);
            } else {
              console.error(`❌ Message ${msg.id} failed after ${this.config.maxRetries} retries`);
            }
          });
        }
      });

      // Schedule next batch if there are more messages
      if (this.queue.length > 0) {
        this.scheduleFlush();
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Force flush all pending messages
   */
  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    while (this.queue.length > 0) {
      await this.processBatch();
    }
  }

  /**
   * Clear the queue and cache
   */
  clear(): void {
    this.queue = [];
    this.messageCache.clear();

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      cacheSize: this.messageCache.size,
      processing: this.processing,
    };
  }
}

// Singleton instance for the app
let messageQueueInstance: MessageQueue | null = null;

export function getMessageQueue(config?: MessageQueueConfig): MessageQueue {
  if (!messageQueueInstance) {
    messageQueueInstance = new MessageQueue(config);
  }
  return messageQueueInstance;
}

export function resetMessageQueue(): void {
  if (messageQueueInstance) {
    messageQueueInstance.clear();
    messageQueueInstance = null;
  }
}