import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, FlatList, Alert, TouchableOpacity, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { GlassHeader } from '@/components/ui/GlassHeader';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { ConversationListItem } from '@/components/ConversationListItem';
import { EmotionFilters, SortOption, SortDirection } from '@/components/EmotionFilters';
import { ConversationModal } from '@/components/ConversationModal';
import { Emotion, calculateEmotionScore, convertToLegacyEmotion } from '@/lib/types/emotion';
import { getEmotionsSorted, deleteEmotion, releaseEmotion, EmotionWithScore, subscribeToEmotions, setGlobalSyncCallback, clearGlobalSyncCallback } from '@/lib/services/emotions';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ConversationsScreen() {
  const { user, signOut } = useAuth();
  const colorScheme = useColorScheme();
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [emotions, setEmotions] = useState<Emotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'CONNECTING' | 'REALTIME_ACTIVE' | 'SMART_POLLING_ACTIVE' | 'DISCONNECTED'>('CONNECTING');
  const [syncManager, setSyncManager] = useState<{ unsubscribe: () => void; syncAfterAction: () => void } | null>(null);

  // Load emotions from Supabase for all users
  useEffect(() => {
    if (!user) {
      // For non-authenticated users, show empty state
      setEmotions([]);
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

  const clearReleasedConversations = async () => {
    try {
      await AsyncStorage.removeItem('releasedConversations');
      Alert.alert('Success', 'Released conversations cleared!');
    } catch (error) {
      console.error('Error clearing released conversations:', error);
    }
  };

  const handleRelease = async (emotion: Emotion) => {
    if (!user) {
      // For non-authenticated users, still use AsyncStorage
      const storeReleasedConversation = async () => {
        try {
          console.log('🔧 Releasing emotion (no auth):', emotion);
          
          const existingReleased = await AsyncStorage.getItem('releasedConversations');
          const releasedConversations = existingReleased ? JSON.parse(existingReleased) : [];
          
          const releasedConversation = {
            ...emotion,
            releasedAt: new Date().toISOString()
          };
          
          releasedConversations.push(releasedConversation);
          await AsyncStorage.setItem('releasedConversations', JSON.stringify(releasedConversations));
          
          // Remove from active emotions list
          setEmotions(prevEmotions => prevEmotions.filter(e => e.id !== emotion.id));
          
          Alert.alert('Success', 'Emotion released successfully!');
        } catch (error) {
          console.error('Error storing released conversation:', error);
          Alert.alert('Error', 'Failed to release emotion. Please try again.');
        }
      };
      
      storeReleasedConversation();
      return;
    }

    // For authenticated users, use Supabase sync
    try {
      console.log('🔧 Releasing emotion with Supabase sync:', emotion);
      await releaseEmotion(emotion.id);
      
      // Trigger sync after release
      syncManager?.syncAfterAction();
      
      Alert.alert('Success', 'Emotion released successfully!');
    } catch (error) {
      console.error('Error releasing emotion:', error);
      Alert.alert('Error', 'Failed to release emotion. Please try again.');
    }
  };


  const sortedEmotions = useMemo(() => {
    // All data comes from Supabase, already sorted
    return emotions;
  }, [emotions]);

  return (
    <GradientBackground style={styles.container}>
      <GlassHeader>
        <ThemedText type="title" style={styles.titleText}>Conversations</ThemedText>
        <TouchableOpacity 
          style={styles.historyButton}
          onPress={() => router.push('/conversations/history')}
        >
          <IconSymbol size={24} name="clock" color={colorScheme === 'dark' ? '#fff' : '#000'} />
        </TouchableOpacity>
      </GlassHeader>
      <SafeAreaView style={styles.safeArea}>
        
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
            <ConversationListItem emotion={item} onPress={handleEmotionPress} />
          )}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
        
        {loading && (
          <ThemedView style={styles.loadingContainer} transparent>
            <ThemedText>Loading conversations...</ThemedText>
          </ThemedView>
        )}
        
        {!loading && emotions.length === 0 && user && (
          <ThemedView style={styles.emptyContainer} transparent>
            <ThemedText style={styles.emptyText}>No conversations yet</ThemedText>
            <ThemedText style={styles.emptySubtext}>Start your first conversation to get started</ThemedText>
          </ThemedView>
        )}
        
        {!loading && emotions.length === 0 && !user && (
          <ThemedView style={styles.emptyContainer} transparent>
            <ThemedText style={styles.emptyText}>Sign in to view your conversations</ThemedText>
            <ThemedText style={styles.emptySubtext}>Create an account to save and track your emotional journey</ThemedText>
          </ThemedView>
        )}
        
        <ConversationModal
          emotion={selectedEmotion}
          visible={modalVisible}
          onClose={handleModalClose}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRelease={handleRelease}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 80, // Account for taller glass header with buttons
  },
  container: {
    flex: 1,
  },
  titleText: {
    flex: 1,
    textAlign: 'left',
    marginLeft: 0, // Remove extra margin since no left spacer
  },
  historyButton: {
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