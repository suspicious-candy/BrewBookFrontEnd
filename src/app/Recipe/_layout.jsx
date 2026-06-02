import { Stack } from 'expo-router';

/** Stack navigator for the Recipe editor section. Headers hidden. */
export default function RecipeLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
