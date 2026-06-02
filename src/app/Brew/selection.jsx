// app/brew/select.jsx
// Flow: Brewer detail → tap recipe → /brew/select?recipeId=X → pick bean
import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/api/client';

const ASSUMED_CAPACITY_G = 250; // for the depletion bar

// ---------- API ----------
/** Fetches all beans (the user's library). */
async function fetchBeans() {
  const { data } = await apiClient.get('/beans');
  return data;
}

/** Fetches a single recipe by its numeric ID. */
async function fetchRecipe(id) {
  const { data } = await apiClient.get(`/recipes/${id}`);
  return data;
}

// ---------- Helpers ----------
/** Formats a bean's origin as "COUNTRY REGION", skipping "none"/empty parts. */
function originLabel(bean) {
  const c = bean.Origin?.Country;
  const r = bean.Origin?.Region;
  if (c && c !== 'none' && r && r !== 'none') return `${c} ${r}`.toUpperCase();
  if (c && c !== 'none') return c.toUpperCase();
  if (r && r !== 'none') return r.toUpperCase();
  return 'UNKNOWN ORIGIN';
}

/** One-line "Process • tasting notes" summary for a bean. */
function notesLine(bean) {
  const process = bean.Process || 'Washed';
  const notes = bean.tasteProfile?.tastingNotes?.join(', ') || '—';
  return `${capitalize(process)} • ${notes}`;
}

/** Capitalizes the first letter of a string. */
function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Formats a coffee:water ratio (e.g. "1:16"), or "—" when inputs are missing. */
function ratioOf(coffee, water) {
  if (!coffee || !water) return '—';
  const r = (water / coffee).toFixed(1).replace(/\.0$/, '');
  return `1:${r}`;
}

/** Formats a seconds count as "Ns" (under a minute) or m:ss. */
function formatBrewTime(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------- Screen ----------
/**
 * Brew flow step 1 — bean selection. Shows the chosen recipe's ratio and brew
 * time, then lists the user's beans (sufficiently-stocked first; under-dose beans
 * are disabled). Selecting one continues to the brew-config screen.
 */
export default function BrewSelectBean() {
  const { recipeId } = useLocalSearchParams();
  const [selectedId, setSelectedId] = useState(null);

  const {
    data: recipe,
    isLoading: recipeLoading,
    isError: recipeError,
  } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => fetchRecipe(recipeId),
    enabled: !!recipeId,
  });

  const {
    data: beans,
    isLoading: beansLoading,
    isError: beansError,
    refetch,
  } = useQuery({
    queryKey: ['beans'],
    queryFn: fetchBeans,
  });

  const dose  = recipe?.CoffeeIn ?? 18;
  const water = recipe?.WaterIn  ?? 250;

  const sortedBeans = useMemo(() => {
    if (!beans) return [];
    return [...beans].sort((a, b) => {
      const aOk = (a.Quantity ?? 0) >= dose ? 0 : 1;
      const bOk = (b.Quantity ?? 0) >= dose ? 0 : 1;
      if (aOk !== bOk) return aOk - bOk;
      return (a.Name ?? '').localeCompare(b.Name ?? '');
    });
  }, [beans, dose]);

  const isLoading = recipeLoading || beansLoading;
  const isError   = recipeError   || beansError;

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
        <Text style={styles.errorText}>Couldn't load brew data.</Text>
        <Pressable style={styles.continueBtn} onPress={() => refetch()}>
          <Text style={styles.continueText}>Try Again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const selectedBean = sortedBeans.find((b) => b.beanId === selectedId);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={ACCENT} />
        </Pressable>
        <Text style={styles.topTitle}>THE BREW LEDGER</Text>
        <View style={{ width: 20 }} />
      </View>

      {/* Recipe header — just number, ratio, total brew time */}
      <View style={styles.recipeHeader}>
        <View style={styles.headerCell}>
          <Text style={styles.headerLabel}>RECIPE</Text>
          <Text style={styles.headerValue}>
            #{String(recipe?.ID ?? '—').padStart(3, '0')}
          </Text>
        </View>
        <View style={[styles.headerCell, styles.headerCellMid]}>
          <Text style={styles.headerLabel}>RATIO</Text>
          <Text style={styles.headerValueAccent}>{ratioOf(dose, water)}</Text>
        </View>
        <View style={styles.headerCell}>
          <Text style={styles.headerLabel}>BREW TIME</Text>
          <Text style={styles.headerValue}>{formatBrewTime(recipe?.BrewTime)}</Text>
        </View>
      </View>

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>SELECT BEANS</Text>
        <Text style={styles.sectionHeaderHint}>Need ≥ {dose}g</Text>
      </View>

      {/* Bean list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        <View style={styles.list}>
          {sortedBeans.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No beans in your library yet.</Text>
            </View>
          ) : (
            sortedBeans.map((bean) => {
              const remaining = bean.Quantity ?? 0;
              const enough = remaining >= dose;
              const selected = bean.beanId === selectedId;
              const pct = Math.max(
                0,
                Math.min(1, remaining / ASSUMED_CAPACITY_G)
              );

              return (
                <Pressable
                  key={bean._id ?? bean.beanId}
                  disabled={!enough}
                  onPress={() => setSelectedId(bean.beanId)}
                  style={[
                    styles.beanRow,
                    selected && styles.beanRowSelected,
                    !enough && styles.beanRowDim,
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text
                      style={[styles.roaster, !enough && styles.textDim]}
                      numberOfLines={1}
                    >
                      {originLabel(bean)}
                    </Text>
                    <Text
                      style={[styles.beanName, !enough && styles.textDim]}
                      numberOfLines={1}
                    >
                      {bean.Name}
                    </Text>
                    <Text
                      style={[styles.beanNotes, !enough && styles.textDim]}
                      numberOfLines={1}
                    >
                      {notesLine(bean)}
                    </Text>
                  </View>

                  <View style={styles.stockBlock}>
                    <Text
                      style={[
                        styles.stockGrams,
                        !enough && styles.stockGramsLow,
                      ]}
                    >
                      {remaining}g
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${pct * 100}%` },
                          !enough && styles.barFillLow,
                        ]}
                      />
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Continue button */}
      <View style={styles.footer}>
        <Pressable
          disabled={!selectedBean}
          onPress={() =>
            router.push({
              pathname: '/Brew/config',
              params: {
                recipeId: recipe?.ID,
                beanId:   selectedBean.beanId,
              },
            })
          }
          style={[
            styles.continueBtn,
            !selectedBean && styles.continueBtnDisabled,
          ]}
        >
          <Text style={styles.continueText}>CONTINUE TO BREW</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
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
const DARK_BTN = '#2a1a13';

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
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  topTitle: {
    fontSize: 14,
    letterSpacing: 2,
    color: ACCENT,
    fontWeight: '700',
  },

  recipeHeader: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerCell: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  headerCellMid: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  headerLabel: {
    fontSize: 10,
    color: MUTED,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  headerValue: {
    fontSize: 16,
    color: INK,
    fontWeight: '700',
    marginTop: 6,
  },
  headerValueAccent: {
    fontSize: 16,
    color: ACCENT,
    fontWeight: '700',
    marginTop: 6,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: CREAM,
  },
  sectionHeaderText: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: INK,
    fontWeight: '700',
  },
  sectionHeaderHint: {
    fontSize: 10,
    color: MUTED,
    letterSpacing: 1,
  },

  list: {
    marginHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: CARD,
  },

  beanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  beanRowSelected: {
    borderLeftColor: ACCENT,
    backgroundColor: '#f5e9df',
  },
  beanRowDim: {
    backgroundColor: CARD_DIM,
  },

  roaster: {
    fontSize: 10,
    color: ACCENT,
    letterSpacing: 1,
    fontWeight: '700',
  },
  beanName: {
    fontSize: 14,
    color: INK,
    fontWeight: '700',
    marginTop: 4,
  },
  beanNotes: {
    fontSize: 11,
    color: MUTED,
    marginTop: 4,
  },

  textDim: { color: '#a9a395' },

  stockBlock: {
    width: 84,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  stockGrams: {
    fontSize: 12,
    color: INK,
    fontWeight: '700',
  },
  stockGramsLow: {
    color: '#a9a395',
  },
  barTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#f1d9d3',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: ACCENT,
    opacity: 0.4,
  },
  barFillLow: {
    backgroundColor: '#cdc7b8',
    opacity: 1,
  },

  footer: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    backgroundColor: CREAM,
  },
  continueBtn: {
    backgroundColor: DARK_BTN,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  continueBtnDisabled: {
    opacity: 0.4,
  },
  continueText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 1.5,
    fontSize: 12,
  },

  errorText: { color: INK, marginBottom: 12 },
  empty: { padding: 20, alignItems: 'center' },
  emptyText: { color: MUTED },
});