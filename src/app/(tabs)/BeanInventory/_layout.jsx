import { Stack } from 'expo-router';

/** Stack navigator for the Bean Inventory section (list, detail, add). Headers hidden. */
export default function BeanInventoryLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
