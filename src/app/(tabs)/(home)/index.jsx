// app/index.jsx
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router, Stack, Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { FONT_SERIF } from '@/constants/fonts';

// ---------- API ----------
async function fetchDashboard() {
  const { data } = await apiClient.get('/dashboard');
  return data;
  /* expected shape:
  {
    user:        { firstName, lastName, ... },
    lastBrew:    { ID, Date, overallRating, CoffeeIn, WaterIn, BrewTime,
                   Recipe: { ID, Brewer: { Name }, bean: { Name, Quantity, beanId } } },
    brewsToday:  number,
    streak:      number,
    beanSupply:  { name, beanId, remaining, capacity }  // for the progress bar
  } */
}

// ---------- Helpers ----------
function timeAgo(date) {
  if (!date) return '—';
  const ms = Date.now() - new Date(date).getTime();
  const mins  = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins  < 1)   return 'JUST NOW';
  if (mins  < 60)  return `${mins} MIN${mins  === 1 ? '' : 'S'} AGO`;
  if (hours < 24)  return `${hours} HOUR${hours === 1 ? '' : 'S'} AGO`;
  if (days  < 7)   return `${days} DAY${days  === 1 ? '' : 'S'} AGO`;
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: '2-digit',
  }).toUpperCase();
}

function fmtSeconds(s) {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function initialsOf(user) {
  if (!user) return '—';
  const a = user.firstName?.[0] ?? '';
  const b = user.lastName?.[0]  ?? '';
  return (a + b).toUpperCase() || '—';
}

// ---------- Screen ----------
export default function Dashboard() {
  const { isAuthenticated, isReady } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    enabled: isAuthenticated,
  });

  // Wait for tokens to hydrate from SecureStore before deciding anything.
  if (!isReady) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }
    console.log(isAuthenticated);

  // Auth gate: <Redirect> works during render, unlike router.replace in useEffect.
  if (!isAuthenticated) {
    return <Redirect href="/Login/Login" />;
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn't load dashboard.</Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const { user, lastBrew, brewsToday, streak, beanSupply } = data;
  const beanName   = lastBrew?.Recipe?.bean?.Name   || 'Unknown Bean';
  const brewerName = lastBrew?.Recipe?.Brewer?.Name || 'Unknown Brewer';
  console.log(data);

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>LEDGER</Text>
        <Pressable
          onPress={() => router.push('/User')}
          style={styles.initialsChip}
          hitSlop={10}
        >
          <Text style={styles.initialsText}>{initialsOf(user)}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Last Brew card */}
        <Pressable
          style={styles.lastBrewCard}
          onPress={() =>
            lastBrew?.ID
              ? router.push({
                  pathname: '/Notes/[NotesId]',
                  params: { NotesId: lastBrew.ID },
                })
              : null
          }
        >
          <Text style={styles.lastBrewLabel}>
            LAST BREW  •  {timeAgo(lastBrew?.Date)}
          </Text>
          <Text style={styles.beanName}>{beanName}</Text>
          <Text style={styles.brewMeta}>
            {brewerName}
            {lastBrew?.CoffeeIn != null && ` • ${lastBrew.CoffeeIn}g in / ${lastBrew.WaterIn}g out`}
            {lastBrew?.BrewTime != null && ` • ${fmtSeconds(lastBrew.BrewTime)}`}
          </Text>

          {/* Rating row (TDS removed) */}
          <View style={styles.ratingRow}>
            <Text style={styles.metricLabel}>RATING</Text>
            <StarRating value={lastBrew?.overallRating} />
          </View>

          {/* Bean supply bar */}
          {beanSupply ? (
            <View style={styles.supplyBlock}>
              <View style={styles.supplyHeader}>
                <Text style={styles.metricLabel}>Bean Supply</Text>
                <Text style={styles.supplyRemaining}>
                  {beanSupply.remaining}g remaining
                </Text>
              </View>
              <View style={styles.supplyTrack}>
                <View
                  style={[
                    styles.supplyFill,
                    {
                      width: `${Math.max(0, Math.min(1,
                        (beanSupply.remaining ?? 0) / (beanSupply.capacity || 250)
                      )) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}
        </Pressable>

        {/* DAILY STATISTICS */}
        <SectionHeader label="DAILY STATISTICS" />
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>BREWS TODAY</Text>
            <Text style={styles.statValue}>{brewsToday ?? 0}</Text>
          </View>
          <View style={[styles.statCell, styles.statCellRight]}>
            <Text style={styles.statLabel}>STREAK</Text>
            <Text style={styles.statValue}>{streak ?? 0} days</Text>
          </View>
        </View>

        {/* QUICK ACTIONS */}
        <SectionHeader label="QUICK ACTIONS" />
        <View style={styles.actionsBox}>
          <ActionRow
            icon="scan-outline"
            title="Scan Beans"
            subtitle="Digitize new bag via OCR"
            disabled
          />
          <ActionRow
            icon="add-circle-outline"
            title="New Brew"
            subtitle="Start a new extraction log"
            onPress={() => router.push('/BrewerInventory')}
          />
          <ActionRow
            icon="newspaper-outline"
            title="Read News"
            subtitle="Latest from the roaster (Offline)"
            disabled
          />
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

function ActionRow({ icon, title, subtitle, onPress, disabled }) {
  const Wrapper = disabled ? View : Pressable;
  return (
    <Wrapper
      style={[styles.actionRow, disabled && styles.actionRowDim]}
      onPress={disabled ? undefined : onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionTitle, disabled && styles.textDim]}>{title}</Text>
        <Text style={[styles.actionSubtitle, disabled && styles.textDim]}>{subtitle}</Text>
      </View>
      <View style={styles.actionIconBox}>
        <Ionicons name={icon} size={18} color={disabled ? MUTED : INK} />
      </View>
    </Wrapper>
  );
}

function StarRating({ value }) {
  // Assumes overallRating is on a 0-10 scale; convert to 5 stars.
  const stars5 = value != null ? Math.round((value / 10) * 5) : 0;
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= stars5 ? 'star' : 'star-outline'}
          size={14}
          color={ACCENT}
        />
      ))}
    </View>
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
    fontSize: 16, letterSpacing: 3, color: INK, fontWeight: '700',
    fontFamily: FONT_SERIF,
  },
  initialsChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  initialsText: { fontSize: 10, color: INK, fontWeight: '700', letterSpacing: 1 },

  lastBrewCard: {
    margin: 14,
    padding: 14,
    backgroundColor: CARD,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  lastBrewLabel: {
    fontSize: 10, color: ACCENT, letterSpacing: 1.5, fontWeight: '700',
  },
  beanName: {
    fontSize: 17, color: INK, fontWeight: '700', marginTop: 6,
    fontFamily: FONT_SERIF,
  },
  brewMeta: {
    fontSize: 12, color: MUTED, marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  metricLabel: { fontSize: 11, color: MUTED, letterSpacing: 1, fontWeight: '600' },

  supplyBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  supplyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  supplyRemaining: { fontSize: 12, color: INK, fontWeight: '700' },
  supplyTrack: {
    height: 4,
    backgroundColor: '#f1d9d3',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT,
    overflow: 'hidden',
  },
  supplyFill: { height: '100%', backgroundColor: ACCENT, opacity: 0.55 },

  sectionHeader: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#e9e3d4',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  sectionHeaderText: {
    fontSize: 10, letterSpacing: 1.5, color: INK, fontWeight: '700',
  },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  statCell: { flex: 1, paddingVertical: 18, paddingHorizontal: 14 },
  statCellRight: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: BORDER,
  },
  statLabel: { fontSize: 10, color: MUTED, letterSpacing: 1.5, fontWeight: '600' },
  statValue: { fontSize: 22, color: INK, fontWeight: '700', marginTop: 24, textAlign: 'center' },

  actionsBox: {
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  actionRowDim: { backgroundColor: '#ece6d6' },
  actionTitle: { fontSize: 13, color: INK, fontWeight: '700', paddingHorizontal: 14, paddingTop: 12 },
  actionSubtitle: { fontSize: 11, color: MUTED, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 2 },
  actionIconBox: {
    width: 56,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: BORDER,
  },
  textDim: { color: MUTED },

  errorText: { color: INK, marginBottom: 12 },
  retryBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '600' },
});