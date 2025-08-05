# Voice Chat Edge Functions

This document covers the deployment and usage of the voice chat system with real-time audio streaming.

## 🚀 Deployment

### 1. Set Environment Variables

Set your OpenAI API key as a Supabase secret:

```bash
supabase secrets set OPENAI_API_KEY=your-openai-api-key-here
```

### 2. Deploy Functions

Deploy both edge functions:

```bash
# Deploy transcription function
supabase functions deploy transcribe

# Deploy chat streaming function  
supabase functions deploy chat-stream
```

### 3. Verify Deployment

Test the functions:

```bash
# Test transcription (with base64 audio)
curl -X POST https://your-project.supabase.co/functions/v1/transcribe \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"audio": "base64_audio_data", "format": "wav"}'

# Test chat streaming
curl -X POST https://your-project.supabase.co/functions/v1/chat-stream \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "voice": "nova"}'
```

## 📋 Function Details

### transcribe Function

**Endpoint:** `/functions/v1/transcribe`

**Request Body:**
```typescript
{
  audio: string,    // Base64 encoded audio
  format?: string,  // Audio format (wav, mp3, etc.)
  language?: string // Optional language hint
}
```

**Response:**
```typescript
{
  success: boolean,
  text?: string,     // Transcribed text
  language?: string, // Detected language
  error?: string     // Error message if failed
}
```

### chat-stream Function

**Endpoint:** `/functions/v1/chat-stream`

**Request Body:**
```typescript
{
  messages: Array<{
    role: 'system' | 'user' | 'assistant',
    content: string
  }>,
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
  model?: string,
  temperature?: number,
  max_tokens?: number,
  response_format?: 'text' | 'audio' | 'both'
}
```

**Response:** Server-Sent Events (SSE)
```
data: {"type": "text", "content": "Hello"}\n\n
data: {"type": "audio", "audio": "base64_pcm_data", "format": "pcm16"}\n\n
data: [DONE]\n\n
```

## 🎯 Audio Format Specifications

### Input Audio (Transcription)
- **Format:** WAV, MP3, M4A, etc.
- **Sample Rate:** 16kHz recommended for Whisper
- **Channels:** Mono preferred
- **Encoding:** Base64

### Output Audio (Streaming)
- **Format:** PCM16 (16-bit PCM)
- **Sample Rate:** 24kHz
- **Channels:** Mono
- **Delivery:** Base64 chunks via SSE

## 🔧 Client Integration

### Expo App Setup

Install required dependencies:
```bash
npm install expo-av expo-audio expo-file-system
```

### Environment Variables

Add to your `.env` file:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Usage Example

```typescript
import { voiceChatService } from '@/lib/services/voiceChatService'

// Start recording
await voiceChatService.startRecording()

// Stop and transcribe
const audioBase64 = await voiceChatService.stopRecording()
const transcription = await voiceChatService.transcribeAudio(audioBase64)

// Stream AI response with voice
await voiceChatService.streamChat(messages, {
  onTextToken: (token) => console.log('Text:', token),
  onAudioChunk: (audio) => console.log('Audio chunk received'),
  onStreamComplete: () => console.log('Done')
})
```

## 🎵 Audio Processing Pipeline

1. **Recording:** expo-av records WAV audio at 16kHz
2. **Transcription:** Audio uploaded to Whisper API
3. **Chat Streaming:** Text sent to GPT-4o with audio output
4. **Playback:** PCM16 chunks converted to WAV and played

## 🔍 Troubleshooting

### Common Issues

1. **No audio recorded**
   - Check microphone permissions
   - Verify audio mode settings

2. **Transcription fails**
   - Check audio format and size
   - Verify OpenAI API key

3. **Audio playback issues**
   - Check PCM16 to WAV conversion
   - Verify audio file cleanup

4. **Streaming stops**
   - Check network connection
   - Verify SSE parsing

### Debug Logs

View function logs:
```bash
supabase functions logs transcribe --follow
supabase functions logs chat-stream --follow
```

## 🔒 Security Considerations

- API keys stored as Supabase secrets
- Audio data not permanently stored
- CORS configured for your domain
- File cleanup after processing

## ⚡ Performance Notes

- Audio chunks streamed in real-time
- Automatic queue management for playback
- Cleanup of temporary files
- Efficient PCM16 to WAV conversion