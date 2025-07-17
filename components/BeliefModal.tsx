import React from 'react';
import { StyleSheet, View, Modal, Pressable, ScrollView, Alert } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';
import { EmotionSliders } from './EmotionSliders';
import { Emotion, getFrequencyColor, calculateEmotionScore } from '@/data/sampleEmotions';
import { useColorScheme } from '@/hooks/useColorScheme';

interface BeliefModalProps {
  emotion: Emotion | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (emotion: Emotion) => void;
  onDelete: (emotion: Emotion) => void;
}

export function BeliefModal({ emotion, visible, onClose, onEdit, onDelete }: BeliefModalProps) {
  const colorScheme = useColorScheme();
  
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
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <IconSymbol size={24} name="xmark" color={colorScheme === 'dark' ? '#fff' : '#000'} />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>
            Limiting Belief
          </ThemedText>
          <View style={styles.headerRight}>
            <Pressable onPress={handleEdit} style={styles.actionButton}>
              <IconSymbol size={20} name="pencil" color={colorScheme === 'dark' ? '#fff' : '#000'} />
            </Pressable>
            <Pressable onPress={handleDelete} style={styles.actionButton}>
              <IconSymbol size={20} name="trash" color="#ff4444" />
            </Pressable>
          </View>
        </ThemedView>
        
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {emotion.limitingBeliefs && (
            <ThemedView style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                Limiting Belief
              </ThemedText>
              <ThemedText type="default" style={styles.beliefText}>
                {emotion.limitingBeliefs}
              </ThemedText>
            </ThemedView>
          )}
          
          <ThemedView style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Emotion Details
            </ThemedText>
            <View style={styles.detailRow}>
              <ThemedText type="default" style={styles.detailLabel}>Label:</ThemedText>
              <ThemedText type="default" style={styles.detailValue}>
                {emotion.label || 'Unlabeled'}
              </ThemedText>
            </View>
            <View style={styles.detailRow}>
              <ThemedText type="default" style={styles.detailLabel}>Score:</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.detailValue}>
                {emotionScore}
              </ThemedText>
            </View>
            <View style={styles.detailRow}>
              <ThemedText type="default" style={styles.detailLabel}>Frequency:</ThemedText>
              <View style={styles.frequencyContainer}>
                <View 
                  style={[
                    styles.frequencyIndicator, 
                    { backgroundColor: frequencyColor }
                  ]} 
                />
                <ThemedText type="default" style={styles.detailValue}>
                  {emotion.frequency}
                </ThemedText>
              </View>
            </View>
            <View style={styles.detailRow}>
              <ThemedText type="default" style={styles.detailLabel}>Date:</ThemedText>
              <ThemedText type="default" style={styles.detailValue}>
                {formattedDate} at {formattedTime}
              </ThemedText>
            </View>
          </ThemedView>
          
          <ThemedView style={styles.section}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              3D Emotion Vector
            </ThemedText>
            <EmotionSliders emotion={emotion} />
          </ThemedView>
          
          {emotion.notes && (
            <ThemedView style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                Notes
              </ThemedText>
              <ThemedText type="default" style={styles.notesText}>
                {emotion.notes}
              </ThemedText>
            </ThemedView>
          )}
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 16,
  },
  beliefText: {
    fontSize: 18,
    lineHeight: 26,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    width: 80,
    opacity: 0.7,
  },
  detailValue: {
    flex: 1,
  },
  frequencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  frequencyIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  notesText: {
    lineHeight: 22,
  },
});