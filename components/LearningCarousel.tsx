import React from 'react';
import { StyleSheet, ScrollView, View, Pressable, Dimensions } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';

interface LearningArticle {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  readTime: string;
  backgroundColor: string;
}

interface LearningCarouselProps {
  onArticlePress?: (article: LearningArticle) => void;
}

const SAMPLE_ARTICLES: LearningArticle[] = [
  {
    id: '1',
    title: 'Understanding Your Inner Voice',
    subtitle: 'Emotional Intelligence',
    description: 'Learn to recognize and work with the different parts of yourself for better emotional regulation.',
    category: 'Self-Awareness',
    readTime: '8 min read',
    backgroundColor: '#2C3E50',
  },
  {
    id: '2',
    title: 'Breaking Limiting Beliefs',
    subtitle: 'Personal Growth',
    description: 'Discover how to identify and transform the beliefs that hold you back from reaching your potential.',
    category: 'Mindset',
    readTime: '12 min read',
    backgroundColor: '#34495E',
  },
  {
    id: '3',
    title: 'The Art of Self-Compassion',
    subtitle: 'Emotional Healing',
    description: 'Practice treating yourself with the same kindness you would offer a good friend.',
    category: 'Wellness',
    readTime: '6 min read',
    backgroundColor: '#4A5568',
  },
  {
    id: '4',
    title: 'Building Emotional Resilience',
    subtitle: 'Mental Health',
    description: 'Develop the skills to bounce back from difficult emotions and challenging situations.',
    category: 'Resilience',
    readTime: '10 min read',
    backgroundColor: '#2D3748',
  },
  {
    id: '5',
    title: 'Mindful Communication',
    subtitle: 'Relationships',
    description: 'Learn to express your needs and boundaries while maintaining healthy connections.',
    category: 'Communication',
    readTime: '9 min read',
    backgroundColor: '#1A202C',
  },
];

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = screenWidth * 0.8;
const cardSpacing = 16;

export function LearningCarousel({ onArticlePress }: LearningCarouselProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleArticlePress = (article: LearningArticle) => {
    onArticlePress?.(article);
  };

  return (
    <View style={styles.container}>
      <ThemedView style={styles.header} transparent>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Featured Learning</ThemedText>
        <ThemedText type="default" style={styles.sectionSubtitle}>
          Curated articles for your emotional growth journey
        </ThemedText>
      </ThemedView>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        snapToInterval={cardWidth + cardSpacing}
        decelerationRate="fast"
      >
        {SAMPLE_ARTICLES.map((article, index) => (
          <Pressable
            key={article.id}
            style={[
              styles.card,
              { 
                width: cardWidth,
                backgroundColor: isDark ? article.backgroundColor : '#f8f8f8',
                marginLeft: index === 0 ? cardSpacing : 0,
                marginRight: cardSpacing,
              }
            ]}
            onPress={() => handleArticlePress(article)}
          >
            <View style={styles.cardContent}>
              <ThemedView style={styles.categoryContainer} transparent>
                <ThemedText style={[
                  styles.category,
                  { color: isDark ? '#A0AEC0' : '#718096' }
                ]}>
                  {article.category}
                </ThemedText>
                <ThemedText style={[
                  styles.readTime,
                  { color: isDark ? '#A0AEC0' : '#718096' }
                ]}>
                  {article.readTime}
                </ThemedText>
              </ThemedView>
              
              <ThemedText 
                type="title" 
                style={[
                  styles.title,
                  { color: isDark ? '#FFFFFF' : '#1A202C' }
                ]}
                numberOfLines={2}
              >
                {article.title}
              </ThemedText>
              
              <ThemedText 
                type="defaultSemiBold" 
                style={[
                  styles.subtitle,
                  { color: isDark ? '#E2E8F0' : '#4A5568' }
                ]}
              >
                {article.subtitle}
              </ThemedText>
              
              <ThemedText 
                type="default" 
                style={[
                  styles.description,
                  { color: isDark ? '#CBD5E0' : '#718096' }
                ]}
                numberOfLines={3}
              >
                {article.description}
              </ThemedText>
            </View>
            
            <View style={[
              styles.actionContainer,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
            ]}>
              <ThemedText style={[
                styles.readButton,
                { color: isDark ? '#FFFFFF' : '#2D3748' }
              ]}>
                Read Article
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    opacity: 0.7,
    fontSize: 14,
  },
  scrollContainer: {
    paddingVertical: 8,
  },
  card: {
    height: 260,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  categoryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  category: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  readTime: {
    fontSize: 12,
    opacity: 0.8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 26,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 12,
    opacity: 0.9,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  actionContainer: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  readButton: {
    fontSize: 14,
    fontWeight: '600',
  },
});