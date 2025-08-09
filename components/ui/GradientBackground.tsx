import React from 'react';
import { StyleSheet, ViewStyle, View } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function GradientBackground({ children, style }: GradientBackgroundProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Use a subtle solid background that mimics gradient effect
  const backgroundColor = isDark ? '#0a0a0a' : '#f8f8f8';

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      {/* Top subtle overlay for depth */}
      <View 
        style={[
          styles.overlay,
          {
            backgroundColor: isDark 
              ? 'rgba(255,255,255,0.01)' 
              : 'rgba(0,0,0,0.02)',
          }
        ]} 
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '30%',
    zIndex: -1,
  },
});