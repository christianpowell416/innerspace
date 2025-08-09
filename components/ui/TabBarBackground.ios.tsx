import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function BlurTabBarBackground() {
  const colorScheme = useColorScheme();
  
  return (
    <>
      <BlurView
        // Ultra light frosted glass effect like MasterClass
        tint={colorScheme === 'dark' ? 'systemThinMaterialDark' : 'systemThinMaterial'}
        intensity={90}
        style={StyleSheet.absoluteFill}
      />
      <View 
        style={[
          StyleSheet.absoluteFill, 
          { 
            backgroundColor: colorScheme === 'dark' 
              ? 'rgba(50,50,50,0.3)' // Much lighter dark overlay
              : 'rgba(255,255,255,0.7)' // Bright white frosted overlay
          }
        ]} 
      />
    </>
  );
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
