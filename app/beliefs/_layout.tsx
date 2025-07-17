import { Stack } from 'expo-router';

export default function BeliefsLayout() {
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