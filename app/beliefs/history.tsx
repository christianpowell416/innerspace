import React, { useState, useMemo } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { BeliefListItem } from '@/components/BeliefListItem';
import { EmotionFilters, SortOption, SortDirection } from '@/components/EmotionFilters';
import { BeliefModal } from '@/components/BeliefModal';
import { sampleEmotions, Emotion, calculateEmotionScore } from '@/data/sampleEmotions';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function BeliefsHistoryScreen() {
  const colorScheme = useColorScheme();
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Filter to show only released beliefs (for demonstration, we'll use a subset)
  const releasedBeliefs = sampleEmotions.filter((emotion, index) => index % 3 === 0);

  const handleEmotionPress = (emotion: Emotion) => {
    setSelectedEmotion(emotion);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setSelectedEmotion(null);
  };

  const handleEdit = (emotion: Emotion) => {
    console.log('Edit released belief:', emotion);
    // TODO: Navigate to edit screen
  };

  const handleDelete = (emotion: Emotion) => {
    console.log('Delete released belief:', emotion);
    // TODO: Implement delete functionality
  };

  const sortedBeliefs = useMemo(() => {
    const sorted = [...releasedBeliefs];
    
    switch (sortBy) {
      case 'recent':
        return sorted.sort((a, b) => {
          const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          return sortDirection === 'desc' ? diff : -diff;
        });
      case 'frequency':
        return sorted.sort((a, b) => {
          const diff = b.frequency - a.frequency;
          return sortDirection === 'desc' ? diff : -diff;
        });
      case 'intensity':
        return sorted.sort((a, b) => {
          const diff = calculateEmotionScore(b) - calculateEmotionScore(a);
          return sortDirection === 'desc' ? diff : -diff;
        });
      default:
        return sorted;
    }
  }, [releasedBeliefs, sortBy, sortDirection]);

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
            <ThemedText type="title" style={styles.title}>Released Beliefs</ThemedText>
            <ThemedText type="default" style={styles.subtitle}>
              {sortedBeliefs.length} released beliefs
            </ThemedText>
          </View>
        </ThemedView>
        
        <EmotionFilters 
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={setSortBy}
          onSortDirectionChange={setSortDirection}
        />
        
        <FlatList
          data={sortedBeliefs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BeliefListItem emotion={item} onPress={handleEmotionPress} />
          )}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
        
        <BeliefModal
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
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
  subtitle: {
    marginTop: 4,
    opacity: 0.7,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100,
  },
});