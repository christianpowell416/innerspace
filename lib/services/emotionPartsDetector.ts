/**
 * Emotion, Parts, and Needs Detection Service
 *
 * Analyzes conversation text to detect mentions of:
 * - Emotions (anger, sadness, joy, etc.)
 * - IFS Parts (manager, exile, firefighter, self)
 * - Needs (safety, connection, autonomy, etc.)
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

  // Patterns to detect emotional expressions (capture verbatim)
  private emotionIndicators = [
    /\bi\s+feel\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/gi,
    /\bfeeling\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/gi,
    /\bi'm\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/gi,
    /\bmakes?\s+me\s+feel\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/gi,
    /\bfeel\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/gi
  ];

  // Patterns to detect parts language (capture verbatim)
  private partsIndicators = [
    /\bpart of me\s+(?:that\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/gi,
    /\bparts? of me\s+(?:that\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/gi,
    /\bthe\s+part\s+(?:of me\s+)?(?:that\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/gi,
    /\binner\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/gi,
    /\b(manager|exile|firefighter|protector|critic)\b/gi,
    /\bthe\s+(manager|exile|firefighter|protector|critic)\b/gi
  ];

  // Patterns to detect needs expressions (capture verbatim)
  private needsIndicators = [
    /\bi\s+need\s+(?:to\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/gi,
    /\bneed\s+(?:to\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/gi,
    /\bi\s+want\s+(?:to\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/gi,
    /\bwant\s+(?:to\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/gi,
    /\bi\s+wish\s+(?:to\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/gi,
    /\blonging\s+for\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/gi,
    /\bdesire\s+(?:for\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/gi
  ];

  /**
   * Analyze text for emotions, parts, and needs (capture verbatim)
   */
  analyzeText(text: string): DetectedLists {
    if (!text || typeof text !== 'string') {
      return this.getCurrentLists();
    }

    console.log('🔍 [DETECTION] Analyzing text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));

    let foundEmotions = 0;
    let foundParts = 0;
    let foundNeeds = 0;

    // Detect emotions (capture what user actually said)
    this.emotionIndicators.forEach((pattern, index) => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
          const emotion = this.cleanCapture(match[1]);
          if (emotion && !this.detectedEmotions.has(emotion)) {
            console.log(`😊 [EMOTION] Pattern ${index + 1} detected: "${emotion}" from "${match[0]}"`);
            this.detectedEmotions.add(emotion);
            foundEmotions++;
          }
        }
      }
    });

    // Detect parts (capture verbatim parts language)
    this.partsIndicators.forEach((pattern, index) => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
          const part = this.cleanCapture(match[1]);
          if (part && !this.detectedParts.has(part)) {
            console.log(`🧩 [PARTS] Pattern ${index + 1} detected: "${part}" from "${match[0]}"`);
            this.detectedParts.add(part);
            foundParts++;
          }
        }
      }
    });

    // Detect needs (capture what user actually said they need)
    this.needsIndicators.forEach((pattern, index) => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
          const need = this.cleanCapture(match[1]);
          if (need && !this.detectedNeeds.has(need)) {
            console.log(`💚 [NEEDS] Pattern ${index + 1} detected: "${need}" from "${match[0]}"`);
            this.detectedNeeds.add(need);
            foundNeeds++;
          }
        }
      }
    });

    if (foundEmotions > 0 || foundParts > 0 || foundNeeds > 0) {
      console.log(`📊 [DETECTION] Summary: ${foundEmotions} emotions, ${foundParts} parts, ${foundNeeds} needs detected`);
    } else {
      console.log('📊 [DETECTION] No new items detected in this text');
    }

    return this.getCurrentLists();
  }

  /**
   * Clean and format captured text (minimal processing)
   */
  private cleanCapture(text: string): string {
    if (!text) return '';

    // Basic cleanup
    let cleaned = text.trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // normalize whitespace
      .replace(/^\w/, c => c.toUpperCase()); // capitalize first letter

    // Limit to 1-2 words as requested
    const words = cleaned.split(' ');
    if (words.length > 2) {
      cleaned = words.slice(0, 2).join(' ');
    }

    // Filter out very short or common words that aren't meaningful
    if (cleaned.length < 3 || ['That', 'This', 'The', 'And', 'But', 'Or', 'It', 'Is', 'Was'].includes(cleaned)) {
      return '';
    }

    return cleaned;
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
   * Add a message to analyze
   */
  addMessage(content: string, callbacks?: DetectionCallbacks): DetectedLists {
    console.log('📨 [DETECTION] Adding message for analysis');
    const lists = this.analyzeText(content);
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