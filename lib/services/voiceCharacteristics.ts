import AsyncStorage from '@react-native-async-storage/async-storage';

export interface VoiceCharacteristics {
  empathyLevel: number; // 0 = Empathetic, 1 = Direct
  verbosity: number; // 0 = Talkative, 1 = Concise
}

const CHARACTERISTICS_KEY = 'voice_characteristics';

const DEFAULT_CHARACTERISTICS: VoiceCharacteristics = {
  empathyLevel: 0.5,
  verbosity: 0.5,
};

export async function saveVoiceCharacteristics(characteristics: VoiceCharacteristics): Promise<void> {
  try {
    console.log('💾 About to save to AsyncStorage:', JSON.stringify(characteristics));
    await AsyncStorage.setItem(CHARACTERISTICS_KEY, JSON.stringify(characteristics));
  } catch (error) {
    console.error('Error saving voice characteristics:', error);
    throw error;
  }
}

export async function getVoiceCharacteristics(): Promise<VoiceCharacteristics> {
  try {
    const stored = await AsyncStorage.getItem(CHARACTERISTICS_KEY);
    console.log('📖 Raw from AsyncStorage:', stored);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('📖 Parsed from AsyncStorage:', JSON.stringify(parsed));
      // Remove deprecated speakingSpeed if it exists
      const { speakingSpeed, ...validCharacteristics } = parsed;
      const result = {
        empathyLevel: validCharacteristics.empathyLevel ?? DEFAULT_CHARACTERISTICS.empathyLevel,
        verbosity: validCharacteristics.verbosity ?? DEFAULT_CHARACTERISTICS.verbosity
      };
      console.log('📖 Returning characteristics:', JSON.stringify(result));
      return result;
    }
    return DEFAULT_CHARACTERISTICS;
  } catch (error) {
    console.error('Error loading voice characteristics:', error);
    return DEFAULT_CHARACTERISTICS;
  }
}

export function generatePromptModifiers(characteristics: VoiceCharacteristics): string {
  console.log('🎛️ Generating prompt modifiers for characteristics:', JSON.stringify(characteristics));

  // Validate characteristics
  if (!characteristics || typeof characteristics.empathyLevel !== 'number' || typeof characteristics.verbosity !== 'number') {
    console.error('❌ Invalid characteristics object:', characteristics);
    return '';
  }

  let modifiers: string[] = [];

  // Empathy level (0 = Empathetic, 1 = Direct)
  if (characteristics.empathyLevel <= 0.25) {
    modifiers.push("Be VERY warm, empathetic, and emotionally supportive. Use gentle, caring language and show deep emotional understanding. Prioritize feelings over facts.");
  } else if (characteristics.empathyLevel <= 0.5) {
    modifiers.push("Be warm and understanding while maintaining some objectivity. Balance emotional support with practical insights.");
  } else if (characteristics.empathyLevel <= 0.75) {
    modifiers.push("Be moderately direct while still showing care. Mix practical advice with emotional awareness.");
  } else {
    modifiers.push("Be VERY direct and straightforward. Focus strongly on practical solutions and actionable insights. Minimize emotional language.");
  }


  // Verbosity (0 = Talkative, 1 = Concise)
  if (characteristics.verbosity <= 0.25) {
    modifiers.push("Be VERY talkative and expansive. Explore topics in great depth. Provide lots of examples, context, and elaboration. Take your time explaining.");
  } else if (characteristics.verbosity <= 0.5) {
    modifiers.push("Be moderately expansive. Provide good context and some examples. Balance thoroughness with efficiency.");
  } else if (characteristics.verbosity <= 0.75) {
    modifiers.push("Be somewhat concise. Focus on key points with minimal elaboration. Provide essential context only.");
  } else {
    modifiers.push("Be VERY concise and brief. Use short sentences. Get straight to the point. No elaboration unless specifically requested.");
  }

  const result = `\n\n## User's Preferred Communication Style\n${modifiers.join('\n')}\n\nIMPORTANT: These preferences significantly shape how you communicate. Make the differences clearly noticeable.`;
  console.log('📝 Generated prompt modifiers:', result);
  return result;
}