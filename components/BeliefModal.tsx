import React from 'react';
import { StyleSheet, View, Modal, Pressable, ScrollView, Alert, Animated, PanResponder } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';
import { EmotionSliders } from './EmotionSliders';
import { Emotion, getFrequencyColor, calculateEmotionScore } from '@/lib/types/emotion';
import { useColorScheme } from '@/hooks/useColorScheme';

interface BeliefModalProps {
  emotion: Emotion | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (emotion: Emotion) => void;
  onDelete: (emotion: Emotion) => void;
  onRelease?: (emotion: Emotion) => void;
}

export function BeliefModal({ emotion, visible, onClose, onEdit, onDelete, onRelease }: BeliefModalProps) {
  const colorScheme = useColorScheme();
  const translateY = new Animated.Value(0);
  
  if (!emotion) return null;
  
  const frequencyColor = getFrequencyColor(emotion.frequency);
  const emotionScore = calculateEmotionScore(emotion);
  const formattedDate = emotion.timestamp.toLocaleDateString();
  const formattedTime = emotion.timestamp.toLocaleTimeString();
  
  const handleDelete = () => {
    Alert.alert(
      "Delete Belief",
      "Are you sure you want to delete this limiting belief?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            onDelete(emotion);
            onClose();
          }
        }
      ]
    );
  };
  
  const handleEdit = () => {
    onEdit(emotion);
    onClose();
  };


  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dy) > 10;
    },
    onPanResponderMove: (evt, gestureState) => {
      if (gestureState.dy < 0) {
        translateY.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (gestureState.dy < -100 || gestureState.vy < -0.5) {
        // Animate slide up and release
        Animated.timing(translateY, {
          toValue: -1000,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          if (onRelease) {
            onRelease(emotion);
          }
          onClose();
          translateY.setValue(0); // Reset for next time
        });
      } else {
        // Snap back to original position
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    },
  });
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <Animated.View 
        style={[
          styles.container, 
          { transform: [{ translateY }] }
        ]}
        {...panResponder.panHandlers}
      >
        <ThemedView style={styles.themedContainer}>
          <ScrollView 
            style={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.headerRow}>
            <ThemedText type="title" style={styles.beliefTitle}>
              {emotion.limitingBeliefs}
            </ThemedText>
            <View style={[
              styles.scoreCircle,
              { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                borderColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
              }
            ]}>
              <ThemedText type="defaultSemiBold" style={styles.headerScore}>
                {emotionScore}
              </ThemedText>
            </View>
          </View>
          
          <View style={styles.detailsRow}>
            <View style={styles.leftSection}>
              <View 
                style={[
                  styles.frequencyIndicator, 
                  { backgroundColor: frequencyColor }
                ]} 
              />
              <ThemedText type="default" style={styles.emotionLabel}>
                {emotion.label || 'Unlabeled'}
              </ThemedText>
            </View>
            <ThemedText type="default" style={styles.date}>
              {formattedDate}
            </ThemedText>
          </View>
          
          <View style={[
            styles.bodyContainer,
            { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }
          ]}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Emotional Components
            </ThemedText>
            <ThemedView style={styles.slidersContainer}>
              <EmotionSliders emotion={emotion} />
            </ThemedView>
          </View>
        </ScrollView>
        
        <Pressable
          style={[
            styles.editButton,
            { 
              backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              borderColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'
            }
          ]}
          onPress={handleEdit}
        >
          <IconSymbol size={20} name="pencil" color={colorScheme === 'dark' ? '#fff' : '#000'} />
        </Pressable>
        
        <View style={styles.instructionContainer}>
          <ThemedText style={styles.instructionText}>
            swipe up to release emotion
          </ThemedText>
        </View>
        </ThemedView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  themedContainer: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    padding: 20,
  },
  beliefTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'left',
    flex: 1,
    marginRight: 16,
  },
  scoreCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerScore: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  bodyContainer: {
    borderRadius: 16,
    padding: 16,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  frequencyIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  emotionLabel: {
    opacity: 0.7,
    fontSize: 20,
  },
  date: {
    opacity: 0.7,
    fontStyle: 'italic',
    fontSize: 20,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
  },
  slidersContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  editButton: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    opacity: 0.7,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});