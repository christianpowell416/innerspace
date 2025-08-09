import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/AuthGuard';

// Polyfill for structuredClone (for React Native/Expo compatibility)
if (!global.structuredClone) {
  global.structuredClone = (obj: any) => {
    return JSON.parse(JSON.stringify(obj));
  };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#151718',
    },
  };

  const customLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#fff',
    },
  };

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? customDarkTheme : customLightTheme}>
          <AuthGuard>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="auth/sign-in" options={{ headerShown: false }} />
              <Stack.Screen name="auth/sign-up" options={{ headerShown: false }} />
              <Stack.Screen name="conversations" options={{ headerShown: false }} />
              <Stack.Screen name="settings" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
          </AuthGuard>
          <StatusBar 
            style={colorScheme === 'dark' ? 'light' : 'dark'} 
          />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
