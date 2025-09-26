import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getSelectedVoice, setSelectedVoice, getAllVoices, VoiceType } from '@/lib/services/voiceSettings';
import { getUserProfile } from '@/lib/services/auth';
import { generateRealtimeVoiceSample } from '@/lib/services/realtimeVoiceSample';

interface VoiceSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  selectedVoice: VoiceType;
  onVoiceChange: (voice: VoiceType) => void;
}

export function VoiceSettingsModal({
  visible,
  onClose,
  selectedVoice,
  onVoiceChange
}: VoiceSettingsModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const modalTranslateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  // Slider state variables
  const [genderValue, setGenderValue] = useState(0.5); // 0 = Empathetic, 1 = Direct
  const [speedValue, setSpeedValue] = useState(0.5); // 0 = Slow, 1 = Fast
  const [verbosityValue, setVerbosityValue] = useState(0.5); // 0 = Talkative, 1 = Concise

  // Previous values for haptic feedback on value change
  const [prevGenderValue, setPrevGenderValue] = useState(0.5);
  const [prevSpeedValue, setPrevSpeedValue] = useState(0.5);
  const [prevVerbosityValue, setPrevVerbosityValue] = useState(0.5);

  // User's name for personalized greetings
  const [userName, setUserName] = useState<string>('');

  // Load user profile when modal becomes visible
  useEffect(() => {
    if (visible) {
      loadUserProfile();
    }
  }, [visible]);

  const loadUserProfile = async () => {
    try {
      const profile = await getUserProfile();
      if (profile && profile.first_name) {
        setUserName(profile.first_name);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  // Greeting variations for voice samples
  const getGreetings = (name: string) => {
    const fallbackGreetings = [
      "Hey there!",
      "Hi! Great to meet you!",
      "Hello! How's it going?",
      "Good to see you!",
      "Hey! Nice to chat with you!"
    ];

    if (!name) return fallbackGreetings;

    return [
      `Hey there ${name}!`,
      `Hi ${name}! Great to meet you!`,
      `Hello ${name}! How's it going?`,
      `Good to see you ${name}!`,
      `Hey ${name}! Nice to chat with you!`
    ];
  };

  // Create pan responder for swipe-down gesture (entire modal)
  const modalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Capture downward swipes more aggressively
        const isDownwardSwipe = gestureState.dy > 5;
        const isMoreVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isDownwardSwipe && isMoreVertical;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        // Use capture to override child components like sliders
        const isDownwardSwipe = gestureState.dy > 5;
        const isMoreVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        return isDownwardSwipe && isMoreVertical;
      },
      onPanResponderGrant: () => {
        // Add subtle haptic feedback when the swipe is captured
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gestureState) => {
        // Move modal with finger
        if (gestureState.dy > 0) {
          modalTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped down more than 100px or with velocity, close modal
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          handleClose();
        } else {
          // Snap back to top
          Animated.timing(modalTranslateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    })
  ).current;

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.timing(modalTranslateY, {
      toValue: Dimensions.get('window').height,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      modalTranslateY.setValue(Dimensions.get('window').height);
    });
  };

  useEffect(() => {
    if (visible) {
      modalTranslateY.setValue(Dimensions.get('window').height);
      // Animate in
      Animated.timing(modalTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const playVoiceSample = async (voice: VoiceType) => {
    try {
      // Get a random greeting variation with user's name
      const greetings = getGreetings(userName);
      const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

      // Use Realtime API for all voices
      console.log(`🎙️ Using Realtime API for ${voice} voice`);
      const result = await generateRealtimeVoiceSample(voice, randomGreeting);

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate voice sample');
      }

    } catch (error) {
      console.error('Error playing voice sample:', error);
      // Show user-friendly message on error
      console.log('Voice sample temporarily unavailable');
    }
  };

  const handleVoiceSelect = async (voice: VoiceType) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await setSelectedVoice(voice);
      onVoiceChange(voice);

      // Play voice sample
      await playVoiceSample(voice);
    } catch (error) {
      console.error('Error saving voice setting:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={handleClose}
        />
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: modalTranslateY }]
            }
          ]}
          {...modalPanResponder.panHandlers}
        >
          <BlurView
            intensity={80}
            tint={isDark ? 'dark' : 'light'}
            style={styles.blurContainer}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 110 : 0}
            >
              {/* Handle Bar */}
              <View style={styles.handleBarContainer}>
                <View style={[
                  styles.handleBar,
                  { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }
                ]} />
              </View>

              {/* Fixed Header */}
              <View style={styles.modalHeader}>
                <Text style={[
                  styles.modalTitle,
                  { color: isDark ? '#FFFFFF' : '#000000' }
                ]}>
                  Voice Settings
                </Text>
              </View>

              {/* Content Container */}
              <View style={styles.modalScrollView}>
                <ScrollView
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 40 }}
                  scrollEnabled={false}
                  scrollEventThrottle={16}
                >
                  <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
                    {/* Voice Selection Section */}
                    <Text style={[
                      {
                        color: isDark ? '#FFFFFF' : '#000000',
                        fontSize: 22.5,
                        fontWeight: '600',
                        marginBottom: 12,
                        fontFamily: 'Georgia',
                        paddingHorizontal: 0,
                        marginTop: 0,
                      }
                    ]}>
                      Voice
                    </Text>

                    <View style={styles.voiceGrid}>
                      {getAllVoices().map((voice) => (
                        <Pressable
                          key={voice}
                          style={[
                            styles.voiceOption,
                            {
                              backgroundColor: selectedVoice === voice
                                ? (isDark ? '#4A90E2' : '#007AFF')
                                : (isDark ? '#2A2A2A' : '#F0F0F0'),
                              borderColor: selectedVoice === voice
                                ? (isDark ? '#6BB6FF' : '#0056CC')
                                : 'transparent',
                            }
                          ]}
                          onPress={() => handleVoiceSelect(voice)}
                        >
                          <Text style={[
                            styles.voiceOptionText,
                            {
                              color: selectedVoice === voice
                                ? '#FFFFFF'
                                : (isDark ? '#FFFFFF' : '#000000')
                            }
                          ]}>
                            {voice.charAt(0).toUpperCase() + voice.slice(1)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    {/* Voice Characteristics Section */}
                    <View style={styles.additionalSection}>
                      <Text style={[
                        {
                          color: isDark ? '#FFFFFF' : '#000000',
                          fontSize: 22.5,
                          fontWeight: '600',
                          marginBottom: 12,
                          fontFamily: 'Georgia',
                          paddingHorizontal: 0,
                          marginTop: 10,
                        }
                      ]}>
                        Characteristics
                      </Text>

                      {/* Gender Slider */}
                      <View style={styles.sliderContainer}>
                        <View style={styles.sliderHeader}>
                          <Text style={[
                            styles.sliderLabel,
                            { color: '#FFFFFF', fontSize: 15 }
                          ]}>
                            Empathetic
                          </Text>
                          <Text style={[
                            styles.sliderLabel,
                            { color: '#FFFFFF', fontSize: 15 }
                          ]}>
                            Direct
                          </Text>
                        </View>
                        <View style={styles.sliderWithTicks}>
                          {/* Tick marks behind the slider */}
                          {[0, 0.25, 0.5, 0.75, 1].map((tick, index) => {
                            // Account for slider's internal padding - thumb doesn't reach edges
                            // Slider typically has ~3% padding on each side
                            const padding = 3;
                            const effectiveRange = 100 - (2 * padding);
                            const tickPosition = padding + (tick * effectiveRange);
                            return (
                              <View
                                key={index}
                                style={[
                                  styles.tickMarkBehind,
                                  {
                                    left: `${tickPosition}%`,
                                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'
                                  }
                                ]}
                              />
                            );
                          })}
                          <Slider
                            style={styles.slider}
                            minimumValue={0}
                            maximumValue={1}
                            step={0.25}
                            value={genderValue}
                            onValueChange={(value) => {
                              // Trigger haptic feedback when crossing intervals
                              const roundedValue = Math.round(value / 0.25) * 0.25;
                              const roundedPrevValue = Math.round(prevGenderValue / 0.25) * 0.25;

                              if (roundedValue !== roundedPrevValue) {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }

                              setPrevGenderValue(value);
                              setGenderValue(value);
                            }}
                            onSlidingComplete={(value) => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            minimumTrackTintColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                            maximumTrackTintColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                            thumbTintColor={isDark ? '#6BB6FF' : '#007AFF'}
                          />
                        </View>
                      </View>

                      {/* Speed Slider */}
                      <View style={styles.sliderContainer}>
                        <View style={styles.sliderHeader}>
                          <Text style={[
                            styles.sliderLabel,
                            { color: '#FFFFFF', fontSize: 15 }
                          ]}>
                            Slow
                          </Text>
                          <Text style={[
                            styles.sliderLabel,
                            { color: '#FFFFFF', fontSize: 15 }
                          ]}>
                            Fast
                          </Text>
                        </View>
                        <View style={styles.sliderWithTicks}>
                          {/* Tick marks behind the slider */}
                          {[0, 0.25, 0.5, 0.75, 1].map((tick, index) => {
                            // Account for slider's internal padding - thumb doesn't reach edges
                            // Slider typically has ~3% padding on each side
                            const padding = 3;
                            const effectiveRange = 100 - (2 * padding);
                            const tickPosition = padding + (tick * effectiveRange);
                            return (
                              <View
                                key={index}
                                style={[
                                  styles.tickMarkBehind,
                                  {
                                    left: `${tickPosition}%`,
                                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'
                                  }
                                ]}
                              />
                            );
                          })}
                          <Slider
                            style={styles.slider}
                            minimumValue={0}
                            maximumValue={1}
                            step={0.25}
                            value={speedValue}
                            onValueChange={(value) => {
                              // Trigger haptic feedback when crossing intervals
                              const roundedValue = Math.round(value / 0.25) * 0.25;
                              const roundedPrevValue = Math.round(prevSpeedValue / 0.25) * 0.25;

                              if (roundedValue !== roundedPrevValue) {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }

                              setPrevSpeedValue(value);
                              setSpeedValue(value);
                            }}
                            onSlidingComplete={(value) => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            minimumTrackTintColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                            maximumTrackTintColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                            thumbTintColor={isDark ? '#6BB6FF' : '#007AFF'}
                          />
                        </View>
                      </View>

                      {/* Verbosity Slider */}
                      <View style={styles.sliderContainer}>
                        <View style={styles.sliderHeader}>
                          <Text style={[
                            styles.sliderLabel,
                            { color: '#FFFFFF', fontSize: 15 }
                          ]}>
                            Talkative
                          </Text>
                          <Text style={[
                            styles.sliderLabel,
                            { color: '#FFFFFF', fontSize: 15 }
                          ]}>
                            Concise
                          </Text>
                        </View>
                        <View style={styles.sliderWithTicks}>
                          {/* Tick marks behind the slider */}
                          {[0, 0.25, 0.5, 0.75, 1].map((tick, index) => {
                            // Account for slider's internal padding - thumb doesn't reach edges
                            // Slider typically has ~3% padding on each side
                            const padding = 3;
                            const effectiveRange = 100 - (2 * padding);
                            const tickPosition = padding + (tick * effectiveRange);
                            return (
                              <View
                                key={index}
                                style={[
                                  styles.tickMarkBehind,
                                  {
                                    left: `${tickPosition}%`,
                                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'
                                  }
                                ]}
                              />
                            );
                          })}
                          <Slider
                            style={styles.slider}
                            minimumValue={0}
                            maximumValue={1}
                            step={0.25}
                            value={verbosityValue}
                            onValueChange={(value) => {
                              // Trigger haptic feedback when crossing intervals
                              const roundedValue = Math.round(value / 0.25) * 0.25;
                              const roundedPrevValue = Math.round(prevVerbosityValue / 0.25) * 0.25;

                              if (roundedValue !== roundedPrevValue) {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }

                              setPrevVerbosityValue(value);
                              setVerbosityValue(value);
                            }}
                            onSlidingComplete={(value) => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            minimumTrackTintColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                            maximumTrackTintColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                            thumbTintColor={isDark ? '#6BB6FF' : '#007AFF'}
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Lighter overlay to show background
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    position: 'absolute',
    top: 150, // Start the modal 150px from top, leaving background visible
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 16,
  },
  blurContainer: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handleBarContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  modalHeader: {
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 15,
    marginBottom: 5,
  },
  modalTitle: {
    fontSize: 35,
    fontWeight: 'bold',
    fontFamily: 'Georgia',
  },
  modalScrollView: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    fontFamily: 'Georgia',
  },
  voiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 30,
  },
  voiceOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    width: '22%', // 4 buttons per row with gaps
    alignItems: 'center',
  },
  voiceOptionText: {
    fontSize: 15,
    fontWeight: 'normal',
    fontFamily: 'Georgia',
  },
  additionalSection: {
    marginTop: 10,
  },
  sliderContainer: {
    marginBottom: 25,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 14,
    fontFamily: 'Georgia',
    fontWeight: 'normal',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderWithTicks: {
    position: 'relative',
    height: 40,
  },
  tickMarkBehind: {
    position: 'absolute',
    width: 2,
    height: 20,
    marginLeft: -1,
    top: 10,
    zIndex: 1,
  },
  sliderThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    top: 14,
  },
});