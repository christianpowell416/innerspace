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
    /\bfeel(?:ing)?\s+([a-zA-Z\s]+?)(?:\s+(?:about|when|that|because|and|but|or|\.|,|$))/gi,
    /\bi'm\s+([a-zA-Z\s]+?)(?:\s+(?:about|when|that|because|and|but|or|\.|,|$))/gi,
    /\bi\s+feel\s+([a-zA-Z\s]+?)(?:\s+(?:about|when|that|because|and|but|or|\.|,|$))/gi,
    /\bmakes?\s+me\s+feel\s+([a-zA-Z\s]+?)(?:\s+(?:about|when|that|because|and|but|or|\.|,|$))/gi,
    /\bfeeling\s+([a-zA-Z\s]+?)(?:\s+(?:about|when|that|because|and|but|or|\.|,|$))/gi
  ];

  // Patterns to detect parts language (capture verbatim)
  private partsIndicators = [
    /\bpart of me\s+(?:that\s+)?([a-zA-Z\s]+?)(?:\s+(?:and|but|or|\.|,|$))/gi,
    /\bparts? of me\s+(?:that\s+)?([a-zA-Z\s]+?)(?:\s+(?:and|but|or|\.|,|$))/gi,
    /\bthe\s+part\s+(?:of me\s+)?(?:that\s+)?([a-zA-Z\s]+?)(?:\s+(?:and|but|or|\.|,|$))/gi,
    /\binner\s+([a-zA-Z\s]+?)(?:\s+(?:and|but|or|\.|,|$))/gi,
    /\b(manager|exile|firefighter|protector|critic)\b/gi,
    /\bthe\s+(manager|exile|firefighter|protector|critic)\b/gi
  ];

  // Patterns to detect needs expressions (capture verbatim)
  private needsIndicators = [
    /\bi\s+need\s+(?:to\s+)?([a-zA-Z\s]+?)(?:\s+(?:and|but|or|\.|,|$))/gi,
    /\bneed\s+(?:to\s+)?([a-zA-Z\s]+?)(?:\s+(?:and|but|or|\.|,|$))/gi,
    /\bi\s+want\s+(?:to\s+)?([a-zA-Z\s]+?)(?:\s+(?:and|but|or|\.|,|$))/gi,
    /\bwant\s+(?:to\s+)?([a-zA-Z\s]+?)(?:\s+(?:and|but|or|\.|,|$))/gi,
    /\bi\s+wish\s+(?:to\s+)?([a-zA-Z\s]+?)(?:\s+(?:and|but|or|\.|,|$))/gi,
    /\blonging\s+for\s+([a-zA-Z\s]+?)(?:\s+(?:and|but|or|\.|,|$))/gi,
    /\bdesire\s+(?:for\s+)?([a-zA-Z\s]+?)(?:\s+(?:and|but|or|\.|,|$))/gi
  ];

  /**
   * Analyze text for emotions, parts, and needs (capture verbatim)
   */
  analyzeText(text: string): DetectedLists {
    if (!text || typeof text !== 'string') {
      return this.getCurrentLists();
    }

    // Detect emotions (capture what user actually said)
    this.emotionIndicators.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
          const emotion = this.cleanCapture(match[1]);
          if (emotion) {
            this.detectedEmotions.add(emotion);
          }
        }
      }
    });

    // Detect parts (capture verbatim parts language)
    this.partsIndicators.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
          const part = this.cleanCapture(match[1]);
          if (part) {
            this.detectedParts.add(part);
          }
        }
      }
    });

    // Detect needs (capture what user actually said they need)
    this.needsIndicators.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
          const need = this.cleanCapture(match[1]);
          if (need) {
            this.detectedNeeds.add(need);
          }
        }
      }
    });

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
    const lists = this.analyzeText(content);
    callbacks?.onDetectionUpdate?.(lists);
    return lists;
  }

  /**
   * Reset all detected items
   */
  reset(): void {
    this.detectedEmotions.clear();
    this.detectedParts.clear();
    this.detectedNeeds.clear();
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