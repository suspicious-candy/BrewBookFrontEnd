// app/profile.jsx  (or app/(tabs)/profile.jsx if it lives in the tab bar)
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/api/client';
import { FONT_SERIF } from '@/constants/fonts';

// ---------- API ----------
async function fetchMe() {
  const { data } = await apiClient.get('/users/me');
  return data;
}

async function fetchStats() {
  const { data } = await apiClient.get('/users/me/stats');
  return data; // { totalBrews, uniqueBeans, activeStreak, avgRating, favoriteBean }
}

// ---------- Helpers ----------
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
  }).toUpperCase();
}

// ---------- Screen ----------
export default function Profile() {
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['me-stats'],
    queryFn: fetchStats,
  });

  if (userLoading || !user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  const fullName = `${user.firstName} ${user.lastName}`.toUpperCase();
  const level = (user.userLevel || 'Bean Sprout').toUpperCase();

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={INK} />
        </Pressable>
        <Text style={styles.topTitle}>PROFILE</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Identity card */}
        <View style={styles.identity}>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.level}>LEVEL: {level}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsBox}>
          <StatRow
            num="01"
            label="TOTAL BREWS"
            value={stats?.totalBrews ?? '—'}
            loading={statsLoading}
          />
          <StatRow
            num="02"
            label="UNIQUE BEANS"
            value={stats?.uniqueBeans ?? '—'}
            loading={statsLoading}
          />
          <StatRow
            num="03"
            label="ACTIVE STREAK"
            value={stats?.activeStreak ?? '—'}
            loading={statsLoading}
          />
          <StatRow
            num="04"
            label="AVG RATING"
            value={stats?.avgRating != null ? stats.avgRating.toFixed(1) : '—'}
            loading={statsLoading}
          />
        </View>

        {/* Preferences */}
        <SectionHeader label="PREFERENCES" />
        <View style={styles.prefBox}>
          <PrefRow label="FAVORITE BEAN" value={stats?.favoriteBean || '—'} />
          <PrefRow label="FAVORITE BREWER" value={stats?.favoriteBrewer || '—'} />
          <PrefRow label="MOST USED RECIPE" value={stats?.favoriteRecipe || '—'} />
        </View>

        {/* Account metadata */}
        <SectionHeader label="ACCOUNT" />
        <View style={styles.prefBox}>
          <PrefRow label="MEMBER SINCE" value={fmtDate(user.createdAt)} />
          <PrefRow label="LAST LOGIN"   value={fmtDate(user.LoginData?.lastLogin)} />
        </View>

        {/* Sign out */}
        <View style={{ padding: 14, marginTop: 14 }}>
          <Pressable
            style={styles.signOutBtn}
            onPress={() => router.replace('/Login/Login')}
          >
            <Ionicons name="log-out-outline" size={16} color={ACCENT} />
            <Text style={styles.signOutText}>SIGN OUT</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------- Subcomponents ----------
function SectionHeader({ label }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{label}</Text>
    </View>
  );
}

function StatRow({ num, label, value, loading }) {
  return (
    <View style={styles.statRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.statNum}>METRIC {num}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <View style={styles.statValueBox}>
        {loading ? (
          <ActivityIndicator size="small" color={ACCENT} />
        ) : (
          <Text style={styles.statValue}>{value}</Text>
        )}
      </View>
    </View>
  );
}

function PrefRow({ label, value, onPress }) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={styles.prefRow}>
      <Text style={styles.prefLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={styles.prefValue} numberOfLines={1}>{value}</Text>
        {onPress ? (
          <Ionicons name="chevron-forward" size={14} color={MUTED} />
        ) : null}
      </View>
    </Wrapper>
  );
}

// ---------- Styles ----------
const CREAM = '#f3eee5';
const CARD = '#faf6ed';
const TINT = '#f1dad2';
const ACCENT = '#c0432b';
const INK = '#1f1f1f';
const MUTED = '#6b6b6b';
const BORDER = '#cdc7b8';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 24, backgroundColor: CREAM,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  topTitle: {
    fontSize: 12, letterSpacing: 3, color: INK, fontWeight: '700',
  },

  identity: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  name: {
    fontSize: 20, color: INK, fontWeight: '700', letterSpacing: 1.5,
    fontFamily: FONT_SERIF,
  },
  level: {
    fontSize: 11, color: MUTED, letterSpacing: 2, fontWeight: '600',
    marginTop: 6,
  },
  email: { fontSize: 11, color: MUTED, marginTop: 10 },

  statsBox: {
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  statNum: {
    fontSize: 10, color: MUTED, letterSpacing: 1.5, fontWeight: '600',
    paddingLeft: 14, paddingTop: 12,
  },
  statLabel: {
    fontSize: 13, color: INK, fontWeight: '700',
    paddingLeft: 14, paddingBottom: 12, paddingTop: 2,
  },
  statValueBox: {
    width: 90,
    paddingVertical: 18,
    backgroundColor: TINT,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: BORDER,
  },
  statValue: { fontSize: 22, color: INK, fontWeight: '700' },

  sectionHeader: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#e9e3d4',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  sectionHeaderText: {
    fontSize: 10, letterSpacing: 1.5, color: INK, fontWeight: '700',
  },

  prefBox: {
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  prefLabel: {
    fontSize: 11, color: MUTED, letterSpacing: 1, fontWeight: '600',
  },
  prefValue: {
    fontSize: 12, color: INK, fontWeight: '600', maxWidth: 200,
  },

  signOutBtn: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    color: ACCENT, fontWeight: '700', letterSpacing: 1.5, fontSize: 12,
  },
});