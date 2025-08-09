import { StyleSheet, ScrollView, Alert, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { GlassHeader } from '@/components/ui/GlassHeader';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LearningCarousel } from '@/components/LearningCarousel';

export default function LearnScreen() {
  const colorScheme = useColorScheme();
  
  const handleArticlePress = (article: any) => {
    Alert.alert(
      article.title,
      `${article.subtitle}\n\n${article.description}\n\nThis would normally navigate to the full article.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <GradientBackground style={styles.container}>
      <GlassHeader>
        <ThemedText type="title" style={styles.titleText}>Learn</ThemedText>
        <View style={styles.rightSpacer} />
      </GlassHeader>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          
          <LearningCarousel onArticlePress={handleArticlePress} />
          
          <ThemedView style={styles.contentContainer} transparent>
            <ThemedText type="subtitle">More Learning Resources</ThemedText>
            <ThemedText type="default" style={styles.description}>
              Explore additional content about emotional intelligence, limiting beliefs, and personal growth.
            </ThemedText>
          </ThemedView>
        </ScrollView>
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
  rightSpacer: {
    width: 40, // Balance the header
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 100, // Account for tab bar
    marginTop: 20,
  },
  description: {
    marginTop: 20,
    textAlign: 'center',
  },
});