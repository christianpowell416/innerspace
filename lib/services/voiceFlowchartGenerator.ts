import * as FileSystem from 'expo-file-system/legacy';
import AudioModule from 'expo-audio/build/AudioModule';
import { setAudioModeAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { RecordingOptions, RecordingPresets } from 'expo-audio';
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
    
    console.log(`🎵 Audio analysis: max=${maxAmplitude}, avg=${avgAmplitude.toFixed(1)}, rms=${rmsAmplitude.toFixed(1)}, activity=${(activityRatio*100).toFixed(1)}%, hasSpeech=${hasSpeech}`);
    
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
    return extractSystemPromptFromVoiceInstructions();
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
    onResponseStart?: (responseId: string) => void;
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
  let lastInputWasText = false; // Track if the most recent input was text vs voice
  let isReceivingAudio = false;
  let hasActiveResponse = false;
  let continuousRecordingInterval: NodeJS.Timeout | null = null;
  let isJsonResponse = false;
  let hasStartedPlayingResponse = false;
  let isUserStoppingRecording = false; // Flag to prevent monitoring from interfering with user stops
  let currentTranscript = ''; // Track transcript as it builds
  let sentenceChunkBoundaries: number[] = []; // Track which chunks end sentences
  let audioStreamingInterval: NodeJS.Timeout | null = null; // For streaming audio chunks
  let lastAudioStreamPosition = 0; // Track last streamed position
  
  // Seamless audio streaming variables (working implementation)
  let streamingAudioBuffer: Uint8Array[] = [];
  let streamingPlayer: any | null = null;
  let isProcessingAudio = false;

  // Transcript throttling variables
  let lastTranscriptUpdate: number = 0;
  const transcriptUpdateInterval: number = 500; // 500ms throttle

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
          
          // Session configuration with audio support (August 2025 specifications)
          const sessionConfig = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: config.sessionInstructions || extractSystemPromptFromVoiceInstructions(),
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
              // Official August 2025 temperature specification (0.6-1.2 range, 0.8 default)
              temperature: config.temperature || 0.8,
              // Official max response tokens specification (1-4096 or "inf")
              max_response_output_tokens: config.maxTokens || 4096
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
      if (audioStreamingInterval) {
        clearInterval(audioStreamingInterval);
        audioStreamingInterval = null;
      }

      // No intervals to stop in event-driven approach

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
      lastAudioStreamPosition = 0;
      audioSegmentCount = 0; // Reset progressive counter
      currentResponseId = null; // Reset response state
      lastProcessedResponse = null; // Reset processed response

      console.log('✅ Disconnect cleanup complete');
    },

    startListening: async () => {
      // console.log('🚨🚨🚨 START_LISTENING_CALLED (REALTIME STREAMING) 🚨🚨🚨');
      if (!websocket || !isConnected) {
        console.log('❌ Cannot start listening - no websocket or not connected');
        return;
      }

      // Mark that the last input was voice
      lastInputWasText = false;
      console.log('🎤 Voice recording started, setting lastInputWasText = false');
      
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
        audioSegmentCount = 0; // Reset progressive counter
        
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
        const permissionStatus = await requestRecordingPermissionsAsync();
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
          lastAudioStreamPosition = 0;

          // Start streaming audio chunks to Realtime API every 100ms
          audioStreamingInterval = setInterval(async () => {
            if (currentRecording && isListening && websocket && isConnected) {
              try {
                // Get current recording URI
                const uri = currentRecording.uri;
                if (uri) {
                  // Check if file exists and has content
                  const fileInfo = await FileSystem.getInfoAsync(uri);
                  if (!fileInfo.exists || fileInfo.size === 0) {
                    return; // File not ready yet
                  }

                  // Read the audio file as it's being recorded
                  const audioData = await FileSystem.readAsStringAsync(uri, {
                    encoding: FileSystem.EncodingType.Base64,
                  });

                  // Convert base64 to binary and extract PCM
                  const binaryString = atob(audioData);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }

                  // Skip WAV header (44 bytes) to get raw PCM
                  const pcmStart = 44;
                  if (bytes.length > pcmStart && bytes.length > lastAudioStreamPosition) {
                    // Get only the new audio data since last stream
                    const newPcmData = bytes.slice(Math.max(pcmStart, lastAudioStreamPosition));

                    // Convert to base64 for transmission
                    let binaryStr = '';
                    for (let i = 0; i < newPcmData.length; i++) {
                      binaryStr += String.fromCharCode(newPcmData[i]);
                    }
                    const pcmBase64 = btoa(binaryStr);

                    // Stream the audio chunk to Realtime API
                    const audioAppendMessage = {
                      type: 'input_audio_buffer.append',
                      audio: pcmBase64
                    };
                    websocket.send(JSON.stringify(audioAppendMessage));

                    lastAudioStreamPosition = bytes.length;
                    // console.log(`📡 Streamed ${newPcmData.length} bytes of PCM audio`);
                  }
                }
              } catch (streamError) {
                // Ignore streaming errors - recording may still be initializing
                // console.log('⚠️ Audio streaming error (continuing):', streamError.message);
              }
            }
          }, 100); // Stream every 100ms for low latency

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
      console.log('🛑 stopListening called (REALTIME STREAMING)');

      if (!websocket || !isConnected || !currentRecording || !isListening) {
        console.log('⚠️ stopListening aborted - missing requirements or already stopped');
        return;
      }

      // Prevent double-stopping
      if (!isListening) {
        console.log('⚠️ Already stopped listening - ignoring duplicate stop call');
        return;
      }

      // Set flags immediately to prevent race conditions
      isListening = false;
      isUserStoppingRecording = true;

      // Stop the audio streaming interval
      if (audioStreamingInterval) {
        clearInterval(audioStreamingInterval);
        audioStreamingInterval = null;
      }

      try {
        // Stop the recording
        const result = await currentRecording.stop();
        const uri = currentRecording.uri;

        // Stream any remaining audio to the Realtime API
        if (uri) {
          try {
            const finalAudioData = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });

            // Check if the audio contains actual speech before sending
            const hasSpeech = await checkAudioForSpeechContent(finalAudioData);

            if (!hasSpeech) {
              console.log('🔇 No speech detected in recording - skipping transcription to prevent hallucination');
              // Silently skip without notifying user

              // Clean up without sending to API
              currentRecording = null;
              lastAudioStreamPosition = 0;
              isUserStoppingRecording = false;
              callbacks.onListeningStop?.();

              // Clean up audio file
              try {
                await FileSystem.deleteAsync(uri, { idempotent: true });
              } catch (cleanupError) {
                console.warn('⚠️ Could not clean up audio file:', cleanupError);
              }

              return; // Exit early without sending to OpenAI
            }

            console.log('✅ Speech detected - proceeding with transcription');

            // Convert base64 to binary
            const binaryString = atob(finalAudioData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            // Skip WAV header (44 bytes) to get raw PCM
            const pcmStart = 44;
            if (bytes.length > Math.max(pcmStart, lastAudioStreamPosition)) {
              // Get the final chunk of audio
              const finalPcmData = bytes.slice(Math.max(pcmStart, lastAudioStreamPosition));

              // Convert to base64 for transmission
              let binaryStr = '';
              for (let i = 0; i < finalPcmData.length; i++) {
                binaryStr += String.fromCharCode(finalPcmData[i]);
              }
              const pcmBase64 = btoa(binaryStr);

              const audioAppendMessage = {
                type: 'input_audio_buffer.append',
                audio: pcmBase64
              };
              websocket.send(JSON.stringify(audioAppendMessage));
              console.log(`📡 Sent final ${finalPcmData.length} bytes of PCM audio`);
            }

            // Commit the audio buffer to trigger transcription and response
            const commitMessage = {
              type: 'input_audio_buffer.commit'
            };
            websocket.send(JSON.stringify(commitMessage));

            // Request a response from the API
            const responseMessage = {
              type: 'response.create',
              response: {
                modalities: ['text', 'audio']
              }
            };
            websocket.send(JSON.stringify(responseMessage));
            hasActiveResponse = true;

            // Clean up audio file
            try {
              await FileSystem.deleteAsync(uri, { idempotent: true });
            } catch (cleanupError) {
              console.warn('⚠️ Could not clean up audio file:', cleanupError);
            }
          } catch (finalStreamError) {
            console.error('❌ Error sending final audio chunk:', finalStreamError);
          }
        }

        currentRecording = null;
        lastAudioStreamPosition = 0;
        isUserStoppingRecording = false;
        callbacks.onListeningStop?.();

      } catch (error) {
        console.error('❌ Error stopping voice recording:', error);

        // Ensure cleanup happens even if stopping fails
        if (audioStreamingInterval) {
          clearInterval(audioStreamingInterval);
          audioStreamingInterval = null;
        }
        currentRecording = null;
        isListening = false;
        lastAudioStreamPosition = 0;
        isUserStoppingRecording = false;

        callbacks.onError?.(error as Error);
      }
    },

    sendMessage: (messageText: string) => {
      if (!websocket || !isConnected) {
        console.error('❌ Cannot send message: websocket not connected');
        return;
      }

      // Mark that the last input was text
      lastInputWasText = true;
      console.log('📝 Text message sent, setting lastInputWasText = true');

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
            modalities: ['text', 'audio'] // Keep both for now, but prioritize text processing
          }
        };
        websocket.send(JSON.stringify(responseMessage));
        hasActiveResponse = true;
        console.log('📤 Requesting response with modalities: text, audio');
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
          try {
            if (currentSound.pause) {
              currentSound.pause();
            }
            if (currentSound.remove) {
              const removeResult = currentSound.remove();
              if (removeResult && typeof removeResult.catch === 'function') {
                removeResult.catch(() => {});
              }
            }
          } catch (error) {
            console.log('⚠️ Audio stop error:', error);
          }
          currentSound = null;
        }
        
        // Clear audio queues
        streamingAudioBuffer = [];
        isPlaying = false;
        isProcessingAudio = false;
        hasActiveResponse = false;
        
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

  const createWavFile = (pcmData: Uint8Array, sampleRate: number = 24000, channels: number = 1): string => {
    const wavHeader = createWAVHeader(pcmData.length, sampleRate);
    const wavHeaderArray = new Uint8Array(wavHeader);
    const fullWavData = new Uint8Array(wavHeaderArray.length + pcmData.length);
    fullWavData.set(wavHeaderArray, 0);
    fullWavData.set(pcmData, wavHeaderArray.length);

    // Convert to string in chunks to avoid stack overflow
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < fullWavData.length; i += chunkSize) {
      const chunk = fullWavData.slice(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }

    return btoa(binaryString);
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

  // Event-driven audio processing (no intervals)
  let audioQueue: Uint8Array[] = []; // Continuous audio buffer for gapless playback
  let isAudioQueuePlaying = false;

  // Simple direct audio processing
  let audioSegmentCount = 0;

  // Response state management to prevent duplicates
  let currentResponseId: string | null = null;
  let lastProcessedResponse: string | null = null;

  // Helper function to process next audio segment
  const processNextSegment = () => {
    if (isProcessingAudio || isPlaying) {
      return;
    }

    // Need at least 100 chunks OR all remaining chunks if not receiving
    if (streamingAudioBuffer.length < 100 && isReceivingAudio) {
      return;
    }

    if (streamingAudioBuffer.length === 0) {
      return;
    }

    // Determine how many chunks to process
    const chunksToProcess = streamingAudioBuffer.length >= 100 ? 100 : streamingAudioBuffer.length;

    audioSegmentCount++;
    isProcessingAudio = true;

    const chunks = streamingAudioBuffer.splice(0, chunksToProcess);

    // Convert chunks to audio file
    const combinedBuffer = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      combinedBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    const wavFile = createWavFile(combinedBuffer, 24000, 1);
    const audioUri = `${FileSystem.documentDirectory}streaming_audio_segment_${audioSegmentCount}.wav`;

    FileSystem.writeAsStringAsync(audioUri, wavFile, {
      encoding: FileSystem.EncodingType.Base64,
    }).then(async () => {
      // Set audio mode for playback through loudspeaker
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'duckOthers',
        interruptionModeAndroid: 'duckOthers',
        shouldRouteThroughEarpiece: false,
      });

      const sound = new AudioModule.AudioPlayer({ uri: audioUri }, 100, false);

      isPlaying = true;
      await sound.play();

      sound.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {

          try {
            sound.remove();
          } catch (e) {
            console.log('⚠️ Sound cleanup error:', e.message);
          }
          isProcessingAudio = false;
          isPlaying = false;
          currentSound = null;

          // Check if we need to continue or complete
          if (streamingAudioBuffer.length === 0 && !isReceivingAudio) {
            audioSegmentCount = 0;
            callbacks.onResponseComplete?.();
          } else if (streamingAudioBuffer.length >= 100) {
            // Continue with next segment
            console.log(`🔄 Continuing with next segment (${streamingAudioBuffer.length} chunks)`);
            setTimeout(() => processNextSegment(), 100);
          } else if (!isReceivingAudio && streamingAudioBuffer.length > 0) {
            // Final segment with remaining chunks (less than 100)
            setTimeout(() => processFinalSegment(), 100);
          } else {
            console.log(`⏳ Waiting for more chunks (have ${streamingAudioBuffer.length}, need 100)`);
          }

          // Cleanup temp file
          setTimeout(() => {
            FileSystem.deleteAsync(audioUri).catch(() => {});
          }, 5000);
        }
      });

      currentSound = sound;
    }).catch((error) => {
      console.error('❌ Error processing audio segment:', error);
      isProcessingAudio = false;
      isPlaying = false;
    });
  };

  // Helper function to process final audio segment (any number of chunks)
  const processFinalSegment = () => {
    if (isProcessingAudio || isPlaying || streamingAudioBuffer.length === 0) {
      return;
    }

    audioSegmentCount++;
    isProcessingAudio = true;

    const chunks = streamingAudioBuffer.splice(0, streamingAudioBuffer.length); // Take all remaining chunks

    // Convert chunks to audio file
    const combinedBuffer = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      combinedBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    const wavFile = createWavFile(combinedBuffer, 24000, 1);
    const audioUri = `${FileSystem.documentDirectory}streaming_audio_final_${audioSegmentCount}.wav`;

    FileSystem.writeAsStringAsync(audioUri, wavFile, {
      encoding: FileSystem.EncodingType.Base64,
    }).then(async () => {
      // Set audio mode for playback through loudspeaker
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: 'duckOthers',
        interruptionModeAndroid: 'duckOthers',
        shouldRouteThroughEarpiece: false,
      });

      const sound = new AudioModule.AudioPlayer({ uri: audioUri }, 100, false);

      isPlaying = true;
      await sound.play();

      sound.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {

          try {
            sound.remove();
          } catch (e) {
            console.log('⚠️ Sound cleanup error:', e.message);
          }
          isProcessingAudio = false;
          isPlaying = false;
          currentSound = null;

          // Final segment is complete - trigger completion
          audioSegmentCount = 0;
          callbacks.onResponseComplete?.();

          // Cleanup temp file
          setTimeout(() => {
            FileSystem.deleteAsync(audioUri).catch(() => {});
          }, 5000);
        }
      });

      currentSound = sound;
    }).catch((error) => {
      console.error('❌ Error processing final audio segment:', error);
      isProcessingAudio = false;
      isPlaying = false;
      audioSegmentCount = 0;
      callbacks.onResponseComplete?.();
    });
  };


  // No more interval-based processing - using event-driven approach

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

      // Log response messages for debugging text responses
      if (message.type.startsWith('response.')) {
        console.log('📥 Received response message:', { type: message.type, lastInputWasText });
      }

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
          // Reset for new response
          currentTranscript = '';
          sentenceChunkBoundaries = [];
          streamingAudioBuffer = []; // Reset audio buffer for new response
          currentResponseId = message.response?.id || Date.now().toString();
          lastProcessedResponse = null;

          // Notify UI of new response start
          callbacks.onResponseStart?.(currentResponseId);
          break;
          
        case 'response.text.delta':
          // Process text deltas if last input was text, otherwise skip for voice responses
          console.log('📝 Text delta received:', { lastInputWasText, hasDelta: !!message.delta, hasResponseId: !!currentResponseId });
          if (lastInputWasText && message.delta && currentResponseId) {
            console.log('📝 Processing text delta for text input:', message.delta);
            currentTranscript += message.delta;
            callbacks.onResponse?.(currentTranscript);
          } else {
            console.log('📝 Skipping text delta:', { lastInputWasText, delta: message.delta, responseId: currentResponseId });
          }
          break;

        case 'response.text.done':
          // Process final text response if last input was text, otherwise skip for voice responses
          console.log('📝 Text done received:', { lastInputWasText, hasText: !!message.text, text: message.text?.substring(0, 100) + '...' });
          if (lastInputWasText && message.text) {
            console.log('📝 Processing final text response for text input:', message.text);
            currentTranscript = message.text;
            callbacks.onResponse?.(currentTranscript);
          } else {
            console.log('📝 Skipping text done:', { lastInputWasText, hasText: !!message.text });
          }
          // Always try to parse flowchart JSON if needed
          if (message.text) {
            tryParseFlowchartFromResponse(message.text);
          }
          break;
          
        case 'response.audio_transcript.delta':
          // Build complete transcript and send incremental updates for real-time display
          if (message.delta && currentResponseId) {
            currentTranscript += message.delta;
            console.log('🎵 Audio transcript delta:', {
              delta: message.delta,
              currentTranscript: currentTranscript.substring(0, 50) + '...',
              lastProcessed: lastProcessedResponse?.substring(0, 50) + '...',
              willSend: currentTranscript !== lastProcessedResponse
            });

            // Audio transcript delta received

            // Send incremental update for streaming display
            // Only if this is the current response (not a duplicate)
            if (currentTranscript !== lastProcessedResponse) {
              console.log('📤 Calling onResponse callback with:', currentTranscript.substring(0, 50) + '...');
              callbacks.onResponse?.(currentTranscript);
            }
          }
          break;

        case 'response.audio_transcript.done':
          // Ensure the final complete transcript is sent to UI
          const finalTranscript = message.transcript || currentTranscript;

          // Send final transcript if it's different from what was last processed
          if (finalTranscript !== lastProcessedResponse) {
            callbacks.onResponse?.(finalTranscript);
          }

          lastProcessedResponse = finalTranscript;
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

            // Process audio when we have enough chunks (100 or when done receiving)
            if (!isProcessingAudio && !isPlaying) {
              if (streamingAudioBuffer.length >= 100 || (!isReceivingAudio && streamingAudioBuffer.length > 0)) {
                processNextSegment();
              }
            }

            // Audio chunk received

          }
          break;
          
        case 'response.audio.done':
          // Audio reception complete
          isReceivingAudio = false;

          // Process any remaining buffered audio
          if (streamingAudioBuffer.length > 0 && !isProcessingAudio && !isPlaying) {
            // Processing final audio chunks
            processNextSegment();
          } else if (!isProcessingAudio && !isPlaying) {
            callbacks.onResponseComplete?.();
          }
          
          // Reset for next response
          sentenceChunkBoundaries = [];
          break;
          
        case 'conversation.item.input_audio_transcription.delta':
          // Partial transcription as user speaks - show real-time transcription
          if (message.delta) {
            console.log('🎵 Real-time transcription:', message.delta);
            callbacks.onTranscript?.(message.delta, false);
          }
          break;
          
        case 'conversation.item.input_audio_transcription.completed':
          // Final transcription from real-time API (USER INPUT)
          if (message.transcript) {
            console.log('✅ Final transcription completed:', message.transcript);
            callbacks.onTranscript?.(message.transcript, true);
          }
          break;
          
        case 'input_audio_buffer.speech_started':
          console.log('🎤 Speech detected by Realtime API - user started speaking');
          if (isContinuousMode) {
            callbacks.onListeningStart?.();
          }
          break;
          
        case 'input_audio_buffer.speech_stopped':
          console.log('🔇 Speech ended by Realtime API - user stopped speaking');
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