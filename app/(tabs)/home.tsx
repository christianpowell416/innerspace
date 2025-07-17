import { StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const { user, signOut } = useAuth();

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
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Home</ThemedText>
        {user && (
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
          </TouchableOpacity>
        )}
      </ThemedView>
      <ThemedView style={styles.sphereContainer}>
        <ThemedText>3D Emotion Sphere will be rendered here</ThemedText>
        <ThemedText type="default" style={styles.description}>
          Interactive 3D sphere showing emotions as vectors across three axes:
        </ThemedText>
        <ThemedText type="default">• Masculine ↔ Feminine</ThemedText>
        <ThemedText type="default">• Light ↔ Dark</ThemedText>
        <ThemedText type="default">• Child ↔ Parent</ThemedText>
      </ThemedView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  sphereContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  description: {
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  signOutButton: {
    marginTop: 12,
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