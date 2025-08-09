import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Image } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#888' : '#888',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: Platform.OS === 'ios' ? TabBarBackground : undefined,
        tabBarShowLabel: false,
        tabBarStyle: Platform.select({
          ios: {
            // Glass effect on iOS
            position: 'absolute',
            paddingTop: 10,
            height: 90,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
          },
          android: {
            paddingTop: 10,
            backgroundColor: colorScheme === 'dark' ? 'rgba(60,60,60,0.85)' : 'rgba(255,255,255,0.9)',
            borderTopColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            borderTopWidth: 0.5,
            elevation: 8,
            height: 80,
          },
          default: {
            paddingTop: 10,
            height: 80,
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house" color={color} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="book" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <ThemedView style={[
              styles.centerButton,
              { 
                backgroundColor: focused 
                  ? '#87CEEB' 
                  : colorScheme === 'dark' ? '#333' : '#E0E0E0'
              }
            ]}>
              <Image 
                source={require('@/assets/images/Logo.png')}
                style={[
                  styles.logoIcon,
                  { 
                    tintColor: focused ? '#000' : color,
                  }
                ]}
                resizeMode="contain"
              />
            </ThemedView>
          ),
          tabBarButton: (props) => (
            <HapticTab {...props} style={[props.style, styles.centerButtonContainer]} />
          ),
        }}
      />
      <Tabs.Screen
        name="bodygraph"
        options={{
          title: 'Body',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="figure.stand" color={color} />,
        }}
      />
      <Tabs.Screen
        name="conversations"
        options={{
          title: 'Conversations',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bubble.left.and.bubble.right.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  centerButtonContainer: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    width: 45,
    height: 45,
  },
});
