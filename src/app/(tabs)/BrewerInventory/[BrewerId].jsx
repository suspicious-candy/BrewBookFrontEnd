// app/brewers/[id].jsx
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/api/client';
import { FONT_SERIF } from '@/constants/fonts';

const FILTER_OPTIONS = ['paper', 'metal', 'cloth', 'N/A'];

// ---------- API ----------
async function fetchBrewer(id) {
  const { data } = await apiClient.get(`/brewers/${id}`);
  return data;
}

async function fetchRecipesForBrewer(id) {
  const { data } = await apiClient.get(`/recipes/brewer/${id}`);
  return data;
}

async function updateBrewer({ id, patch }) {
  const { data } = await apiClient.put(`/brewers/${id}`, patch);
  return data;
}

// ---------- Helpers ----------
function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function splitName(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return { brand: name.toUpperCase(), model: '' };
  return {
    brand: parts[0].toUpperCase(),
    model: parts.slice(1).join(' '),
  };
}

function paramEntries(tracked) {
  if (!tracked) return [];
  if (tracked instanceof Map) return Array.from(tracked.entries());
  return Object.entries(tracked);
}

function ratioOf(coffee, water) {
  if (!coffee || !water) return null;
  const r = (water / coffee).toFixed(1).replace(/\.0$/, '');
  return `1:${r}`;
}

function typeIconName(type) {
  switch (type) {
    case 'espresso':    return 'flash';
    case 'immersion':   return 'water';
    case 'Perculation': return 'funnel';
    default:            return 'cafe-outline';
  }
}

function filterIconName(filter) {
  switch (filter) {
    case 'paper': return 'document-outline';
    case 'metal': return 'disc-outline';
    case 'cloth': return 'shirt-outline';
    case 'N/A':   return 'remove-circle-outline';
    default:      return 'ellipse-outline';
  }
}

// ---------- Screen ----------
export default function BrewerDetail() {
  const { BrewerId: id } = useLocalSearchParams();
  const qc = useQueryClient();

  const { data: brewer, isLoading, isError, refetch } = useQuery({
    queryKey: ['brewer', id],
    queryFn: () => fetchBrewer(id),
  });

  const { data: recipes, isLoading: recipesLoading } = useQuery({
    queryKey: ['brewer-recipes', id],
    queryFn: () => fetchRecipesForBrewer(id),
    enabled: !!brewer,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: updateBrewer,
    onSuccess: (updated) => {
      qc.setQueryData(['brewer', id], updated);
      qc.invalidateQueries({ queryKey: ['my-brewers'] });
      qc.invalidateQueries({ queryKey: ['brewers-catalog'] });
    },
    onError: (err) => {
      const msg =
        err?.response?.data?.message ?? err?.message ?? 'Could not update brewer.';
      Alert.alert('Update failed', msg);
    },
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (isError || !brewer) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn't load this brewer.</Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const { brand, model } = splitName(brewer.Name);
  const idCode =
    brewer.modelCode || `B-${String(brewer.BrewerID).padStart(3, '0')}`;
  const tracked = paramEntries(brewer.trackedParameters);
  const currentFilter = brewer.filterType ?? null;
  const currentType = brewer.Type ?? null;

  const setFilterType = (filterType) => {
    if (filterType === currentFilter || mutation.isPending) return;
    mutation.mutate({ id: brewer.BrewerID, patch: { filterType } });
  };

  return (
    <ScrollView style={styles.safe} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={INK} />
        </Pressable>
        <Text style={styles.topTitle}>BREWER SPEC</Text>
        <View style={{ width: 20 }} />
      </View>

      {/* Hero card */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name={typeIconName(currentType)} size={32} color={ACCENT} />
        </View>
        <Text style={styles.brand}>{brand}</Text>
        <Text style={styles.model}>{model || brewer.Name}</Text>
        <Text style={styles.idLine}>ID: {idCode}</Text>
      </View>

      {/* TYPE — read-only */}
      <SectionHeader icon="cog-outline" label="TYPE" />
      <View style={styles.fieldBlock}>
        <View style={styles.staticRow}>
          <Ionicons name={typeIconName(currentType)} size={18} color={ACCENT} />
          <Text style={styles.staticValue}>
            {currentType ? capitalize(currentType) : 'Unspecified'}
          </Text>
        </View>
      </View>

      {/* FILTER — editable */}
      <SectionHeader icon="funnel-outline" label="FILTER TYPE" />
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldHint}>
          Tap to change. Saved automatically.
        </Text>
        <View style={styles.chipsRow}>
          {FILTER_OPTIONS.map((opt) => {
            const active = opt === currentFilter;
            return (
              <Pressable
                key={opt}
                onPress={() => setFilterType(opt)}
                disabled={mutation.isPending}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Ionicons
                  name={filterIconName(opt)}
                  size={14}
                  color={active ? '#fff' : INK}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {opt.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {mutation.isPending ? (
          <View style={styles.savingRow}>
            <ActivityIndicator size="small" color={ACCENT} />
            <Text style={styles.savingText}>Saving…</Text>
          </View>
        ) : null}
      </View>

      {/* TRACKED PARAMETERS — only if any exist */}
      {tracked.length > 0 ? (
        <>
          <SectionHeader icon="options-outline" label="TRACKED PARAMETERS" />
          <View style={styles.paramBox}>
            {tracked.map(([k, v]) => (
              <View key={k} style={styles.paramRow}>
                <Text style={styles.paramKey}>{k.toUpperCase()}</Text>
                <Text style={styles.paramVal}>{String(v)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* OPTIMIZED RECIPES */}
      <SectionHeader icon="flame-outline" label="OPTIMIZED RECIPES" />
      {recipesLoading ? (
        <View style={styles.recipesLoading}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : recipes && recipes.length > 0 ? (
        <View style={styles.recipesBox}>
          {recipes.map((r) => (
            <RecipeRow key={r._id} recipe={r} brewerId={brewer.BrewerID} />
          ))}
        </View>
      ) : (
        <View style={styles.recipesEmpty}>
          <Text style={styles.emptyText}>No recipes paired yet.</Text>
        </View>
      )}

      {/* Persistent "add another recipe" button — visible whether or not
          the list is empty so users can keep adding to a brewer. */}
      <Pressable
        style={styles.addRecipeBtn}
        onPress={() =>
          router.push(`/Recipe/addRecipe?brewerId=${brewer.BrewerID}`)
        }
      >
        <Ionicons name="add" size={16} color="#fff" />
        <Text style={styles.addRecipeText}>
          {recipes && recipes.length > 0 ? 'ADD ANOTHER RECIPE' : 'PAIR A RECIPE'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// ---------- Subcomponents ----------
function SectionHeader({ icon, label }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={14} color={INK} />
      <Text style={styles.sectionHeaderText}>{label}</Text>
    </View>
  );
}

function RecipeRow({ recipe, brewerId }) {
  const dose = recipe.CoffeeIn ?? recipe.coffeeGrams;
  const water = recipe.WaterIn ?? recipe.waterGrams;
  const ratio = ratioOf(dose, water) || '—';
  const name = recipe.Name ?? recipe.name ?? recipe.RecipeBody ?? 'Untitled recipe';

  return (
    <Pressable
      style={styles.recipeRow}
      onPress={() =>
        router.push(`/Brew/config?recipeId=${recipe.ID}&brewerId=${brewerId}`)
      }
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.recipeName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.recipeMeta} numberOfLines={1}>
          {dose ?? '—'}g Coffee · {water ?? '—'}g Water
          {recipe.WaterTemp ? ` · ${recipe.WaterTemp}°C` : ''}
        </Text>
      </View>
      <View style={styles.ratioBox}>
        <Text style={styles.ratioValue}>{ratio}</Text>
        <Text style={styles.ratioLabel}>RATIO</Text>
      </View>
    </Pressable>
  );
}

// ---------- Styles ----------
const CREAM = '#f3eee5';
const CARD = '#faf6ed';
const CARD_DIM = '#ece6d6';
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
  },
  topTitle: {
    fontSize: 14,
    letterSpacing: 2,
    color: INK,
    fontWeight: '700',
    fontFamily: FONT_SERIF,
  },

  hero: {
    marginHorizontal: 14,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: CARD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    gap: 4,
    marginBottom: 8,
  },
  heroIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#f5dfd9',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  brand: {
    fontSize: 12,
    color: ACCENT,
    letterSpacing: 2,
    fontWeight: '700',
  },
  model: {
    fontSize: 22,
    color: INK,
    fontWeight: '700',
    fontFamily: FONT_SERIF,
    textAlign: 'center',
  },
  idLine: {
    fontSize: 11,
    color: MUTED,
    letterSpacing: 1,
    marginTop: 2,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#e9e3d4',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  sectionHeaderText: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: INK,
    fontWeight: '700',
  },

  fieldBlock: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  fieldHint: {
    fontSize: 11,
    color: MUTED,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  staticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  staticValue: {
    fontSize: 16,
    color: INK,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  chipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  chipText: {
    fontSize: 12,
    color: INK,
    letterSpacing: 0.5,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  savingText: {
    color: MUTED,
    fontSize: 11,
    letterSpacing: 1,
  },

  paramBox: {
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  paramKey: {
    fontSize: 11,
    color: MUTED,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  paramVal: {
    fontSize: 12,
    color: INK,
    fontWeight: '700',
  },

  recipesBox: {
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  recipeRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingLeft: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  recipeRowDim: { backgroundColor: CARD_DIM },
  recipeRoast: {
    fontSize: 10,
    color: MUTED,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  recipeName: { fontSize: 13, color: INK, marginTop: 4, fontWeight: '600' },
  recipeMeta: { fontSize: 11, color: MUTED, marginTop: 4 },

  ratioBox: {
    width: 90,
    backgroundColor: '#f5dfd9',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: BORDER,
  },
  ratioValue: { fontSize: 14, fontWeight: '700', color: INK },
  ratioLabel: {
    fontSize: 9,
    color: MUTED,
    letterSpacing: 1.5,
    marginTop: 2,
  },

  textDim: { color: '#9b9683' },

  recipesLoading: { padding: 20, alignItems: 'center' },
  recipesEmpty: { padding: 20, alignItems: 'center', gap: 10 },

  addRecipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 14,
    marginTop: 12,
    paddingVertical: 14,
    backgroundColor: ACCENT,
  },
  addRecipeText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 12,
  },

  errorText: { color: INK, marginBottom: 12 },
  retryBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  emptyText: { color: MUTED },
});
