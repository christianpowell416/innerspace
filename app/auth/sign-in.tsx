import React, { useState } from 'react';
import { StyleSheet, TextInput, Alert, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = () => {
    router.push('/auth/sign-up');
  };



  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ThemedView style={styles.content}>
          <ThemedView style={styles.header}>
            <ThemedText type="title" style={styles.title}>Welcome Back</ThemedText>
            <ThemedText type="default" style={styles.subtitle}>
              Sign in to continue your emotional journey
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.form}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F5F5F5',
                  borderColor: colorScheme === 'dark' ? '#444' : '#DDD',
                  color: colorScheme === 'dark' ? '#FFF' : '#000',
                }
              ]}
              placeholder="Email"
              placeholderTextColor={colorScheme === 'dark' ? '#999' : '#666'}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F5F5F5',
                  borderColor: colorScheme === 'dark' ? '#444' : '#DDD',
                  color: colorScheme === 'dark' ? '#FFF' : '#000',
                }
              ]}
              placeholder="Password"
              placeholderTextColor={colorScheme === 'dark' ? '#999' : '#666'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: Colors[colorScheme ?? 'light'].tint },
                loading && styles.buttonDisabled
              ]}
              onPress={handleSignIn}
              disabled={loading}
            >
              <ThemedText style={styles.buttonText}>
                {loading ? 'Signing In...' : 'Sign In'}
              </ThemedText>
            </TouchableOpacity>



            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleSignUp}
            >
              <ThemedText style={styles.linkText}>
                Don't have an account? Sign up
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  form: {
    gap: 20,
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  button: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 16,
    opacity: 0.8,
  },
});