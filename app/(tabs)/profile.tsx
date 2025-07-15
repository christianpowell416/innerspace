import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function ProfileScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Profile</ThemedText>
      </ThemedView>
      <ThemedView style={styles.profileContainer}>
        <ThemedText>User profile and settings will be available here</ThemedText>
        <ThemedText type="default" style={styles.description}>
          Manage your therapy journey:
        </ThemedText>
        <ThemedText type="default">• View progress and insights</ThemedText>
        <ThemedText type="default">• Adjust app preferences</ThemedText>
        <ThemedText type="default">• Access premium features</ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileContainer: {
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
});