import { Stack } from 'expo-router';

/** Stack navigator for the Brewer Inventory section (list, detail, catalog). Headers hidden. */
export default function BrewerInventoryLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
