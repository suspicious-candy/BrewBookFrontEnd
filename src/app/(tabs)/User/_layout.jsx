import { Stack } from 'expo-router';

/** Stack navigator for the User/Profile section. Headers hidden. */
export default function UserLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
