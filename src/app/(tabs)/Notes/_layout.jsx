import { Stack } from 'expo-router';

/** Stack navigator for the Notes section (journal list + note detail). Headers hidden. */
export default function NotesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
