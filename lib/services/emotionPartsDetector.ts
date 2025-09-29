/**
 * AI-Powered Emotion, Parts, and Needs Detection Service
 *
 * Uses OpenAI to intelligently analyze user messages and detect:
 * - Emotions (expressed feelings and emotional states - ONLY from outer ring of emotion wheel)
 * - IFS Parts (internal family systems language and parts work)
 * - Needs (expressed desires, wants, and unmet needs)
 */

import { isValidOuterRingEmotion, normalizeEmotion, getEmotionColor } from '@/lib/constants/validEmotions';
import { DetectedItem } from '@/lib/database.types';

export interface DetectedLists {
  emotions: DetectedItem[];
  parts: DetectedItem[];
  needs: DetectedItem[];
}

export interface DetectionCallbacks {
  onDetectionUpdate?: (lists: DetectedLists) => void;
}

class EmotionPartsDetector {
  private detectedEmotions: Map<string, DetectedItem> = new Map();
  private detectedParts: Map<string, DetectedItem> = new Map();
  private detectedNeeds: Map<string, DetectedItem> = new Map();
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
  }

  /**
   * Make API request with retry logic
   */
  private async makeAPIRequest(text: string, retryCount = 0): Promise<Response> {
    const maxRetries = 2;

    try {
      // Create abort controller for timeout handling (React Native compatible)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 15000); // 15 second timeout

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: this.getDetectionPrompt()
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.3,
          max_tokens: 200,
        }),
        signal: controller.signal,
      });

      // Clear timeout if request succeeds
      clearTimeout(timeoutId);

      return response;
    } catch (error) {
      if (retryCount < maxRetries && error instanceof Error) {
        if (error.message.includes('Network request failed') ||
            error.message.includes('Failed to fetch') ||
            error.name === 'AbortError' ||
            error.message.includes('aborted')) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
          return this.makeAPIRequest(text, retryCount + 1);
        }
      }
      throw error;
    }
  }

  /**
   * AI Detection Prompt for analyzing user messages
   */
  private getDetectionPrompt(): string {
    return `You are a specialized therapeutic analysis agent that detects emotions, parts, and needs from user messages.

TASK: Analyze the user's message and extract:
1. EMOTIONS: Any feelings, emotional states, or emotional expressions
   - Also note if they mention intensity (1-10 scale) for any emotion
2. PARTS: Any internal parts language, IFS concepts, or inner aspects mentioned
3. NEEDS: Any expressed needs, wants, desires, or unmet needs

GUIDELINES:
- Extract ONLY the core emotion/part/need word, removing all adjectives and intensifiers
- Remove words like: really, very, extremely, super, quite, pretty, totally, completely, so, deeply, etc.
- Convert ALL detections to proper NOUN forms (not adjectives or verbs)
- Only extract what is explicitly or implicitly expressed
- Be contextually intelligent - understand nuance and implications
- Don't invent or assume - only detect what's genuinely present
- Capture the essence in clean, simple terms

EMOTION RULES (TEMPORARILY RELAXED):
- Accept all emotions including core emotions like: Angry, Disgusted, Sad, Happy, Surprised, Bad, Fearful
- Also accept specific emotions: Frustrated, Hurt, Jealous, Lonely, Joyful, Anxious, Overwhelmed
- Extract whatever emotion is expressed without filtering

EMOTION & NEED CONVERSION RULES:
- Adjectives to nouns: "anxious" → "Anxiety", "overwhelmed" → "Overwhelm", "tired" → "Fatigue"
- Verbs to nouns: "hurting" → "Pain", "struggling" → "Struggle", "wanting" → "Want"
- Keep existing nouns: "peace" → "Peace", "safety" → "Safety"

PARTS REFINEMENT RULES:
- For parts language, extract the core function/behavior as "verb + object" structure
- Remove filler words like "part of me", "something in me", "there's a part"
- Focus on what the part DOES or what it's about
- Examples: "part of me is scared of rejection" → "Fears rejection"
- Examples: "part of me wants to protect others" → "Protects others"
- Examples: "something in me feels angry" → extract as emotion "Anger", not a part

EXAMPLES:
User: "I'm feeling really overwhelmed lately"
→ {"emotions": [{"name": "Overwhelmed", "intensity": null}], "parts": [], "needs": []}

User: "I'm super anxious, maybe like an 8 out of 10"
→ {"emotions": [{"name": "Anxious", "intensity": 8}], "parts": [], "needs": []}

User: "Part of me desperately wants to hide"
→ {"emotions": [], "parts": ["Wants to hide"], "needs": []}

User: "Part of me is scared of rejection"
→ {"emotions": [{"name": "Scared", "intensity": null}], "parts": ["Fears rejection"], "needs": []}

User: "I feel joy when I see my kids"
→ {"emotions": [{"name": "Joy", "intensity": null}], "parts": [], "needs": []}

User: "I'm extremely tired, like a 9 out of 10, and need some peace"
→ {"emotions": [{"name": "Exhausted", "intensity": 9}], "parts": [], "needs": ["Peace"]}

User: "Something deep inside me feels completely broken"
→ {"emotions": [{"name": "Hopeless", "intensity": null}], "parts": [], "needs": []}

User: "I really need to feel very safe right now"
→ {"emotions": [], "parts": [], "needs": ["Safety"]}

RESPONSE FORMAT: JSON only, no explanations
{
  "emotions": [
    {"name": "emotion1", "intensity": null},
    {"name": "emotion2", "intensity": 7}
  ],
  "parts": ["phrase1"],
  "needs": ["need1", "need2"]
}

Note: intensity is optional - only include if user mentions it (1-10 scale)`;
  }

  /**
   * Analyze text using AI for intelligent emotion/parts/needs detection
   */
  async analyzeText(text: string): Promise<DetectedLists> {

    if (!text || typeof text !== 'string') {
      return this.getCurrentLists();
    }

    if (!this.apiKey) {
      console.warn('🤖 [DETECTOR] No API key found, returning current lists');
      return this.getCurrentLists();
    }



    try {
      const response = await this.makeAPIRequest(text);

      if (!response.ok) {
        console.warn('🤖 [DETECTOR] API request failed with status:', response.status);
        return this.getCurrentLists();
      }

      const result = await response.json();
      const aiResponse = result.choices[0]?.message?.content;

      if (!aiResponse) {
        console.warn('🤖 [DETECTOR] No AI response content found');
        return this.getCurrentLists();
      }


      // Parse AI response
      let detected;
      try {
        // Clean up any markdown formatting
        const cleanResponse = aiResponse.replace(/```json|```/g, '').trim();
        detected = JSON.parse(cleanResponse);
      } catch (parseError) {
        return this.getCurrentLists();
      }

      // Add new detections to our sets
      let foundEmotions = 0;
      let foundParts = 0;
      let foundNeeds = 0;

      if (detected.emotions && Array.isArray(detected.emotions)) {
        detected.emotions.forEach((emotionData: any) => {
          // Handle both old format (string) and new format (object)
          const emotionName = typeof emotionData === 'string' ? emotionData : emotionData?.name;
          const intensity = typeof emotionData === 'object' ? emotionData?.intensity : undefined;

          if (emotionName) {
            // Validate and normalize the emotion
            const normalized = normalizeEmotion(emotionName);

            if (normalized && !this.detectedEmotions.has(normalized)) {
              // TEMPORARILY DISABLED: Only add if it's a valid outer ring emotion
              // if (isValidOuterRingEmotion(normalized)) {
                const detectedItem: DetectedItem = {
                  name: normalized,
                  confidence: 0.8, // Default confidence
                  color: getEmotionColor(normalized),
                  intensity: intensity !== null ? intensity : undefined
                };

                console.log(`😊 [EMOTION] AI detected emotion: "${normalized}" (intensity: ${intensity || 'not specified'})`);
                this.detectedEmotions.set(normalized, detectedItem);
                foundEmotions++;
              // } else {
              //   console.log(`⚠️ [EMOTION] Rejected non-outer-ring emotion: "${emotionName}"`);
              // }
            } else if (!normalized) {
              console.log(`❌ [EMOTION] Rejected invalid emotion: "${emotionName}"`);
            }
          }
        });
      }

      if (detected.parts && Array.isArray(detected.parts)) {
        detected.parts.forEach((part: string) => {
          if (part && !this.detectedParts.has(part)) {
            const detectedItem: DetectedItem = {
              name: part,
              confidence: 0.8,
            };
            console.log(`🧩 [PARTS] AI detected: "${part}"`);
            this.detectedParts.set(part, detectedItem);
            foundParts++;
          }
        });
      }

      if (detected.needs && Array.isArray(detected.needs)) {
        detected.needs.forEach((need: string) => {
          if (need && !this.detectedNeeds.has(need)) {
            const detectedItem: DetectedItem = {
              name: need,
              confidence: 0.8,
            };
            console.log(`💚 [NEEDS] AI detected: "${need}"`);
            this.detectedNeeds.set(need, detectedItem);
            foundNeeds++;
          }
        });
      }

      if (foundEmotions > 0 || foundParts > 0 || foundNeeds > 0) {
      } else {
      }

    } catch (error) {
      console.error('🤖 [DETECTOR] Error during analysis:', error);
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          console.warn('🤖 [DETECTOR] Request was aborted/timed out');
        } else if (error.message.includes('Network request failed')) {
          console.warn('🤖 [DETECTOR] Network request failed');
        } else if (error.message.includes('Failed to fetch')) {
          console.warn('🤖 [DETECTOR] Fetch failed');
        } else {
          console.error('🤖 [DETECTOR] Unknown error:', error.message);
        }
      } else {
        console.error('🤖 [DETECTOR] Non-Error exception:', error);
      }

      // Continue gracefully without AI analysis
    }

    return this.getCurrentLists();
  }

  /**
   * Get current detected lists
   */
  getCurrentLists(): DetectedLists {
    return {
      emotions: Array.from(this.detectedEmotions.values()).sort((a, b) => a.name.localeCompare(b.name)),
      parts: Array.from(this.detectedParts.values()).sort((a, b) => a.name.localeCompare(b.name)),
      needs: Array.from(this.detectedNeeds.values()).sort((a, b) => a.name.localeCompare(b.name))
    };
  }

  /**
   * Add a message to analyze (async for AI analysis)
   */
  async addMessage(content: string, callbacks?: DetectionCallbacks): Promise<DetectedLists> {
    const lists = await this.analyzeText(content);
    // Current totals - emotions: lists.emotions.length, parts: lists.parts.length, needs: lists.needs.length
    callbacks?.onDetectionUpdate?.(lists);
    return lists;
  }

  /**
   * Reset all detected items
   */
  reset(): void {
    const prevCounts = {
      emotions: this.detectedEmotions.size,
      parts: this.detectedParts.size,
      needs: this.detectedNeeds.size
    };

    this.detectedEmotions.clear();
    this.detectedParts.clear();
    this.detectedNeeds.clear();

  }

  /**
   * Manually add detected items
   */
  addEmotion(emotion: string, intensity?: number): void {
    // Validate before adding
    const normalized = normalizeEmotion(emotion);
    // TEMPORARILY DISABLED: if (normalized && isValidOuterRingEmotion(normalized)) {
    if (normalized) {
      const detectedItem: DetectedItem = {
        name: normalized,
        confidence: 0.9, // Higher confidence for manual adds
        color: getEmotionColor(normalized),
        intensity: intensity
      };
      this.detectedEmotions.set(normalized, detectedItem);
      console.log(`✅ [EMOTION] Manually added emotion: "${normalized}" (intensity: ${intensity || 'not specified'})`);
    } else {
      console.log(`❌ [EMOTION] Rejected manual emotion (invalid): "${emotion}"`);
    }
  }

  addPart(part: string): void {
    const detectedItem: DetectedItem = {
      name: part,
      confidence: 0.9,
    };
    this.detectedParts.set(part, detectedItem);
  }

  addNeed(need: string): void {
    const detectedItem: DetectedItem = {
      name: need,
      confidence: 0.9,
    };
    this.detectedNeeds.set(need, detectedItem);
  }

  /**
   * Remove detected items
   */
  removeEmotion(emotion: string): void {
    this.detectedEmotions.delete(emotion);
  }

  removePart(part: string): void {
    this.detectedParts.delete(part);
  }

  removeNeed(need: string): void {
    this.detectedNeeds.delete(need);
  }
}

// Export singleton instance
export const emotionPartsDetector = new EmotionPartsDetector();