import React from 'react';
import { StyleSheet, View, Pressable, ScrollView } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';

export type SortOption = 'recent' | 'frequency' | 'intensity';
export type SortDirection = 'asc' | 'desc';

interface EmotionFiltersProps {
  sortBy: SortOption;
  sortDirection: SortDirection;
  onSortChange: (sort: SortOption) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
}

export function EmotionFilters({ sortBy, sortDirection, onSortChange, onSortDirectionChange }: EmotionFiltersProps) {
  const colorScheme = useColorScheme();
  
  const sortOptions: { key: SortOption; label: string }[] = [
    { key: 'recent', label: 'Recent' },
    { key: 'frequency', label: 'Frequency' },
    { key: 'intensity', label: 'Intensity' },
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
      <View style={styles.filtersRow}>
        <View style={styles.sortOptionsContainer}>
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
        </View>
        <Pressable
          style={[
            styles.filterButton,
            styles.directionButton,
            { borderColor }
          ]}
          onPress={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
        >
          <IconSymbol 
            size={18} 
            name={sortDirection === 'asc' ? 'arrow.up' : 'arrow.down'} 
            color={colorScheme === 'dark' ? '#fff' : '#000'} 
          />
        </Pressable>
      </View>
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
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sortOptionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  directionButton: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
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