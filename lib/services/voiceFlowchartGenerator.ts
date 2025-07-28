import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { FlowchartStructure } from '../types/flowchart';
import { promptContent } from '../../assets/flowchart/prompt_instructions.js';

const OPENAI_REALTIME_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
const REALTIME_API_URL = 'wss://api.openai.com/v1/realtime';

const extractSystemPromptFromCentralFile = (): string => {
  try {
    const lines = promptContent.split('\n');
    let systemPrompt = '';
    let currentSection = '';
    
    for (const line of lines) {
      if (line.startsWith('## System Prompt')) {
        currentSection = 'system';
        continue;
      } else if (line.startsWith('#') || line.trim() === '') {
        continue;
      }
      
      if (currentSection === 'system') {
        systemPrompt += line + '\n';
      }
    }
    
    return systemPrompt.trim();
  } catch (error) {
    console.error('❌ Error extracting system prompt from central file:', error);
    // Even in error case, try to get something from the raw content
    if (promptContent && typeof promptContent === 'string') {
      const firstLine = promptContent.split('\n').find(line => 
        line.includes('You are') && line.includes('assistant')
      );
      if (firstLine) {
        return firstLine.trim();
      }
    }
    // Ultimate fallback only if prompt file is completely unavailable
    return 'You are a helpful assistant that generates flowchart data structures in JSON format.';
  }
};

export const loadFlowchartTemplate = async (): Promise<any> => {
  try {
    // Import the template directly instead of using Asset.fromModule
    const template = require('../../assets/flowchart/templates/template1.json');
    console.log('✅ Template loaded successfully:', template.templateName);
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
    console.log('🔍 Parsing prompt content, length:', promptContent.length);
    console.log('🔍 First 200 chars:', promptContent.substring(0, 200));
    
    // Parse the prompt content to extract system instructions
    const lines = promptContent.split('\n');
    let currentSection = '';
    let systemPrompt = '';
    let responseGuidelines = '';
    let voiceGuidelines = '';
    let finalInstructions = '';
    
    for (const line of lines) {
      if (line.startsWith('## System Prompt')) {
        currentSection = 'system';
        console.log('🔍 Found System Prompt section');
        continue;
      } else if (line.startsWith('## Response Guidelines')) {
        currentSection = 'response';
        console.log('🔍 Found Response Guidelines section');
        continue;
      } else if (line.startsWith('## Voice Conversation Guidelines')) {
        currentSection = 'voice';
        console.log('🔍 Found Voice Conversation Guidelines section');
        continue;
      } else if (line.startsWith('## Final Instructions')) {
        currentSection = 'final';
        console.log('🔍 Found Final Instructions section');
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
    
    console.log('🔍 Parsed sections:');
    console.log('  System prompt length:', systemPrompt.length);
    console.log('  Response guidelines length:', responseGuidelines.length);
    console.log('  Voice guidelines length:', voiceGuidelines.length);
    console.log('  Final instructions length:', finalInstructions.length);
    console.log('  System prompt preview:', systemPrompt.substring(0, 100) + '...');
    
    // Create voice-specific instructions using ONLY content from the centralized prompt file
    const voiceInstructions = `${systemPrompt.trim()}

${responseGuidelines.trim()}

${voiceGuidelines.trim()}

DATA STRUCTURE TEMPLATE:
${JSON.stringify(template.structure, null, 2)}

${finalInstructions.trim()}`;

    console.log('🔍 Generated voice instructions:', voiceInstructions);
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
}

export interface VoiceFlowchartSession {
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: () => void;
  stopListening: () => void;
  sendMessage: (message: string) => void;
  isConnected: boolean;
  isListening: boolean;
  isPlaying: boolean;
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
  let currentRecording: Audio.Recording | null = null;
  let currentSound: Audio.Sound | null = null;
  let audioChunks: string[] = [];
  let isReceivingAudio = false;
  let hasActiveResponse = false;

  const session: VoiceFlowchartSession = {
    connect: async () => {
      try {
        if (!OPENAI_REALTIME_API_KEY) {
          throw new Error('OpenAI API key not configured');
        }

        console.log('🔌 Connecting to OpenAI Realtime API...');
        console.log('🔑 API Key present:', !!OPENAI_REALTIME_API_KEY);
        console.log('🔑 API Key prefix:', OPENAI_REALTIME_API_KEY ? OPENAI_REALTIME_API_KEY.substring(0, 10) + '...' : 'NONE');
        
        const wsUrl = `${REALTIME_API_URL}?model=gpt-4o-realtime-preview-2024-10-01`;
        console.log('🌐 WebSocket URL:', wsUrl);
        
        websocket = new WebSocket(wsUrl, [], {
          headers: {
            'Authorization': `Bearer ${OPENAI_REALTIME_API_KEY}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        });
        
        console.log('🔗 WebSocket created, waiting for connection...');

        // Add connection timeout
        const connectionTimeout = setTimeout(() => {
          if (websocket && websocket.readyState === WebSocket.CONNECTING) {
            console.error('❌ Connection timeout after 10 seconds');
            websocket.close();
            callbacks.onError?.(new Error('Connection timeout. Please check your internet connection and API key.'));
          }
        }, 10000);

        websocket.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('✅ Connected to OpenAI Realtime API');
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
              turn_detection: null,
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
          console.log('🔌 Disconnected from OpenAI Realtime API');
          isConnected = false;
          isListening = false;
          callbacks.onDisconnected?.();
        };

        websocket.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          console.error('❌ Error details:', JSON.stringify(error, null, 2));
          console.error('❌ WebSocket readyState:', websocket?.readyState);
          console.error('❌ WebSocket URL was:', wsUrl);
          
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
        console.log('🎤 Starting voice recording...');
        
        // Request microphone permissions
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
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
        console.log('✅ Voice recording started');
        
      } catch (error) {
        console.error('❌ Error starting voice recording:', error);
        callbacks.onError?.(error as Error);
      }
    },

    stopListening: async () => {
      if (!websocket || !isConnected || !currentRecording) return;
      
      try {
        console.log('🎤 Stopping voice recording...');
        
        // Get recording status before stopping
        const status = await currentRecording.getStatusAsync();
        const recordingDuration = status.durationMillis || 0;
        console.log('⏱️ Recording duration:', recordingDuration, 'ms');
        
        const result = await currentRecording.stopAndUnloadAsync();
        const uri = currentRecording.getURI();
        
        if (uri) {
          // Get file info
          const fileInfo = await FileSystem.getInfoAsync(uri);
          console.log('📁 Audio file size:', fileInfo.size);
          
          // Only process if we have at least 100ms of audio (matching OpenAI's requirement)
          // and the file size is substantial
          if (fileInfo.exists && fileInfo.size > 1000 && recordingDuration >= 100) {
            // Read the audio file as base64
            const wavBase64 = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
            // Extract raw PCM data from WAV file
            const pcmBase64 = extractPCMFromWAV(wavBase64);
            
            if (pcmBase64) {
              // Send audio through Realtime API
              const audioMessage = {
                type: 'input_audio_buffer.append',
                audio: pcmBase64
              };
              
              websocket.send(JSON.stringify(audioMessage));
              
              // Commit the audio buffer
              const commitMessage = {
                type: 'input_audio_buffer.commit'
              };
              websocket.send(JSON.stringify(commitMessage));
              
              // Create a response after committing audio
              if (!hasActiveResponse) {
                const responseMessage = {
                  type: 'response.create',
                  response: {
                    modalities: ['text', 'audio'],
                    instructions: 'Please respond to the user\'s voice input'
                  }
                };
                websocket.send(JSON.stringify(responseMessage));
                hasActiveResponse = true;
              }
              
              console.log('🎤 PCM audio sent and response requested');
            } else {
              console.error('❌ Failed to extract PCM data from WAV file');
              callbacks.onError?.(new Error('Failed to process audio recording'));
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
      
      console.log('📤 Sending message to AI:', messageText);
      
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

    get isConnected() { return isConnected; },
    get isListening() { return isListening; },
    get isPlaying() { return isPlaying; }
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
      console.log(`🎵 Playing ${audioChunks.length} audio chunks`);
      
      // Combine all audio chunks
      const pcmDataArrays = audioChunks.map(chunk => new Uint8Array(base64ToArrayBuffer(chunk)));
      const totalLength = pcmDataArrays.reduce((acc, arr) => acc + arr.length, 0);
      
      // Create combined PCM data
      const combinedPCM = new Uint8Array(totalLength);
      let offset = 0;
      for (const arr of pcmDataArrays) {
        combinedPCM.set(arr, offset);
        offset += arr.length;
      }
      
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
          console.log('✅ Audio playback completed');
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
      console.log('📨 Message type:', message.type);
      
      switch (message.type) {
        case 'session.created':
          console.log('🎯 Voice session created successfully');
          break;
          
        case 'session.updated':
          console.log('🔄 Voice session updated successfully');
          break;
          
        case 'conversation.item.created':
          console.log('📝 Message created');
          break;
          
        case 'response.created':
          console.log('🤖 Response generation started');
          break;
          
        case 'response.text.delta':
          if (message.delta) {
            callbacks.onResponse?.(message.delta);
          }
          break;
          
        case 'response.text.done':
          console.log('💬 AI text response completed:', message.text);
          // Try to parse flowchart JSON from response
          tryParseFlowchartFromResponse(message.text);
          break;
          
        case 'response.audio_transcript.delta':
          // Show AI's speech as it's being generated
          if (message.delta) {
            callbacks.onResponse?.(message.delta);
          }
          break;
          
        case 'response.audio_transcript.done':
          console.log('💬 AI said:', message.transcript);
          break;
          
        case 'response.audio.delta':
          // Handle audio response chunks
          if (message.delta) {
            console.log('🔊 Received audio chunk');
            audioChunks.push(message.delta);
            isReceivingAudio = true;
          }
          break;
          
        case 'response.audio.done':
          console.log('🔊 Audio response completed');
          isReceivingAudio = false;
          // Play all collected audio chunks
          if (audioChunks.length > 0) {
            setTimeout(() => playAudioChunks(), 100);
          }
          break;
          
        case 'conversation.item.input_audio_transcription.delta':
          // Partial transcription as user speaks
          if (message.delta) {
            callbacks.onTranscript?.(message.delta, false);
          }
          break;
          
        case 'conversation.item.input_audio_transcription.completed':
          // User's speech transcribed
          if (message.transcript) {
            console.log('📝 User said:', message.transcript);
            callbacks.onTranscript?.(message.transcript, true);
          }
          break;
          
        case 'input_audio_buffer.speech_started':
          console.log('🎤 Speech detected');
          break;
          
        case 'input_audio_buffer.speech_stopped':
          console.log('🎤 Speech ended');
          break;
          
        case 'input_audio_buffer.committed':
          console.log('✅ Audio buffer committed');
          break;
          
        case 'response.done':
          console.log('✅ Conversation turn completed');
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
          console.log('📝 Unhandled message type:', message.type);
          break;
      }
    } catch (error) {
      console.error('❌ Error handling realtime message:', error);
    }
  };

  const tryParseFlowchartFromResponse = (responseText: string) => {
    try {
      console.log('🔍 Trying to parse flowchart from response:', responseText);
      
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
        console.log('📝 Found potential JSON:', jsonMatch[0]);
        const flowchartData = JSON.parse(jsonMatch[0]);
        
        if (flowchartData.nodes && flowchartData.edges) {
          console.log('✅ Valid flowchart structure found, triggering callback');
          callbacks.onFlowchartGenerated?.(flowchartData as FlowchartStructure);
        } else {
          console.log('⚠️ JSON found but missing nodes/edges structure');
          console.log('⚠️ Available keys:', Object.keys(flowchartData));
        }
      } else {
        console.log('⚠️ No JSON structure found in response');
        // Check if response contains flowchart-related keywords, might need to ask more explicitly
        if (responseText.toLowerCase().includes('flowchart') || 
            responseText.toLowerCase().includes('nodes') || 
            responseText.toLowerCase().includes('edges')) {
          console.log('🔄 Response mentions flowchart terms but no JSON found. Consider asking more explicitly.');
        }
      }
    } catch (error) {
      console.log('❌ Error parsing JSON from response:', error);
    }
  };

  return session;
};