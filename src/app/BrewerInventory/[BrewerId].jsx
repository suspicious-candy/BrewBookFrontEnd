// app/brewers/[id].jsx
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/src/api/client';
import brewerImages from '@/src/assets/brewerImages';

// ---------- API ----------
async function fetchBrewer(id) {
  const { data } = await apiClient.get(`/brewers/${id}`);
  return data;
}

async function fetchRecipesForBrewer(id) {
  const { data } = await apiClient.get(`/brewers/${id}/recipes`);
  return data; // [{ _id, roastLevel, name, coffeeGrams, waterGrams, ratio }]
}

// ---------- Helpers ----------
function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// "Hario V60 Dripper" → { brand: "HARIO", model: "V60 Dripper" }
function splitName(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return { brand: name.toUpperCase(), model: '' };
  return {
    brand: parts[0].toUpperCase(),
    model: parts.slice(1).join(' ').toUpperCase(),
  };
}

// Mongo Map or plain object → [[k,v], ...]
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

// ---------- Screen ----------
export default function BrewerDetail() {
  const { id } = useLocalSearchParams();

  const {
    data: brewer,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['brewer', id],
    queryFn: () => fetchBrewer(id),
  });

  const {
    data: recipes,
    isLoading: recipesLoading,
  } = useQuery({
    queryKey: ['brewer-recipes', id],
    queryFn: () => fetchRecipesForBrewer(id),
    enabled: !!brewer,
    retry: false,
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
  const imgSource = brewerImages[brewer.BrewerID];

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

      {/* Image block */}
      <View style={styles.schematicBox}>
        <View style={styles.schematicInner}>
          {imgSource ? (
            <Image
              source={imgSource}
              style={styles.brewerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imageFallback}>
              <Ionicons name="cafe-outline" size={48} color={MUTED} />
              <Text style={styles.imageFallbackText}>NO IMAGE</Text>
            </View>
          )}
        </View>
        <Text style={styles.monogram}>{idCode}</Text>
      </View>

      {/* Brand + model + ID */}
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>{brand}</Text>
          <Text style={styles.model}>{model}</Text>
        </View>
        <Text style={styles.idLine}>ID: {idCode}</Text>
      </View>

      {/* TECHNICAL DETAILS */}
      <SectionHeader icon="cog-outline" label="TECHNICAL DETAILS" />
      <View style={styles.grid}>
        <Row label="TYPE" value={capitalize(brewer.Type) || '—'} />
        <Row label="FILTER" value={capitalize(brewer.filterType) || 'N/A'} />
        {tracked.map(([k, v]) => (
          <Row key={k} label={k.toUpperCase()} value={String(v)} />
        ))}
      </View>

      {/* OPTIMIZED RECIPES */}
      <SectionHeader icon="flame-outline" label="OPTIMIZED RECIPES" />

      {recipesLoading ? (
        <View style={styles.recipesLoading}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : recipes && recipes.length > 0 ? (
        <View style={styles.recipesBox}>
          {recipes.map((r) => (
            <RecipeRow key={r._id} recipe={r} />
          ))}
        </View>
      ) : (
        <View style={styles.recipesEmpty}>
          <Text style={styles.emptyText}>No recipes paired yet.</Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() =>
              router.push(`/brewers/${brewer.BrewerID}/pair-recipe`)
            }
          >
            <Text style={styles.retryText}>Pair a Recipe</Text>
          </Pressable>
        </View>
      )}
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

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function RecipeRow({ recipe }) {
  const roast = (recipe.roastLevel || 'medium').toLowerCase();
  const dim = roast === 'dark' || roast === 'french';
  const ratio =
    recipe.ratio || ratioOf(recipe.coffeeGrams, recipe.waterGrams) || '—';

  return (
    <Pressable
      style={[styles.recipeRow, dim && styles.recipeRowDim]}
      onPress={() => router.push(`/recipes/${recipe._id}`)}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.recipeRoast, dim && styles.textDim]}>
          {roast.toUpperCase()} ROAST
        </Text>
        <Text style={[styles.recipeName, dim && styles.textDim]}>
          {recipe.name}
        </Text>
        <Text style={[styles.recipeMeta, dim && styles.textDim]}>
          {recipe.coffeeGrams}g Coffee / {recipe.waterGrams}g Water /...
        </Text>
      </View>
      <View style={styles.ratioBox}>
        <Text style={[styles.ratioValue, dim && styles.textDim]}>{ratio}</Text>
        <Text style={[styles.ratioLabel, dim && styles.textDim]}>RATIO</Text>
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
const TAUPE = '#8b7a6e';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: CREAM,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 50,
    paddingBottom: 12,
  },
  topTitle: {
    fontSize: 12,
    letterSpacing: 2,
    color: INK,
    fontWeight: '700',
  },

  schematicBox: {
    marginHorizontal: 14,
    height: 200,
    backgroundColor: TAUPE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    position: 'relative',
  },
  schematicInner: {
    backgroundColor: CARD,
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brewerImage: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  imageFallbackText: {
    fontSize: 10,
    color: MUTED,
    letterSpacing: 1.5,
  },
  monogram: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontSize: 10,
    letterSpacing: 2,
    color: CARD,
    fontWeight: '700',
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  brand: { fontSize: 12, color: MUTED, letterSpacing: 1, fontWeight: '600' },
  model: { fontSize: 14, color: INK, marginTop: 4 },
  idLine: { fontSize: 11, color: MUTED, letterSpacing: 1 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: CARD,
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

  grid: {
    marginHorizontal: 14,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  rowLabel: {
    flex: 1,
    fontSize: 12,
    color: INK,
    letterSpacing: 1,
    fontWeight: '500',
  },
  rowValue: { fontSize: 12, color: INK, textAlign: 'right' },

  recipesBox: {
    marginHorizontal: 14,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: CARD,
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