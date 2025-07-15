import React from 'react';
import { StyleSheet, View, Pressable, ScrollView } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';

export type SortOption = 'newest' | 'oldest' | 'frequency';

interface EmotionFiltersProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export function EmotionFilters({ sortBy, onSortChange }: EmotionFiltersProps) {
  const colorScheme = useColorScheme();
  
  const sortOptions: { key: SortOption; label: string }[] = [
    { key: 'newest', label: 'Newest' },
    { key: 'oldest', label: 'Oldest' },
    { key: 'frequency', label: 'Frequency' },
  ];

  const borderColor = colorScheme === 'dark' 
    ? 'rgba(255, 255, 255, 0.3)' 
    : 'rgba(0, 0, 0, 0.3)';
    
  const activeBorderColor = colorScheme === 'dark' 
    ? 'rgba(255, 255, 255, 0.5)' 
    : 'rgba(0, 0, 0, 0.5)';
    
  const activeBackgroundColor = colorScheme === 'dark' 
    ? 'rgba(255, 255, 255, 0.2)' 
    : 'rgba(0, 0, 0, 0.1)';

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="defaultSemiBold" style={styles.title}>
        Sort by:
      </ThemedText>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {sortOptions.map((option) => (
          <Pressable
            key={option.key}
            style={[
              styles.filterButton,
              { borderColor },
              sortBy === option.key && {
                backgroundColor: activeBackgroundColor,
                borderColor: activeBorderColor,
              }
            ]}
            onPress={() => onSortChange(option.key)}
          >
            <ThemedText 
              style={[
                styles.filterText,
                sortBy === option.key && styles.activeFilterText
              ]}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    marginBottom: 8,
    fontSize: 14,
  },
  scrollContent: {
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    opacity: 0.7,
  },
  activeFilterText: {
    opacity: 1,
    fontWeight: '600',
  },
});