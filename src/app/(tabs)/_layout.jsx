import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// expo-router reads this on first mount to decide which tab is selected
// before any navigation has happened.
export const unstable_settings = {
  initialRouteName: 'Dashboard',
};

export default function TabsLayout() {
  return (
    <Tabs
      // Order shown left → right in the tab bar.
      // Order: Beans · Brewers · Dashboard · Notes · Profile
      screenOptions={{ headerShown: false, tabBarActiveTintColor: '#c0432b' }}
    >
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
        name="Dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
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
    </Tabs>
  );
}
