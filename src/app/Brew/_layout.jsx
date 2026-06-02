import { Stack } from 'expo-router';

/** Stack navigator for the guided Brew flow (selection → config → session → log). Headers hidden. */
export default function BrewLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
