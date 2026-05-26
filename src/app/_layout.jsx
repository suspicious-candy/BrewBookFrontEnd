import { useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { AuthProvider } from '@/auth/AuthContext';
import { applyGlobalFontDefaults } from '@/constants/fonts';

applyGlobalFontDefaults();

// Adds the device's top safe-area inset (status bar / notch) as padding
// so no screen content can hide behind the OS chrome.
function RootStack() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="Login" />
        <Stack.Screen name="Brew" />
        <Stack.Screen name="Recipe" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <RootStack />
          </ThemeProvider>
        </QueryClientProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
