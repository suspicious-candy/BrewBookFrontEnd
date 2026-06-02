import { Stack } from 'expo-router';

/** Stack navigator for the auth screens (sign in, create account). Headers hidden. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
