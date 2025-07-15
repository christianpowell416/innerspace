import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function EmotionSphereScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Emotion Sphere</ThemedText>
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
});