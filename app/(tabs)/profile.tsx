import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { EmotionListItem } from '@/components/EmotionListItem';
import { EmotionFilters, SortOption } from '@/components/EmotionFilters';
import { EmotionalPartModal } from '@/components/EmotionalPartModal';
import { sampleEmotions, Emotion, calculateEmotionScore, convertToLegacyEmotion } from '@/data/sampleEmotions';
import { getEmotionsSorted, deleteEmotion, EmotionWithScore, subscribeToEmotions, setGlobalSyncCallback, clearGlobalSyncCallback } from '@/lib/services/emotions';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [sortBy, setSortBy] = useState<SortOption>('intensity');
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
            case 'newest':
              sortedEmotions.sort((a, b) => 
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              );
              break;
            case 'oldest':
              sortedEmotions.sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
              break;
            case 'frequency':
              sortedEmotions.sort((a, b) => b.frequency - a.frequency);
              break;
            case 'intensity':
              sortedEmotions.sort((a, b) => calculateEmotionScore(b) - calculateEmotionScore(a));
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
        
        const statusMessages = {
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
  }, [user, sortBy]);


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

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };


  const sortedEmotions = useMemo(() => {
    if (user) {
      // Data is already sorted from Supabase
      return emotions;
    } else {
      // Sort sample data manually
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
    }
  }, [emotions, sortBy, user]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">Emotional Parts</ThemedText>
          <ThemedText type="default" style={styles.subtitle}>
            {sortedEmotions.length} emotional parts recorded
          </ThemedText>
          {user && (
            <ThemedView style={styles.statusContainer}>
              <ThemedView style={[
                styles.statusIndicator, 
                { backgroundColor: isConnected ? '#34C759' : '#FF3B30' }
              ]} />
              <ThemedText type="default" style={styles.statusText}>
                {syncStatus === 'REALTIME_ACTIVE' && 'Live sync active'}
                {syncStatus === 'SMART_POLLING_ACTIVE' && 'Smart sync active'}
                {syncStatus === 'CONNECTING' && 'Connecting...'}
                {syncStatus === 'DISCONNECTED' && 'Reconnecting...'}
              </ThemedText>
            </ThemedView>
          )}
          {user && (
            <ThemedView style={styles.buttonContainer}>
              <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          )}
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
  signOutButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  signOutText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    opacity: 0.7,
  },
});