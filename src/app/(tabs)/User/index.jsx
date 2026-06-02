import { SafeAreaView, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import Profile from './[UserId]';
import { FONT_SERIF } from '@/constants/fonts';

/**
 * Profile tab: renders the signed-in user's Profile screen, or a sign-in prompt
 * when logged out (and a loader until auth state is ready).
 */
export default function ProfileTab() {
  const { isReady, isAuthenticated } = useAuth();

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color="#c0432b" />
      </SafeAreaView>
    );
  }

  if (isAuthenticated) {
    return <Profile />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.row}>
        <Text style={styles.label}>STATUS</Text>
        <Text style={styles.value}>Signed out</Text>
      </View>

      <Pressable style={styles.btn} onPress={() => router.push('/Login/Login')}>
        <Text style={styles.btnText}>Sign in</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: 24, backgroundColor: '#f3eee5' },
  title: { fontSize: 22, fontWeight: '700', color: '#1f1f1f', marginBottom: 24, fontFamily: FONT_SERIF },
  row: { marginBottom: 24 },
  label: { fontSize: 11, color: '#6b6b6b', letterSpacing: 1, marginBottom: 4 },
  value: { fontSize: 16, color: '#1f1f1f' },
  btn: {
    backgroundColor: '#c0432b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  btnText: { color: '#fff', fontWeight: '600' },
});
