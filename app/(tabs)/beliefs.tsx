import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, FlatList, Alert, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { BeliefListItem } from '@/components/BeliefListItem';
import { EmotionFilters, SortOption, SortDirection } from '@/components/EmotionFilters';
import { BeliefModal } from '@/components/BeliefModal';
import { sampleEmotions, Emotion, calculateEmotionScore, convertToLegacyEmotion } from '@/data/sampleEmotions';
import { getEmotionsSorted, deleteEmotion, EmotionWithScore, subscribeToEmotions, setGlobalSyncCallback, clearGlobalSyncCallback } from '@/lib/services/emotions';
import { useAuth } from '@/contexts/AuthContext';

export default function BeliefsListScreen() {
  const { user, signOut } = useAuth();
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [emotions, setEmotions] = useState<Emotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'CONNECTING' | 'REALTIME_ACTIVE' | 'SMART_POLLING_ACTIVE' | 'DISCONNECTED'>('CONNECTING');
  const [syncManager, setSyncManager] = useState<{ unsubscribe: () => void; syncAfterAction: () => void } | null>(null);

  // Load emotions from Supabase (for non-authenticated users only)
  useEffect(() => {
    if (!user) {
      // Use sample data when not authenticated
      setEmotions(sampleEmotions);
      setLoading(false);
    }
  }, [user]);

  // Real-time subscription for authenticated users
  useEffect(() => {
    if (!user) return;

    console.log('🔄 Setting up smart sync for emotions...');
    setIsConnected(true);

    const subscription = subscribeToEmotions(
      // Data callback
      (updatedEmotions: EmotionWithScore[]) => {
        console.log('📡 Data update received:', updatedEmotions.length, 'emotions');
        
        try {
          const legacyEmotions = updatedEmotions.map(convertToLegacyEmotion);
          
          // Apply current sorting
          let sortedEmotions = [...legacyEmotions];
          switch (sortBy) {
            case 'recent':
              sortedEmotions.sort((a, b) => {
                const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                return sortDirection === 'desc' ? diff : -diff;
              });
              break;
            case 'frequency':
              sortedEmotions.sort((a, b) => {
                const diff = b.frequency - a.frequency;
                return sortDirection === 'desc' ? diff : -diff;
              });
              break;
            case 'intensity':
              sortedEmotions.sort((a, b) => {
                const diff = calculateEmotionScore(b) - calculateEmotionScore(a);
                return sortDirection === 'desc' ? diff : -diff;
              });
              break;
          }
          
          setEmotions(sortedEmotions);
          setLoading(false);
          setIsConnected(true);
        } catch (error) {
          console.error('Error processing emotion update:', error);
          setIsConnected(false);
        }
      },
      // Error callback
      (error) => {
        console.error('❌ Real-time subscription error:', error);
        setIsConnected(false);
      },
      // Status callback
      (status) => {
        setSyncStatus(status);
        const connected = status === 'REALTIME_ACTIVE' || status === 'SMART_POLLING_ACTIVE';
        setIsConnected(connected);
        
        const statusMessages: Record<string, string> = {
          'CONNECTING': 'Connecting...',
          'REALTIME_ACTIVE': '✅ Real-time sync active',
          'SMART_POLLING_ACTIVE': '🎯 Smart sync active',
          'DISCONNECTED': '🔌 Sync disconnected'
        };
        
        console.log(statusMessages[status] || `Status: ${status}`);
      }
    );

    // Store the subscription manager
    setSyncManager(subscription);
    
    // Set up global sync callback for other parts of the app
    setGlobalSyncCallback(subscription.syncAfterAction);

    // Cleanup subscription on unmount or user change
    return () => {
      console.log('🔌 Cleaning up sync subscription');
      subscription.unsubscribe();
      setSyncManager(null);
      clearGlobalSyncCallback();
    };
  }, [user, sortBy, sortDirection]);


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

  const handleDelete = async (emotion: Emotion) => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to delete emotions');
      return;
    }

    try {
      await deleteEmotion(emotion.id);
      Alert.alert('Success', 'Emotion deleted successfully');
      // Trigger sync after user action
      syncManager?.syncAfterAction();
    } catch (error) {
      console.error('Error deleting emotion:', error);
      Alert.alert('Error', 'Failed to delete emotion. Please try again.');
    }
  };


  const sortedEmotions = useMemo(() => {
    if (user) {
      // Data is already sorted from Supabase
      return emotions;
    } else {
      // Sort sample data manually
      const sorted = [...sampleEmotions];
      
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
    }
  }, [emotions, sortBy, sortDirection, user]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title" style={styles.centerTitle}>Limiting Beliefs</ThemedText>
          <ThemedText type="default" style={styles.centerSubtitle}>
            {sortedEmotions.length} limiting beliefs
          </ThemedText>
          <TouchableOpacity 
            style={styles.historyButton}
            onPress={() => router.push('/beliefs/history')}
          >
            <IconSymbol size={24} name="clock" color="#666" />
          </TouchableOpacity>
        </ThemedView>
        
        <EmotionFilters 
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={setSortBy}
          onSortDirectionChange={setSortDirection}
        />
        
        <FlatList
          data={sortedEmotions}
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
  titleContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    position: 'relative',
  },
  centerTitle: {
    textAlign: 'center',
    width: '100%',
  },
  centerSubtitle: {
    marginTop: 4,
    opacity: 0.7,
    textAlign: 'center',
    width: '100%',
  },
  historyButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 8,
    borderRadius: 8,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100, // Add padding to account for tab bar
  },
});