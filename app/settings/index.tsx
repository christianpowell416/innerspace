import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getSelectedVoice, setSelectedVoice, getAllVoices, VoiceType } from '@/lib/services/voiceSettings';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [selectedVoice, setSelectedVoiceState] = useState<VoiceType>('alloy');

  useEffect(() => {
    loadVoiceSetting();
  }, []);

  const loadVoiceSetting = async () => {
    const voice = await getSelectedVoice();
    setSelectedVoiceState(voice);
  };

  const handleVoiceChange = async (voice: VoiceType) => {
    setSelectedVoiceState(voice);
    await setSelectedVoice(voice);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol size={24} name="chevron.left" color={colorScheme === 'dark' ? '#fff' : '#000'} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <ThemedText type="title" style={styles.title}>Chat Settings</ThemedText>
          </View>
          <View style={styles.rightSpacer} />
        </ThemedView>
        
        <ThemedView style={styles.contentContainer}>
          {/* Voice Settings Section */}
          <ThemedView style={styles.settingsSection}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Voice Assistant
            </ThemedText>
            <ThemedText type="default" style={styles.sectionDescription}>
              Choose the voice for your AI therapy companion
            </ThemedText>
            
            <View style={[styles.voiceGrid, { marginTop: 16 }]}>
              {getAllVoices().map((voice) => (
                <Pressable
                  key={voice}
                  style={[
                    styles.voiceButton,
                    {
                      backgroundColor: selectedVoice === voice 
                        ? '#4CAF50' 
                        : (isDark ? '#333333' : '#E0E0E0'),
                    }
                  ]}
                  onPress={() => handleVoiceChange(voice)}
                >
                  <ThemedText style={[
                    styles.voiceButtonText,
                    { color: selectedVoice === voice ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#000000') }
                  ]}>
                    {voice}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 5,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
    borderRadius: 8,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  rightSpacer: {
    width: 48, // Same width as back button (24px icon + 8px padding each side + 12px margin)
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  settingsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  sectionDescription: {
    opacity: 0.7,
    fontSize: 14,
    lineHeight: 20,
  },
  currentSelection: {
    fontSize: 14,
    opacity: 0.8,
    fontWeight: '500',
  },
  voiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  voiceButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  voiceButtonText: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});