import { GradientBackground } from '@/components/ui/GradientBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { DetectedItem } from '@/lib/database.types';
import {
  ComplexData,
  createComplex,
  getRandomComplexColor,
  loadComplexes,
  validateComplexName
} from '@/lib/services/complexManagementService';
import {
  ConversationMessage,
  saveConversation
} from '@/lib/services/conversationPersistence';
import {
  saveAllDetectedData
} from '@/lib/services/detectedDataService';
// Draft conversation data type
interface DraftConversationData {
  sessionId?: string;
  topic: string;
  messages: ConversationMessage[];
  detectedData?: {
    emotions?: DetectedItem[];
    parts?: DetectedItem[];
    needs?: DetectedItem[];
  };
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CARD_BORDER_RADIUS = 24;

type NewComplexCard = {
  id: 'new-complex';
  name: 'New Complex';
  isNewComplex: true;
};

type ComplexOrNew =
  | (ComplexData & { isNewComplex?: false })
  | NewComplexCard;

export default function SaveConversationScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const params = useLocalSearchParams();
  const { user } = useAuth();

  // Debug logs commented out to reduce console spam
  // console.log('🔄 [DEBUG] SaveConversationScreen mounted');
  // console.log('🔄 [DEBUG] Params received:', params);

  // State management
  const [complexes, setComplexes] = useState<ComplexData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newComplexName, setNewComplexName] = useState('');
  const [newComplexDescription, setNewComplexDescription] = useState('');

  // Scroll velocity tracking for dynamic spacing
  const [scrollY, setScrollY] = useState(0);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const scrollViewRef = useRef<any>(null);
  const lastScrollTime = useRef(Date.now());
  const velocityDecayTimer = useRef<number | null>(null);

  // Extract conversation data from params
  const sessionId = params.sessionId as string | undefined;
  const topic = params.topic as string | undefined;
  const messagesStr = params.messages as string | undefined;
  const complexesStr = params.complexes as string | undefined;

  // Parse messages if provided
  const messages = messagesStr ?
    (typeof messagesStr === 'string' ? JSON.parse(messagesStr) : messagesStr) :
    [];

  // Parse complexes if provided (preloaded from conversation page)
  const preloadedComplexes = complexesStr ?
    (typeof complexesStr === 'string' ? JSON.parse(complexesStr) : complexesStr) :
    null;

  // Create draft data from params
  const directData: DraftConversationData | null = (topic && messages.length > 0) ? {
    sessionId,
    topic,
    messages
  } : null;

  const [conversationData, setConversationData] = useState<DraftConversationData | null>(directData);

  // Load draft data from AsyncStorage only if not provided directly
  useEffect(() => {
    const loadDraftData = async () => {
      // If we already have direct data, use that
      if (directData) {
        return;
      }

      if (!sessionId) {
        console.warn('No conversation data provided to save-conversation');
        return;
      }

      try {
        const draftKey = `draft_conversation_${sessionId}`;
        const draftData = await AsyncStorage.getItem(draftKey);
        if (draftData) {
          const parsed = JSON.parse(draftData) as DraftConversationData;
          setConversationData(parsed);
        }
      } catch (error) {
        console.error('Failed to load draft data:', error);
      }
    };

    loadDraftData();
  }, [sessionId, directData]);

  // Load complexes on mount (use preloaded if available)
  const complexesLoadedRef = useRef(false);
  useEffect(() => {
    if (complexesLoadedRef.current) return; // Skip if already loaded

    if (preloadedComplexes && preloadedComplexes.length > 0) {
      setComplexes(preloadedComplexes);
      setLoading(false);
      complexesLoadedRef.current = true;
    } else if (user && !preloadedComplexes) {
      loadUserComplexes();
      complexesLoadedRef.current = true;
    }
  }, [user, preloadedComplexes]);

  const loadUserComplexes = async () => {
    try {
      setLoading(true);
      const userComplexes = await loadComplexes(user!.id);
      setComplexes(userComplexes);
    } catch (error) {
      console.error('Error loading complexes:', error);
      Alert.alert('Error', 'Failed to load complexes');
    } finally {
      setLoading(false);
    }
  };

  const handleComplexSelect = async (complexId: string, complexName: string) => {
    if (!user || !conversationData) {
      Alert.alert('Error', 'Missing user or conversation data');
      return;
    }

    try {
      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log(`Saving conversation to complex: ${complexName} (${complexId})`);

      // Save conversation to database from draft
      const savedConversation = await saveConversation(
        user.id,
        conversationData.topic,
        conversationData.messages as ConversationMessage[],
        {
          complexId,
          title: generateConversationTitle(conversationData.messages),
          summary: null, // Could add AI-generated summary later
        }
      );

      // Save detected data if available
      if (conversationData.detectedData) {
        const { emotions, parts, needs } = conversationData.detectedData;
        if ((emotions && emotions.length > 0) ||
            (parts && parts.length > 0) ||
            (needs && needs.length > 0)) {
          await saveAllDetectedData(
            savedConversation.id,
            user.id,
            {
              emotions: emotions || [],
              parts: parts || [],
              needs: needs || [],
            }
          );
          console.log('✅ Detected data saved to Supabase');
        }
      }

      // Clear the draft data after successful save
      if (sessionId) {
        const draftKey = `draft_conversation_${sessionId}`;
        await AsyncStorage.removeItem(draftKey);
        console.log('🧹 Draft data cleared after successful save');
      }

      console.log('✅ Conversation saved successfully');

      // Show success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Success',
        `Conversation saved to "${complexName}"`,
        [{ text: 'OK', onPress: () => {
          console.log('🔄 [DEBUG] SUCCESS Alert OK pressed - About to dismiss modals and navigate');
          console.log('🔄 [DEBUG] SUCCESS Available router methods:', Object.getOwnPropertyNames(router));
          console.log('🔄 [DEBUG] SUCCESS Calling router.dismissAll()...');

          try {
            // Dismiss ALL modals (save-conversation AND conversation) then navigate to complexes
            router.dismissAll();
            console.log('🔄 [DEBUG] SUCCESS router.dismissAll() completed successfully');
          } catch (error) {
            console.error('🔄 [DEBUG] SUCCESS Error in router.dismissAll():', error);
          }

          console.log('🔄 [DEBUG] SUCCESS Now calling router.replace...');

          try {
            router.replace('/(tabs)/complexes');
            console.log('🔄 [DEBUG] SUCCESS router.replace called successfully - navigation should be complete');
          } catch (error) {
            console.error('🔄 [DEBUG] SUCCESS Error in router.replace():', error);
          }
        }}]
      );

    } catch (error) {
      console.error('Error saving conversation:', error);
      Alert.alert('Error', 'Failed to save conversation');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const handleDontSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('🔄 [DEBUG] handleDontSave called - User chose not to save conversation');

    // Clear the draft data when user chooses not to save
    if (sessionId) {
      try {
        const draftKey = `draft_conversation_${sessionId}`;
        await AsyncStorage.removeItem(draftKey);
        console.log('🧹 Draft data cleared - user chose not to save');
      } catch (error) {
        console.error('Failed to clear draft data:', error);
      }
    }

    // Use the same Alert pattern as successful save to ensure proper navigation
    Alert.alert(
      'Conversation Not Saved',
      'Your conversation will be discarded.',
      [{ text: 'OK', onPress: () => {
        console.log('🔄 [DEBUG] Alert OK pressed - About to dismiss modals and navigate');
        console.log('🔄 [DEBUG] Available router methods:', Object.getOwnPropertyNames(router));
        console.log('🔄 [DEBUG] Calling router.dismissAll()...');

        try {
          // Dismiss ALL modals (save-conversation AND conversation) then navigate to complexes
          router.dismissAll();
          console.log('🔄 [DEBUG] router.dismissAll() completed successfully');
        } catch (error) {
          console.error('🔄 [DEBUG] Error in router.dismissAll():', error);
        }

        console.log('🔄 [DEBUG] Now calling router.replace...');

        try {
          router.replace('/(tabs)/complexes');
          console.log('🔄 [DEBUG] router.replace called successfully - navigation should be complete');
        } catch (error) {
          console.error('🔄 [DEBUG] Error in router.replace():', error);
        }
      }}]
    );
  };

  const handleCreateNewComplex = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowCreateModal(true);
  };

  const handleCreateComplexSubmit = async () => {
    if (!user) return;

    const validation = validateComplexName(newComplexName);
    if (!validation.valid) {
      Alert.alert('Error', validation.error);
      return;
    }

    try {
      setSaving(true);

      const newComplex = await createComplex(
        user.id,
        newComplexName,
        {
          description: newComplexDescription || null,
          color: getRandomComplexColor(),
        }
      );

      // Add to local state
      setComplexes(prev => [newComplex, ...prev]);

      // Close modal and reset form
      setShowCreateModal(false);
      setNewComplexName('');
      setNewComplexDescription('');

      // Automatically select the new complex
      await handleComplexSelect(newComplex.id!, newComplex.name);

    } catch (error) {
      console.error('Error creating complex:', error);
      Alert.alert('Error', 'Failed to create complex');
    } finally {
      setSaving(false);
    }
  };

  // Helper functions
  const generateConversationTitle = (messages: any[]): string => {
    if (!messages || messages.length === 0) return 'Empty Conversation';

    const firstUserMessage = messages.find(msg => msg.type === 'user' && msg.text?.trim());
    if (!firstUserMessage) return 'New Conversation';

    const text = firstUserMessage.text.trim();
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  };

  const transformDetectedData = (bubbleChartData: any[]): DetectedItem[] => {
    if (!bubbleChartData || !Array.isArray(bubbleChartData)) return [];

    return bubbleChartData.map(item => ({
      name: item.text || item.name || 'Unknown',
      confidence: item.confidence || 0.5,
      context: item.context || undefined,
    }));
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const currentTime = Date.now();
    const timeDelta = currentTime - lastScrollTime.current;

    setScrollY(currentScrollY);

    // Check if we're in a bounce state (scrolled beyond content bounds)
    const maxScrollY = Math.max(0, contentHeight - scrollViewHeight);
    const inBounceState = currentScrollY < 0 || currentScrollY > maxScrollY;

    // Only calculate velocity when not in bounce state
    if (!inBounceState && timeDelta > 0 && timeDelta < 100) { // Ignore large time gaps
      const scrollDelta = Math.abs(currentScrollY - lastScrollY);
      const instantVelocity = scrollDelta / timeDelta;
      const scaledVelocity = Math.min(instantVelocity * 50, 3); // Scale and cap velocity

      // Smooth velocity with momentum - blend current with previous
      setScrollVelocity(prevVelocity => {
        const smoothedVelocity = prevVelocity * 0.8 + scaledVelocity * 0.2; // More smoothing
        return smoothedVelocity;
      });

      // Clear any existing decay timer and start a new one
      if (velocityDecayTimer.current) {
        clearInterval(velocityDecayTimer.current);
      }

      // Start decay timer to gradually reduce velocity when scrolling stops
      velocityDecayTimer.current = setInterval(() => {
        setScrollVelocity(prevVelocity => {
          const decayedVelocity = prevVelocity * 0.92; // Slower, smoother decay
          if (decayedVelocity < 0.02) { // Lower threshold for smoother finish
            clearInterval(velocityDecayTimer.current!);
            velocityDecayTimer.current = null;
            return 0;
          }
          return decayedVelocity;
        });
      }, 33) as any; // 30fps for smooth animation
    }

    setLastScrollY(currentScrollY);
    lastScrollTime.current = currentTime;
  };

  if (!user) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: isDark ? '#FFFFFF' : '#000000' }]}>
              Please sign in to save conversations
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const items: ComplexOrNew[] = [{ id: 'new-complex', name: 'New Complex', isNewComplex: true }, ...complexes];

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={styles.blurContainer}
        >
          {/* Handle Bar */}
          <View style={styles.handleBarContainer}>
            <View style={[
              styles.handleBar,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }
            ]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={{
                fontSize: 35,
                fontWeight: 'bold',
                color: isDark ? '#FFFFFF' : '#000000',
                textAlign: 'left',
                fontFamily: 'Georgia',
                flex: 1,
              }}>Save Conversation</Text>
              <Pressable
                onPress={handleDontSave}
                style={[styles.closeButton, { opacity: saving ? 0.5 : 1 }]}
                disabled={saving}
              >
                <IconSymbol
                  name="xmark.circle.fill"
                  size={32}
                  color="#FF453A"
                />
              </Pressable>
            </View>
          </View>

          {/* Complex Cards List */}
          <ScrollView
            ref={scrollViewRef}
            style={[styles.scrollView, { marginBottom: -155 }]}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={true}
            alwaysBounceVertical={true}
            bouncesZoom={true}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={(width, height) => setContentHeight(height)}
            onLayout={(event) => setScrollViewHeight(event.nativeEvent.layout.height)}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="large"
                  color={isDark ? '#FFFFFF' : '#007AFF'}
                />
              </View>
            ) : complexes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: isDark ? '#AAAAAA' : '#666666' }]}>
                  No complexes found. Create your first one below.
                </Text>
              </View>
            ) : (
              items.map((complex, index) => {
                // Calculate card position for gradient
                const cardTop = index * 140; // Position of card relative to scroll content
                const cardCenter = cardTop + 175; // Center of the card (350/2 = 175)

                // Calculate card's position relative to viewport
                const viewportHeight = 800; // Approximate viewport height
                const cardPositionInViewport = cardCenter - scrollY;

                // Normalize position (0 = top of viewport, 1 = bottom of viewport)
                const normalizedPosition = Math.max(0, Math.min(1, cardPositionInViewport / viewportHeight));

                // Skip gradient calculations for New Complex card
                let backgroundColor = '';

                // Cards spread farther apart when scrolling fast (subtle bounce)
                const baseMargin = -210;

                // Check if we're near scroll bounds to prevent stuttering
                const maxScrollY = Math.max(0, contentHeight - scrollViewHeight);
                const nearTop = scrollY < 50;
                const nearBottom = scrollY > maxScrollY - 50;
                const atBounds = nearTop || nearBottom;

                // Only apply bounce effect when not at scroll bounds
                const velocitySpread = atBounds ? 0 : Math.min(scrollVelocity * 3, 10);
                const dynamicMargin = baseMargin + velocitySpread; // Less negative = more space

                if ('isNewComplex' in complex && complex.isNewComplex) {
                  return (
                    <View
                      key="new-complex"
                      style={[
                        styles.addNewCardContainer,
                        {
                          marginTop: index === 0 ? 0 : dynamicMargin,
                          zIndex: index + 1,
                          height: 340,
                          borderRadius: CARD_BORDER_RADIUS,
                        }
                      ]}
                    >
                      <BlurView
                        intensity={50}
                        tint={isDark ? 'dark' : 'light'}
                        style={[
                          styles.card,
                          styles.addNewCard,
                          {
                            height: 340,
                            overflow: 'hidden',
                          }
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Pressable
                            style={[styles.addNewCardPressable, { marginTop: -150 }]}
                            onPress={handleCreateNewComplex}
                            disabled={saving}
                          >
                            <IconSymbol
                              name="plus.circle.fill"
                              size={48}
                              color={saving ? '#999999' : (isDark ? '#4CAF50' : '#2E7D32')}
                            />
                            <Text style={[
                              styles.addNewText,
                              { color: saving ? '#999999' : (isDark ? '#4CAF50' : '#2E7D32') }
                            ]}>
                              New Complex
                            </Text>
                          </Pressable>
                        </View>
                      </BlurView>
                      {/* Border overlay */}
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          borderRadius: CARD_BORDER_RADIUS,
                          borderWidth: 2,
                          borderColor: isDark
                            ? 'rgba(76, 175, 80, 0.4)'
                            : 'rgba(46, 125, 50, 0.3)',
                          borderStyle: 'dashed',
                          pointerEvents: 'none',
                        }}
                      />
                    </View>
                  );
                }

                // Get color for this complex
                const complexColor = complex.color || '#888888';
                backgroundColor = isDark
                  ? `${complexColor}23` // 23% opacity for dark mode (25% less intense)
                  : `${complexColor}15`; // 15% opacity for light mode (25% less intense)

                return (
                  <View
                    key={complex.id}
                    style={[
                      styles.cardShadowContainer,
                      {
                        marginTop: index === 0 ? 0 : dynamicMargin,
                        zIndex: index + 1,
                        height: 340,
                      }
                    ]}
                  >
                    <BlurView
                      intensity={50}
                      tint={isDark ? 'dark' : 'light'}
                      style={[
                        styles.card,
                        {
                          backgroundColor,
                          height: 340,
                          overflow: 'hidden',
                        }
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Pressable
                          onPress={() => handleComplexSelect(String(complex.id), complex.name)}
                          style={styles.cardPressable}
                          disabled={saving}
                        >
                          <View style={styles.cardHeader}>
                            <Text style={[
                              styles.cardTitle,
                              { color: isDark ? '#FFFFFF' : '#000000' }
                            ]}>
                              {complex.name}
                            </Text>
                            <Text style={[
                              styles.cardDate,
                              { color: isDark ? '#CCCCCC' : '#666666' }
                            ]}>
                              {formatDate(complex.created_at || new Date().toISOString())}
                            </Text>
                          </View>
                          {complex.description && (
                            <Text style={[
                              styles.cardDescription,
                              { color: isDark ? '#DDDDDD' : '#444444' }
                            ]}>
                              {complex.description}
                            </Text>
                          )}
                          {saving && (
                            <Text style={[styles.savingText, { color: isDark ? '#4CAF50' : '#2E7D32' }]}>
                              Saving...
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    </BlurView>
                    {/* Border overlay */}
                    <View
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: CARD_BORDER_RADIUS,
                        borderWidth: 1,
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.2)'
                          : 'rgba(0, 0, 0, 0.1)',
                        pointerEvents: 'none',
                      }}
                    />
                  </View>
                );
              })
            )}
          </ScrollView>
        </BlurView>

        {/* Create New Complex Modal */}
        <Modal
          visible={showCreateModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.modalOverlay}>
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={styles.modalContent}
            >
              <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                Create New Complex
              </Text>

              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5',
                    borderColor: isDark ? '#444' : '#DDD',
                    color: isDark ? '#FFF' : '#000',
                  }
                ]}
                placeholder="Complex name"
                placeholderTextColor={isDark ? '#999' : '#666'}
                value={newComplexName}
                onChangeText={setNewComplexName}
                autoFocus={true}
                maxLength={100}
              />

              <TextInput
                style={[
                  styles.modalInput,
                  styles.modalTextArea,
                  {
                    backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5',
                    borderColor: isDark ? '#444' : '#DDD',
                    color: isDark ? '#FFF' : '#000',
                  }
                ]}
                placeholder="Description (optional)"
                placeholderTextColor={isDark ? '#999' : '#666'}
                value={newComplexDescription}
                onChangeText={setNewComplexDescription}
                multiline={true}
                numberOfLines={3}
                maxLength={500}
              />

              <View style={styles.modalButtons}>
                <Pressable
                  style={[
                    styles.modalButton,
                    styles.modalButtonCancel,
                    { backgroundColor: isDark ? '#444' : '#DDD' }
                  ]}
                  onPress={() => {
                    setShowCreateModal(false);
                    setNewComplexName('');
                    setNewComplexDescription('');
                  }}
                  disabled={saving}
                >
                  <Text style={[
                    styles.modalButtonText,
                    { color: isDark ? '#FFF' : '#000' }
                  ]}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.modalButton,
                    styles.modalButtonCreate,
                    {
                      backgroundColor: '#4CAF50',
                      opacity: (saving || !newComplexName.trim()) ? 0.5 : 1
                    }
                  ]}
                  onPress={handleCreateComplexSubmit}
                  disabled={saving || !newComplexName.trim()}
                >
                  <Text style={styles.modalButtonText}>
                    {saving ? 'Creating...' : 'Create'}
                  </Text>
                </Pressable>
              </View>
            </BlurView>
          </View>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  blurContainer: {
    flex: 1,
  },
  handleBarContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    padding: 4,
    marginLeft: 10,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 20,
    minHeight: '120%',
  },
  cardShadowContainer: {
    borderRadius: CARD_BORDER_RADIUS,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -8,
    },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 15,
  },
  card: {
    borderRadius: CARD_BORDER_RADIUS,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  cardPressable: {
    flex: 1,
    padding: 10,
    paddingBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
    fontFamily: 'Georgia',
  },
  cardDate: {
    fontSize: 21,
    fontWeight: 'normal',
    fontFamily: 'Georgia',
  },
  cardDescription: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'left',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    marginBottom: 15,
  },
  addNewCardContainer: {
    marginBottom: 20,
  },
  addNewCard: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  addNewCardPressable: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  addNewText: {
    fontSize: 20,
    fontFamily: 'Georgia',
    fontWeight: '600',
    marginTop: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 23,
    marginTop: -15,
    backgroundColor: 'transparent',
    minHeight: 90,
  },
  dontSaveButton: {
    paddingVertical: 22,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  dontSaveButtonText: {
    fontSize: 17,
    fontFamily: 'Georgia',
    fontWeight: '600',
  },
  // Loading and error states
  loadingContainer: {
    height: 500,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Georgia',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    fontFamily: 'Georgia',
    textAlign: 'center',
  },
  savingText: {
    fontSize: 16,
    fontFamily: 'Georgia',
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Georgia',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    fontFamily: 'Georgia',
    marginBottom: 16,
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonCancel: {},
  modalButtonCreate: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Georgia',
    color: '#FFFFFF',
  },
});
