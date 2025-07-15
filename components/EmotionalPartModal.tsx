import React from 'react';
import { StyleSheet, View, Modal, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { EmotionSliders } from './EmotionSliders';
import { Emotion, getFrequencyColor, calculateEmotionScore } from '@/data/sampleEmotions';
import { useColorScheme } from '@/hooks/useColorScheme';

interface EmotionalPartModalProps {
  emotion: Emotion | null;
  visible: boolean;
  onClose: () => void;
  onEdit?: (emotion: Emotion) => void;
  onDelete?: (emotion: Emotion) => void;
}

export function EmotionalPartModal({ 
  emotion, 
  visible, 
  onClose, 
  onEdit, 
  onDelete 
}: EmotionalPartModalProps) {
  const colorScheme = useColorScheme();
  
  if (!emotion) return null;

  const frequencyColor = getFrequencyColor(emotion.frequency);
  const emotionScore = calculateEmotionScore(emotion);
  const formattedDate = emotion.timestamp.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = emotion.timestamp.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const handleDelete = () => {
    Alert.alert(
      'Delete Emotional Part',
      'Are you sure you want to delete this emotional part? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            onDelete?.(emotion);
            onClose();
          }
        }
      ]
    );
  };

  const borderColor = colorScheme === 'dark' 
    ? 'rgba(255, 255, 255, 0.1)' 
    : 'rgba(0, 0, 0, 0.1)';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#151718' : '#fff' }]}>
        <ThemedView style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <View style={styles.titleRow}>
                <View 
                  style={[
                    styles.frequencyIndicator, 
                    { backgroundColor: frequencyColor }
                  ]} 
                />
                <ThemedText type="title" style={styles.title}>
                  {emotion.label || 'Unlabeled'}
                </ThemedText>
              </View>
              <ThemedText type="default" style={styles.dateTime}>
                {formattedDate} at {formattedTime}
              </ThemedText>
            </View>
            <ThemedText type="default" style={styles.headerScore}>
              {emotionScore}
            </ThemedText>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Emotion Sliders */}
            <ThemedView style={[styles.section, { borderColor }]}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Emotional Components
              </ThemedText>
              <EmotionSliders emotion={emotion} />
            </ThemedView>

            {/* Notes */}
            {emotion.notes && (
              <ThemedView style={[styles.section, { borderColor }]}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                  Notes
                </ThemedText>
                <ThemedText type="default" style={styles.notesText}>
                  {emotion.notes}
                </ThemedText>
              </ThemedView>
            )}

            {/* AI Conversation Summary */}
            {emotion.aiConversationSummary && (
              <ThemedView style={[styles.section, { borderColor }]}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                  AI Conversation Summary
                </ThemedText>
                <ThemedText type="default" style={styles.conversationText}>
                  {emotion.aiConversationSummary}
                </ThemedText>
              </ThemedView>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Pressable 
              style={[styles.actionButton, styles.editButton]}
              onPress={() => onEdit?.(emotion)}
            >
              <ThemedText style={styles.editButtonText}>Edit</ThemedText>
            </Pressable>
            <Pressable 
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDelete}
            >
              <ThemedText style={styles.deleteButtonText}>Delete</ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 5,
    position: 'relative',
  },
  titleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  frequencyIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 36, // 1.5x larger than default title size (24px * 1.5 = 36px)
    lineHeight: 44, // Add extra line height to prevent clipping
  },
  dateTime: {
    opacity: 0.7,
  },
  headerScore: {
    fontSize: 36,
    fontWeight: 'bold',
    position: 'absolute',
    right: 0,
    top: 0,
    lineHeight: 44, // Match the title line height to align with title top and date bottom
  },
  scrollContent: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  notesText: {
    lineHeight: 20,
  },
  conversationText: {
    lineHeight: 22,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#6366F1',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  editButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});