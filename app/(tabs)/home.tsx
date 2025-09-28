import React, { useState, useEffect, Suspense } from 'react';
import { StyleSheet, View, Pressable, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { loadComplexes, ComplexData } from '@/lib/services/complexManagementService';

// Declare global cache types
declare global {
  var preloadedComplexes: ComplexData[] | null;
  var preloadedComplexesTimestamp: number | null;
}

// Lazy load heavy components to prevent loading during page transitions
const LearningCarousel = React.lazy(() => import('@/components/LearningCarousel').then(module => ({ default: module.LearningCarousel })));

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  // Progressive loading states
  const [shouldLoadCarousel, setShouldLoadCarousel] = useState(false);
  const [hyphenator, setHyphenator] = useState<any>(null);

  // Initialize progressive loading after component mounts
  useEffect(() => {
    // Delay loading to allow page to render first
    const timer = setTimeout(() => {
      setShouldLoadCarousel(true);

      // Lazy load hyphenation libraries
      Promise.all([
        import('hypher'),
        import('hyphenation.en-us')
      ]).then(([HypherModule, englishModule]) => {
        const Hypher = HypherModule.default;
        const english = englishModule.default;
        setHyphenator(new Hypher(english));
      }).catch(error => {
        console.warn('Failed to load hyphenation libraries:', error);
      });
    }, 300); // Delay for page load

    return () => clearTimeout(timer);
  }, []);

  // Preload complexes data when user becomes available
  useEffect(() => {
    if (user) {
      // Start preloading complexes immediately when user is available
      console.log('🚀 Preloading complexes data in background...');
      loadComplexes(user.id)
        .then(complexes => {
          console.log(`✅ Preloaded ${complexes.length} complexes`);
          // Store in a simple cache that the complexes page can check
          global.preloadedComplexes = complexes;
          global.preloadedComplexesTimestamp = Date.now();
        })
        .catch(error => {
          console.warn('Failed to preload complexes:', error);
        });
    }
  }, [user]);

  // Function to hyphenate text automatically
  const getHyphenatedText = (text: string) => {
    if (!hyphenator) return text; // Return original text if hyphenator not loaded

    try {
      return hyphenator.hyphenateText(text);
    } catch (error) {
      console.warn('Hyphenation failed, using original text:', error);
      return text;
    }
  };
  
  // Theme data with automatic hyphenation and colors
  const themes = [
    { text: 'Overwhelm with work responsibilities', color: '#A1616B' }, // Darker muted rose - stress/urgency
    { text: 'Not having enough time', color: '#B5935E' }, // Darker muted amber - pressure/anxiety
    { text: 'Racing thoughts at bedtime', color: '#8B7BA8' }, // Darker muted purple - mental/sleep
    { text: 'Speaking up', color: '#6B87B3' }, // Darker muted blue - communication/confidence
    { text: 'Enforcing my boundaries', color: '#7A9F73' } // Darker muted green - growth/self-care
  ];

  const handleArticlePress = (article: any) => {
    // Handle article press - could navigate to article detail or show modal
    console.log('Article pressed:', article.title);
  };

  return (
    <GradientBackground style={styles.container}>
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <ThemedText style={styles.dateText}>
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </ThemedText>
          <ThemedText type="title" style={styles.welcomeText}>
            Welcome,{'\n'}{profile?.first_name || user?.email?.split('@')[0] || 'Guest'}
          </ThemedText>
          <Pressable
            style={styles.profileButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/profile');
            }}
          >
            <IconSymbol size={36} name="person.circle" color={colorScheme === 'dark' ? '#fff' : '#000'} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.mainScrollView}
          showsVerticalScrollIndicator={false}
        >
        
        <ThemedText style={styles.inflectionTitle}>
          Inflection of the day:
        </ThemedText>
        
        <View style={styles.aiQuestionCard}>
          <ThemedText style={styles.aiQuestionText}>
            Have we been able to relax lately?
          </ThemedText>
        </View>
        
        <ThemedText style={styles.themesTitle}>
          Common themes:
        </ThemedText>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.themesCarousel}
          contentContainerStyle={styles.themesCarouselContent}
        >
          {themes.map((theme, index) => (
            <View 
              key={index} 
              style={[
                styles.themesCard, 
                { 
                  backgroundColor: theme.color,
                  borderColor: theme.color
                }
              ]}
            >
              <ThemedText style={[styles.themesText, { color: '#FFFFFF' }]}>
                {getHyphenatedText(theme.text)}
              </ThemedText>
            </View>
          ))}
        </ScrollView>
        
          {shouldLoadCarousel ? (
            <Suspense fallback={null}>
              <LearningCarousel onArticlePress={handleArticlePress} />
            </Suspense>
          ) : (
            null
          )}

        </ScrollView>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  mainScrollView: {
    flex: 1,
  },
  profileButton: {
    position: 'absolute',
    top: 15,
    right: 20,
    padding: 8,
    borderRadius: 8,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    alignItems: 'flex-start',
    paddingTop: -5,
    paddingHorizontal: 20,
    paddingBottom: 15,
    zIndex: 100,
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  welcomeText: {
    fontSize: 42,
    fontWeight: 'bold',
    textAlign: 'left',
    fontFamily: 'Georgia',
    lineHeight: 50,
  },
  dateText: {
    fontSize: 24,
    color: '#666',
    fontFamily: 'Georgia',
    marginTop: 8,
    marginBottom: 6,
  },
  inflectionTitle: {
    fontSize: 24,
    fontFamily: 'Georgia',
    marginTop: 48,
    marginBottom: 2,
    paddingHorizontal: 20,
  },
  aiQuestionCard: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginTop: 8,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  aiQuestionText: {
    fontSize: 27,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    color: '#000',
    textAlign: 'left',
    lineHeight: 36,
  },
  themesTitle: {
    fontSize: 24,
    fontFamily: 'Georgia',
    marginTop: 32,
    marginBottom: 2,
    paddingHorizontal: 20,
  },
  themesCarousel: {
    marginTop: 8,
  },
  themesCarouselContent: {
    paddingLeft: 20,
    paddingRight: 20,
    gap: 12,
  },
  themesCard: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    width: Dimensions.get('window').width * 0.345,
    height: 180,
    justifyContent: 'center',
  },
  themesText: {
    fontSize: 21,
    fontFamily: 'Georgia',
    textAlign: 'center',
    lineHeight: 28,
    flexWrap: 'wrap',
  },
});