import AsyncStorage from '@react-native-async-storage/async-storage';

export type VoiceType = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | 'marin' | 'cedar';

const VOICE_SETTING_KEY = 'selectedVoice';
const DEFAULT_VOICE: VoiceType = 'alloy';

export const getSelectedVoice = async (): Promise<VoiceType> => {
  try {
    const stored = await AsyncStorage.getItem(VOICE_SETTING_KEY);
    if (stored && isValidVoice(stored)) {
      return stored as VoiceType;
    }
    return DEFAULT_VOICE;
  } catch (error) {
    console.error('Error loading voice setting:', error);
    return DEFAULT_VOICE;
  }
};

export const setSelectedVoice = async (voice: VoiceType): Promise<void> => {
  try {
    await AsyncStorage.setItem(VOICE_SETTING_KEY, voice);
  } catch (error) {
    console.error('Error saving voice setting:', error);
  }
};

const isValidVoice = (voice: string): voice is VoiceType => {
  const validVoices: VoiceType[] = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'marin', 'cedar'];
  return validVoices.includes(voice as VoiceType);
};

export const getAllVoices = (): VoiceType[] => {
  const voices: VoiceType[] = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'marin', 'cedar'];
  // console.log('🎵 getAllVoices called, returning:', voices);
  return voices;
};