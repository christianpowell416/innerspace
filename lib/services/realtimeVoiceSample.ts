import AudioModule from 'expo-audio/build/AudioModule';
import { setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { VoiceType } from './voiceSettings';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
const REALTIME_API_URL = 'wss://api.openai.com/v1/realtime';

interface VoiceSampleResult {
  success: boolean;
  error?: string;
}

/**
 * Generate a voice sample using the Realtime API for voices that support it
 */
export async function generateRealtimeVoiceSample(
  voice: VoiceType,
  text: string
): Promise<VoiceSampleResult> {
  return new Promise((resolve) => {
    let websocket: WebSocket | null = null;
    let audioData: string = '';
    let sessionId: string | null = null;
    const timeoutMs = 10000; // 10 second timeout

    const cleanup = () => {
      if (websocket) {
        websocket.close();
        websocket = null;
      }
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ success: false, error: 'Timeout generating voice sample' });
    }, timeoutMs);

    try {
      const wsUrl = `${REALTIME_API_URL}?model=gpt-realtime`;

      websocket = new WebSocket(wsUrl, [], {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1',
          'OpenAI-Version': '2025-08-28'
        }
      } as any);

      websocket.onopen = () => {
        console.log('🎙️ Connected to Realtime API for voice sample');

        // Send session configuration with the selected voice
        const sessionConfig = {
          type: 'session.update',
          session: {
            modalities: ['audio', 'text'],
            voice: voice,
            instructions: `You are generating a voice sample. Simply say: "${text}"`,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: null,
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 200
            },
            tools: [],
            tool_choice: 'none',
            max_response_output_tokens: 100
          }
        };

        websocket?.send(JSON.stringify(sessionConfig));

        // Send a conversation item to trigger the response
        const conversationItem = {
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{
              type: 'input_text',
              text: `Say: "${text}"`
            }]
          }
        };

        websocket?.send(JSON.stringify(conversationItem));

        // Trigger response generation
        const responseCreate = {
          type: 'response.create'
        };

        websocket?.send(JSON.stringify(responseCreate));
      };

      websocket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'session.created':
              sessionId = message.session.id;
              console.log('📋 Session created:', sessionId);
              break;

            case 'response.audio.delta':
              // Accumulate audio data
              if (message.delta) {
                audioData += message.delta;
              }
              break;

            case 'response.audio.done':
              // Audio stream complete - just log it
              console.log('🎵 Audio stream complete');
              break;

            case 'response.done':
              // Process and play audio only once when response is fully done
              if (audioData) {
                console.log('🎵 Voice sample generated successfully');

                try {
                  // Set audio mode for playback
                  await setAudioModeAsync({
                    allowsRecording: false,
                    playsInSilentMode: true,
                    shouldPlayInBackground: false,
                    interruptionMode: 'duckOthers',
                    interruptionModeAndroid: 'duckOthers',
                    shouldRouteThroughEarpiece: false,
                  });

                  // Convert base64 PCM to WAV format
                  const wavBase64 = await convertPCMToWAV(audioData);

                  // Save as temporary WAV file
                  const fileUri = `${FileSystem.documentDirectory}voice_sample_${Date.now()}.wav`;
                  await FileSystem.writeAsStringAsync(fileUri, wavBase64, {
                    encoding: FileSystem.EncodingType.Base64,
                  });

                  // Play the audio
                  const sound = new AudioModule.AudioPlayer({ uri: fileUri }, 500, false);
                  sound.play();

                  // Clean up after playback
                  setTimeout(async () => {
                    try {
                      sound.remove();
                      await FileSystem.deleteAsync(fileUri, { idempotent: true });
                    } catch (cleanupError) {
                      console.warn('Cleanup warning:', cleanupError);
                    }
                  }, 3000);

                  clearTimeout(timeout);
                  cleanup();
                  resolve({ success: true });
                } catch (playError) {
                  console.error('Error playing voice sample:', playError);
                  clearTimeout(timeout);
                  cleanup();
                  resolve({ success: false, error: 'Failed to play audio' });
                }
              } else {
                // No audio data received
                clearTimeout(timeout);
                cleanup();
                resolve({ success: false, error: 'No audio data received' });
              }
              break;

            case 'error':
              console.error('❌ Realtime API error:', message.error);
              clearTimeout(timeout);
              cleanup();
              resolve({ success: false, error: message.error.message });
              break;
          }
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      };

      websocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        clearTimeout(timeout);
        cleanup();
        resolve({ success: false, error: 'WebSocket connection error' });
      };

      websocket.onclose = () => {
        console.log('🔌 WebSocket connection closed');
      };

    } catch (error) {
      console.error('❌ Error creating voice sample:', error);
      clearTimeout(timeout);
      cleanup();
      resolve({ success: false, error: 'Failed to connect to Realtime API' });
    }
  });
}

/**
 * Convert base64 PCM16 audio to WAV format
 */
async function convertPCMToWAV(pcmBase64: string): Promise<string> {
  // Decode base64 to binary
  const binaryStr = atob(pcmBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Create WAV header
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = bytes.length;
  const fileSize = 44 + dataSize;

  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // "RIFF" chunk descriptor
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, fileSize - 8, true); // file size - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // "fmt " sub-chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // subchunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, numChannels, true); // number of channels
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true); // byte rate
  view.setUint16(32, numChannels * bitsPerSample / 8, true); // block align
  view.setUint16(34, bitsPerSample, true); // bits per sample

  // "data" sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true); // data size

  // Combine header and PCM data
  const wavBytes = new Uint8Array(fileSize);
  wavBytes.set(new Uint8Array(header), 0);
  wavBytes.set(bytes, 44);

  // Convert to base64
  let binaryString = '';
  for (let i = 0; i < wavBytes.length; i++) {
    binaryString += String.fromCharCode(wavBytes[i]);
  }

  return btoa(binaryString);
}