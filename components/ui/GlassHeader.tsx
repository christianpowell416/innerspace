import React from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';

interface GlassHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
  showBorder?: boolean;
}

export function GlassHeader({ children, style, showBorder = true }: GlassHeaderProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const containerStyle = [
    styles.container,
    {
      paddingTop: insets.top,
      borderBottomWidth: showBorder ? 0.5 : 0,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    },
    style,
  ];

  if (Platform.OS === 'ios') {
    return (
      <View style={containerStyle}>
        <BlurView
          tint={isDark ? 'systemMaterialDark' : 'systemMaterial'}
          intensity={100}
          style={StyleSheet.absoluteFill}
        />
        <View 
          style={[
            StyleSheet.absoluteFill, 
            { 
              backgroundColor: isDark 
                ? 'rgba(30,30,30,0.5)' // Lighter dark overlay for frosted effect
                : 'rgba(248,248,248,0.6)', // Light frosted overlay
              paddingTop: insets.top,
            }
          ]} 
        />
        <View style={styles.content}>
          {children}
        </View>
      </View>
    );
  }

  // Android fallback with semi-transparent background
  return (
    <View 
      style={[
        containerStyle,
        { 
          backgroundColor: isDark 
            ? 'rgba(40,40,40,0.92)' // Lighter dark with high opacity for Android
            : 'rgba(248,248,248,0.92)' // Light frosted for Android
        }
      ]}
    >
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
  },
});