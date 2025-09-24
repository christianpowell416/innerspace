/**
 * Conversation service for handling conversation data operations
 */

export interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ConversationData {
  id: number;
  title: string;
  date: string;
  description: string;
  messages: ConversationMessage[];
}

/**
 * Generate realistic conversation messages based on the conversation description
 */
export function generateConversationMessages(conversation: { id: number; title: string; description: string }): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  let messageId = 1;

  // Create realistic conversation flows based on the topic
  switch (conversation.id) {
    case 1: // Work Stress Discussion
      messages.push(
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'user',
          content: "I've been feeling completely overwhelmed at work lately. The deadlines are getting impossible to meet and I feel like I'm drowning.",
          timestamp: new Date('2024-12-08T10:00:00')
        },
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'assistant',
          content: "I can hear the weight you're carrying right now. That feeling of drowning sounds really overwhelming. What part of you is most activated when you think about these deadlines?",
          timestamp: new Date('2024-12-08T10:01:00')
        },
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'user',
          content: "There's this part that just keeps pushing and pushing, telling me I have to be perfect or I'll get fired. But then there's another part that just wants to escape and avoid everything.",
          timestamp: new Date('2024-12-08T10:02:30')
        },
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'assistant',
          content: "I'm noticing two distinct parts here - one that's working so hard to protect you through perfectionism, and another that's overwhelmed and wants relief. What does that perfectionist part need right now?",
          timestamp: new Date('2024-12-08T10:04:00')
        },
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'user',
          content: "I think it needs to feel safe. Like, that I'm not going to lose my job if I'm not perfect at everything.",
          timestamp: new Date('2024-12-08T10:05:15')
        },
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'assistant',
          content: "That makes so much sense. Safety and security are such fundamental needs. What would help that part feel more secure? Maybe we could explore some concrete strategies for managing these deadlines in a way that honors both your need for quality work and your wellbeing.",
          timestamp: new Date('2024-12-08T10:06:30')
        }
      );
      break;

    case 2: // Relationship Boundaries
      messages.push(
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'user',
          content: "My family is driving me crazy about the holidays. They expect me to come to every single event and when I try to say no, they make me feel so guilty.",
          timestamp: new Date('2024-12-05T14:00:00')
        },
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'assistant',
          content: "It sounds like there's a lot of pressure from your family and then guilt when you try to protect your own needs. What comes up for you when you imagine setting a boundary with them?",
          timestamp: new Date('2024-12-05T14:01:00')
        },
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'user',
          content: "Fear, honestly. Fear that they'll be angry, or that they'll think I don't love them. I know it's not rational, but there's this part of me that feels like I'm being selfish.",
          timestamp: new Date('2024-12-05T14:02:30')
        },
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'assistant',
          content: "That fear makes complete sense - it sounds like there's a part that learned early on that love might be conditional on always saying yes. What would it be like to reassure that part that you can love your family AND take care of yourself?",
          timestamp: new Date('2024-12-05T14:04:00')
        }
      );
      break;

    case 3: // Self-Confidence Building
      messages.push(
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'user',
          content: "I had this presentation today and even though it went well, all I can think about is that one moment where I stumbled over my words.",
          timestamp: new Date('2024-12-01T16:00:00')
        },
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'assistant',
          content: "I notice your mind went straight to that one imperfect moment rather than the fact that the presentation went well overall. What's that critical voice telling you?",
          timestamp: new Date('2024-12-01T16:01:00')
        },
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'user',
          content: "It's saying I'm not good enough, that everyone probably noticed and thinks I'm incompetent. Even though logically I know that's not true.",
          timestamp: new Date('2024-12-01T16:02:15')
        },
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'assistant',
          content: "That critical part is really loud right now. What would it be like to speak to yourself the way you'd speak to a good friend who had the same experience?",
          timestamp: new Date('2024-12-01T16:03:30')
        }
      );
      break;

    default:
      // Generic conversation flow for other topics
      messages.push(
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'user',
          content: "I've been thinking about what we discussed last time, and I'm noticing some patterns coming up.",
          timestamp: new Date()
        },
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'assistant',
          content: "I'm curious about what patterns you're noticing. What's standing out for you?",
          timestamp: new Date()
        },
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'user',
          content: conversation.description.substring(0, 150) + "...",
          timestamp: new Date()
        },
        {
          id: `${conversation.id}-${messageId++}`,
          type: 'assistant',
          content: "That sounds like an important insight. What part of you is most affected by this pattern?",
          timestamp: new Date()
        }
      );
      break;
  }

  return messages;
}

/**
 * Get conversation by ID with messages
 */
export function getConversationById(id: number, conversationData: any[]): ConversationData | null {
  const conversation = conversationData.find(conv => conv.id === id);
  if (!conversation) return null;

  return {
    ...conversation,
    messages: generateConversationMessages(conversation)
  };
}

/**
 * Get all conversations with messages
 */
export function getAllConversationsWithMessages(conversationData: any[]): ConversationData[] {
  return conversationData.map(conversation => ({
    ...conversation,
    messages: generateConversationMessages(conversation)
  }));
}