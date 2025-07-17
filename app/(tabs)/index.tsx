import { Redirect } from 'expo-router';

// Default redirect to home tab
export default function TabsIndex() {
  return <Redirect href="/(tabs)/home" />;
}