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
  Modal,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import apiClient from '@/api/client';
import { FONT_SERIF } from '@/constants/fonts';

// ---------- API ----------
// /brewers/me returns only the brewers the signed-in user has added to their
// collection. The full catalog lives at /brewers and is shown on the
// "Add a Brewer" screen reached via the FAB.
async function fetchMyBrewers() {
  const { data } = await apiClient.get('/brewers/me');
  return data;
}

// Notes feed the usage + recency sorts (count and most-recent brew per brewer).
async function fetchNotes() {
  const { data } = await apiClient.get('/notes');
  return data;
}

const SORT_MODES = [
  { key: 'name-asc',    label: 'Name (A–Z)',                short: 'A-Z' },
  { key: 'name-desc',   label: 'Name (Z–A)',                short: 'Z-A' },
  { key: 'type',        label: 'Type',                      short: 'TYPE' },
  { key: 'used-asc',    label: 'Least → Most Used',         short: 'USAGE' },
  { key: 'recency-asc', label: 'Least → Most Recently Used', short: 'RECENT' },
];

// ---------- Helpers ----------
/** Maps a brewer Type to an Ionicons glyph (flash = espresso, water = immersion, funnel = percolation). */
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

/** Maps a filter type (paper/metal/cloth/N/A) to an Ionicons glyph. */
function filterIconName(filter) {
  switch (filter) {
    case 'paper':  return 'document-outline';
    case 'metal':  return 'disc-outline';
    case 'cloth':  return 'shirt-outline';
    case 'N/A':    return 'remove-circle-outline';
    default:       return 'ellipse-outline';
  }
}

/** Capitalizes the first letter of a string. */
function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- Screen ----------
/**
 * My Brewers screen: a searchable, sortable grid of the brewers the user has
 * added to their collection (from /brewers/me). A FAB opens the full catalog to
 * add more; usage/recency sort modes are derived from the notes feed.
 */
export default function BrewerInventory() {
  const [sortMode, setSortMode] = useState('name-asc');
  const [sortOpen, setSortOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data: brewers, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['my-brewers'],
    queryFn: fetchMyBrewers,
  });

  const { data: notes } = useQuery({
    queryKey: ['notes'],
    queryFn: fetchNotes,
  });

  // count = how many notes reference each brewer; recency = newest note date.
  const { usage, recency } = useMemo(() => {
    const usage = new Map();
    const recency = new Map();
    notes?.forEach((n) => {
      const id = n.Recipe?.Brewer?._id;
      if (!id) return;
      usage.set(id, (usage.get(id) ?? 0) + 1);
      const t = n.Date ? new Date(n.Date).getTime() : 0;
      if (t > (recency.get(id) ?? 0)) recency.set(id, t);
    });
    return { usage, recency };
  }, [notes]);

  const sortedBrewers = useMemo(() => {
    if (!brewers) return [];
    const filtered = brewers.filter((b) =>
      (b.Name ?? '').toLowerCase().includes(query.toLowerCase())
    );
    const byName = (a, b) => (a.Name ?? '').localeCompare(b.Name ?? '');
    const arr = [...filtered];
    switch (sortMode) {
      case 'name-desc':
        return arr.sort((a, b) => byName(b, a));
      case 'type':
        return arr.sort(
          (a, b) => (a.Type ?? '').localeCompare(b.Type ?? '') || byName(a, b)
        );
      case 'used-asc':
        return arr.sort(
          (a, b) => (usage.get(a._id) ?? 0) - (usage.get(b._id) ?? 0) || byName(a, b)
        );
      case 'recency-asc':
        return arr.sort(
          (a, b) => (recency.get(a._id) ?? 0) - (recency.get(b._id) ?? 0) || byName(a, b)
        );
      case 'name-asc':
      default:
        return arr.sort(byName);
    }
  }, [brewers, sortMode, query, usage, recency]);

  const sortShort =
    SORT_MODES.find((m) => m.key === sortMode)?.short ?? '';

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
        <Text style={styles.headerTitle}>My Brewers</Text>
        <Pressable onPress={() => setSortOpen(true)} hitSlop={10}>
          <Ionicons name="options-outline" size={22} color={INK} />
        </Pressable>
      </View>

      {/* Catalog metadata bar */}
      <View style={styles.metaBar}>
        <Text style={styles.metaText}>
          RACK // {sortedBrewers.length} ENTRIES
        </Text>
        <Text style={styles.metaText}>SORT: {sortShort}</Text>
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
          <View style={styles.emptyState}>
            <Ionicons name="flask-outline" size={48} color={MUTED} />
            <Text style={styles.emptyTitle}>No brewers yet</Text>
            <Text style={styles.emptySub}>
              Tap the + button below to add brewers from the catalog.
            </Text>
          </View>
        }
        renderItem={({ item }) => <BrewerCard brewer={item} />}
      />

      {/* Floating add button → opens the catalog picker */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/BrewerInventory/catalog')}
        hitSlop={10}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Sort dropdown */}
      <SortModal
        visible={sortOpen}
        current={sortMode}
        onClose={() => setSortOpen(false)}
        onPick={(key) => {
          setSortMode(key);
          setSortOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

// ---------- Sort modal ----------
/** Bottom-sheet modal listing the available brewer sort modes. */
function SortModal({ visible, current, onClose, onPick }) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalLabel}>SORT BREWERS</Text>
          {SORT_MODES.map((m) => (
            <Pressable key={m.key} onPress={() => onPick(m.key)} style={styles.modalRow}>
              <Text
                style={[
                  styles.modalRowText,
                  m.key === current && styles.modalRowTextActive,
                ]}
              >
                {m.label}
              </Text>
              {m.key === current ? (
                <Ionicons name="checkmark" size={16} color={ACCENT} />
              ) : null}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------- Card ----------
/** Grid card for one brewer: type, name, unit number, filter, and last-used status. */
function BrewerCard({ brewer }) {
  const type = brewer.Type ?? '—';
  const filter = brewer.filterType ?? 'N/A';
  const hasLastBrew = !!brewer.lastBrew?.Note;

  return (
    <Pressable
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: '/BrewerInventory/[BrewerId]',
          params: { BrewerId: brewer.BrewerID },
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: INK, fontFamily: FONT_SERIF },

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
    fontFamily: FONT_SERIF,
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

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    letterSpacing: 1,
  },
  emptySub: {
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 18,
  },

  // sort modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 12, 8, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: CARD,
    paddingTop: 20,
    paddingBottom: 30,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  modalLabel: {
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 2,
    color: MUTED,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  modalRowText: { fontSize: 14, color: INK },
  modalRowTextActive: { color: ACCENT, fontWeight: '700' },
});