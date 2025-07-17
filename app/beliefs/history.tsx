import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { BeliefListItem } from '@/components/BeliefListItem';
import { EmotionFilters, SortOption, SortDirection } from '@/components/EmotionFilters';
import { BeliefModal } from '@/components/BeliefModal';
import { Emotion, calculateEmotionScore, convertToLegacyEmotion } from '@/lib/types/emotion';
import { getReleasedEmotions } from '@/lib/services/emotions';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function BeliefsHistoryScreen() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [releasedBeliefs, setReleasedBeliefs] = useState<Emotion[]>([]);

  // Load released beliefs
  useEffect(() => {
    const loadReleasedBeliefs = async () => {
      if (user) {
        // For authenticated users, load from Supabase
        try {
          const releasedEmotions = await getReleasedEmotions();
          const beliefsWithDates = releasedEmotions.map((emotion: any) => {
            const converted = convertToLegacyEmotion(emotion);
            return {
              ...converted,
              releasedAt: new Date(emotion.released_at || emotion.created_at)
            };
          });
          setReleasedBeliefs(beliefsWithDates);
        } catch (error) {
          console.error('Error loading released beliefs from Supabase:', error);
        }
      } else {
        // For non-authenticated users, load from AsyncStorage
        try {
          const stored = await AsyncStorage.getItem('releasedBeliefs');
          if (stored) {
            const beliefs = JSON.parse(stored);
            const beliefsWithDates = beliefs.map((belief: any) => ({
              ...belief,
              timestamp: new Date(belief.timestamp),
              releasedAt: new Date(belief.releasedAt)
            }));
            setReleasedBeliefs(beliefsWithDates);
          }
        } catch (error) {
          console.error('Error loading released beliefs from AsyncStorage:', error);
        }
      }
    };

    loadReleasedBeliefs();
  }, [user]);

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
    if (!releasedBeliefs.length) return [];
    
    const sorted = [...releasedBeliefs];
    
    switch (sortBy) {
      case 'recent':
        return sorted.sort((a, b) => {
          // Sort by release date instead of original timestamp
          const aDate = (a as any).releasedAt || a.timestamp;
          const bDate = (b as any).releasedAt || b.timestamp;
          const diff = new Date(bDate).getTime() - new Date(aDate).getTime();
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
              {sortedBeliefs.length} total
            </ThemedText>
          </View>
          <View style={styles.rightSpacer} />
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
  rightSpacer: {
    width: 48, // Same width as back button (24px icon + 8px padding each side + 12px margin)
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