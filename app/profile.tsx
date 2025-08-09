import React, { useState } from 'react';
import { StyleSheet, Alert, TouchableOpacity, View, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { GlassHeader } from '@/components/ui/GlassHeader';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
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
            router.replace('/(tabs)/home');
          },
        },
      ]
    );
  };

  const handleEditProfile = () => {
    Alert.alert('Edit Profile', 'Profile editing functionality coming soon!');
  };

  const handleSettings = () => {
    router.push('/settings');
  };

  const handleDataExport = () => {
    Alert.alert('Export Data', 'Data export functionality coming soon!');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Delete Account', 'Account deletion functionality coming soon!');
          },
        },
      ]
    );
  };

  return (
    <GradientBackground style={styles.container}>
      <GlassHeader>
        <Pressable 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol size={24} name="chevron.left" color={colorScheme === 'dark' ? '#fff' : '#000'} />
        </Pressable>
        <ThemedText type="title" style={styles.titleText}>Profile</ThemedText>
        <Pressable style={styles.invisibleButton} />
      </GlassHeader>
      
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.contentContainer} transparent>
            
            {/* Profile Header */}
            <ThemedView style={styles.profileHeader} transparent>
              <View style={[
                styles.avatarContainer,
                { backgroundColor: colorScheme === 'dark' ? '#333' : '#E0E0E0' }
              ]}>
                <IconSymbol size={64} name="person.circle.fill" color={colorScheme === 'dark' ? '#666' : '#999'} />
              </View>
              <ThemedText type="title" style={styles.userName}>
                {user?.email?.split('@')[0] || 'Guest User'}
              </ThemedText>
              {user?.email && (
                <ThemedText type="default" style={styles.userEmail}>
                  {user.email}
                </ThemedText>
              )}
            </ThemedView>

            {/* Profile Actions */}
            <ThemedView style={styles.actionsContainer} transparent>
              
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { 
                    backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F5F5F5',
                    borderColor: colorScheme === 'dark' ? '#444' : '#DDD',
                  }
                ]}
                onPress={handleEditProfile}
              >
                <IconSymbol size={24} name="pencil" color={colorScheme === 'dark' ? '#fff' : '#000'} />
                <ThemedText type="defaultSemiBold" style={styles.actionText}>
                  Edit Profile
                </ThemedText>
                <IconSymbol size={16} name="chevron.right" color={colorScheme === 'dark' ? '#666' : '#999'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { 
                    backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F5F5F5',
                    borderColor: colorScheme === 'dark' ? '#444' : '#DDD',
                  }
                ]}
                onPress={handleSettings}
              >
                <IconSymbol size={24} name="slider.horizontal.3" color={colorScheme === 'dark' ? '#fff' : '#000'} />
                <ThemedText type="defaultSemiBold" style={styles.actionText}>
                  Settings
                </ThemedText>
                <IconSymbol size={16} name="chevron.right" color={colorScheme === 'dark' ? '#666' : '#999'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { 
                    backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F5F5F5',
                    borderColor: colorScheme === 'dark' ? '#444' : '#DDD',
                  }
                ]}
                onPress={handleDataExport}
              >
                <IconSymbol size={24} name="square.and.arrow.up" color={colorScheme === 'dark' ? '#fff' : '#000'} />
                <ThemedText type="defaultSemiBold" style={styles.actionText}>
                  Export Data
                </ThemedText>
                <IconSymbol size={16} name="chevron.right" color={colorScheme === 'dark' ? '#666' : '#999'} />
              </TouchableOpacity>

            </ThemedView>

            {/* Account Actions */}
            {user && (
              <ThemedView style={styles.accountContainer} transparent>
                <ThemedText type="subtitle" style={styles.sectionTitle}>Account</ThemedText>
                
                <TouchableOpacity
                  style={styles.signOutButton}
                  onPress={handleSignOut}
                >
                  <IconSymbol size={24} name="power" color="#007AFF" />
                  <ThemedText style={[styles.actionText, styles.signOutText]}>
                    Sign Out
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDeleteAccount}
                >
                  <IconSymbol size={24} name="trash" color="#FF3B30" />
                  <ThemedText style={[styles.actionText, styles.deleteText]}>
                    Delete Account
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            )}

          </ThemedView>
        </ScrollView>
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
  backButton: {
    padding: 8,
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  invisibleButton: {
    padding: 8,
    borderRadius: 8,
    width: 40,
    height: 40,
    opacity: 0,
  },
  titleText: {
    flex: 1,
    textAlign: 'left',
    marginLeft: 16, // Add some left margin for proper indentation
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100, // Account for tab bar
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  userEmail: {
    opacity: 0.7,
    fontSize: 16,
  },
  actionsContainer: {
    marginBottom: 32,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
  },
  accountContainer: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  signOutText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  deleteText: {
    color: '#FF3B30',
    fontWeight: '600',
  },
});