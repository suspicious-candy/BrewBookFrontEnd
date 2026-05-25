import { useState } from 'react';
import { useColorScheme } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from '@/auth/AuthContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [queryClient] = useState(() => new QueryClient());

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#c0432b' }}>
            <Tabs.Screen
              name="(home)"
              options={{
                title: 'Home',
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="home-outline" size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="BeanInventory"
              options={{
                title: 'Beans',
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="cafe-outline" size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="BrewerInventory"
              options={{
                title: 'Brewers',
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="flask-outline" size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="Notes"
              options={{
                title: 'Notes',
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="book-outline" size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="User"
              options={{
                title: 'Profile',
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="person-outline" size={size} color={color} />
                ),
              }}
            />

            {/* Routes that exist in src/app but should NOT appear in the tab bar */}
            <Tabs.Screen name="Login" options={{ href: null }} />
            <Tabs.Screen name="Brew" options={{ href: null }} />
            <Tabs.Screen name="Recipe" options={{ href: null }} />
          </Tabs>
        </ThemeProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
