import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system'
import { AudioModule } from 'expo-audio'
import { localOpenAIService } from './localOpenAIService'
import { elevenLabsService, ELEVENLABS_VOICES } from './elevenLabsService'

export interface VoiceChatMessage {
  role: 'user' | 'assistant'
  content: string
  audio?: string // Base64 audio for playback
  timestamp: Date
}

interface VoiceChatCallbacks {
  onTranscriptionStart?: () => void
  onTranscriptionComplete?: (text: string) => void
  onStreamStart?: () => void
  onTextToken?: (token: string) => void
  onAudioChunk?: (audioData: string) => void
  onStreamComplete?: () => void
  onError?: (error: Error) => void
}

export class VoiceChatService {
  private recording: Audio.Recording | null = null
  private audioPlayer: Audio.Sound | null = null
  private abortController: AbortController | null = null
  private audioQueue: Array<{audio: string, format: string}> = []
  private isPlaying = false
  private supabaseUrl: string
  private supabaseAnonKey: string

  constructor() {
    this.supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
    this.supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
    
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      console.warn('Supabase credentials not configured')
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const permissionStatus = await AudioModule.requestRecordingPermissionsAsync()
      return permissionStatus.granted
    } catch (error) {
      console.error('Permission request failed:', error)
      return false
    }
  }

  async startRecording(): Promise<void> {
    try {
      // Stop any existing recording
      if (this.recording) {
        await this.stopRecording()
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      // Create and start recording
      const recording = new Audio.Recording()
      await recording.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000, // Whisper works well with 16kHz
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 128000,
        }
      })

      await recording.startAsync()
      this.recording = recording
      console.log('Recording started')
    } catch (error) {
      console.error('Failed to start recording:', error)
      throw error
    }
  }

  async stopRecording(): Promise<string | null> {
    try {
      if (!this.recording) {
        return null
      }

      await this.recording.stopAndUnloadAsync()
      const uri = this.recording.getURI()
      this.recording = null

      if (!uri) {
        throw new Error('No recording URI available')
      }

      // Convert to base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      // Clean up file
      await FileSystem.deleteAsync(uri, { idempotent: true })

      console.log('Recording stopped and converted to base64')
      return base64Audio
    } catch (error) {
      console.error('Failed to stop recording:', error)
      throw error
    }
  }

  async transcribeAudio(audioBase64: string, callbacks?: VoiceChatCallbacks): Promise<string> {
    try {
      callbacks?.onTranscriptionStart?.()

      console.log('🎤 Using Supabase transcribe function')
      
      const response = await fetch(`${this.supabaseUrl}/functions/v1/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.supabaseAnonKey}`,
        },
        body: JSON.stringify({
          audio: audioBase64,
          format: 'wav',
        }),
      })

      if (!response.ok) {
        // Fallback to local service if function not deployed
        console.warn('Supabase function not available, using local OpenAI service')
        const transcribedText = await localOpenAIService.transcribeAudio(audioBase64)
        callbacks?.onTranscriptionComplete?.(transcribedText)
        return transcribedText
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Transcription failed')
      }

      callbacks?.onTranscriptionComplete?.(result.text)
      return result.text
    } catch (error) {
      console.error('Transcription error:', error)
      // Fallback to local service on any error
      try {
        console.log('🔄 Falling back to local OpenAI service')
        const transcribedText = await localOpenAIService.transcribeAudio(audioBase64)
        callbacks?.onTranscriptionComplete?.(transcribedText)
        return transcribedText
      } catch (fallbackError) {
        callbacks?.onError?.(error as Error)
        throw error
      }
    }
  }

  async streamChat(
    messages: VoiceChatMessage[],
    callbacks?: VoiceChatCallbacks
  ): Promise<void> {
    try {
      // Cancel any existing stream
      this.cancelStream()
      
      this.abortController = new AbortController()
      this.audioQueue = []
      
      console.log('💬 Using Supabase chat-stream function with voice')
      callbacks?.onStreamStart?.()

      console.log('🔗 Fetching:', `${this.supabaseUrl}/functions/v1/chat-stream`)
      console.log('📝 Payload:', JSON.stringify({
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        voice: 'nova',
        model: 'gpt-4-turbo-preview'
      }, null, 2))

      // Add timeout to the fetch request
      const timeoutId = setTimeout(() => {
        console.log('⏰ Function call timed out after 30 seconds')
        this.abortController?.abort()
      }, 30000)

      const response = await fetch(`${this.supabaseUrl}/functions/v1/chat-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.supabaseAnonKey}`,
        },
        body: JSON.stringify({
          messages: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          voice: 'nova',
          model: 'gpt-4-turbo-preview'
        }),
        signal: this.abortController.signal,
      })

      clearTimeout(timeoutId)
      console.log('📡 Response status:', response.status)
      console.log('📄 Response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        // Fallback to local service if function not deployed
        console.warn('Supabase chat-stream function not available, using local service')
        await this.streamChatWithTTS(messages, callbacks)
        return
      }

      // Process SSE stream with audio
      await this.processAudioStream(response, callbacks)
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Stream cancelled')
        return
      }
      console.error('Stream error:', error)
      // Fallback to local service on error
      try {
        console.log('🔄 Falling back to local service')
        await localOpenAIService.streamChat(
          messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          {
            onToken: callbacks?.onTextToken,
            onComplete: callbacks?.onStreamComplete,
            onError: callbacks?.onError
          }
        )
      } catch (fallbackError) {
        callbacks?.onError?.(error as Error)
        throw error
      }
    }
  }

  private async processAudioStream(
    response: Response,
    callbacks?: VoiceChatCallbacks
  ): Promise<void> {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            
            if (data === '[DONE]') {
              console.log('🏁 Stream completed. Audio queue length:', this.audioQueue.length)
              if (this.audioQueue.length > 0) {
                console.log('🎵 Playing remaining audio chunks')
                await this.playAudioQueue()
              } else {
                console.log('⚠️ No audio chunks received - may need fallback TTS')
              }
              callbacks?.onStreamComplete?.()
              return
            }

            try {
              const json = JSON.parse(data)
              
              if (json.error) {
                throw new Error(json.error)
              }
              
              // Handle text tokens
              if (json.type === 'text' && json.content) {
                fullText += json.content
                callbacks?.onTextToken?.(json.content)
              }
              
              // Handle audio chunks
              if (json.type === 'audio' && json.audio) {
                console.log('🔊 Received audio chunk, format:', json.format, 'length:', json.audio.length)
                this.audioQueue.push({
                  audio: json.audio,
                  format: json.format || 'pcm16'
                })
                callbacks?.onAudioChunk?.(json.audio)
                
                // Start playing audio immediately for TTS (complete audio)
                if (!this.isPlaying) {
                  console.log('🎵 Starting audio playback, queue length:', this.audioQueue.length)
                  this.playAudioQueue()
                }
              }
              
              // Handle legacy text format (fallback)
              if (json.content && !json.type) {
                fullText += json.content
                callbacks?.onTextToken?.(json.content)
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                console.warn('Failed to parse SSE data:', data)
              } else {
                throw e
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private async playAudioQueue(): Promise<void> {
    console.log('🎵 playAudioQueue called. isPlaying:', this.isPlaying, 'queue length:', this.audioQueue.length)
    
    if (this.isPlaying || this.audioQueue.length === 0) {
      console.log('⏸️ Skipping playback - already playing or empty queue')
      return
    }
    
    this.isPlaying = true
    console.log('🔊 Starting audio playback...')
    
    try {
      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      })
      console.log('🔧 Audio mode set for playback')

      while (this.audioQueue.length > 0) {
        const audioItem = this.audioQueue.shift()
        if (!audioItem) continue

        console.log('🎧 Processing audio chunk, format:', audioItem.format, 'length:', audioItem.audio.length)

        let fileUri: string
        let fileExtension: string

        if (audioItem.format === 'mp3') {
          // Handle MP3 audio (from TTS)
          fileExtension = 'mp3'
          fileUri = `${FileSystem.documentDirectory}audio_${Date.now()}.mp3`
          
          console.log('💾 Writing MP3 audio file to:', fileUri)
          await FileSystem.writeAsStringAsync(fileUri, audioItem.audio, {
            encoding: FileSystem.EncodingType.Base64,
          })
        } else {
          // Handle PCM16 audio (convert to WAV)
          fileExtension = 'wav'
          const wavData = this.pcm16ToWav(audioItem.audio)
          fileUri = `${FileSystem.documentDirectory}audio_${Date.now()}.wav`
          
          console.log('💾 Writing WAV audio file to:', fileUri)
          await FileSystem.writeAsStringAsync(fileUri, wavData, {
            encoding: FileSystem.EncodingType.Base64,
          })
        }

        // Play the audio
        console.log('▶️ Creating sound from file...')
        const { sound } = await Audio.Sound.createAsync({ uri: fileUri })
        await sound.playAsync()
        
        // Wait for playback to complete
        await new Promise((resolve) => {
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              resolve(null)
            }
          })
        })

        // Clean up
        await sound.unloadAsync()
        await FileSystem.deleteAsync(fileUri, { idempotent: true })
      }
    } catch (error) {
      console.error('Audio playback error:', error)
    } finally {
      this.isPlaying = false
    }
  }

  private pcm16ToWav(pcmBase64: string): string {
    // Decode base64 to bytes
    const pcmData = atob(pcmBase64)
    const pcmBytes = new Uint8Array(pcmData.length)
    for (let i = 0; i < pcmData.length; i++) {
      pcmBytes[i] = pcmData.charCodeAt(i)
    }

    // Create WAV header
    const sampleRate = 24000
    const numChannels = 1
    const bitsPerSample = 16
    const dataSize = pcmBytes.length
    
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)
    
    // RIFF header
    const setString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
      }
    }
    
    setString(0, 'RIFF')
    view.setUint32(4, 36 + dataSize, true)
    setString(8, 'WAVE')
    setString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true)
    view.setUint16(32, numChannels * bitsPerSample / 8, true)
    view.setUint16(34, bitsPerSample, true)
    setString(36, 'data')
    view.setUint32(40, dataSize, true)
    
    // Copy PCM data
    const dataArray = new Uint8Array(buffer, 44)
    dataArray.set(pcmBytes)
    
    // Convert to base64
    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    
    return btoa(binary)
  }

  private async streamChatWithTTS(
    messages: VoiceChatMessage[],
    callbacks?: VoiceChatCallbacks
  ): Promise<void> {
    console.log('🎵 Using local OpenAI service with ElevenLabs TTS')
    
    let fullResponse = ''
    
    await localOpenAIService.streamChat(
      messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      {
        onToken: (token: string) => {
          fullResponse += token
          callbacks?.onTextToken?.(token)
        },
        onComplete: async () => {
          // Generate TTS audio after text is complete
          if (fullResponse.trim()) {
            console.log('🔊 Generating TTS audio with ElevenLabs...')
            try {
              let audioBase64: string
              
              // Try ElevenLabs first if configured
              if (elevenLabsService.isConfigured()) {
                console.log('🎙️ Using ElevenLabs voice synthesis')
                audioBase64 = await elevenLabsService.generateSpeech(
                  fullResponse,
                  'rachel' // Use Rachel voice by default
                )
              } else {
                // Fallback to OpenAI TTS
                console.log('🔄 Falling back to OpenAI TTS (ElevenLabs not configured)')
                audioBase64 = await localOpenAIService.generateTTS(fullResponse, 'nova')
              }
              
              // Add to audio queue for playback
              this.audioQueue.push({
                audio: audioBase64,
                format: 'mp3'
              })
              
              // Start playing audio
              if (!this.isPlaying) {
                console.log('🎵 Starting TTS audio playback')
                this.playAudioQueue()
              }
              
              callbacks?.onAudioChunk?.(audioBase64)
            } catch (ttsError) {
              console.error('⚠️ TTS generation failed:', ttsError)
              
              // Try OpenAI TTS as ultimate fallback
              if (elevenLabsService.isConfigured()) {
                try {
                  console.log('🔄 Trying OpenAI TTS as fallback')
                  const audioBase64 = await localOpenAIService.generateTTS(fullResponse, 'nova')
                  
                  this.audioQueue.push({
                    audio: audioBase64,
                    format: 'mp3'
                  })
                  
                  if (!this.isPlaying) {
                    this.playAudioQueue()
                  }
                  
                  callbacks?.onAudioChunk?.(audioBase64)
                } catch (fallbackError) {
                  console.error('❌ All TTS options failed:', fallbackError)
                }
              }
            }
          }
          
          callbacks?.onStreamComplete?.()
        },
        onError: callbacks?.onError
      }
    )
  }

  cancelStream(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.audioQueue = []
  }

  async cleanup(): Promise<void> {
    this.cancelStream()
    if (this.recording) {
      await this.recording.stopAndUnloadAsync()
      this.recording = null
    }
    if (this.audioPlayer) {
      await this.audioPlayer.unloadAsync()
      this.audioPlayer = null
    }
  }
}

export const voiceChatService = new VoiceChatService()