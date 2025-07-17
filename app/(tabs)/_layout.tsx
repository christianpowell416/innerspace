import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

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
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#666' : '#999',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: Platform.OS === 'ios' ? TabBarBackground : undefined,
        tabBarShowLabel: false,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
            paddingTop: 10,
            height: 90,
          },
          android: {
            paddingTop: 10,
            backgroundColor: colorScheme === 'dark' ? '#000' : '#FFF',
            borderTopColor: colorScheme === 'dark' ? '#333' : '#E0E0E0',
            borderTopWidth: 1,
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
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="house" color={color} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="book" color={color} />,
        }}
      />
      <Tabs.Screen
        name="sphere"
        options={{
          title: 'Sphere',
          tabBarIcon: ({ color, focused }) => (
            <ThemedView style={[
              styles.centerButton,
              { 
                backgroundColor: focused 
                  ? Colors[colorScheme ?? 'light'].tint 
                  : colorScheme === 'dark' ? '#333' : '#E0E0E0'
              }
            ]}>
              <IconSymbol 
                size={24} 
                name="globe" 
                color={focused ? '#FFF' : color} 
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
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="figure.stand" color={color} />,
        }}
      />
      <Tabs.Screen
        name="beliefs"
        options={{
          title: 'Beliefs',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="puzzlepiece" color={color} />,
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
});
