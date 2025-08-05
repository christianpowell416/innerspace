import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { useAudioRecorder, AudioModule } from 'expo-audio';
import { FlowchartStructure } from '../types/flowchart';
import { voiceConversationInstructions } from '../../assets/flowchart/voice_conversation_instructions.js';

const OPENAI_REALTIME_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
const REALTIME_API_URL = 'wss://api.openai.com/v1/realtime';

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
    // Import the template directly instead of using Asset.fromModule
    const template = require('../../assets/flowchart/templates/template1.json');
    return template;
  } catch (error) {
    console.error('❌ Error loading flowchart template:', error);
    // Return a basic template structure if loading fails
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
  }
};

export const generateVoiceInstructions = async (template: any): Promise<string> => {
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
    const voiceInstructions = `${systemPrompt.trim()}

${responseGuidelines.trim()}

${voiceGuidelines.trim()}

DATA STRUCTURE TEMPLATE:
${JSON.stringify(template.structure, null, 2)}

${finalInstructions.trim()}`;

    return voiceInstructions;
    
  } catch (error) {
    console.error('❌ Error generating voice instructions:', error);
    // Use system prompt from centralized file as fallback
    return extractSystemPromptFromCentralFile();
  }
};

export interface VoiceSessionConfig {
  sessionInstructions?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
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
    onFlowchartGenerated?: (flowchart: FlowchartStructure) => void;
    onError?: (error: Error) => void;
  }
): VoiceFlowchartSession => {
  
  let websocket: WebSocket | null = null;
  let isConnected = false;
  let isListening = false;
  let isPlaying = false;
  let isContinuousMode = false;
  let currentRecording: Audio.Recording | null = null;
  let currentSound: Audio.Sound | null = null;
  let audioChunks: string[] = [];
  let isReceivingAudio = false;
  let hasActiveResponse = false;
  let continuousRecordingInterval: NodeJS.Timeout | null = null;
  let isJsonResponse = false;

  const session: VoiceFlowchartSession = {
    connect: async () => {
      try {
        if (!OPENAI_REALTIME_API_KEY) {
          throw new Error('OpenAI API key not configured');
        }

        const wsUrl = `${REALTIME_API_URL}?model=gpt-4o-realtime-preview-2024-10-01`;
        
        websocket = new WebSocket(wsUrl, [], {
          headers: {
            'Authorization': `Bearer ${OPENAI_REALTIME_API_KEY}`,
            'OpenAI-Beta': 'realtime=v1'
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
      if (websocket) {
        websocket.close();
        websocket = null;
      }
      if (currentSound) {
        currentSound.unloadAsync();
        currentSound = null;
      }
      if (currentRecording) {
        currentRecording.stopAndUnloadAsync();
        currentRecording = null;
      }
      isConnected = false;
      isListening = false;
      isPlaying = false;
      audioQueue = [];
    },

    startListening: async () => {
      if (!websocket || !isConnected) return;
      
      try {
        
        // Request microphone permissions using expo-audio
        const permissionStatus = await AudioModule.requestRecordingPermissionsAsync();
        if (!permissionStatus.granted) {
          throw new Error('Microphone permission not granted');
        }

        // Set audio mode for recording
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        // Create and configure audio recording
        const recording = new Audio.Recording();
        
        // Configure for PCM16 format that OpenAI expects
        await recording.prepareToRecordAsync({
          android: {
            extension: '.wav',
            outputFormat: Audio.AndroidOutputFormat.DEFAULT,
            audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
            sampleRate: 24000,
            numberOfChannels: 1,
            bitRate: 384000,
          },
          ios: {
            extension: '.wav',
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 24000,
            numberOfChannels: 1,
            bitRate: 384000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/wav',
            bitsPerSecond: 384000,
          }
        });

        await recording.startAsync();
        currentRecording = recording;
        
        isListening = true;
        callbacks.onListeningStart?.();
        
      } catch (error) {
        console.error('❌ Error starting voice recording:', error);
        callbacks.onError?.(error as Error);
      }
    },

    stopListening: async () => {
      if (!websocket || !isConnected || !currentRecording) return;
      
      try {
        // Get recording status before stopping
        const status = await currentRecording.getStatusAsync();
        const recordingDuration = status.durationMillis || 0;
        
        const result = await currentRecording.stopAndUnloadAsync();
        const uri = currentRecording.getURI();
        
        if (uri) {
          // Get file info
          const fileInfo = await FileSystem.getInfoAsync(uri);
          
          // Only process if we have at least 100ms of audio (matching OpenAI's requirement)
          // and the file size is substantial
          if (fileInfo.exists && fileInfo.size > 1000 && recordingDuration >= 100) {
            // Read the audio file as base64
            const wavBase64 = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
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
                  return formData;
                })(),
              });

              // Clean up temp file
              await FileSystem.deleteAsync(tempUri, { idempotent: true });

              if (transcriptionResponse.ok) {
                const transcriptionResult = await transcriptionResponse.json();
                const userText = transcriptionResult.text;
                
                
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
                console.error('❌ Local transcription failed');
                callbacks.onError?.(new Error('Transcription failed'));
              }
            } catch (transcriptionError) {
              console.error('❌ Local transcription error:', transcriptionError);
              callbacks.onError?.(transcriptionError as Error);
            }
          } else {
            console.warn(`⚠️ Audio too short or file too small. Duration: ${recordingDuration}ms, Size: ${fileInfo.size} bytes`);
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
        isListening = false;
        callbacks.onListeningStop?.();
        
      } catch (error) {
        console.error('❌ Error stopping voice recording:', error);
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
      if (!websocket || !isConnected) return;
      
      try {
        
        // Request microphone permissions
        const permissionStatus = await AudioModule.requestRecordingPermissionsAsync();
        if (!permissionStatus.granted) {
          throw new Error('Microphone permission not granted');
        }

        // Set audio mode for continuous recording
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        isContinuousMode = true;
        isListening = true;
        callbacks.onListeningStart?.();
        
        // Function to continuously record and stream audio
        const streamAudioChunks = async () => {
          while (isContinuousMode) {
            try {
              const recording = new Audio.Recording();
              
              // Configure for streaming
              await recording.prepareToRecordAsync({
                android: {
                  extension: '.wav',
                  outputFormat: Audio.AndroidOutputFormat.DEFAULT,
                  audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
                  sampleRate: 24000,
                  numberOfChannels: 1,
                  bitRate: 384000,
                },
                ios: {
                  extension: '.wav',
                  audioQuality: Audio.IOSAudioQuality.HIGH,
                  sampleRate: 24000,
                  numberOfChannels: 1,
                  bitRate: 384000,
                  linearPCMBitDepth: 16,
                  linearPCMIsBigEndian: false,
                  linearPCMIsFloat: false,
                },
                web: {
                  mimeType: 'audio/wav',
                  bitsPerSecond: 384000,
                }
              });

              await recording.startAsync();
              
              // Record for 100ms chunks for low latency
              await new Promise(resolve => setTimeout(resolve, 100));
              
              if (!isContinuousMode) break;
              
              await recording.stopAndUnloadAsync();
              const uri = recording.getURI();
              
              if (uri) {
                const wavBase64 = await FileSystem.readAsStringAsync(uri, {
                  encoding: FileSystem.EncodingType.Base64,
                });
                
                const pcmBase64 = extractPCMFromWAV(wavBase64);
                
                if (pcmBase64 && websocket && websocket.readyState === WebSocket.OPEN) {
                  // Stream audio to the API
                  const audioMessage = {
                    type: 'input_audio_buffer.append',
                    audio: pcmBase64
                  };
                  websocket.send(JSON.stringify(audioMessage));
                }
                
                // Clean up
                await FileSystem.deleteAsync(uri, { idempotent: true });
              }
            } catch (error) {
              console.error('❌ Error in audio streaming:', error);
              // Continue streaming even if one chunk fails
            }
          }
        };
        
        // Start streaming
        streamAudioChunks();
        
        
      } catch (error) {
        console.error('❌ Error starting continuous listening:', error);
        callbacks.onError?.(error as Error);
      }
    },

    stopContinuousListening: async () => {
      
      isContinuousMode = false;
      isListening = false;
      
      // Cancel any active response
      if (hasActiveResponse) {
        const cancelMessage = {
          type: 'response.cancel'
        };
        websocket?.send(JSON.stringify(cancelMessage));
        hasActiveResponse = false;
      }
      
      callbacks.onListeningStop?.();
      
    },

    get isConnected() { return isConnected; },
    get isListening() { return isListening; },
    get isPlaying() { return isPlaying; },
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

  const playAudioChunks = async () => {
    if (audioChunks.length === 0 || isPlaying) return;
    
    try {
      
      // Combine all audio chunks
      const pcmDataArrays = audioChunks.map(chunk => new Uint8Array(base64ToArrayBuffer(chunk)));
      const totalLength = pcmDataArrays.reduce((acc, arr) => acc + arr.length, 0);
      
      // Create combined PCM data with silence buffer at the end
      // Add 0.5 seconds of silence (24000 Hz * 2 bytes per sample * 0.5 seconds)
      // Increased for alloy voice which tends to cut off
      const silenceLength = Math.floor(24000 * 2 * 0.5);
      const combinedPCM = new Uint8Array(totalLength + silenceLength);
      let offset = 0;
      for (const arr of pcmDataArrays) {
        combinedPCM.set(arr, offset);
        offset += arr.length;
      }
      // Fill the rest with silence (zeros)
      combinedPCM.fill(0, offset);
      
      // Create WAV header
      const wavHeader = createWAVHeader(combinedPCM.length);
      
      // Combine header and PCM data
      const wavFile = new Uint8Array(wavHeader.byteLength + combinedPCM.length);
      wavFile.set(new Uint8Array(wavHeader), 0);
      wavFile.set(combinedPCM, wavHeader.byteLength);
      
      // Convert to base64
      let binaryString = '';
      for (let i = 0; i < wavFile.length; i++) {
        binaryString += String.fromCharCode(wavFile[i]);
      }
      const wavBase64 = btoa(binaryString);
      
      // Save to file and play
      const fileUri = FileSystem.documentDirectory + `audio_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(fileUri, wavBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });
      
      const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
      currentSound = sound;
      isPlaying = true;
      
      await sound.playAsync();
      
      // Clear the chunks that were played
      audioChunks = [];
      
      // Clean up when done
      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.isLoaded && status.didJustFinish) {
          await sound.unloadAsync();
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
          isPlaying = false;
          currentSound = null;
        }
      });
    } catch (error) {
      console.error('❌ Error playing audio:', error);
      isPlaying = false;
      audioChunks = [];
    }
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
          console.log('🔍 DEBUG: New response created, ID:', message.response?.id);
          break;
          
        case 'response.text.delta':
          // Skip text deltas - they may contain JSON mixed with conversation
          break;
          
        case 'response.text.done':
          console.log('📝 AI TEXT RESPONSE (includes JSON):', message.text);
          console.log('🔍 DEBUG: Text response length:', message.text?.length);
          // Try to parse flowchart JSON from response (but don't use for chat display)
          tryParseFlowchartFromResponse(message.text);
          break;
          
        case 'response.audio_transcript.delta':
          // Use audio transcript deltas for real-time conversation display
          // This ensures chat matches exactly what is spoken
          if (message.delta) {
            callbacks.onResponse?.(message.delta);
          }
          break;
          
        case 'response.audio_transcript.done':
          console.log('🎤 ACTUAL VOICE SPOKEN:', message.transcript);
          console.log('🔍 DEBUG: Audio transcript length:', message.transcript?.length);
          // The complete transcript was already built from deltas above
          break;
          
        case 'response.audio.delta':
          // Handle audio response chunks
          if (message.delta) {
            audioChunks.push(message.delta);
            isReceivingAudio = true;
          }
          break;
          
        case 'response.audio.done':
          console.log('🔍 DEBUG: Collected', audioChunks.length, 'audio chunks');
          isReceivingAudio = false;
          // Play audio chunks
          if (audioChunks.length > 0) {
            setTimeout(() => playAudioChunks(), 800); // Increased to 800ms for alloy voice
          }
          break;
          
        case 'conversation.item.input_audio_transcription.delta':
          // Partial transcription as user speaks
          if (message.delta) {
            callbacks.onTranscript?.(message.delta, false);
          }
          break;
          
        case 'conversation.item.input_audio_transcription.completed':
          // Skip - we're now handling transcription locally for better UI control
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
          console.log('🔍 DEBUG: Response completed, ID:', message.response?.id);
          hasActiveResponse = false;
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