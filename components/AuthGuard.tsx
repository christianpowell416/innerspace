import React from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ActivityIndicator, StyleSheet } from 'react-native';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      console.log('🔄 AuthGuard: Still loading auth state...');
      return;
    }

    const inAuthGroup = segments[0] === 'auth';
    console.log('🛡️ AuthGuard check:', {
      user: user?.email || 'none',
      loading,
      inAuthGroup,
      segments
    });

    if (!user && !inAuthGroup) {
      console.log('🔐 AuthGuard: No user, redirecting to sign-in');
      // Add small delay in dev mode to allow auto-login to complete
      if (__DEV__) {
        setTimeout(() => {
          router.replace('/auth/sign-in');
        }, 500);
      } else {
        router.replace('/auth/sign-in');
      }
    } else if (user && inAuthGroup) {
      console.log('✅ AuthGuard: User authenticated, redirecting to app');
      router.replace('/(tabs)');
    } else {
      console.log('👌 AuthGuard: Auth state OK');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
});