import AsyncStorage from '@react-native-async-storage/async-storage';

// Only Realtime API compatible voices
export type VoiceType = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse' | 'marin' | 'cedar';

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
  const validVoices: VoiceType[] = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
  return validVoices.includes(voice as VoiceType);
};

export const getAllVoices = (): VoiceType[] => {
  const voices: VoiceType[] = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
  // console.log('🎵 getAllVoices called, returning:', voices);
  return voices;
};

// All voices now use the Realtime API
export const isRealtimeOnlyVoice = (voice: VoiceType): boolean => {
  return true; // All voices are now Realtime API voices
};