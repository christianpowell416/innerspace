import { Tabs, useRouter, useSegments } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Image, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { CircleDotIcon } from '@/components/ui/CircleDotIcon';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// Custom chat tab button component
function ChatTabButton(props: any) {
  const router = useRouter();
  const segments = useSegments();
  const isOnChatTab = segments[1] === 'chat';

  const handlePress = () => {
    if (isOnChatTab) {
      // Already on chat tab, trigger a new chat
      // We'll use a global event or navigation params to trigger new chat
      router.push('/(tabs)/chat?newChat=true');
    } else {
      // Navigate to chat tab normally
      router.push('/(tabs)/chat');
    }
  };

  return (
    <HapticTab {...props} onPress={handlePress} style={[props.style, styles.centerButtonContainer]} />
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#888' : '#888',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: () => (
          <BlurView
            intensity={Platform.OS === 'ios' ? 90 : 80}
            tint={colorScheme === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          >
            <View 
              style={[
                StyleSheet.absoluteFill,
                { 
                  backgroundColor: colorScheme === 'dark' 
                    ? 'rgba(30,30,30,0.2)' // Subtle dark overlay
                    : 'rgba(255,255,255,0.4)', // Light white overlay
                  borderTopWidth: 0.5,
                  borderTopColor: colorScheme === 'dark' 
                    ? 'rgba(255,255,255,0.1)' 
                    : 'rgba(0,0,0,0.1)',
                }
              ]} 
            />
          </BlurView>
        ),
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
            backgroundColor: 'transparent', // Transparent to show blur
            borderTopWidth: 0,
            elevation: 0, // Remove elevation to show blur properly
            height: 80,
          },
          default: {
            paddingTop: 10,
            height: 80,
            backgroundColor: 'transparent',
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
          href: null, // Hide Learn tab
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Loops',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.centerButton,
                {
                  borderWidth: 3,
                  borderColor: focused
                    ? 'rgba(46, 125, 50, 0.5)'
                    : colorScheme === 'dark'
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'rgba(0, 0, 0, 0.15)',
                }
              ]}
            >
              <BlurView
                intensity={20}
                tint="systemMaterial"
                style={[
                  styles.centerButtonBlur,
                  {
                    backgroundColor: focused
                      ? 'rgba(46, 125, 50, 0.6)' // Stronger green when focused
                      : 'rgba(255, 255, 255, 0.3)', // White when not focused
                  }
                ]}
              >
                <Image
                  source={require('@/assets/images/Logo.png')}
                  style={[
                    styles.logoIcon,
                    {
                      tintColor: focused ? '#FFF' : colorScheme === 'dark' ? '#FFF' : '#000',
                      marginLeft: 2,
                      marginTop: 2,
                    }
                  ]}
                  resizeMode="contain"
                />
              </BlurView>
            </View>
          ),
          tabBarButton: ChatTabButton,
        }}
      />
      <Tabs.Screen
        name="bodygraph"
        options={{
          href: null, // Hide Body tab
        }}
      />
      <Tabs.Screen
        name="innerspace"
        options={{
          title: 'My Innerspace',
          tabBarIcon: ({ color }) => <CircleDotIcon size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
    overflow: 'hidden',
  },
  centerButtonBlur: {
    width: 104,
    height: 104,
    borderRadius: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -2,
    marginTop: -2,
  },
  centerButtonContainer: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    width: 80,
    height: 80,
  },
});
