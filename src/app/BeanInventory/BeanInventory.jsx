// app/(tabs)/library.jsx
import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import apiClient from '@/src/api/client';

// Assumed default bag size since the schema has no capacity field.
// Adjust or add a `capacity` field to your schema if you want it accurate.
const DEFAULT_CAPACITY_G = 250;

// ---------- API ----------
async function fetchBeans() {
  const { data } = await apiClient.get('/beans');
  return data; // array of bean documents (see schema)
}

// ---------- Helpers ----------
function roastIconName(roast) {
  switch (roast) {
    case 'french':
    case 'dark':
    case 'dark-medium':
      return 'moon';
    case 'medium':
      return 'contrast';
    case 'medium-light':
    case 'light':
      return 'sunny';
    case 'green':
      return 'leaf';
    default:
      return 'ellipse-outline';
  }
}

function originLabel(origin) {
  if (!origin) return '';
  const country = origin.Country && origin.Country !== 'none' ? origin.Country : '';
  const region = origin.Region && origin.Region !== 'none' ? origin.Region : '';
  if (country && region) return `${country.toUpperCase()} // ${region.toUpperCase()}`;
  if (country) return country.toUpperCase();
  if (region) return region.toUpperCase();
  return 'ORIGIN UNKNOWN';
}

// ---------- Screen ----------
export default function BeanInventory() {
  const [sortAsc, setSortAsc] = useState(true);
  const [query, setQuery] = useState('');

  const { data: beans, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['beans'],
    queryFn: fetchBeans,
  });

  const sortedBeans = useMemo(() => {
    if (!beans) return [];
    const filtered = beans.filter((b) =>
      (b.Name ?? '').toLowerCase().includes(query.toLowerCase())
    );
    return [...filtered].sort((a, b) =>
      sortAsc
        ? (a.Name ?? '').localeCompare(b.Name ?? '')
        : (b.Name ?? '').localeCompare(a.Name ?? '')
    );
  }, [beans, sortAsc, query]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#c0432b" />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Couldn't load your bean library.</Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bean Library</Text>
        <Pressable onPress={() => setSortAsc((s) => !s)} hitSlop={10}>
          <Ionicons name="options-outline" size={22} color="#222" />
        </Pressable>
      </View>

      {/* Catalog metadata bar */}
      <View style={styles.metaBar}>
        <Text style={styles.metaText}>
          CATALOG // {sortedBeans.length} ENTRIES
        </Text>
        <Text style={styles.metaText}>SORT: {sortAsc ? 'A-Z' : 'Z-A'}</Text>
      </View>

      {/* Optional search */}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search beans..."
        placeholderTextColor="#9a9a9a"
        style={styles.search}
      />

      {/* Grid */}
      <FlatList
        data={sortedBeans}
        keyExtractor={(item) => String(item._id ?? item.beanId)}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ padding: 12, paddingBottom: 100, gap: 10 }}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No beans yet.</Text>
          </View>
        }
        renderItem={({ item }) => <BeanCard bean={item} />}
      />

      {/* Floating add button */}
      <Pressable style={styles.fab} onPress={() => router.push('/beans/new')}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

// ---------- Card ----------
function BeanCard({ bean }) {
  const remaining = bean.Quantity ?? 0;
  const pct = Math.max(0, Math.min(1, remaining / DEFAULT_CAPACITY_G));
  const roast = bean.tasteProfile?.Roast ?? 'none';
  const notes = bean.tasteProfile?.tastingNotes?.join(', ') || 'No notes';

  return (
    <Pressable
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: '/beans/[id]',
          params: { id: bean.beanId },
        })
      }
    >
      <View style={styles.cardTop}>
        <Text style={styles.roaster} numberOfLines={1}>
          {originLabel(bean.Origin)}
        </Text>
        <Ionicons name={roastIconName(roast)} size={14} color="#5a5a5a" />
      </View>

      <Text style={styles.beanName} numberOfLines={2}>
        {bean.Name}
      </Text>

      <Text style={styles.beanMeta} numberOfLines={1}>
        {(bean.Process ?? 'wash')} // {notes}
      </Text>

      {bean.Varietal ? (
        <Text style={styles.varietal} numberOfLines={1}>
          {bean.Varietal}
        </Text>
      ) : null}

      <View style={styles.depletionBox}>
        <Text style={styles.depletionLabel}>
          DEPLETION{' '}
          <Text style={styles.depletionGrams}>{remaining}G LEFT</Text>
        </Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
        </View>
      </View>
    </Pressable>
  );
}

// ---------- Styles ----------
const CREAM = '#f3eee5';
const CARD = '#faf6ed';
const ACCENT = '#c0432b';
const INK = '#1f1f1f';
const MUTED = '#6b6b6b';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#cdc7b8',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: INK },

  metaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  metaText: { fontSize: 11, color: MUTED, letterSpacing: 1 },

  search: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cdc7b8',
    color: INK,
  },

  card: {
    flex: 1,
    backgroundColor: CARD,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cdc7b8',
    minHeight: 140,
    justifyContent: 'space-between',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  roaster: {
    fontSize: 10,
    color: ACCENT,
    letterSpacing: 1,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  beanName: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    marginTop: 2,
  },
  beanMeta: {
    fontSize: 12,
    color: MUTED,
    marginTop: 4,
  },
  varietal: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
    fontStyle: 'italic',
  },

  depletionBox: { marginTop: 10 },
  depletionLabel: { fontSize: 10, color: MUTED, letterSpacing: 0.5 },
  depletionGrams: { color: INK, fontWeight: '700' },
  barTrack: {
    height: 3,
    backgroundColor: '#dcd6c5',
    marginTop: 4,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: ACCENT },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 4,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  errorText: { color: INK, marginBottom: 12 },
  retryBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  emptyText: { color: MUTED, marginTop: 40 },
});