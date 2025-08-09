import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { readFlowchartRequirements, updateFlowchartRequirements } from '@/lib/services/aiFlowchartGenerator';
import * as FileSystem from 'expo-file-system';

export default function RequirementsEditor() {
  const [requirements, setRequirements] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const colorScheme = useColorScheme();

  const isDark = colorScheme === 'dark';

  useEffect(() => {
    loadRequirements();
  }, []);

  const loadRequirements = async () => {
    try {
      setIsLoading(true);
      const content = await readFlowchartRequirements();
      setRequirements(content);
    } catch (error) {
      console.error('Error loading requirements:', error);
      Alert.alert('Error', 'Failed to load requirements');
    } finally {
      setIsLoading(false);
    }
  };

  const saveRequirements = async () => {
    try {
      setIsSaving(true);
      
      // Save to document directory
      await updateFlowchartRequirements(requirements);
      
      Alert.alert('Success', 'Requirements saved successfully!');
    } catch (error) {
      console.error('Error saving requirements:', error);
      Alert.alert('Error', 'Failed to save requirements');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
        <ThemedView style={styles.content}>
          <ThemedText>Loading requirements...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      <ThemedView style={styles.header}>
        <Pressable onPress={handleClose} style={styles.closeButton}>
          <ThemedText style={styles.closeButtonText}>✕</ThemedText>
        </Pressable>
        <ThemedText style={styles.title}>Edit Requirements</ThemedText>
        <Pressable 
          onPress={saveRequirements} 
          style={[styles.saveButton, { opacity: isSaving ? 0.5 : 1 }]}
          disabled={isSaving}
        >
          <ThemedText style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save'}
          </ThemedText>
        </Pressable>
      </ThemedView>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
              color: isDark ? '#fff' : '#000',
              borderColor: isDark ? '#333' : '#ddd',
            },
          ]}
          value={requirements}
          onChangeText={setRequirements}
          multiline
          placeholder="Enter your flowchart requirements here..."
          placeholderTextColor={isDark ? '#666' : '#999'}
          textAlignVertical="top"
        />
      </ScrollView>

      <ThemedView style={styles.footer}>
        <ThemedText style={styles.footerText}>
          Changes are saved locally and will be used immediately for flowchart generation.
        </ThemedText>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Georgia',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Georgia',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  textInput: {
    minHeight: 400,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
    fontFamily: 'Georgia',
  },
});