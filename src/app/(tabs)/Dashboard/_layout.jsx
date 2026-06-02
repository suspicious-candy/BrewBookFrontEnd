import { Stack } from 'expo-router';

/** Stack navigator for the Dashboard section. Headers hidden. */
export default function DashboardLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
