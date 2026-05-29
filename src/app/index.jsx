import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';

// Entry route for "/". Without this, a cold start has no concrete match and
// expo-router falls through to the first tab (Beans). Redirecting here lands
// the app on the Dashboard for signed-in users regardless of tab order.
export default function Index() {
  const { isReady, isAuthenticated } = useAuth();

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#c0432b" />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/Dashboard' : '/Login/Login'} />;
}
