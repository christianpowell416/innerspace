import { StyleSheet, ScrollView, Alert, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { GradientBackground } from '@/components/ui/GradientBackground';
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
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          <ThemedView style={styles.headerContainer} transparent>
            <ThemedText style={styles.headerText}>Learn</ThemedText>
          </ThemedView>
          
          <LearningCarousel onArticlePress={handleArticlePress} />
          
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 0,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  headerContainer: {
    alignItems: 'flex-start',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  headerText: {
    fontSize: 42,
    fontWeight: 'bold',
    textAlign: 'left',
    fontFamily: 'Georgia',
    lineHeight: 50,
  },
});