import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { promptContent } from '../../assets/flowchart/prompt_instructions.js';
import { FlowchartStructure } from '../types/flowchart';

/**
 * Voice-powered Flowchart Generator Service
 * 
 * This service integrates with OpenAI's Realtime API to enable voice conversations
 * for creating flowcharts based on exported templates.
 */

// OpenAI Realtime API configuration
const OPENAI_REALTIME_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
const REALTIME_API_URL = 'wss://api.openai.com/v1/realtime';

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
}

/**
 * Load a flowchart template for voice session context
 */
export const loadFlowchartTemplate = async (templatePath: string): Promise<any> => {
  try {
    console.log('📖 Loading flowchart template:', templatePath);
    
    const templateContent = await FileSystem.readAsStringAsync(templatePath);
    const template = JSON.parse(templateContent);
    
    console.log('✅ Template loaded successfully:', template.templateName);
    return template;
  } catch (error) {
    console.error('❌ Error loading template:', error);
    throw new Error(`Failed to load template: ${error.message}`);
  }
};

/**
 * Create a voice-powered flowchart generation session
 */
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
  let template: any = null;
  let currentRecording: Audio.Recording | null = null;
  let audioQueue: string[] = [];
  let isPlayingAudio = false;
  let recordingStartTime: number = 0;
  let lastUserTranscript: string = '';

  const playAudioChunk = async (audioData: string) => {
    try {
      // Add audio chunk to queue
      audioQueue.push(audioData);
      
      // Start playing if not already playing
      if (!isPlayingAudio) {
        await processAudioQueue();
      }
    } catch (error) {
      console.error('❌ Error playing audio chunk:', error);
    }
  };

  const processAudioQueue = async () => {
    if (isPlayingAudio || audioQueue.length === 0) return;
    
    isPlayingAudio = true;
    
    try {
      // For now, just log that we received audio - audio playback has compatibility issues
      console.log(`🔊 Received ${audioQueue.length} audio chunks from AI`);
      audioQueue.length = 0; // Clear the queue
      
      // TODO: Implement proper PCM16 audio playback when format issues are resolved
      
    } catch (error) {
      console.error('❌ Error processing audio queue:', error);
    } finally {
      isPlayingAudio = false;
    }
  };

  const session: VoiceFlowchartSession = {
    connect: async () => {
      try {
        if (!OPENAI_REALTIME_API_KEY) {
          throw new Error('OpenAI API key not configured');
        }

        // Load built-in template (from template1.json content)
        template = {
          templateName: 'empart-flowchart',
          createdAt: '2025-07-25T07:54:30.451Z',
          description: 'Flowchart template exported from Empart app',
          structure: {
            nodes: [
              {
                id: 'need_name',
                type: 'need',
                description: 'need_description',
                x: 282.92083127827715,
                y: 61.1779803314559
              },
              {
                id: 'self_name',
                type: 'self',
                description: 'self_description',
                x: 125.62192892767241,
                y: 217.90691494705382
              },
              {
                id: 'manager_name',
                type: 'manager',
                description: 'manager_description',
                x: 448.6485591408564,
                y: 222.8352101595247
              },
              {
                id: 'exile_name',
                type: 'exile',
                description: 'exile_description',
                x: 449.88372754678994,
                y: 424.19592831764595
              },
              {
                id: 'firefighter_name',
                type: 'firefighter',
                description: 'firefighter_description',
                x: 450.5507124437046,
                y: 650.4975762221266
              }
            ],
            edges: [
              { from: 'need_name', to: 'self_name', type: '💚', label: '' },
              { from: 'need_name', to: 'manager_name', type: '💔', label: '' },
              { from: 'manager_name', to: 'exile_name', type: '❌', label: '' },
              { from: 'exile_name', to: 'firefighter_name', type: '🚨', label: '' }
            ],
            metadata: {
              version: '1.0',
              lastModified: '2025-07-25T07:54:30.451Z',
              notes: 'Exported template for AI generation'
            }
          },
          usage: {
            instructions: 'Use this template structure as a reference when generating new flowcharts',
            nodeTypes: ['need', 'self', 'manager', 'exile', 'firefighter'],
            edgeTypes: ['💚', '💔', '❌', '🚨']
          }
        };
        console.log('✅ Loaded built-in template:', template.templateName);

        console.log('🔌 Connecting to OpenAI Realtime API...');
        
        const wsUrl = `${REALTIME_API_URL}?model=gpt-4o-realtime-preview-2024-10-01`;
        websocket = new WebSocket(wsUrl, [], {
          headers: {
            'Authorization': `Bearer ${OPENAI_REALTIME_API_KEY}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        });

        websocket.onopen = () => {
          console.log('✅ Connected to OpenAI Realtime API');
          isConnected = true;
          
          // Configure the session for voice and text mode
          const sessionConfig = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: generateSessionInstructions(template, config.sessionInstructions),
              voice: config.voice || 'alloy',
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: {
                model: 'whisper-1'
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.7,
                prefix_padding_ms: 300,
                silence_duration_ms: 500
              },
              temperature: config.temperature || 0.7,
              max_response_output_tokens: 2000
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
            console.error('❌ Raw message data:', event.data);
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
          isConnected = false;
          isListening = false;
          callbacks.onError?.(new Error('WebSocket connection failed'));
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
      isConnected = false;
      isListening = false;
    },

    startListening: async () => {
      if (!websocket || !isConnected) return;
      
      console.log('📢 Starting voice recording...');
      
      try {
        // Request microphone permissions
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Microphone permission not granted');
        }

        // Configure audio recording
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        // Start recording with format compatible with OpenAI
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
          android: {
            extension: '.wav',
            outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_PCM_16BIT,
            audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
            sampleRate: 24000,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.wav',
            audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
            sampleRate: 24000,
            numberOfChannels: 1,
            bitRate: 384000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
        });

        await recording.startAsync();
        currentRecording = recording;
        recordingStartTime = Date.now();
        
        isListening = true;
        callbacks.onListeningStart?.();
        console.log('🎤 Voice recording started successfully');
        
      } catch (error) {
        console.error('❌ Error starting voice recording:', error);
        callbacks.onError?.(error as Error);
      }
    },

    stopListening: async () => {
      if (!websocket || !isConnected || !currentRecording) return;
      
      console.log('📢 Stopping voice recording...');
      
      try {
        await currentRecording.stopAndUnloadAsync();
        const uri = currentRecording.getURI();
        const recordingDuration = Date.now() - recordingStartTime;
        
        console.log(`🎤 Recording duration: ${recordingDuration}ms`);
        
        // Ensure minimum recording duration (100ms)
        if (recordingDuration < 200) {
          console.warn('⚠️ Recording too short, minimum 200ms required');
          currentRecording = null;
          isListening = false;
          callbacks.onListeningStop?.();
          return;
        }
        
        if (uri) {
          try {
            // Get file info for debugging
            const fileInfo = await FileSystem.getInfoAsync(uri);
            console.log('📁 Audio file info:', fileInfo);
            
            // Read audio file and convert to base64
            const audioData = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
            console.log('📊 Audio data length:', audioData.length);
            
            // Send audio to OpenAI Realtime API
            const audioMessage = {
              type: 'input_audio_buffer.append',
              audio: audioData
            };
            
            websocket.send(JSON.stringify(audioMessage));
            
            // Commit the audio buffer
            const commitMessage = {
              type: 'input_audio_buffer.commit'
            };
            websocket.send(JSON.stringify(commitMessage));
            
            console.log('🎤 Audio sent to OpenAI');
          } catch (audioError) {
            console.error('❌ Error processing audio:', audioError);
            // Fallback: clean up and continue
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
      
      console.log('📤 Sending message to AI...');
      
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
      
      // Request response
      const responseMessage = {
        type: 'response.create',
        response: {
          modalities: ['text']
        }
      };
      websocket.send(JSON.stringify(responseMessage));
    },

    get isConnected() { return isConnected; },
    get isListening() { return isListening; }
  };

  const handleRealtimeMessage = (message: any) => {
    try {
      // Debug log all message types
      if (!['response.audio.delta', 'rate_limits.updated'].includes(message.type)) {
        console.log('📨 Message type:', message.type);
        
        // Log transcript-related messages
        if (message.type.includes('transcript') || message.type.includes('audio_transcription')) {
          console.log('📄 Message content:', JSON.stringify(message, null, 2));
        }
      }
    
    switch (message.type) {
      case 'session.created':
        console.log('🎯 Voice session created successfully');
        break;
        
      case 'session.updated':
        console.log('🔄 Voice session updated successfully');
        break;
        
      case 'conversation.item.created':
        // Message sent successfully
        break;
        
      case 'response.created':
        // Response generation started
        break;
        
      case 'response.output_item.added':
      case 'response.content_part.added':
      case 'response.content_part.done':
      case 'response.output_item.done':
      case 'rate_limits.updated':
        // Normal API events - no logging needed
        break;
        
      case 'response.text.delta':
        if (message.delta) {
          callbacks.onResponse?.(message.delta);
        }
        break;
        
      case 'response.text.done':
        console.log('💬 AI text response received:', message.text);
        // Check if the response contains flowchart JSON
        const responseText = message.text;
        if (responseText) {
          tryParseFlowchartFromResponse(responseText);
        }
        break;
        
      case 'response.audio.delta':
        // Handle streaming audio response
        if (message.delta) {
          playAudioChunk(message.delta);
        }
        break;
        
      case 'response.audio.done':
        console.log('🔊 Audio response completed');
        break;
        
      case 'input_audio_buffer.speech_started':
        console.log('🎤 Speech detected');
        break;
        
      case 'input_audio_buffer.speech_stopped':
        console.log('🎤 Speech ended');
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcribed
        if (message.transcript) {
          console.log('📝 User said:', message.transcript);
          lastUserTranscript = message.transcript;
          callbacks.onTranscript?.(message.transcript, true);
        }
        break;
        
      case 'response.audio_transcript.delta':
        // AI's audio response transcript (partial)
        if (message.delta) {
          callbacks.onResponse?.(message.delta);
        }
        break;
        
      case 'response.audio_transcript.done':
        // AI's audio response transcript (complete)
        if (message.transcript) {
          console.log('🤖 AI said:', message.transcript);
          tryParseFlowchartFromResponse(message.transcript);
        }
        break;
        
      case 'input_audio_buffer.committed':
        console.log('✅ Audio buffer committed');
        break;
        
      case 'response.done':
        console.log('✅ Conversation turn completed');
        break;
        
      case 'error':
        console.error('❌ Realtime API error:', message.error);
        callbacks.onError?.(new Error(message.error.message));
        break;
        
      default:
        // Only log truly unexpected message types
        if (!message.type.startsWith('response.') && !message.type.startsWith('conversation.')) {
          console.log('📝 Unhandled message type:', message.type);
        }
        break;
    }
    } catch (error) {
      console.error('❌ Error handling realtime message:', error);
      console.error('❌ Message that caused error:', message);
    }
  };

  const tryParseFlowchartFromResponse = (responseText: string) => {
    try {
      // Look for JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const flowchartData = JSON.parse(jsonMatch[0]);
        if (flowchartData.nodes && flowchartData.edges) {
          callbacks.onFlowchartGenerated?.(flowchartData as FlowchartStructure);
        }
      }
    } catch (error) {
      // Response doesn't contain valid flowchart JSON, that's okay
    }
  };

  const generateSessionInstructions = (template: any, customInstructions?: string): string => {
    // Use the comprehensive prompt instructions as the base
    let instructions = customInstructions || `
You are an AI assistant specialized in creating therapy flowcharts using Internal Family Systems (IFS) principles. 

${promptContent}

IMPORTANT FOR VOICE CONVERSATIONS:
- Have a natural, therapeutic conversation with the user to understand their internal parts and relationships
- Ask questions to explore their experiences, emotions, and patterns
- When you have enough information, offer to generate a flowchart
- Include detailed transcripts of our conversation in the "transcripts" field for each relevant node
- Focus on creating meaningful, therapeutic flowcharts that reflect the user's actual internal system

CONVERSATION GUIDELINES:
- Be empathetic and supportive
- Ask follow-up questions to understand parts deeply
- Help identify IFS part types (Self, Manager, Firefighter, Exile, Need)
- Explore relationships between parts
- Document insights in node descriptions and transcripts
`;
    
    if (template) {
      instructions += `\n\n📋 TEMPLATE AVAILABLE: ${template.templateName || 'Unknown Template'}`;
      instructions += `\n\nYou have access to this template structure as a reference:\n${JSON.stringify(template.structure, null, 2)}`;
      instructions += `\n\nThe template includes these node types: ${template.usage.nodeTypes.join(', ')}`;
      instructions += `\n\nThe template includes these relationship types: ${template.usage.edgeTypes.join(', ')}`;
      instructions += `\n\nTEMPLATE USAGE:
- Use the template as inspiration for creating flowcharts
- When users ask for template-based flowcharts, you can use the template structure as a starting point
- Feel free to adapt the template structure to better fit the user's specific situation
- The template is a helpful reference, but personalize it for each user's needs`;
    }
    
    instructions += `\n\nWhen the user is ready to generate a flowchart, provide the complete JSON structure following the exact format specified in the prompt instructions above, including:
- Proper node IDs based on their function/description
- Accurate node types (self, manager, firefighter, exile, need)
- Detailed descriptions based on our conversation
- Transcripts of relevant conversation portions for each node
- Proper x,y coordinates with good spacing (800x800 coordinate space)
- Meaningful edge relationships with appropriate types
- Complete metadata section

The JSON should be properly formatted and ready to import into the flowchart system.`;
    
    return instructions;
  };

  return session;
};