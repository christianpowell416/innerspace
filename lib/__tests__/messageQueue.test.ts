/**
 * Message Queue Performance Tests
 */

import { MessageQueue } from '../services/messageQueue';
import { ConversationMessage } from '../database.types';

describe('MessageQueue Performance', () => {
  let queue: MessageQueue;
  let processedBatches: any[] = [];

  beforeEach(() => {
    processedBatches = [];
    queue = new MessageQueue({
      batchSize: 5,
      flushInterval: 50,
      onBatchProcess: async (batch) => {
        processedBatches.push(batch);
        // Simulate async save operation
        await new Promise(resolve => setTimeout(resolve, 10));
      },
    });
  });

  afterEach(() => {
    queue.clear();
  });

  test('should enqueue messages instantly', () => {
    const start = Date.now();

    // Enqueue 100 messages
    for (let i = 0; i < 100; i++) {
      const message: ConversationMessage = {
        id: `msg-${i}`,
        type: 'user',
        text: `Message ${i}`,
        timestamp: Date.now(),
      };
      queue.enqueue(message);
    }

    const elapsed = Date.now() - start;

    // Should take less than 10ms to enqueue 100 messages
    expect(elapsed).toBeLessThan(10);

    // All messages should be in cache immediately
    expect(queue.getStats().cacheSize).toBe(100);
  });

  test('should retrieve messages from cache instantly', () => {
    // Add messages
    for (let i = 0; i < 50; i++) {
      const message: ConversationMessage = {
        id: `msg-${i}`,
        type: 'user',
        text: `Message ${i}`,
        timestamp: Date.now(),
      };
      queue.enqueue(message);
    }

    // Retrieve should be instant
    const start = Date.now();
    const message25 = queue.getMessage('msg-25');
    const elapsed = Date.now() - start;

    expect(message25).toBeDefined();
    expect(message25?.message.text).toBe('Message 25');
    expect(elapsed).toBeLessThan(1);
  });

  test('should process batches in parallel', async () => {
    // Enqueue 15 messages (3 batches of 5)
    for (let i = 0; i < 15; i++) {
      const message: ConversationMessage = {
        id: `msg-${i}`,
        type: 'user',
        text: `Message ${i}`,
        timestamp: Date.now(),
      };
      queue.enqueue(message);
    }

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 200));

    // Should have processed in batches
    expect(processedBatches.length).toBeGreaterThanOrEqual(3);

    // Each batch should have at most 5 messages
    processedBatches.forEach(batch => {
      expect(batch.length).toBeLessThanOrEqual(5);
    });
  });

  test('should handle concurrent enqueues without blocking', async () => {
    const promises: Promise<void>[] = [];
    const start = Date.now();

    // Simulate 10 concurrent users sending messages
    for (let user = 0; user < 10; user++) {
      promises.push(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            for (let msg = 0; msg < 10; msg++) {
              const message: ConversationMessage = {
                id: `user-${user}-msg-${msg}`,
                type: 'user',
                text: `User ${user} Message ${msg}`,
                timestamp: Date.now(),
              };
              queue.enqueue(message);
            }
            resolve();
          }, user * 5); // Stagger slightly
        })
      );
    }

    await Promise.all(promises);
    const elapsed = Date.now() - start;

    // Should handle 100 messages from 10 users quickly
    expect(elapsed).toBeLessThan(100);
    expect(queue.getStats().cacheSize).toBe(100);
  });

  test('should maintain message order in cache', () => {
    const messages: ConversationMessage[] = [];

    // Add messages with timestamps
    for (let i = 0; i < 20; i++) {
      const message: ConversationMessage = {
        id: `msg-${i}`,
        type: i % 2 === 0 ? 'user' : 'assistant',
        text: `Message ${i}`,
        timestamp: 1000 + i * 100, // Incrementing timestamps
      };
      messages.push(message);
      queue.enqueue(message);
    }

    // Get all messages from cache
    const cachedMessages = queue.getAllMessages();

    // Should maintain order by timestamp
    expect(cachedMessages.length).toBe(20);
    for (let i = 0; i < 19; i++) {
      expect(cachedMessages[i].timestamp).toBeLessThanOrEqual(cachedMessages[i + 1].timestamp);
    }
  });

  test('should handle flush without blocking', async () => {
    // Add many messages
    for (let i = 0; i < 50; i++) {
      const message: ConversationMessage = {
        id: `msg-${i}`,
        type: 'user',
        text: `Message ${i}`,
        timestamp: Date.now(),
      };
      queue.enqueue(message);
    }

    const start = Date.now();

    // Force flush should complete quickly
    await queue.flush();

    const elapsed = Date.now() - start;

    // Flush should be relatively quick even with many messages
    expect(elapsed).toBeLessThan(500);

    // Queue should be empty after flush
    expect(queue.getStats().queueLength).toBe(0);
  });
});

// Performance benchmark
if (process.env.RUN_BENCHMARKS) {
  describe('MessageQueue Benchmarks', () => {
    test('benchmark: 1000 messages throughput', async () => {
      const queue = new MessageQueue({
        batchSize: 10,
        flushInterval: 25,
        onBatchProcess: async () => {
          // Minimal processing
        },
      });

      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        const message: ConversationMessage = {
          id: `bench-${i}`,
          type: 'user',
          text: `Benchmark message ${i}`,
          timestamp: Date.now(),
        };
        queue.enqueue(message);
      }

      await queue.flush();
      const elapsed = Date.now() - start;

      console.log(`Processed 1000 messages in ${elapsed}ms`);
      console.log(`Throughput: ${Math.round(1000 / (elapsed / 1000))} messages/second`);

      expect(elapsed).toBeLessThan(1000); // Should process 1000 messages in under 1 second
    });
  });
}