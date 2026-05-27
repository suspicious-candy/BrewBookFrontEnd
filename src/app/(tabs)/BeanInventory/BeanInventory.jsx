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
  Modal,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import apiClient from '@/api/client';
import { FONT_SERIF } from '@/constants/fonts';

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
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const { data: beans, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['beans'],
    queryFn: fetchBeans,
  });

  const sortedBeans = useMemo(() => {
    if (!beans) return [];
    const filtered = beans.filter((b) =>
      (b.details?.Name ?? '').toLowerCase().includes(query.toLowerCase())
    );
    return [...filtered].sort((a, b) =>
      sortAsc
        ? (a.details?.Name ?? '').localeCompare(b.details?.Name ?? '')
        : (b.details?.Name ?? '').localeCompare(a.details?.Name ?? '')
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
      <Pressable
        style={styles.fab}
        onPress={() => setAddMenuOpen(true)}
        hitSlop={10}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Add-bean choice modal */}
      <Modal
        visible={addMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddMenuOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAddMenuOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>ADD A BEAN</Text>

            <Pressable
              style={styles.modalOption}
              onPress={() => {
                setAddMenuOpen(false);
                // TODO: wire to scanner screen when it exists
              }}
            >
              <Ionicons name="scan-outline" size={20} color={INK} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOptionTitle}>Open Scanner</Text>
                <Text style={styles.modalOptionSub}>Capture bag info with the camera</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={MUTED} />
            </Pressable>

            <Pressable
              style={styles.modalOption}
              onPress={() => {
                setAddMenuOpen(false);
                router.push('/BeanInventory/addBean');
              }}
            >
              <Ionicons name="create-outline" size={20} color={INK} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOptionTitle}>Add Manually</Text>
                <Text style={styles.modalOptionSub}>Enter the bean details by hand</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={MUTED} />
            </Pressable>

            <Pressable
              style={styles.modalCancel}
              onPress={() => setAddMenuOpen(false)}
            >
              <Text style={styles.modalCancelText}>CANCEL</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

// ---------- Card ----------
function BeanCard({ bean }) {
  const d = bean.details ?? {};
  const remaining = bean.Quantity ?? 0;
  const pct = Math.max(0, Math.min(1, remaining / DEFAULT_CAPACITY_G));
  const roast = d.tasteProfile?.Roast ?? 'none';
  const notes = d.tasteProfile?.tastingNotes?.join(', ') || 'No notes';
  const isEmpty = remaining <= 0;

  return (
    <Pressable
      style={[styles.card, isEmpty && styles.cardEmpty]}
      onPress={() =>
        router.push({
          pathname: '/BeanInventory/[BeanId]',
          params: { BeanId: bean.beanId },
        })
      }
    >
      <View style={styles.cardTop}>
        <Text style={styles.roaster} numberOfLines={1}>
          {originLabel(d.Origin)}
        </Text>
        <Ionicons name={roastIconName(roast)} size={14} color="#5a5a5a" />
      </View>

      <Text
        style={[styles.beanName, isEmpty && styles.textEmpty]}
        numberOfLines={2}
      >
        {d.Name}
      </Text>

      <Text style={styles.beanMeta} numberOfLines={1}>
        {(d.Process ?? 'wash')} // {notes}
      </Text>

      {d.Varietal ? (
        <Text style={styles.varietal} numberOfLines={1}>
          {d.Varietal}
        </Text>
      ) : null}

      {isEmpty ? (
        <View style={styles.depletedBadge}>
          <Ionicons name="alert-circle" size={12} color="#fff" />
          <Text style={styles.depletedBadgeText}>DEPLETED</Text>
        </View>
      ) : null}

      <View style={styles.depletionBox}>
        <Text
          style={[styles.depletionLabel, isEmpty && styles.textEmpty]}
        >
          DEPLETION{' '}
          <Text
            style={[styles.depletionGrams, isEmpty && styles.textEmpty]}
          >
            {remaining}G LEFT
          </Text>
        </Text>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${pct * 100}%` },
              isEmpty && styles.barFillEmpty,
            ]}
          />
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
    fontFamily: FONT_SERIF,
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: CREAM,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#cdc7b8',
  },
  modalTitle: {
    fontSize: 11,
    letterSpacing: 2,
    color: MUTED,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: CARD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cdc7b8',
    marginBottom: 10,
  },
  modalOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },
  modalOptionSub: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },
  modalCancel: {
    marginTop: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: ACCENT,
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 12,
  },

  cardEmpty: {
    backgroundColor: '#fbe6e0',
    borderColor: ACCENT,
  },
  textEmpty: { color: ACCENT },
  depletedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: ACCENT,
    marginTop: 6,
  },
  depletedBadgeText: {
    color: '#fff',
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  barFillEmpty: {
    backgroundColor: ACCENT,
    opacity: 1,
  },
});