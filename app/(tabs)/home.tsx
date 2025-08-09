import { StyleSheet, Alert, TouchableOpacity, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { GlassHeader } from '@/components/ui/GlassHeader';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const colorScheme = useColorScheme();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            signOut();
          },
        },
      ]
    );
  };

  return (
    <GradientBackground style={styles.container}>
      <GlassHeader>
        <ThemedText type="title" style={styles.titleText}>Home</ThemedText>
        <Pressable 
          style={styles.profileButton}
          onPress={() => router.push('/profile')}
        >
          <IconSymbol size={24} name="person.circle" color={colorScheme === 'dark' ? '#fff' : '#000'} />
        </Pressable>
      </GlassHeader>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.sphereContainer} transparent>
          <ThemedText>3D Emotion Sphere will be rendered here</ThemedText>
          <ThemedText type="default" style={styles.description}>
            Interactive 3D sphere showing emotions as vectors across three axes:
          </ThemedText>
          <ThemedText type="default">• Masculine ↔ Feminine</ThemedText>
          <ThemedText type="default">• Light ↔ Dark</ThemedText>
          <ThemedText type="default">• Child ↔ Parent</ThemedText>
          
          {user && (
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
            </TouchableOpacity>
          )}
        </ThemedView>
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
  profileButton: {
    padding: 8,
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    flex: 1,
    textAlign: 'left',
    marginLeft: 0, // Remove extra margin since no left spacer
  },
  sphereContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  description: {
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  signOutButton: {
    marginTop: 30,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  signOutText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
});