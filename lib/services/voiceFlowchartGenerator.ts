import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import AudioModule from 'expo-audio/build/AudioModule';
import { RecordingOptions, RecordingPresets } from 'expo-audio';
import { setAudioModeAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { FlowchartStructure } from '../types/flowchart';
import { voiceConversationInstructions } from '../../assets/flowchart/voice_conversation_instructions.js';

const OPENAI_REALTIME_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
const REALTIME_API_URL = 'wss://api.openai.com/v1/realtime';

// Simple Voice Activity Detection using audio amplitude analysis
const checkAudioForSpeechContent = async (wavBase64: string): Promise<boolean> => {
  try {
    // Convert base64 to binary
    const binaryString = atob(wavBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Skip WAV header (typically 44 bytes) to get to audio data
    const audioDataStart = 44;
    if (bytes.length <= audioDataStart) {
      console.log('🔇 Audio file too small, likely no content');
      return false;
    }
    
    // Analyze audio samples (assuming 16-bit PCM)
    const audioSamples = [];
    for (let i = audioDataStart; i < bytes.length - 1; i += 2) {
      // Convert 16-bit little-endian to signed integer
      const sample = (bytes[i + 1] << 8) | bytes[i];
      const signedSample = sample > 32767 ? sample - 65536 : sample;
      audioSamples.push(Math.abs(signedSample)); // Use absolute value for amplitude
    }
    
    if (audioSamples.length === 0) {
      console.log('🔇 No audio samples found');
      return false;
    }
    
    // Calculate audio statistics without spreading array (prevent stack overflow)
    let maxAmplitude = 0;
    let sumAmplitude = 0;
    let sumSquares = 0;
    
    for (const sample of audioSamples) {
      if (sample > maxAmplitude) maxAmplitude = sample;
      sumAmplitude += sample;
      sumSquares += sample * sample;
    }
    
    const avgAmplitude = sumAmplitude / audioSamples.length;
    const rmsAmplitude = Math.sqrt(sumSquares / audioSamples.length);
    
    // Balanced thresholds for speech detection
    const MIN_MAX_AMPLITUDE = 2000;     // Minimum peak amplitude
    const MIN_RMS_AMPLITUDE = 300;      // Minimum sustained level (RMS)
    const MIN_AVG_AMPLITUDE = 150;      // Minimum average amplitude
    
    // Calculate what percentage of samples are above noise floor
    const noiseFloor = 500;
    const activeSamples = audioSamples.filter(sample => sample > noiseFloor).length;
    const activityRatio = activeSamples / audioSamples.length;
    const MIN_ACTIVITY_RATIO = 0.1; // At least 10% of samples should be above noise floor
    
    const dynamicRange = maxAmplitude - avgAmplitude;
    const hasSpeech = maxAmplitude > MIN_MAX_AMPLITUDE && 
                     rmsAmplitude > MIN_RMS_AMPLITUDE &&
                     avgAmplitude > MIN_AVG_AMPLITUDE &&
                     activityRatio > MIN_ACTIVITY_RATIO;
    
    // console.log(`🎵 Audio analysis: max=${maxAmplitude}, avg=${avgAmplitude.toFixed(1)}, rms=${rmsAmplitude.toFixed(1)}, activity=${(activityRatio*100).toFixed(1)}%, hasSpeech=${hasSpeech}`);
    
    return hasSpeech;
  } catch (error) {
    console.error('❌ Error analyzing audio content:', error);
    // If analysis fails, allow transcription to proceed (fail-safe)
    return true;
  }
};

const extractSystemPromptFromVoiceInstructions = (): string => {
  try {
    const lines = voiceConversationInstructions.split('\n');
    let systemPrompt = '';
    let currentSection = '';
    
    for (const line of lines) {
      if (line.startsWith('## System Prompt')) {
        currentSection = 'system';
        continue;
      } else if (line.startsWith('##') && currentSection === 'system') {
        break; // End of system prompt section
      } else if (line.trim() === '' && currentSection !== 'system') {
        continue;
      }
      
      if (currentSection === 'system') {
        systemPrompt += line + '\n';
      }
    }
    
    return systemPrompt.trim();
  } catch (error) {
    console.error('❌ Error extracting system prompt from voice instructions:', error);
    // Fallback
    return 'You are a compassionate AI therapeutic companion trained in Internal Family Systems (IFS) therapy principles.';
  }
};

export const loadFlowchartTemplate = async (): Promise<any> => {
  try {
    // Return a simple fallback template to avoid import issues
    // console.log('📄 Using fallback flowchart template');
    return {
      templateName: "fallback-template",
      structure: {
        nodes: [
          { id: "need_name", label: "need_name", type: "Need", description: "need_description", x: 300, y: 100 },
          { id: "self_name", label: "self_name", type: "Self", description: "self_description", x: 150, y: 250 },
          { id: "manager_name", label: "manager_name", type: "Manager", description: "manager_description", x: 450, y: 250 },
          { id: "exile_name", label: "exile_name", type: "Exile", description: "exile_description", x: 450, y: 400 },
          { id: "firefighter_name", label: "firefighter_name", type: "Firefighter", description: "firefighter_description", x: 450, y: 550 }
        ],
        edges: [
          { from: "need_name", to: "self_name", type: "💚", label: "" },
          { from: "need_name", to: "manager_name", type: "💔", label: "" },
          { from: "manager_name", to: "exile_name", type: "❌", label: "" },
          { from: "exile_name", to: "firefighter_name", type: "🚨", label: "" }
        ]
      },
      usage: {
        nodeTypes: ["Need", "Self", "Manager", "Exile", "Firefighter"],
        edgeTypes: ["💚", "💔", "❌", "🚨"]
      }
    };
  } catch (error) {
    console.error('❌ Error in loadFlowchartTemplate:', error);
    return { templateName: "error-template", structure: { nodes: [], edges: [] } };
  }
};

export const generateVoiceInstructions = async (template: any | null): Promise<string> => {
  try {
    
    // Parse the voice instructions to extract system instructions
    const lines = voiceConversationInstructions.split('\n');
    let currentSection = '';
    let systemPrompt = '';
    let responseGuidelines = '';
    let voiceGuidelines = '';
    let finalInstructions = '';
    
    for (const line of lines) {
      if (line.startsWith('## System Prompt')) {
        currentSection = 'system';
        continue;
      } else if (line.startsWith('## Response Guidelines')) {
        currentSection = 'response';
        continue;
      } else if (line.startsWith('## Voice Conversation Guidelines')) {
        currentSection = 'voice';
        continue;
      } else if (line.startsWith('## Final Instructions')) {
        currentSection = 'final';
        continue;
      } else if (line.startsWith('#') || line.trim() === '') {
        continue;
      }
      
      const content = line + '\n';
      switch (currentSection) {
        case 'system':
          systemPrompt += content;
          break;
        case 'response':
          responseGuidelines += content;
          break;
        case 'voice':
          voiceGuidelines += content;
          break;
        case 'final':
          finalInstructions += content;
          break;
      }
    }
    
    
    // Create voice-specific instructions using ONLY content from the centralized prompt file
    const templateSection = template ? `DATA STRUCTURE TEMPLATE:
${JSON.stringify(template.structure, null, 2)}

` : '';
    
    const voiceInstructions = `${systemPrompt.trim()}

${responseGuidelines.trim()}

${voiceGuidelines.trim()}

${templateSection}${finalInstructions.trim()}`;

    return voiceInstructions;
    
  } catch (error) {
    console.error('❌ Error generating voice instructions:', error);
    // Use system prompt from centralized file as fallback
    return extractSystemPromptFromCentralFile();
  }
};

export interface VoiceSessionConfig {
  sessionInstructions?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | 'marin' | 'cedar';
  temperature?: number;
  enableVAD?: boolean; // Enable Voice Activity Detection for hands-free mode
}

export interface VoiceFlowchartSession {
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: () => void;
  stopListening: () => void;
  startContinuousListening: () => void;
  stopContinuousListening: () => void;
  interruptResponse: () => void;
  sendMessage: (message: string) => void;
  isConnected: boolean;
  isListening: boolean;
  isPlaying: boolean;
  isContinuousMode: boolean;
}

export const createVoiceFlowchartSession = (
  config: VoiceSessionConfig,
  callbacks: {
    onConnected?: () => void;
    onDisconnected?: () => void;
    onListeningStart?: () => void;
    onListeningStop?: () => void;
    onTranscript?: (transcript: string, isFinal: boolean) => void;
    onResponse?: (response: string) => void;
    onResponseComplete?: () => void;
    onFlowchartGenerated?: (flowchart: FlowchartStructure) => void;
    onError?: (error: Error) => void;
  }
): VoiceFlowchartSession => {
  
  let websocket: WebSocket | null = null;
  let isConnected = false;
  let isListening = false;
  let isPlaying = false;
  let isContinuousMode = false;
  let currentRecording: any | null = null;
  let currentSound: any | null = null;
  let isCreatingRecording = false; // Prevent concurrent recording creation
  let isReceivingAudio = false;
  let hasActiveResponse = false;
  let continuousRecordingInterval: NodeJS.Timeout | null = null;
  let isJsonResponse = false;
  let hasStartedPlayingResponse = false;
  let isUserStoppingRecording = false; // Flag to prevent monitoring from interfering with user stops
  let currentTranscript = ''; // Track transcript as it builds
  let sentenceChunkBoundaries: number[] = []; // Track which chunks end sentences
  
  // Seamless audio streaming variables (working implementation)
  let streamingAudioBuffer: Uint8Array[] = [];
  let streamingPlayer: AudioModule.AudioPlayer | null = null;
  let isProcessingAudio = false;

  const session: VoiceFlowchartSession = {
    connect: async () => {
      try {
        if (!OPENAI_REALTIME_API_KEY) {
          throw new Error('OpenAI API key not configured');
        }

        const wsUrl = `${REALTIME_API_URL}?model=gpt-realtime`;
        
        websocket = new WebSocket(wsUrl, [], {
          headers: {
            'Authorization': `Bearer ${OPENAI_REALTIME_API_KEY}`,
            'OpenAI-Beta': 'realtime=v1',
            'OpenAI-Version': '2025-08-28'
          }
        });
        
        // Add connection timeout
        const connectionTimeout = setTimeout(() => {
          if (websocket && websocket.readyState === WebSocket.CONNECTING) {
            websocket.close();
            callbacks.onError?.(new Error('Connection timeout. Please check your internet connection and API key.'));
          }
        }, 10000);

        websocket.onopen = () => {
          clearTimeout(connectionTimeout);
          isConnected = true;
          
          // Session configuration with audio support
          const sessionConfig = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: config.sessionInstructions || extractSystemPromptFromCentralFile(),
              voice: config.voice || 'alloy',
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: {
                model: 'whisper-1'
              },
              turn_detection: config.enableVAD ? {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500
              } : null,
              temperature: config.temperature || 0.7
            }
          };
          
          websocket?.send(JSON.stringify(sessionConfig));
          callbacks.onConnected?.();
        };

        websocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            handleRealtimeMessage(message);
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
          }
        };

        websocket.onclose = () => {
          isConnected = false;
          isListening = false;
          callbacks.onDisconnected?.();
        };

        websocket.onerror = (error) => {
          
          isConnected = false;
          isListening = false;
          
          // Provide more specific error messages
          let errorMessage = 'WebSocket connection failed';
          if (error.message && error.message.includes('-9806')) {
            errorMessage = 'Network connection error (SSL/TLS issue). Please check your internet connection and try again.';
          } else if (error.message && error.message.includes('401')) {
            errorMessage = 'Invalid API key. Please check your OpenAI API key configuration.';
          } else if (error.message && error.message.includes('403')) {
            errorMessage = 'Access denied. Your API key may not have access to the Realtime API.';
          }
          
          callbacks.onError?.(new Error(errorMessage));
        };

      } catch (error) {
        console.error('❌ Error connecting to Realtime API:', error);
        callbacks.onError?.(error as Error);
      }
    },

    disconnect: () => {
      console.log('🔌 Disconnect called - cleaning up all resources');
      
      if (websocket) {
        websocket.close();
        websocket = null;
      }
      if (currentSound) {
        currentSound.remove().catch(e => console.log('⚠️ Error unloading sound:', e.message));
        currentSound = null;
      }
      if (currentRecording) {
        console.log('🧹 Disconnect: Cleaning up currentRecording');
        currentRecording.stop().catch(e => console.log('⚠️ Error unloading recording:', e.message));
        currentRecording = null;
      }
      isConnected = false;
      isListening = false;
      isPlaying = false;
      streamingAudioBuffer = [];
      isProcessingAudio = false;
      isReceivingAudio = false;
      hasActiveResponse = false;
      hasStartedPlayingResponse = false;
      isUserStoppingRecording = false;
      currentTranscript = '';
      sentenceChunkBoundaries = [];
      
      console.log('✅ Disconnect cleanup complete');
    },

    startListening: async () => {
      // console.log('🚨🚨🚨 START_LISTENING_CALLED (REALTIME STREAMING) 🚨🚨🚨');
      if (!websocket || !isConnected) {
        console.log('❌ Cannot start listening - no websocket or not connected');
        return;
      }
      
      // Check if already creating a recording
      if (isCreatingRecording) {
        console.log('⚠️ Recording creation already in progress, skipping');
        return;
      }
      
      // Set flag to prevent concurrent attempts
      isCreatingRecording = true;
      
      try {
        // console.log('🎤 Starting listening process...');
        
        // Immediately signal listening start for instant UI feedback
        isListening = true;
        callbacks.onListeningStart?.();
        
        // Interrupt any current AI response playback
        if (isPlaying && currentSound) {
          // console.log('🛑🛑🛑 INTERRUPTING AI AUDIO PLAYBACK 🛑🛑🛑');
          try {
            // console.log('⏹️ Stopping current sound...');
            currentSound.pause();
            // console.log('🗑️ Unloading current sound...');
            await currentSound.remove();
            // console.log('✅ AI audio successfully stopped');
          } catch (e) {
            console.log('⚠️ Error stopping current sound:', e.message);
          }
          currentSound = null;
          isPlaying = false;
          // console.log('🎯 Audio interruption complete - ready for user input');
        } else {
          // console.log('ℹ️ No active audio to interrupt', { isPlaying, hasCurrentSound: !!currentSound });
        }
        
        // Clear any pending audio stream and sentence tracking
        streamingAudioBuffer = [];
        isReceivingAudio = false;
        isProcessingAudio = false;
        hasStartedPlayingResponse = false;
        currentTranscript = '';
        sentenceChunkBoundaries = [];
        
        // Cancel any active response from the API and clear audio queue
        if (hasActiveResponse && websocket) {
          const cancelMessage = {
            type: 'response.cancel'
          };
          websocket.send(JSON.stringify(cancelMessage));
          hasActiveResponse = false;
          // console.log('🛑 Cancelled active API response');
        }
        
        // Force clear any remaining audio stream after interruption
        // console.log('🧹 Clearing any remaining audio stream after interruption');
        streamingAudioBuffer = [];
        isReceivingAudio = false;
        isProcessingAudio = false;
        
        // Force cleanup of any existing recording before starting a new one
        if (currentRecording) {
          // console.log('🧹 Cleaning up existing recording before starting new one...');
          try {
            await currentRecording.stop();
            // console.log('✅ Previous recording cleaned up');
          } catch (e) {
            console.log('⚠️ Error cleaning up previous recording:', e.message);
          }
          currentRecording = null;
        }
        
        // Ensure proper audio mode for recording
        // Skip redundant audio mode setting if we just set it above
        if (!(isPlaying && currentSound)) {
          // console.log('🔊 Setting audio mode for recording...');
          try {
            await setAudioModeAsync({
              allowsRecording: true,
              playsInSilentMode: true,
              shouldPlayInBackground: false,
              interruptionMode: 'duckOthers',
              interruptionModeAndroid: 'duckOthers',
              shouldRouteThroughEarpiece: false,
            });
            // console.log('✅ Audio mode set for recording');
          } catch (modeError) {
            console.log('⚠️ Error setting audio mode:', modeError.message);
          }
        }
        
        // Minimal delay only if we interrupted AI audio
        if (isPlaying && currentSound) {
          // console.log('⏳ Brief pause after AI interruption...');
          await new Promise(resolve => setTimeout(resolve, 100)); // Reduced from 800ms to 100ms
          // console.log('✅ Ready for recording');
        }
        
        // Request microphone permissions (should be fast if already granted)
        const permissionStatus = await AudioModule.requestRecordingPermissionsAsync();
        if (!permissionStatus.granted) {
          throw new Error('Microphone permission not granted');
        }

        // Audio mode already set above - skip duplicate call

        // Streamlined cleanup - only if we have an existing recording
        if (currentRecording) {
          // console.log('🧹 Cleaning up existing recording...');
          try {
            await currentRecording.stop();
          } catch (e) {
            console.log('⚠️ Cleanup error (continuing):', e.message);
          }
          currentRecording = null;
        }
        
        // NEW: Use real-time audio streaming to Realtime API
        try {
          // Configure real-time recording for streaming to Realtime API
          const recording = new AudioModule.AudioRecorder({});
          
          // Optimized configuration for real-time streaming (24kHz matching API)
          await recording.prepareToRecordAsync({
            extension: '.wav',
            sampleRate: 24000, // Match Realtime API sample rate
            numberOfChannels: 1,
            bitRate: 384000, // Higher quality for real-time
            android: {
              outputFormat: 'default',
              audioEncoder: 'default',
            },
            ios: {
              outputFormat: 'lpcm' as any,
              audioQuality: 96, // High quality for real-time API
              linearPCMBitDepth: 16,
              linearPCMIsBigEndian: false,
              linearPCMIsFloat: false,
            },
            web: {
              mimeType: 'audio/wav',
              bitsPerSecond: 384000,
            }
          });
          
          // Start recording for continuous streaming
          recording.record();
          currentRecording = recording;
          
          
          // console.log('📡 Started real-time audio streaming to Realtime API');
          isCreatingRecording = false;
        } catch (recordingError) {
          console.error('❌ Failed to create/start recording:', recordingError);
          currentRecording = null;
          isCreatingRecording = false;
          throw new Error(`Recording failed: ${recordingError.message}`);
        }
        
        hasStartedPlayingResponse = false; // Reset flag for new recording session
        // console.log('✅ Recording started successfully');
        
      } catch (error) {
        console.error('❌ Error starting voice recording:', error);
        isCreatingRecording = false; // Always clear flag on error
        currentRecording = null; // Ensure no orphaned recording
        isListening = false; // Reset listening state on error
        callbacks.onListeningStop?.(); // Reset UI state
        callbacks.onError?.(error as Error);
      }
    },

    stopListening: async () => {
      // console.log('🛑 stopListening called (REALTIME STREAMING)', {
      //   hasWebsocket: !!websocket,
      //   isConnected,
      //   hasCurrentRecording: !!currentRecording,
      //   isListening
      // });
      
      if (!websocket || !isConnected || !currentRecording || !isListening) {
        // console.log('⚠️ stopListening aborted - missing requirements or already stopped');
        return;
      }
      
      // Prevent double-stopping
      if (!isListening) {
        // console.log('⚠️ Already stopped listening - ignoring duplicate stop call');
        return;
      }
      
      // Set flags immediately to prevent race conditions
      isListening = false;
      isUserStoppingRecording = true; // Prevent monitoring from interfering
      
      try {
        // Get recording status before stopping
        const status = currentRecording.getStatus();
        const apiReportedDuration = status.durationMillis || 0;
        
        // console.log(`📊 Recording status before stop:`, {
        //   isRecording: status.isRecording,
        //   isDoneRecording: status.isDoneRecording,
        //   durationMillis: status.durationMillis,
        //   canRecord: status.canRecord
        // });
        
        const result = await currentRecording.stop();
        const uri = currentRecording.uri;
        
        // console.log(`📊 Stop result:`, {
        //   uri: uri,
        //   status: result?.status,
        //   durationMillis: result?.durationMillis
        // });
        
        if (uri) {
          // Get file info
          const file = new File(uri);
          const fileInfo = file.info();
          
          // Use the duration from the stop result if available, otherwise use API reported duration
          const actualDuration = result?.durationMillis ?? apiReportedDuration;
          
          // Check if we have a substantial audio file - prioritize file size over duration
          // since duration might be unreliable immediately after stopping
          const hasSubstantialAudio = fileInfo.exists && fileInfo.size > 3000;
          const hasMinimumDuration = actualDuration >= 50 || actualDuration === 0; // Allow 0ms duration as it might be a timing issue
          
          
          if (hasSubstantialAudio && hasMinimumDuration) {
            // Read the audio file as base64
            const wavBase64 = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
            // Check if audio contains actual speech content
            const audioHasSpeech = await checkAudioForSpeechContent(wavBase64);
            if (!audioHasSpeech) {
              console.log('🔇 No speech detected in audio, skipping transcription');
              // Reset AI responding state since no transcription will happen
              callbacks.onResponseComplete?.();
              return;
            }
            
            // First transcribe locally to show user message immediately
            
            try {
              // Create a temporary file for Whisper API
              const tempUri = `${FileSystem.documentDirectory}temp_audio_${Date.now()}.wav`;
              await FileSystem.writeAsStringAsync(tempUri, wavBase64, {
                encoding: FileSystem.EncodingType.Base64,
              });

              // Use local transcription
              const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
                },
                body: (() => {
                  const formData = new FormData();
                  formData.append('file', {
                    uri: tempUri,
                    type: 'audio/wav',
                    name: 'audio.wav'
                  } as any);
                  formData.append('model', 'whisper-1');
                  formData.append('language', 'en'); // Force English language
                  return formData;
                })(),
              });

              // Clean up temp file
              await FileSystem.deleteAsync(tempUri, { idempotent: true });

              if (transcriptionResponse.ok) {
                const transcriptionResult = await transcriptionResponse.json();
                const userText = transcriptionResult.text;
                
                console.log(`📝 TRANSCRIPTION: "${userText}"`);
                
                // Only check for completely empty transcriptions
                if (!userText || userText.trim().length === 0) {
                  // console.log(`🚫 Filtered out empty transcription`);
                  return;
                }
                
                // Immediately show the user's message in the UI
                callbacks.onTranscript?.(userText, true);
                
                // Wait a bit for UI to update, then send text message for response
                setTimeout(() => {
                  
                  // Send as text message to Realtime API
                  const textMessage = {
                    type: 'conversation.item.create',
                    item: {
                      type: 'message', 
                      role: 'user',
                      content: [{
                        type: 'input_text',
                        text: userText
                      }]
                    }
                  };
                  
                  websocket.send(JSON.stringify(textMessage));
                  
                  // Request response
                  const responseMessage = {
                    type: 'response.create',
                    response: {
                      modalities: ['text', 'audio']
                    }
                  };
                  websocket.send(JSON.stringify(responseMessage));
                  hasActiveResponse = true;
                }, 300);
                
              } else {
                const errorText = await transcriptionResponse.text();
                
                // Check if it's the "audio too short" error
                try {
                  const errorData = JSON.parse(errorText);
                  if (errorData.error?.code === 'audio_too_short') {
                    // Don't show error to user for very short audio - just ignore it
                    // This handles quick taps or interruption gestures gracefully
                    return;
                  }
                } catch (parseError) {
                  // If we can't parse the error, fall through to general error handling
                }
                
                callbacks.onError?.(new Error(`Transcription failed: ${transcriptionResponse.status}`));
              }
            } catch (transcriptionError) {
              console.error('❌ Local transcription error:', transcriptionError);
              callbacks.onError?.(transcriptionError as Error);
            }
          } else {
            callbacks.onError?.(new Error('Recording too short. Please hold the button longer while speaking.'));
          }
          
          // Clean up audio file
          try {
            await FileSystem.deleteAsync(uri, { idempotent: true });
          } catch (cleanupError) {
            console.warn('⚠️ Could not clean up audio file:', cleanupError);
          }
        }
        
        currentRecording = null;
        isUserStoppingRecording = false; // Reset flag after stop is complete
        // isListening already set to false above to prevent race conditions
        callbacks.onListeningStop?.();
        
      } catch (error) {
        console.error('❌ Error stopping voice recording:', error);
        
        // Ensure cleanup happens even if stopping fails
        currentRecording = null;
        isListening = false;
        isUserStoppingRecording = false; // Reset flag even on error
        
        callbacks.onError?.(error as Error);
      }
    },

    sendMessage: (messageText: string) => {
      if (!websocket || !isConnected) {
        console.error('❌ Cannot send message: websocket not connected');
        return;
      }
      
      
      const message = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',  
          content: [
            {
              type: 'input_text',
              text: messageText
            }
          ]
        }
      };
      
      websocket.send(JSON.stringify(message));
      
      // Only request response if we're using text input and no active response
      if (!hasActiveResponse) {
        const responseMessage = {
          type: 'response.create',
          response: {
            modalities: ['text', 'audio']
          }
        };
        websocket.send(JSON.stringify(responseMessage));
        hasActiveResponse = true;
      }
    },


    startContinuousListening: async () => {
      console.log('🔄 Starting continuous listening mode with VAD');
      if (!websocket || !isConnected) {
        console.log('❌ Cannot start continuous listening - no websocket or not connected');
        return;
      }
      
      // Enable server-side VAD for hands-free operation
      const vadConfig = {
        type: 'session.update',
        session: {
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 800 // Slightly longer for natural conversation
          }
        }
      };
      
      websocket.send(JSON.stringify(vadConfig));
      isContinuousMode = true;
      callbacks.onListeningStart?.();
      console.log('✅ Continuous listening enabled - server will handle turn detection');
    },

    stopContinuousListening: () => {
      console.log('🛑 Stopping continuous listening mode');
      if (!websocket || !isConnected) {
        return;
      }
      
      // Disable server-side VAD
      const disableVadConfig = {
        type: 'session.update',
        session: {
          turn_detection: null
        }
      };
      
      websocket.send(JSON.stringify(disableVadConfig));
      isContinuousMode = false;
      callbacks.onListeningStop?.();
      console.log('✅ Continuous listening disabled');
    },

    interruptResponse: () => {
      console.log('⚡ Interrupting current AI response');
      if (!websocket || !isConnected) {
        return;
      }
      
      // Cancel current response
      if (hasActiveResponse) {
        const cancelMessage = {
          type: 'response.cancel'
        };
        websocket.send(JSON.stringify(cancelMessage));
        
        // Stop current audio playback
        if (currentSound) {
          currentSound.pause();
          currentSound.remove();
          currentSound = null;
        }
        
        // Clear audio queues
        streamingAudioBuffer = [];
        isPlaying = false;
        isProcessingAudio = false;
        hasActiveResponse = false;
        
        console.log('✅ Response interrupted and audio stopped');
        callbacks.onResponseComplete?.();
      }
    },

    get isConnected() { return isConnected; },
    get isListening() { return isListening; },
    get isPlaying() { 
      const result = isPlaying && !!currentSound;
      console.log(`🔍 isPlaying getter called: ${result} (isPlaying=${isPlaying}, currentSound=${!!currentSound})`);
      return result; 
    },
    get isContinuousMode() { return isContinuousMode; }
  };

  const createWAVHeader = (dataLength: number, sampleRate: number = 24000): ArrayBuffer => {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    
    // "RIFF" chunk descriptor
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, dataLength + 36, true); // file size - 8
    view.setUint32(8, 0x57415645, false); // "WAVE"
    
    // "fmt " sub-chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // sub-chunk size
    view.setUint16(20, 1, true); // audio format (1 = PCM)
    view.setUint16(22, 1, true); // number of channels
    view.setUint32(24, sampleRate, true); // sample rate
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    
    // "data" sub-chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataLength, true); // data size
    
    return buffer;
  };

  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const extractPCMFromWAV = (wavBase64: string): string => {
    try {
      // Convert base64 to array buffer
      const arrayBuffer = base64ToArrayBuffer(wavBase64);
      const dataView = new DataView(arrayBuffer);
      
      // WAV files have a 44-byte header for simple PCM files
      // Skip the header and extract raw PCM data
      const pcmDataStart = 44;
      const pcmDataLength = arrayBuffer.byteLength - pcmDataStart;
      
      if (pcmDataLength <= 0) {
        console.error('❌ No PCM data found in WAV file');
        return '';
      }
      
      // Extract PCM data
      const pcmData = new Uint8Array(arrayBuffer, pcmDataStart, pcmDataLength);
      
      // Convert back to base64
      let binaryString = '';
      for (let i = 0; i < pcmData.length; i++) {
        binaryString += String.fromCharCode(pcmData[i]);
      }
      
      return btoa(binaryString);
    } catch (error) {
      console.error('❌ Error extracting PCM from WAV:', error);
      return '';
    }
  };

  // Simple audio streaming - process one segment at a time (NO LOOPS)
  const processStreamingAudio = async () => {
    if (streamingAudioBuffer.length === 0) {
      console.log('🎵 No chunks to process');
      isProcessingAudio = false;
      return;
    }
    
    if (isProcessingAudio) {
      console.log('🎵 Already processing audio, skipping');
      return;
    }

    isProcessingAudio = true;
    
    try {
      // Take only available chunks (no waiting)
      const processChunks = [...streamingAudioBuffer];
      streamingAudioBuffer = [];
      
      console.log(`🎵 Processing ${processChunks.length} chunks for seamless playback`);
      
      // Combine chunks into a single buffer
      const totalLength = processChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedBuffer = new Uint8Array(totalLength);
      
      let offset = 0;
      for (const chunk of processChunks) {
        combinedBuffer.set(chunk, offset);
        offset += chunk.length;
      }
      
      // Create WAV header for the combined audio
      const wavHeader = createWAVHeader(combinedBuffer.length, 24000);
      const wavHeaderArray = new Uint8Array(wavHeader);
      
      // Combine header and audio data
      const fullWavData = new Uint8Array(wavHeaderArray.length + combinedBuffer.length);
      fullWavData.set(wavHeaderArray, 0);
      fullWavData.set(combinedBuffer, wavHeaderArray.length);
      
      // Convert to base64 for file creation
      const base64Audio = btoa(String.fromCharCode(...fullWavData));
      
      // Create temporary file for seamless playback
      const fileUri = FileSystem.documentDirectory + `streaming_audio_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(fileUri, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Set up audio mode for playback
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'duckOthers',
        interruptionModeAndroid: 'duckOthers',
        shouldRouteThroughEarpiece: false,
      });
      
      // Create audio player with optimized settings for streaming
      const sound = new AudioModule.AudioPlayer({ uri: fileUri }, 100, false);
      
      // Set up completion callback for next segment
      sound.addListener('playbackStatusUpdate', async (status) => {
        if (status.didJustFinish) {
          // console.log('🎵 Streaming audio segment finished - checking for continuation');
          
          // Reset current sound and processing state
          isPlaying = false;
          currentSound = null;
          isProcessingAudio = false;
          
          // Clean up audio file
          try {
            await sound.remove();
            await FileSystem.deleteAsync(fileUri, { idempotent: true });
          } catch (cleanupError) {
            console.log('⚠️ Cleanup error:', cleanupError);
          }
          
          // Check if more audio is available
          if (streamingAudioBuffer.length > 0) {
            // console.log(`🔄 Continuing with ${streamingAudioBuffer.length} more chunks`);
            // Process remaining audio chunks
            setTimeout(() => processStreamingAudio(), 50);
          } else if (!isReceivingAudio) {
            // All audio complete
            // console.log('✅ All streaming audio complete');
            callbacks.onResponseComplete?.();
          }
        }
      });
      
      // Start playback
      currentSound = sound;
      isPlaying = true;
      sound.play();
      
      // console.log('🎵 Started seamless streaming audio playback');
      
    } catch (error) {
      console.error('❌ Streaming audio error:', error);
      isProcessingAudio = false;
    }
  };

  const detectSentenceEndings = (text: string) => {
    // Look for sentence-ending punctuation followed by space or end of string
    const sentenceEnders = /[.!?]+(\s+[A-Z]|\s*$)/g;
    let match;
    const positions = [];
    
    while ((match = sentenceEnders.exec(text)) !== null) {
      positions.push(match.index + match[0].length - (match[1].length > 0 ? match[1].length - 1 : 0));
    }
    
    return positions;
  };

  const handleRealtimeMessage = (message: any) => {
    try {
      // console.log('🔍 DEBUG: Received message type:', message.type); // Too verbose
      switch (message.type) {
        case 'session.created':
          break;
          
        case 'session.updated':
          break;
          
        case 'conversation.item.created':
          // Don't process user messages here - they're already handled by input_audio_transcription.completed
          // This prevents duplicate messages in the conversation
          break;
          
        case 'response.created':
          // console.log('🔍 DEBUG: New response created, ID:', message.response?.id);
          // Reset for new response
          currentTranscript = '';
          sentenceChunkBoundaries = [];
          streamingAudioBuffer = []; // Reset audio buffer for new response
          break;
          
        case 'response.text.delta':
          // Use text deltas for immediate display - this is independent of audio processing
          // console.log('📝 TEXT DELTA (using for immediate display):', JSON.stringify(message.delta));
          if (message.delta) {
            // Only send text deltas if we don't have audio transcript
            if (!currentTranscript || currentTranscript.trim() === '') {
              callbacks.onResponse?.(message.delta);
            } else {
              // console.log('📝 Skipping text delta - audio transcript active');
            }
          }
          break;
          
        case 'response.text.done':
          // console.log('📝 AI TEXT RESPONSE (complete):', message.text);
          // console.log('🔍 DEBUG: Text response length:', message.text?.length);
          
          // Only use text response if we don't have audio transcript
          if (!currentTranscript || currentTranscript.trim() === '') {
            // Use the complete text response for display since deltas might be empty
            if (message.text) {
              // console.log('📝 Raw text content:', message.text);
              
              // Try extracting conversational text first
              const conversationalText = extractConversationalText(message.text);
              // console.log('📝 Extracted conversational text:', conversationalText);
              
              if (conversationalText && conversationalText.trim()) {
                // console.log('📝 Displaying extracted text:', conversationalText.substring(0, 100) + '...');
                callbacks.onResponse?.(conversationalText);
              } else {
                // Fallback: display the complete text if extraction fails
                // console.log('📝 Extraction failed, displaying complete text as fallback');
                callbacks.onResponse?.(message.text);
              }
            }
          } else {
            // console.log('📝 Skipping text response - audio transcript will be used');
          }
          
          // Try to parse flowchart JSON from response
          tryParseFlowchartFromResponse(message.text);
          break;
          
        case 'response.audio_transcript.delta':
          // Use audio transcript deltas for building complete transcript
          // console.log('🎤 AUDIO TRANSCRIPT DELTA:', JSON.stringify(message.delta));
          if (message.delta) {
            // Update running transcript
            currentTranscript += message.delta;
            
            // Check for sentence endings
            const sentenceEndings = detectSentenceEndings(currentTranscript);
            const lastSentenceEnd = sentenceEndings[sentenceEndings.length - 1];
            
            // If we found a sentence ending and it's new
            if (lastSentenceEnd && lastSentenceEnd > (sentenceChunkBoundaries[sentenceChunkBoundaries.length - 1] || 0)) {
              // console.log(`📝 SENTENCE DETECTED at position ${lastSentenceEnd}: "${currentTranscript.slice(0, lastSentenceEnd)}"`);
              // Mark current sentence boundary position (not audio chunks)
              sentenceChunkBoundaries.push(lastSentenceEnd);
            }
            
            // Don't send deltas to UI - wait for complete transcript
            // console.log(`📝 BUILDING TRANSCRIPT: "${currentTranscript}"`);
          }
          break;
          
        case 'response.audio_transcript.done':
          // console.log('🎤 ACTUAL VOICE SPOKEN:', message.transcript);
          // console.log('🔍 DEBUG: Audio transcript length:', message.transcript?.length);
          
          // Send the complete transcript to UI now that it's finished
          if (currentTranscript && currentTranscript.trim()) {
            // console.log(`📝 SENDING COMPLETE TRANSCRIPT TO UI: "${currentTranscript}"`);
            callbacks.onResponse?.(currentTranscript);
          } else if (message.transcript && message.transcript.trim()) {
            // Fallback to message transcript if currentTranscript is empty
            // console.log(`📝 SENDING MESSAGE TRANSCRIPT TO UI: "${message.transcript}"`);;
            callbacks.onResponse?.(message.transcript);
          }
          break;
          
        case 'response.audio.delta':
          // Handle audio response chunks with seamless streaming approach
          if (message.delta) {
            // Convert base64 chunk to binary buffer for seamless streaming
            const binaryString = atob(message.delta);
            const chunkBuffer = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              chunkBuffer[i] = binaryString.charCodeAt(i);
            }
            
            streamingAudioBuffer.push(chunkBuffer);
            isReceivingAudio = true;
            
            // Minimal logging for audio buffering
            // if (streamingAudioBuffer.length % 5 === 0 || streamingAudioBuffer.length === 1) {
            //   console.log(`🔊 Streaming audio chunks: ${streamingAudioBuffer.length} buffered`);
            // }
            
            // Start streaming playback after optimal buffering for seamless playback
            if (!isProcessingAudio && !isPlaying && streamingAudioBuffer.length >= 8) {
              // console.log('🎵 Starting streaming audio with sufficient buffer for seamless playback');
              // Start processing directly (the function handles all audio in a loop)
              processStreamingAudio();
            }
          }
          break;
          
        case 'response.audio.done':
          // console.log('🔍 DEBUG: Audio reception complete. Buffer has', streamingAudioBuffer.length, 'chunks');
          isReceivingAudio = false;
          
          // Process any remaining buffered audio for seamless completion
          if (streamingAudioBuffer.length > 0 && !isProcessingAudio && !isPlaying) {
            // console.log('🎵 Processing final streaming audio chunks');
            // Start processing directly (the function handles all audio in a loop)
            processStreamingAudio();
          } else if (!isProcessingAudio && !isPlaying) {
            // No audio to play, complete immediately
            // console.log('✅ No final audio to process - response complete');
            callbacks.onResponseComplete?.();
          }
          
          // Reset for next response
          sentenceChunkBoundaries = [];
          break;
          
        case 'conversation.item.input_audio_transcription.delta':
          // Partial transcription as user speaks - show real-time transcription
          if (message.delta) {
            callbacks.onTranscript?.(message.delta, false);
          }
          break;
          
        case 'conversation.item.input_audio_transcription.completed':
          // Final transcription from real-time API
          if (message.transcript) {
            callbacks.onTranscript?.(message.transcript, true);
          }
          break;
          
        case 'input_audio_buffer.speech_started':
          if (isContinuousMode) {
            callbacks.onListeningStart?.();
          }
          break;
          
        case 'input_audio_buffer.speech_stopped':
          if (isContinuousMode) {
            // Commit the audio buffer when speech stops
            const commitMessage = {
              type: 'input_audio_buffer.commit'
            };
            websocket?.send(JSON.stringify(commitMessage));
            
            // VAD will automatically trigger a response
            hasActiveResponse = true;
            callbacks.onListeningStop?.();
          }
          break;
          
        case 'input_audio_buffer.committed':
          break;
          
        case 'response.done':
          // console.log('🔍 DEBUG: Response completed, ID:', message.response?.id);
          hasActiveResponse = false;
          
          // If no audio is playing or queued, call onResponseComplete immediately
          if (!isPlaying && streamingAudioBuffer.length === 0) {
            // console.log('✅ No audio to play - calling onResponseComplete immediately');
            callbacks.onResponseComplete?.();
          } else {
            // console.log('🔊 Audio is playing or queued - waiting for audio completion');
            // Add a safety timeout to reset button state if audio callback fails
            setTimeout(() => {
              if (!isPlaying && streamingAudioBuffer.length === 0) {
                // console.log('⚠️ Safety timeout: calling onResponseComplete after 3 seconds');
                callbacks.onResponseComplete?.();
              }
            }, 3000);
          }
          break;
          
        case 'error':
          console.error('❌ Realtime API error:', message.error);
          callbacks.onError?.(new Error(message.error.message));
          // Reset active response on error
          if (message.error && message.error.code === 'conversation_already_has_active_response') {
            hasActiveResponse = false;
          }
          break;
          
        default:
          break;
      }
    } catch (error) {
      console.error('❌ Error handling realtime message:', error);
    }
  };

  const extractConversationalText = (responseText: string): string => {
    try {
      // Split on common JSON indicators
      const jsonIndicators = ['{', '```json', '```', '"nodes"', '"edges"'];
      
      for (const indicator of jsonIndicators) {
        const beforeJson = responseText.split(indicator)[0];
        if (beforeJson && beforeJson.trim().length > 0) {
          return beforeJson.trim();
        }
      }
      
      // If no JSON found, return the whole response
      return responseText.trim();
    } catch (error) {
      return responseText.trim();
    }
  };

  const tryParseFlowchartFromResponse = (responseText: string) => {
    try {
      
      // Look for JSON in the response - try multiple patterns
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      // If no match, try looking for JSON code blocks
      if (!jsonMatch) {
        const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
          jsonMatch = [codeBlockMatch[1]];
        }
      }
      
      // Try to find the largest valid JSON object if multiple exist
      if (!jsonMatch) {
        const allBraceMatches = responseText.match(/\{[^{}]*\}/g);
        if (allBraceMatches) {
          // Try each potential JSON object
          for (const match of allBraceMatches) {
            try {
              const testParse = JSON.parse(match);
              if (testParse.nodes || testParse.edges) {
                jsonMatch = [match];
                break;
              }
            } catch (e) {
              continue;
            }
          }
        }
      }
      
      if (jsonMatch) {
        const flowchartData = JSON.parse(jsonMatch[0]);
        
        if (flowchartData.nodes && flowchartData.edges) {
          callbacks.onFlowchartGenerated?.(flowchartData as FlowchartStructure);
        } else {
        }
      } else {
      }
    } catch (error) {
    }
  };


  return session;
};