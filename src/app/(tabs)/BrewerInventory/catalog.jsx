// app/(tabs)/BrewerInventory/catalog.jsx
// Reached from My Brewers FAB → "+". Shows every brewer in the global
// catalog; tapping one adds it to the signed-in user's collection.
import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/api/client';
import { FONT_SERIF } from '@/constants/fonts';

// ---------- API ----------
/** Fetches the full brewer catalog (all brewers). */
async function fetchCatalog() {
  const { data } = await apiClient.get('/brewers');
  return data;
}

/** Fetches the user's brewer collection (used to mark which catalog items are already added). */
async function fetchMyBrewers() {
  const { data } = await apiClient.get('/brewers/me');
  return data;
}

/** Adds a catalog brewer (by BrewerID) to the user's collection. */
async function addBrewerToCollection(brewerId) {
  const { data } = await apiClient.post(`/brewers/me/${brewerId}`);
  return data;
}

// ---------- Helpers ----------
/** Maps a brewer Type to an Ionicons glyph. */
function typeIconName(type) {
  switch (type) {
    case 'espresso':    return 'flash';
    case 'immersion':   return 'water';
    case 'Perculation': return 'funnel';
    default:            return 'cafe-outline';
  }
}
/** Capitalizes the first letter of a string. */
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// ---------- Screen ----------
/**
 * Brewer catalog screen: lists every brewer in the global catalog with search.
 * Brewers already in the user's collection show an "ADDED" pill; the rest get an
 * Add button that posts to /brewers/me.
 */
export default function BrewerCatalog() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');

  const { data: catalog, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['brewers-catalog'],
    queryFn: fetchCatalog,
  });

  const { data: mine } = useQuery({
    queryKey: ['my-brewers'],
    queryFn: fetchMyBrewers,
  });

  const ownedIds = useMemo(() => {
    const set = new Set();
    (mine ?? []).forEach((b) => set.add(b.BrewerID));
    return set;
  }, [mine]);

  const addMutation = useMutation({
    mutationFn: addBrewerToCollection,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-brewers'] });
    },
    onError: (err) => {
      const msg =
        err?.response?.data?.message ?? err?.message ?? 'Could not add brewer.';
      Alert.alert('Could not add brewer', msg);
    },
  });

  const sorted = useMemo(() => {
    if (!catalog) return [];
    return catalog
      .filter((b) =>
        (b.Name ?? '').toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => (a.Name ?? '').localeCompare(b.Name ?? ''));
  }, [catalog, query]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn't load the catalog.</Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={INK} />
        </Pressable>
        <Text style={styles.topTitle}>ADD A BREWER</Text>
        <View style={{ width: 20 }} />
      </View>

      {/* Search */}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search catalog..."
        placeholderTextColor={MUTED}
        style={styles.search}
      />

      <FlatList
        data={sorted}
        keyExtractor={(item) => String(item._id ?? item.BrewerID)}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No brewers in the catalog.</Text>
        }
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => (
          <CatalogRow
            brewer={item}
            isOwned={ownedIds.has(item.BrewerID)}
            isAdding={
              addMutation.isPending &&
              addMutation.variables === item.BrewerID
            }
            onAdd={() => addMutation.mutate(item.BrewerID)}
          />
        )}
      />
    </View>
  );
}

// ---------- Row ----------
/** A catalog row: brewer name/type/filter, with an Add button or an "ADDED" pill. */
function CatalogRow({ brewer, isOwned, isAdding, onAdd }) {
  const type = brewer.Type ?? '—';
  const filter = brewer.filterType ?? 'N/A';

  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={typeIconName(type)} size={20} color={ACCENT} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.brewerName} numberOfLines={1}>
          {brewer.Name}
        </Text>
        <Text style={styles.brewerMeta} numberOfLines={1}>
          {capitalize(type)} • Filter: {filter.toUpperCase()}
        </Text>
      </View>

      {isOwned ? (
        <View style={styles.addedPill}>
          <Ionicons name="checkmark" size={14} color={ACCENT} />
          <Text style={styles.addedText}>ADDED</Text>
        </View>
      ) : (
        <Pressable
          style={[styles.addBtn, isAdding && styles.addBtnDisabled]}
          onPress={onAdd}
          disabled={isAdding}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={styles.addText}>ADD</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
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
    fontSize: 14,
    letterSpacing: 2,
    color: INK,
    fontWeight: '700',
    fontFamily: FONT_SERIF,
  },

  search: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    color: INK,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: CARD,
  },
  rowIcon: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: '#f5dfd9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brewerName: {
    fontSize: 14,
    color: INK,
    fontWeight: '700',
    fontFamily: FONT_SERIF,
  },
  brewerMeta: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: ACCENT,
    borderRadius: 4,
    minWidth: 64,
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.6 },
  addText: {
    color: '#fff',
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
  },

  addedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT,
    borderRadius: 4,
  },
  addedText: {
    color: ACCENT,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
  },

  emptyText: {
    color: MUTED,
    textAlign: 'center',
    marginTop: 40,
  },

  errorText: { color: INK, marginBottom: 12 },
  retryBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
  },
  retryText: { color: '#fff', fontWeight: '600' },
});
