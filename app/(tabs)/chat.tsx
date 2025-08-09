import { StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { VoiceFlowchartCreator } from '@/components/VoiceFlowchartCreator';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FlowchartStructure } from '@/lib/types/flowchart';
import { createFlowchart, updateFlowchartWithDescription, getUserFlowchartWithId } from '@/lib/services/flowcharts';
import { useAuth } from '@/contexts/AuthContext';
import { Alert } from 'react-native';

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  
  const handleButtonPress = (type: string) => {
    console.log(`${type} button pressed`);
    setSelectedTopic(type);
    setVoiceModalVisible(true);
  };

  const handleVoiceModalClose = () => {
    setVoiceModalVisible(false);
    setSelectedTopic('');
  };

  const handleFlowchartCreated = async (flowchart: FlowchartStructure) => {
    console.log('Flowchart created from chat:', flowchart);
    
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to save your flowchart');
      setVoiceModalVisible(false);
      setSelectedTopic('');
      return;
    }

    try {
      // Check if user has an existing default flowchart
      const { structure: existingFlowchart, id: existingId } = await getUserFlowchartWithId();
      
      if (existingId) {
        // Update existing flowchart
        await updateFlowchartWithDescription(
          existingId,
          flowchart,
          `Generated flowchart via voice conversation about ${selectedTopic}`
        );
        console.log('✅ Updated existing flowchart with voice-generated content');
      } else {
        // Create new flowchart
        const newFlowchart = await createFlowchart(
          `${selectedTopic} Conversation Flowchart`,
          flowchart,
          true // Set as default
        );
        console.log('✅ Created new flowchart:', newFlowchart.id);
      }
      
      Alert.alert('Success', 'Your flowchart has been saved! View it on the Body page.');
    } catch (error) {
      console.error('❌ Error saving flowchart:', error);
      Alert.alert('Error', 'Failed to save your flowchart. Please try again.');
    }
    
    setVoiceModalVisible(false);
    setSelectedTopic('');
  };

  const buttonData = [
    { title: 'Emotion', type: 'emotion' },
    { title: 'Need', type: 'need' },
    { title: 'Belief', type: 'belief' },
    { title: 'Part', type: 'part' },
  ];

  return (
    <GradientBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.headerContainer} transparent>
          <ThemedText style={styles.headerText}>Chat</ThemedText>
          <Pressable 
            style={styles.settingsButton}
            onPress={() => router.push('/settings')}
          >
            <IconSymbol size={24} name="slider.horizontal.3" color={colorScheme === 'dark' ? '#fff' : '#000'} />
          </Pressable>
        </ThemedView>
        <ThemedView style={styles.contentContainer} transparent>
          <ThemedText type="subtitle">What would you like to discuss?</ThemedText>
          
          <View style={styles.gridContainer}>
            {buttonData.map((button, index) => (
              <Pressable
                key={button.type}
                style={({ pressed }) => [
                  styles.gridButton,
                  {
                    backgroundColor: colorScheme === 'dark' 
                      ? (pressed ? '#333' : '#2A2A2A')
                      : (pressed ? '#E0E0E0' : '#F5F5F5'),
                    borderColor: colorScheme === 'dark' 
                      ? '#444' 
                      : '#DDD',
                  }
                ]}
                onPress={() => handleButtonPress(button.type)}
              >
                <ThemedText type="defaultSemiBold" style={styles.buttonText}>
                  {button.title}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </ThemedView>
      </SafeAreaView>
      
      <VoiceFlowchartCreator
        visible={voiceModalVisible}
        onClose={handleVoiceModalClose}
        onFlowchartCreated={handleFlowchartCreated}
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 0,
  },
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerText: {
    fontSize: 42,
    fontWeight: 'bold',
    textAlign: 'left',
    fontFamily: 'Georgia',
    lineHeight: 50,
    flex: 1,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 20,
    marginTop: -40,
  },
  description: {
    textAlign: 'center',
    marginBottom: 10,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    gap: 16,
  },
  gridButton: {
    width: 140,
    height: 140,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontSize: 16,
    textAlign: 'center',
  },
});