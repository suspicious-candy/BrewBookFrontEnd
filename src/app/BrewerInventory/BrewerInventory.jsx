// app/(tabs)/brewers.jsx
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

// ---------- API ----------
async function fetchBrewers() {
  const { data } = await apiClient.get('/brewers');
  return data; // array of Brewer documents
}

// ---------- Helpers ----------
function typeIconName(type) {
  switch (type) {
    case 'espresso':
      return 'flash';          // pressure
    case 'immersion':
      return 'water';          // steeping
    case 'Perculation':
      return 'funnel';         // pour-over
    default:
      return 'cafe-outline';
  }
}

function filterIconName(filter) {
  switch (filter) {
    case 'paper':  return 'document-outline';
    case 'metal':  return 'disc-outline';
    case 'cloth':  return 'shirt-outline';
    case 'N/A':    return 'remove-circle-outline';
    default:       return 'ellipse-outline';
  }
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- Screen ----------
export default function BrewerInventory() {
  const [sortAsc, setSortAsc] = useState(true);
  const [query, setQuery] = useState('');

  const { data: brewers, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['brewers'],
    queryFn: fetchBrewers,
  });

  const sortedBrewers = useMemo(() => {
    if (!brewers) return [];
    const filtered = brewers.filter((b) =>
      (b.Name ?? '').toLowerCase().includes(query.toLowerCase())
    );
    return [...filtered].sort((a, b) =>
      sortAsc
        ? (a.Name ?? '').localeCompare(b.Name ?? '')
        : (b.Name ?? '').localeCompare(a.Name ?? '')
    );
  }, [brewers, sortAsc, query]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Couldn't load your brewers.</Text>
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
        <Text style={styles.headerTitle}>Brewer Rack</Text>
        <Pressable onPress={() => setSortAsc((s) => !s)} hitSlop={10}>
          <Ionicons name="options-outline" size={22} color={INK} />
        </Pressable>
      </View>

      {/* Catalog metadata bar */}
      <View style={styles.metaBar}>
        <Text style={styles.metaText}>
          RACK // {sortedBrewers.length} ENTRIES
        </Text>
        <Text style={styles.metaText}>SORT: {sortAsc ? 'A-Z' : 'Z-A'}</Text>
      </View>

      {/* Search */}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search brewers..."
        placeholderTextColor="#9a9a9a"
        style={styles.search}
      />

      {/* Grid */}
      <FlatList
        data={sortedBrewers}
        keyExtractor={(item) => String(item._id ?? item.BrewerID)}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ padding: 12, paddingBottom: 100, gap: 10 }}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No brewers yet.</Text>
          </View>
        }
        renderItem={({ item }) => <BrewerCard brewer={item} />}
      />

      {/* Floating add button */}
      <Pressable style={styles.fab} onPress={() => router.push('/brewers/new')}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

// ---------- Card ----------
function BrewerCard({ brewer }) {
  const type = brewer.Type ?? '—';
  const filter = brewer.filterType ?? 'N/A';
  const hasLastBrew = !!brewer.lastBrew?.Note;

  return (
    <Pressable
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: '/brewers/[id]',
          params: { id: brewer.BrewerID },
        })
      }
    >
      <View style={styles.cardTop}>
        <Text style={styles.typeLabel} numberOfLines={1}>
          {type.toUpperCase()}
        </Text>
        <Ionicons name={typeIconName(type)} size={14} color="#5a5a5a" />
      </View>

      <Text style={styles.brewerName} numberOfLines={2}>
        {brewer.Name}
      </Text>

      <Text style={styles.idLabel} numberOfLines={1}>
        UNIT #{String(brewer.BrewerID).padStart(3, '0')}
      </Text>

      <View style={styles.filterRow}>
        <Ionicons name={filterIconName(filter)} size={12} color={MUTED} />
        <Text style={styles.filterText}>
          FILTER: <Text style={styles.filterStrong}>{filter.toUpperCase()}</Text>
        </Text>
      </View>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: hasLastBrew ? ACCENT : '#bdb6a4' },
          ]}
        />
        <Text style={styles.statusText}>
          {hasLastBrew ? 'BREWED RECENTLY' : 'AWAITING USE'}
        </Text>
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
const BORDER = '#cdc7b8';

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
    borderBottomColor: BORDER,
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
    borderColor: BORDER,
    color: INK,
  },

  card: {
    flex: 1,
    backgroundColor: CARD,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    minHeight: 150,
    justifyContent: 'space-between',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 10,
    color: ACCENT,
    letterSpacing: 1,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  brewerName: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    marginTop: 2,
  },
  idLabel: {
    fontSize: 10,
    color: MUTED,
    letterSpacing: 1,
    marginTop: 4,
  },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  filterText: { fontSize: 11, color: MUTED, letterSpacing: 0.5 },
  filterStrong: { color: INK, fontWeight: '700' },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, color: MUTED, letterSpacing: 1 },

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