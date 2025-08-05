import * as FileSystem from 'expo-file-system';

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  preview_url?: string;
  category?: string;
}

// Popular ElevenLabs voices
export const ELEVENLABS_VOICES = {
  rachel: '21m00Tcm4TlvDq8ikWAM',
  domi: 'AZnzlk1XvdvUeBnXmlld',
  bella: 'EXAVITQu4vr4xnSDxMaL',
  antoni: 'ErXwobaYiN019PkySvjV',
  elli: 'MF3mGyEYCl7XYWbV9V6O',
  josh: 'TxGEqnHWrfWFTfGW9XjX',
  arnold: 'VR6AewLTigWG4xSOukaG',
  adam: 'pNInz6obpgDQGcFmaJgB',
  sam: 'yoZ06aMxZJJ28mfd3POQ',
} as const;

export type VoiceId = keyof typeof ELEVENLABS_VOICES | string;

interface ElevenLabsConfig {
  apiKey: string;
  voiceId?: string;
  modelId?: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private defaultVoiceId = ELEVENLABS_VOICES.rachel; // Default to Rachel
  private defaultModelId = 'eleven_turbo_v2'; // Latest turbo model

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || '';
    
    if (!this.apiKey || this.apiKey === 'YOUR_ELEVENLABS_API_KEY_HERE') {
      console.warn('ElevenLabs API key not configured');
    }
  }

  isConfigured(): boolean {
    return this.apiKey !== '' && this.apiKey !== 'YOUR_ELEVENLABS_API_KEY_HERE';
  }

  /**
   * Generate speech from text using ElevenLabs API
   * @param text The text to convert to speech
   * @param voiceId The voice ID to use (defaults to Rachel)
   * @param options Additional voice settings
   * @returns Base64 encoded MP3 audio
   */
  async generateSpeech(
    text: string,
    voiceId?: VoiceId,
    options?: {
      modelId?: string;
      voiceSettings?: ElevenLabsConfig['voiceSettings'];
    }
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    // Resolve voice ID
    const resolvedVoiceId = voiceId 
      ? (typeof voiceId === 'string' && voiceId in ELEVENLABS_VOICES 
        ? ELEVENLABS_VOICES[voiceId as keyof typeof ELEVENLABS_VOICES] 
        : voiceId)
      : this.defaultVoiceId;

    const url = `${this.baseUrl}/text-to-speech/${resolvedVoiceId}`;

    const requestBody = {
      text,
      model_id: options?.modelId || this.defaultModelId,
      voice_settings: options?.voiceSettings || {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true
      }
    };

    try {
      console.log('🎙️ Generating speech with ElevenLabs:', {
        voiceId: resolvedVoiceId,
        textLength: text.length,
        model: requestBody.model_id
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API error:', response.status, errorText);
        
        // Check for common errors
        if (response.status === 401) {
          throw new Error('Invalid ElevenLabs API key');
        } else if (response.status === 422) {
          throw new Error('Invalid voice ID or parameters');
        } else if (response.status === 429) {
          throw new Error('ElevenLabs rate limit exceeded');
        }
        
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      // Convert response to base64
      const audioBlob = await response.blob();
      
      // For React Native, we need to handle blob differently
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // Remove data:audio/mpeg;base64, prefix
          const base64Audio = base64data.split(',')[1];
          resolve(base64Audio);
        };
        reader.onerror = reject;
      });
      
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      console.log('✅ ElevenLabs speech generated successfully');
      return base64Audio;

    } catch (error) {
      console.error('ElevenLabs speech generation error:', error);
      throw error;
    }
  }

  /**
   * Stream speech generation (returns async iterator)
   * Note: Streaming requires websocket support which may not work well in React Native
   */
  async *streamSpeech(
    text: string,
    voiceId?: VoiceId,
    options?: {
      modelId?: string;
      voiceSettings?: ElevenLabsConfig['voiceSettings'];
    }
  ): AsyncGenerator<ArrayBuffer, void, unknown> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const resolvedVoiceId = voiceId 
      ? (typeof voiceId === 'string' && voiceId in ELEVENLABS_VOICES 
        ? ELEVENLABS_VOICES[voiceId as keyof typeof ELEVENLABS_VOICES] 
        : voiceId)
      : this.defaultVoiceId;

    const url = `${this.baseUrl}/text-to-speech/${resolvedVoiceId}/stream`;

    const requestBody = {
      text,
      model_id: options?.modelId || this.defaultModelId,
      voice_settings: options?.voiceSettings || {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true
      },
      optimize_streaming_latency: 0, // Optimize for lowest latency
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs streaming error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body available for streaming');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value.buffer;
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get available voices from ElevenLabs
   */
  async getVoices(): Promise<ElevenLabsVoice[]> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = await response.json();
    return data.voices;
  }

  /**
   * Get user subscription info (useful for checking limits)
   */
  async getSubscriptionInfo(): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/user/subscription`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch subscription info: ${response.status}`);
    }

    return response.json();
  }
}

export const elevenLabsService = new ElevenLabsService();