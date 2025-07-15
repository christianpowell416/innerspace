import { StyleSheet, ScrollView } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function AddEmotionScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Add emotion</ThemedText>
      </ThemedView>
      <ScrollView style={styles.contentContainer}>
        <ThemedView style={styles.addEmotionState}>
          <ThemedText type="subtitle">Rate your current emotion</ThemedText>
          <ThemedText style={styles.description}>
            Choose how you'd like to record your emotional state:
          </ThemedText>
          <ThemedText type="default">• Manual rating on three axes</ThemedText>
          <ThemedText type="default">• AI-assisted conversation</ThemedText>
          <ThemedText type="default">• Quick emotion selection</ThemedText>
          <ThemedText type="default">• Optional journal entry</ThemedText>
        </ThemedView>
      </ScrollView>
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
    marginBottom: 20,
  },
  contentContainer: {
    flex: 1,
  },
  addEmotionState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  description: {
    marginTop: 10,
    marginBottom: 15,
    textAlign: 'center',
  },
});
