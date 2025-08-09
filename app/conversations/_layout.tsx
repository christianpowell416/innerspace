import { Stack } from 'expo-router';

export default function ConversationsLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="history" 
        options={{ 
          headerShown: false 
        }} 
      />
    </Stack>
  );
}