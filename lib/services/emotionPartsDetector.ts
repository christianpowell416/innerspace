/**
 * AI-Powered Emotion, Parts, and Needs Detection Service
 *
 * Uses OpenAI to intelligently analyze user messages and detect:
 * - Emotions (expressed feelings and emotional states)
 * - IFS Parts (internal family systems language and parts work)
 * - Needs (expressed desires, wants, and unmet needs)
 */

export interface DetectedLists {
  emotions: string[];
  parts: string[];
  needs: string[];
}

export interface DetectionCallbacks {
  onDetectionUpdate?: (lists: DetectedLists) => void;
}

class EmotionPartsDetector {
  private detectedEmotions: Set<string> = new Set();
  private detectedParts: Set<string> = new Set();
  private detectedNeeds: Set<string> = new Set();
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
  }

  /**
   * AI Detection Prompt for analyzing user messages
   */
  private getDetectionPrompt(): string {
    return `You are a specialized therapeutic analysis agent that detects emotions, parts, and needs from user messages.

TASK: Analyze the user's message and extract:
1. EMOTIONS: Any feelings, emotional states, or emotional expressions
2. PARTS: Any internal parts language, IFS concepts, or inner aspects mentioned
3. NEEDS: Any expressed needs, wants, desires, or unmet needs

GUIDELINES:
- Use the user's exact words when possible (1-2 words max per item)
- Only extract what is explicitly or implicitly expressed
- Be contextually intelligent - understand nuance and implications
- Don't invent or assume - only detect what's genuinely present
- Capture the essence in the user's language, not clinical terms

EXAMPLES:
User: "I'm feeling really overwhelmed lately"
→ {"emotions": ["Overwhelmed"], "parts": [], "needs": []}

User: "Part of me wants to hide, but I also need connection"
→ {"emotions": [], "parts": ["Wants to hide"], "needs": ["Connection"]}

User: "I'm anxious about the meeting tomorrow"
→ {"emotions": ["Anxious"], "parts": [], "needs": []}

User: "Something inside me feels broken"
→ {"emotions": ["Broken"], "parts": ["Something inside"], "needs": []}

RESPONSE FORMAT: JSON only, no explanations
{"emotions": ["word1", "word2"], "parts": ["phrase1"], "needs": ["need1", "need2"]}`;
  }

  /**
   * Analyze text using AI for intelligent emotion/parts/needs detection
   */
  async analyzeText(text: string): Promise<DetectedLists> {
    if (!text || typeof text !== 'string') {
      return this.getCurrentLists();
    }

    if (!this.apiKey) {
      console.warn('🔍 [DETECTION] No OpenAI API key - skipping AI analysis');
      return this.getCurrentLists();
    }

    console.log('🔍 [DETECTION] Analyzing text with AI:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));

    try {
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
      });

      if (!response.ok) {
        console.error('🔍 [DETECTION] OpenAI API error:', response.status);
        return this.getCurrentLists();
      }

      const result = await response.json();
      const aiResponse = result.choices[0]?.message?.content;

      if (!aiResponse) {
        console.warn('🔍 [DETECTION] No response from AI');
        return this.getCurrentLists();
      }

      console.log('🤖 [DETECTION] AI Response:', aiResponse);

      // Parse AI response
      let detected;
      try {
        // Clean up any markdown formatting
        const cleanResponse = aiResponse.replace(/```json|```/g, '').trim();
        detected = JSON.parse(cleanResponse);
      } catch (parseError) {
        console.error('🔍 [DETECTION] Failed to parse AI response:', aiResponse);
        return this.getCurrentLists();
      }

      // Add new detections to our sets
      let foundEmotions = 0;
      let foundParts = 0;
      let foundNeeds = 0;

      if (detected.emotions && Array.isArray(detected.emotions)) {
        detected.emotions.forEach((emotion: string) => {
          if (emotion && !this.detectedEmotions.has(emotion)) {
            console.log(`😊 [EMOTION] AI detected: "${emotion}"`);
            this.detectedEmotions.add(emotion);
            foundEmotions++;
          }
        });
      }

      if (detected.parts && Array.isArray(detected.parts)) {
        detected.parts.forEach((part: string) => {
          if (part && !this.detectedParts.has(part)) {
            console.log(`🧩 [PARTS] AI detected: "${part}"`);
            this.detectedParts.add(part);
            foundParts++;
          }
        });
      }

      if (detected.needs && Array.isArray(detected.needs)) {
        detected.needs.forEach((need: string) => {
          if (need && !this.detectedNeeds.has(need)) {
            console.log(`💚 [NEEDS] AI detected: "${need}"`);
            this.detectedNeeds.add(need);
            foundNeeds++;
          }
        });
      }

      if (foundEmotions > 0 || foundParts > 0 || foundNeeds > 0) {
        console.log(`📊 [DETECTION] AI Summary: ${foundEmotions} emotions, ${foundParts} parts, ${foundNeeds} needs detected`);
      } else {
        console.log('📊 [DETECTION] AI found no new items in this text');
      }

    } catch (error) {
      console.error('🔍 [DETECTION] AI analysis error:', error);
    }

    return this.getCurrentLists();
  }

  /**
   * Get current detected lists
   */
  getCurrentLists(): DetectedLists {
    return {
      emotions: Array.from(this.detectedEmotions).sort(),
      parts: Array.from(this.detectedParts).sort(),
      needs: Array.from(this.detectedNeeds).sort()
    };
  }

  /**
   * Add a message to analyze (async for AI analysis)
   */
  async addMessage(content: string, callbacks?: DetectionCallbacks): Promise<DetectedLists> {
    console.log('📨 [DETECTION] Adding message for AI analysis');
    const lists = await this.analyzeText(content);
    console.log('📋 [DETECTION] Current totals:', {
      emotions: lists.emotions.length,
      parts: lists.parts.length,
      needs: lists.needs.length
    });
    callbacks?.onDetectionUpdate?.(lists);
    return lists;
  }

  /**
   * Reset all detected items
   */
  reset(): void {
    console.log('🔄 [DETECTION] Resetting all detected items');
    const prevCounts = {
      emotions: this.detectedEmotions.size,
      parts: this.detectedParts.size,
      needs: this.detectedNeeds.size
    };

    this.detectedEmotions.clear();
    this.detectedParts.clear();
    this.detectedNeeds.clear();

    console.log('✅ [DETECTION] Reset complete. Cleared:', prevCounts);
  }

  /**
   * Manually add detected items
   */
  addEmotion(emotion: string): void {
    this.detectedEmotions.add(emotion);
  }

  addPart(part: string): void {
    this.detectedParts.add(part);
  }

  addNeed(need: string): void {
    this.detectedNeeds.add(need);
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