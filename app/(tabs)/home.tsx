import { StyleSheet, View, Pressable, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { GlassHeader } from '@/components/ui/GlassHeader';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
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
  
  // Theme data with automatic hyphenation
  const themes = [
    'Overwhelm with work responsibilities',
    'Not having enough time', 
    'Racing thoughts at bedtime'
  ];

  return (
    <GradientBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable 
          style={styles.profileButton}
          onPress={() => router.push('/profile')}
        >
          <IconSymbol size={24} name="person.circle" color={colorScheme === 'dark' ? '#fff' : '#000'} />
        </Pressable>
        
        <ThemedView style={styles.welcomeContainer} transparent>
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
              style={[styles.themesCard, { borderColor: colorScheme === 'dark' ? '#444' : '#DDD' }]}
            >
              <ThemedText style={styles.themesText}>
                {getHyphenatedText(theme)}
              </ThemedText>
            </View>
          ))}
        </ScrollView>
        
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { borderColor: colorScheme === 'dark' ? '#444' : '#DDD' }]}>
            <ThemedText style={styles.statLabel}>Open loops</ThemedText>
            <ThemedText style={styles.statNumber}>12</ThemedText>
          </View>
          
          <View style={[styles.statCard, { borderColor: colorScheme === 'dark' ? '#444' : '#DDD' }]}>
            <ThemedText style={styles.statLabel}>Closed loops</ThemedText>
            <ThemedText style={styles.statNumber}>4</ThemedText>
          </View>
        </View>
        
        <ThemedView style={styles.sphereContainer} transparent>
          
        </ThemedView>
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
  profileButton: {
    position: 'absolute',
    top: 80, // Moved down 20px more
    right: 20,
    padding: 8,
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  welcomeContainer: {
    alignItems: 'flex-start',
    paddingTop: 20, // Moved down 20px
  },
  sphereContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 16,
    paddingHorizontal: 20,
  },
  statCard: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'Georgia',
    textAlign: 'center',
    marginTop: 8,
    marginVertical: 0,
  },
  statLabel: {
    fontSize: 21,
    fontFamily: 'Georgia',
    opacity: 0.7,
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
});