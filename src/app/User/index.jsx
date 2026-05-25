import { SafeAreaView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '@/auth/AuthContext';

export default function ProfileTab() {
  const { isReady, isAuthenticated, signIn, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.row}>
        <Text style={styles.label}>STATUS</Text>
        <Text style={styles.value}>
          {!isReady ? 'Loading…' : isAuthenticated ? 'Signed in' : 'Signed out'}
        </Text>
      </View>

      <Pressable
        style={styles.btn}
        onPress={() => (isAuthenticated ? signOut() : signIn())}
        disabled={!isReady}
      >
        <Text style={styles.btnText}>{isAuthenticated ? 'Sign out' : 'Sign in'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: 24, backgroundColor: '#f3eee5' },
  title: { fontSize: 22, fontWeight: '700', color: '#1f1f1f', marginBottom: 24 },
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
