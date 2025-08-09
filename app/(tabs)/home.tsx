import { StyleSheet, View, Pressable, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { LearningCarousel } from '@/components/LearningCarousel';
import Hypher from 'hypher';
import english from 'hyphenation.en-us';

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const colorScheme = useColorScheme();
  
  // Initialize hyphenator with English patterns
  const hyphenator = new Hypher(english);
  
  // Function to hyphenate text automatically
  const getHyphenatedText = (text: string) => {
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
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          style={styles.mainScrollView}
          showsVerticalScrollIndicator={false}
        >
          <ThemedView style={styles.welcomeContainer} transparent>
            <Pressable 
              style={styles.profileButton}
              onPress={() => router.push('/profile')}
            >
              <IconSymbol size={36} name="person.circle" color={colorScheme === 'dark' ? '#fff' : '#000'} />
            </Pressable>
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
        </ThemedView>
        
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
        
          <LearningCarousel onArticlePress={handleArticlePress} />
          
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 0, // Let SafeAreaView handle the status bar spacing
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
    right: 0,
    padding: 8,
    borderRadius: 8,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeContainer: {
    alignItems: 'flex-start',
    paddingTop: 20, // Moved down 20px
  },
  welcomeText: {
    fontSize: 42,
    fontWeight: 'bold',
    textAlign: 'left',
    fontFamily: 'Georgia',
    lineHeight: 50,
    paddingHorizontal: 20,
  },
  dateText: {
    fontSize: 24,
    color: '#666',
    fontFamily: 'Georgia',
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 20,
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