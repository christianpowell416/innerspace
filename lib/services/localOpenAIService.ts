// Temporary local OpenAI service to bypass Supabase functions
// This allows testing the voice chat while functions are being deployed

import * as FileSystem from 'expo-file-system'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface StreamCallbacks {
  onToken?: (token: string) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

export class LocalOpenAIService {
  private apiKey: string

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || ''
    
    if (!this.apiKey) {
      console.warn('OpenAI API key not found in environment variables')
    }
  }

  async streamChat(messages: ChatMessage[], callbacks?: StreamCallbacks): Promise<void> {
    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      console.log('🔥 Starting OpenAI stream request...')
      console.log('🔑 API Key present:', !!this.apiKey && this.apiKey.length > 0)
      console.log('📝 Messages count:', messages.length)

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages,
          temperature: 0.7,
          max_tokens: 1000,
          stream: false, // Temporarily disable streaming to test
        }),
      })

      console.log('📡 Response status:', response.status)
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()))
      console.log('📡 Response body type:', typeof response.body)
      console.log('📡 Response body exists:', !!response.body)

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${response.status} - ${error}`)
      }

      // Handle non-streaming response for React Native compatibility
      const result = await response.json()
      console.log('💬 Non-streaming response received:', result)
      
      const content = result.choices?.[0]?.message?.content
      if (content) {
        // Simulate streaming by sending the content in chunks
        const words = content.split(' ')
        for (let i = 0; i < words.length; i++) {
          const chunk = i === 0 ? words[i] : ' ' + words[i]
          callbacks?.onToken?.(chunk)
          
          // Add small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        callbacks?.onComplete?.()
      } else {
        throw new Error('No content in OpenAI response')
      }
    } catch (error) {
      console.error('Local OpenAI streaming error:', error)
      callbacks?.onError?.(error as Error)
      throw error
    }
  }

  async transcribeAudio(audioBase64: string): Promise<string> {
    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      // For React Native, we need to use a different approach
      // Create a temporary file URI and use that for FormData
      
      // Write base64 to temporary file
      const tempUri = `${FileSystem.documentDirectory}temp_audio_${Date.now()}.wav`
      await FileSystem.writeAsStringAsync(tempUri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      })

      // Create form data with the file URI
      const formData = new FormData()
      formData.append('file', {
        uri: tempUri,
        name: 'audio.wav',
        type: 'audio/wav',
      } as any)
      formData.append('model', 'whisper-1')

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      })

      // Clean up temporary file
      await FileSystem.deleteAsync(tempUri, { idempotent: true })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Whisper API error: ${error}`)
      }

      const result = await response.json()
      return result.text || ''
    } catch (error) {
      console.error('Local transcription error:', error)
      throw error
    }
  }

  async generateTTS(text: string, voice: string = 'nova'): Promise<string> {
    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      console.log('🔊 Generating TTS with OpenAI...')

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: voice,
          response_format: 'mp3'
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI TTS error: ${error}`)
      }

      // Convert response to base64
      const audioArrayBuffer = await response.arrayBuffer()
      const audioBytes = new Uint8Array(audioArrayBuffer)
      
      // Convert to base64 for React Native
      let binary = ''
      for (let i = 0; i < audioBytes.byteLength; i++) {
        binary += String.fromCharCode(audioBytes[i])
      }
      const base64Audio = btoa(binary)

      console.log('✅ OpenAI TTS generated successfully')
      return base64Audio

    } catch (error) {
      console.error('OpenAI TTS error:', error)
      throw error
    }
  }
}

export const localOpenAIService = new LocalOpenAIService()