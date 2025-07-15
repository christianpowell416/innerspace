import React, { useState, useMemo } from 'react';
import { StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { EmotionListItem } from '@/components/EmotionListItem';
import { EmotionFilters, SortOption } from '@/components/EmotionFilters';
import { EmotionalPartModal } from '@/components/EmotionalPartModal';
import { sampleEmotions, Emotion, calculateEmotionScore } from '@/data/sampleEmotions';

export default function ProfileScreen() {
  const [sortBy, setSortBy] = useState<SortOption>('intensity');
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleEmotionPress = (emotion: Emotion) => {
    setSelectedEmotion(emotion);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setSelectedEmotion(null);
  };

  const handleEdit = (emotion: Emotion) => {
    console.log('Edit emotion:', emotion);
    // TODO: Navigate to edit screen
  };

  const handleDelete = (emotion: Emotion) => {
    console.log('Delete emotion:', emotion);
    // TODO: Implement delete functionality
  };

  const sortedEmotions = useMemo(() => {
    const sorted = [...sampleEmotions];
    
    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      case 'oldest':
        return sorted.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      case 'frequency':
        return sorted.sort((a, b) => b.frequency - a.frequency);
      case 'intensity':
        return sorted.sort((a, b) => calculateEmotionScore(b) - calculateEmotionScore(a));
      default:
        return sorted;
    }
  }, [sortBy]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">Emotional Parts</ThemedText>
          <ThemedText type="default" style={styles.subtitle}>
            {sampleEmotions.length} emotional parts recorded
          </ThemedText>
        </ThemedView>
        
        <EmotionFilters 
          sortBy={sortBy} 
          onSortChange={setSortBy}
        />
        
        <FlatList
          data={sortedEmotions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EmotionListItem emotion={item} onPress={handleEmotionPress} />
          )}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
        
        <EmotionalPartModal
          emotion={selectedEmotion}
          visible={modalVisible}
          onClose={handleModalClose}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
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
  titleContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  subtitle: {
    marginTop: 4,
    opacity: 0.7,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100, // Add padding to account for tab bar
  },
});