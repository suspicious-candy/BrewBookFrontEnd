import { useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/api/client';
import { useAuth } from '@/auth/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------- API ----------
async function fetchRecipe(id) {
  const { data } = await apiClient.get(`/recipes/${id}`);
  return data;
}

async function fetchBrewer(id) {
  const { data } = await apiClient.get(`/brewers/${id}`);
  return data;
}

// Creates a Notes draft (without tasting fields — those come from the log screen)
async function createNotesDraft(body) {
  const { data } = await apiClient.post('/notes', body);
  return data;
}

// Decrement a bean's stock. Best-effort: if it fails we still let the brew
// proceed because the user has already committed to it.
async function decrementBeanStock({ beanId, grams }) {
  if (!beanId || !grams) return null;
  try {
    const { data } = await apiClient.patch(`/beans/${beanId}/consume`, { grams });
    return data;
  } catch (err) {
    console.warn('Bean consume failed (non-fatal)', err?.message);
    return null;
  }
}

// User's beans (404 → []) so the picker stays usable for new accounts
async function fetchUserBeans(email) {
  try {
    const { data } = await apiClient.get(`/beans/user/${encodeURIComponent(email)}`);
    return data;
  } catch (err) {
    if (err?.response?.status === 404) return [];
    throw err;
  }
}

// ---------- Helpers ----------
function ratioOf(coffee, water) {
  if (!coffee || !water) return '—';
  const r = (water / coffee).toFixed(1).replace(/\.0$/, '');
  return `1:${r}`;
}

function formatGrind(clicks) {
  if (clicks == null) return '—';
  let band = 'Custom';
  if (clicks <= 10)      band = 'Extra Fine';
  else if (clicks <= 18) band = 'Fine';
  else if (clicks <= 24) band = 'Med-Fine';
  else if (clicks <= 30) band = 'Medium';
  else if (clicks <= 36) band = 'Med-Coarse';
  else                   band = 'Coarse';
  return `${band} / ${clicks} clicks`;
}

function range(min, max, step = 1) {
  const out = [];
  for (let i = min; i <= max; i += step) out.push(Number(i.toFixed(2)));
  return out;
}

// ---------- Screen ----------
export default function RecipeConfig() {
  const { recipeId, brewerId, beanId: beanIdFromUrl } = useLocalSearchParams();
  const { user } = useAuth();
  const email = user?.email;
  const qc = useQueryClient();

  const { data: recipe, isLoading: recipeLoading } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => fetchRecipe(recipeId),
    enabled: !!recipeId,
  });

  // The recipe arrives with its Brewer populated, so prefer that. Only fetch by
  // id when handed an explicit numeric brewerId param — GET /brewers/:id keys on
  // the numeric BrewerID, not the ObjectId, so passing recipe.Brewer would 404.
  const populatedBrewer =
    recipe?.Brewer && typeof recipe.Brewer === 'object' ? recipe.Brewer : null;

  const { data: fetchedBrewer } = useQuery({
    queryKey: ['brewer', brewerId],
    queryFn: () => fetchBrewer(brewerId),
    enabled: !!brewerId,
  });

  const brewer = fetchedBrewer ?? populatedBrewer;

  // Numeric BrewerID used to attribute the brew: URL param wins, else the
  // resolved brewer's own id.
  const resolvedBrewerId = brewerId ? Number(brewerId) : brewer?.BrewerID;

  const { data: beans } = useQuery({
    queryKey: ['beans', 'user', email],
    queryFn: () => fetchUserBeans(email),
    enabled: !!email,
  });

  // Bean choice: URL param wins, then recipe.bean (ObjectId), then null.
  const [chosenBeanRef, setChosenBeanRef] = useState(null);
  if (chosenBeanRef === null) {
    if (beanIdFromUrl) {
      setChosenBeanRef({ kind: 'beanId', value: Number(beanIdFromUrl) });
    } else if (recipe?.bean) {
      // recipe.bean may be populated (object) or a raw ObjectId.
      const beanRef =
        typeof recipe.bean === 'object' ? recipe.bean._id : recipe.bean;
      setChosenBeanRef({ kind: 'objectId', value: beanRef });
    }
  }

  // Resolve the chosen reference into an actual bean document so we can show
  // its name and confirm it still belongs to the user.
  const selectedBean = useMemo(() => {
    if (!beans || !chosenBeanRef) return null;
    if (chosenBeanRef.kind === 'objectId') {
      return beans.find((b) => b._id === chosenBeanRef.value) ?? null;
    }
    return beans.find((b) => b.beanId === chosenBeanRef.value) ?? null;
  }, [beans, chosenBeanRef]);

  const [beanPickerOpen, setBeanPickerOpen] = useState(false);

  // Local editable copy of the brew params (seeded from the recipe)
  const [params, setParams] = useState(null);
  // The recipe's stored dose/water are treated as "per 1 cup". Changing the
  // cup count scales both proportionally from these baselines.
  const [baseline, setBaseline] = useState(null);
  const [cups, setCups] = useState(1);
  if (recipe && params === null) {
    const baseDose  = recipe.CoffeeIn ?? 15;
    const baseWater = recipe.WaterIn  ?? 250;
    setBaseline({ CoffeeIn: baseDose, WaterIn: baseWater });
    setParams({
      CoffeeIn:  baseDose,
      WaterIn:   baseWater,
      WaterTemp: recipe.WaterTemp ?? 93,
      grindSize: recipe.grindSize ?? 20,
      bloomTime: recipe.bloomTime ?? 45,
      BrewTime:  recipe.BrewTime  ?? 210,
      Agitation: recipe.Agitation ?? 'no',
    });
  }

  // Whenever cups changes, recompute dose/water from the per-cup baseline so
  // they always stay in proportion.
  const changeCups = (next) => {
    const n = Math.max(1, Math.min(10, next));
    setCups(n);
    if (baseline) {
      setParams((p) => ({
        ...p,
        CoffeeIn: +(baseline.CoffeeIn * n).toFixed(1),
        WaterIn:  Math.round(baseline.WaterIn  * n),
      }));
    }
  };

  // Picker modal state
  const [picker, setPicker] = useState(null);

  const draftMutation = useMutation({
    mutationFn: async () => {
      const notes = await createNotesDraft({
        Recipe: recipe?._id,
        recipeId: recipe?.ID,
        beanId: selectedBean?.beanId,
        brewerId: resolvedBrewerId,
        CoffeeIn:  params.CoffeeIn,
        WaterIn:   params.WaterIn,
        WaterTemp: params.WaterTemp,
        BrewTime:  params.BrewTime,
        grindSize: params.grindSize,
        bloomTime: params.bloomTime,
        Agitation: params.Agitation,
      });

      // Decrement the bean's stock as soon as the brew starts — the brewer has
      // committed to using these grams whether or not they later log tasting notes.
      if (selectedBean?.beanId && params.CoffeeIn) {
        await decrementBeanStock({
          beanId: selectedBean.beanId,
          grams: params.CoffeeIn,
        });
      }

      return notes;
    },
    onSuccess: (notes) => {
      // Stats and inventory should reflect the new brew immediately.
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['beans', 'user', email] });
      qc.invalidateQueries({ queryKey: ['beans'] });
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['me-stats'] });

      router.push({
        pathname: '/Brew/session',
        params: {
          notesId: notes.ID,
          recipeId: recipe?.ID,
          brewerId: resolvedBrewerId,
          beanId: selectedBean?.beanId,
        },
      });
    },
  });

  if (recipeLoading || !params) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
      </SafeAreaView>
    );
  }

  const openPicker = (cfg) =>
    setPicker({ ...cfg, initial: params[cfg.field] });

  const commit = (field, value) =>
    setParams((p) => ({ ...p, [field]: value }));

  const brewerName =
    brewer?.Name?.split(/\s+/).slice(1).join(' ') || brewer?.Name || 'V60';

  // Stock check: do we have enough of this bean for the configured dose?
  const remainingGrams = selectedBean?.Quantity ?? 0;
  const requiredGrams = Number(params.CoffeeIn) || 0;
  const enoughStock = !selectedBean || remainingGrams >= requiredGrams;
  const stockShort = requiredGrams - remainingGrams;

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={ACCENT} />
        </Pressable>
        <Text style={styles.topTitle}>CONFIG: {brewerName.toUpperCase()}</Text>
        <View style={{ width: 20 }} />
      </View>

      {/* Bean — pre-filled from the recipe when possible, otherwise required */}
      <SectionHeader label="BEAN *" />
      <Pressable
        style={styles.beanSelector}
        onPress={() => setBeanPickerOpen(true)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.beanSelectorLabel}>
            {selectedBean ? 'USING' : 'CHOOSE A BEAN'}
          </Text>
          <Text style={styles.beanSelectorValue}>
            {selectedBean?.details?.Name ?? 'Tap to pick'}
          </Text>
          {selectedBean ? (
            <Text
              style={[
                styles.beanSelectorStock,
                !enoughStock && styles.beanSelectorStockShort,
              ]}
            >
              {remainingGrams}g remaining
              {!enoughStock
                ? ` · need ${requiredGrams}g (short ${stockShort}g)`
                : ` · need ${requiredGrams}g`}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={MUTED} />
      </Pressable>

      {/* # of cups — scales DOSE and WATER from the recipe's baseline */}
      <View style={styles.cupsRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cellLabel}>NUMBER OF CUPS</Text>
          <Text style={styles.cupsHint}>
            Scales dose & water proportionally. Recipe = 1 cup.
          </Text>
        </View>
        <View style={styles.cupsControl}>
          <Pressable
            onPress={() => changeCups(cups - 1)}
            hitSlop={10}
            disabled={cups <= 1}
            style={[styles.cupsBtn, cups <= 1 && { opacity: 0.4 }]}
          >
            <Text style={styles.cupsBtnText}>−</Text>
          </Pressable>
          <Text style={styles.cupsValue}>{cups}</Text>
          <Pressable
            onPress={() => changeCups(cups + 1)}
            hitSlop={10}
            disabled={cups >= 10}
            style={[styles.cupsBtn, cups >= 10 && { opacity: 0.4 }]}
          >
            <Text style={styles.cupsBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* Top 2x2 summary grid */}
      <View style={styles.grid2}>
        <Pressable
          style={[styles.gridCell, styles.gridCellRight]}
          onPress={() =>
            openPicker({
              field: 'CoffeeIn',
              label: 'DOSE',
              unit: 'g',
              values: range(5, 40, 0.5),
            })
          }
        >
          <Text style={styles.cellLabel}>DOSE</Text>
          <Text style={styles.cellValue}>{params.CoffeeIn}g</Text>
        </Pressable>
        <Pressable
          style={styles.gridCell}
          onPress={() =>
            openPicker({
              field: 'WaterIn',
              label: 'WATER',
              unit: 'g',
              values: range(50, 1000, 5),
            })
          }
        >
          <Text style={styles.cellLabel}>WATER</Text>
          <Text style={styles.cellValue}>{params.WaterIn}g</Text>
        </Pressable>
      </View>
      <View style={[styles.grid2, styles.grid2Top]}>
        <Pressable
          style={[styles.gridCell, styles.gridCellRight]}
          onPress={() =>
            openPicker({
              field: 'WaterTemp',
              label: 'TEMP',
              unit: '°C',
              values: range(70, 100, 1),
            })
          }
        >
          <Text style={styles.cellLabel}>TEMP</Text>
          <Text style={styles.cellValue}>{params.WaterTemp}°C</Text>
        </Pressable>
        <View style={styles.gridCell}>
          <Text style={styles.cellLabel}>RATIO</Text>
          <Text style={styles.cellValue}>
            {ratioOf(params.CoffeeIn, params.WaterIn)}
          </Text>
        </View>
      </View>

      {/* ADJUST PARAMETERS */}
      <SectionHeader label="ADJUST PARAMETERS" />
      <View style={styles.adjustBox}>
        <AdjustRow
          label="Coffee In"
          value={params.CoffeeIn}
          step={0.5}
          unit="g"
          min={1}
          onChange={(v) => commit('CoffeeIn', v)}
        />
        <AdjustRow
          label="Water In"
          value={params.WaterIn}
          step={5}
          unit="g"
          min={1}
          onChange={(v) => commit('WaterIn', v)}
        />
      </View>

      {/* EXTRACTION DETAILS */}
      <SectionHeader label="EXTRACTION DETAILS" />
      <View style={styles.detailGrid}>
        <Pressable
          style={[styles.detailCell, styles.detailCellRight]}
          onPress={() =>
            openPicker({
              field: 'grindSize',
              label: 'GRIND SIZE',
              unit: 'clicks',
              values: range(1, 50, 1),
            })
          }
        >
          <Text style={styles.cellLabel}>GRIND SIZE</Text>
          <Text style={styles.detailValue}>{formatGrind(params.grindSize)}</Text>
        </Pressable>
        <Pressable
          style={styles.detailCell}
          onPress={() =>
            openPicker({
              field: 'bloomTime',
              label: 'BLOOM TIME',
              unit: 's',
              values: range(0, 120, 5),
            })
          }
        >
          <Text style={styles.cellLabel}>BLOOM TIME</Text>
          <Text style={styles.detailValue}>{params.bloomTime}s</Text>
        </Pressable>
      </View>

      {/* AGITATION toggle */}
      <View style={styles.agitationRow}>
        <Text style={styles.adjustLabel}>Agitation</Text>
        <View style={styles.agitationControl}>
          {['no', 'yes'].map((opt) => (
            <Pressable
              key={opt}
              style={[
                styles.agitationBtn,
                params.Agitation === opt && styles.agitationBtnActive,
              ]}
              onPress={() => commit('Agitation', opt)}
            >
              <Text
                style={[
                  styles.agitationBtnText,
                  params.Agitation === opt && styles.agitationBtnTextActive,
                ]}
              >
                {opt.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ flex: 1 }} />

      {/* Confirm button */}
      <View style={styles.footer}>
        {draftMutation.isError && (
          <Text style={styles.errorText}>
            Couldn't start brew. Tap to retry.
          </Text>
        )}
        {selectedBean && !enoughStock ? (
          <Text style={styles.errorText}>
            Not enough beans — {remainingGrams}g left but recipe needs {requiredGrams}g.
          </Text>
        ) : null}
        <Pressable
          onPress={() => draftMutation.mutate()}
          disabled={
            draftMutation.isPending || !selectedBean || !enoughStock
          }
          style={[
            styles.confirmBtn,
            (draftMutation.isPending || !selectedBean || !enoughStock) && {
              opacity: 0.5,
            },
          ]}
        >
          {draftMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmText}>
              {!selectedBean
                ? 'PICK A BEAN TO CONTINUE'
                : !enoughStock
                ? 'NOT ENOUGH BEANS'
                : 'CONFIRM PARAMETERS'}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Picker modal — numeric values. Keyed by field so each open remounts
          with fresh scroll position and temp value instead of leaking the
          previous field's selection. */}
      <PickerModal
        key={picker ? picker.field : 'picker-closed'}
        config={picker}
        onClose={() => setPicker(null)}
        onSelect={(v) => {
          if (picker) commit(picker.field, v);
          setPicker(null);
        }}
      />

      {/* Bean picker modal */}
      <BeanPickerModal
        visible={beanPickerOpen}
        beans={beans ?? []}
        selectedId={selectedBean?._id}
        onClose={() => setBeanPickerOpen(false)}
        onSelect={(bean) => {
          setChosenBeanRef({ kind: 'objectId', value: bean._id });
          setBeanPickerOpen(false);
        }}
      />
    </SafeAreaView>
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

function AdjustRow({ label, value, step, unit, min = 0, onChange }) {
  const dec = () => onChange(Math.max(min, +(value - step).toFixed(2)));
  const inc = () => onChange(+(value + step).toFixed(2));

  return (
    <View style={styles.adjustRow}>
      <Text style={styles.adjustLabel}>{label}</Text>
      <View style={styles.adjustControl}>
        <Pressable onPress={dec} hitSlop={10} style={styles.adjustBtn}>
          <Text style={styles.adjustBtnText}>−</Text>
        </Pressable>
        <Text style={styles.adjustValue}>
          {Number.isInteger(value) ? value.toFixed(1) : value}
        </Text>
        <Pressable onPress={inc} hitSlop={10} style={styles.adjustBtn}>
          <Text style={styles.adjustBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------- Bean Picker Modal ----------
function BeanPickerModal({ visible, beans, selectedId, onClose, onSelect }) {
  if (!visible) return null;
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.beanModalRoot}>
        <Pressable style={styles.beanModalBackdrop} onPress={onClose} />
        <View style={styles.beanModalSheet}>
          <Text style={styles.beanModalTitle}>CHOOSE A BEAN</Text>

          {beans.length === 0 ? (
            <View style={styles.beanModalEmpty}>
              <Text style={styles.beanModalEmptyText}>
                You haven't added any beans yet. Add one from the Beans tab first.
              </Text>
            </View>
          ) : (
            <View style={styles.beanModalList}>
              {beans.map((b) => {
                const isSelected = b._id === selectedId;
                const d = b.details ?? {};
                const origin =
                  d.Origin?.Country && d.Origin.Country !== 'none'
                    ? d.Origin.Country
                    : null;
                return (
                  <Pressable
                    key={b._id}
                    onPress={() => onSelect(b)}
                    style={[
                      styles.beanModalRow,
                      isSelected && styles.beanModalRowActive,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.beanModalRowName}>
                        {d.Name ?? 'Unnamed bean'}
                      </Text>
                      {origin || d.Varietal ? (
                        <Text style={styles.beanModalRowMeta}>
                          {[origin, d.Varietal].filter(Boolean).join(' • ')}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={18} color={ACCENT} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable style={styles.beanModalCancel} onPress={onClose}>
            <Text style={styles.beanModalCancelText}>CLOSE</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ---------- Horizontal Picker Modal ----------
const ITEM_WIDTH = 80;

function PickerModal({ config, onClose, onSelect }) {
  // Seed scrollX with the selected item's offset so the wheel renders already
  // centered on the current value — scrollX drives the opacity/scale highlight,
  // and starting at 0 would otherwise spotlight the wrong (first) item on open.
  const values = config?.values ?? [];
  const initialIndex = Math.max(0, values.indexOf(config?.initial));
  const scrollX = useRef(new Animated.Value(initialIndex * ITEM_WIDTH)).current;
  const listRef = useRef(null);
  const [tempValue, setTempValue] = useState(config?.initial);

  if (!config) return null;

  const { initial, label, unit } = config;

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: true }
  );

  const handleMomentumEnd = (e) => {
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / ITEM_WIDTH);
    const clamped = Math.max(0, Math.min(values.length - 1, idx));
    setTempValue(values[clamped]);
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={styles.modalSheet}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.modalLabel}>{label}</Text>

          <View style={styles.pickerWrap}>
            <View style={styles.pickerCenterMark} pointerEvents="none" />

            <Animated.FlatList
              ref={listRef}
              data={values}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(v) => String(v)}
              initialScrollIndex={initialIndex}
              getItemLayout={(_, i) => ({
                length: ITEM_WIDTH,
                offset: ITEM_WIDTH * i,
                index: i,
              })}
              snapToInterval={ITEM_WIDTH}
              decelerationRate="fast"
              contentContainerStyle={{
                paddingHorizontal: (SCREEN_WIDTH - ITEM_WIDTH) / 2 - 12,
              }}
              onScroll={handleScroll}
              onMomentumScrollEnd={handleMomentumEnd}
              scrollEventThrottle={16}
              renderItem={({ item, index }) => {
                const inputRange = [
                  (index - 2) * ITEM_WIDTH,
                  (index - 1) * ITEM_WIDTH,
                  index * ITEM_WIDTH,
                  (index + 1) * ITEM_WIDTH,
                  (index + 2) * ITEM_WIDTH,
                ];
                const opacity = scrollX.interpolate({
                  inputRange,
                  outputRange: [0.15, 0.35, 1, 0.35, 0.15],
                  extrapolate: 'clamp',
                });
                const scale = scrollX.interpolate({
                  inputRange,
                  outputRange: [0.7, 0.85, 1, 0.85, 0.7],
                  extrapolate: 'clamp',
                });

                return (
                  <Animated.View
                    style={[
                      styles.pickerItem,
                      { opacity, transform: [{ scale }] },
                    ]}
                  >
                    <Text style={styles.pickerItemText}>{item}</Text>
                  </Animated.View>
                );
              }}
            />
          </View>

          <Text style={styles.pickerUnit}>{unit}</Text>

          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>CANCEL</Text>
            </Pressable>
            <Pressable
              onPress={() => onSelect(tempValue ?? initial)}
              style={styles.modalOk}
            >
              <Text style={styles.modalOkText}>SET</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------- Styles ----------
const CREAM = '#f3eee5';
const CARD = '#faf6ed';
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
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  topTitle: { fontSize: 14, letterSpacing: 2, color: ACCENT, fontWeight: '700' },

  grid2: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  grid2Top: { borderTopWidth: 0 },
  gridCell: { flex: 1, paddingHorizontal: 14, paddingVertical: 14 },
  gridCellRight: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: BORDER,
  },
  cellLabel: {
    fontSize: 10, color: MUTED, letterSpacing: 1.5, fontWeight: '600',
  },
  cellValue: { fontSize: 22, color: INK, fontWeight: '700', marginTop: 6 },

  sectionHeader: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#e9e3d4',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  sectionHeaderText: {
    fontSize: 10, letterSpacing: 1.5, color: INK, fontWeight: '700',
  },

  adjustBox: {
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  adjustLabel: { flex: 1, paddingHorizontal: 14, fontSize: 13, color: INK },
  adjustControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: BORDER,
  },
  adjustBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  adjustBtnText: { fontSize: 18, color: ACCENT, fontWeight: '700' },
  adjustValue: {
    minWidth: 60,
    textAlign: 'center',
    fontSize: 14,
    color: INK,
    fontWeight: '700',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingVertical: 14,
  },

  detailGrid: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  detailCell: { flex: 1, paddingHorizontal: 14, paddingVertical: 14 },
  detailCellRight: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: BORDER,
  },
  detailValue: { fontSize: 13, color: INK, fontWeight: '600', marginTop: 6 },

  agitationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  agitationControl: {
    flexDirection: 'row',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: BORDER,
  },
  agitationBtn: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: BORDER,
  },
  agitationBtnActive: { backgroundColor: ACCENT },
  agitationBtnText: { fontSize: 11, color: MUTED, fontWeight: '700', letterSpacing: 1 },
  agitationBtnTextActive: { color: '#fff' },

  footer: { paddingHorizontal: 14, paddingVertical: 14, backgroundColor: CREAM },
  confirmBtn: {
    backgroundColor: DARK_BTN,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmText: {
    color: '#fff', fontWeight: '700', letterSpacing: 1.5, fontSize: 12,
  },
  errorText: { color: ACCENT, textAlign: 'center', marginBottom: 8 },

  // Picker modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 12, 8, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: CARD,
    paddingTop: 24,
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
  pickerWrap: { height: 80, justifyContent: 'center' },
  pickerCenterMark: {
    position: 'absolute',
    left: SCREEN_WIDTH / 2 - ITEM_WIDTH / 2,
    width: ITEM_WIDTH,
    top: 0, bottom: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT,
  },
  pickerItem: { width: ITEM_WIDTH, alignItems: 'center', justifyContent: 'center' },
  pickerItemText: { fontSize: 28, fontWeight: '700', color: INK },
  pickerUnit: {
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 2,
    color: ACCENT,
    marginTop: 8,
    fontWeight: '700',
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 18,
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    alignItems: 'center',
  },
  modalCancelText: {
    color: MUTED, fontWeight: '700', letterSpacing: 1.5, fontSize: 11,
  },
  modalOk: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
  },
  modalOkText: {
    color: '#fff', fontWeight: '700', letterSpacing: 1.5, fontSize: 11,
  },

  // Bean selector row (in-page)
  beanSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  beanSelectorLabel: {
    fontSize: 10,
    color: MUTED,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  beanSelectorValue: {
    fontSize: 15,
    color: INK,
    fontWeight: '700',
    marginTop: 4,
  },
  beanSelectorStock: {
    fontSize: 11,
    color: MUTED,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  beanSelectorStockShort: {
    color: ACCENT,
    fontWeight: '700',
  },

  cupsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    gap: 12,
  },
  cupsHint: {
    fontSize: 10,
    color: MUTED,
    marginTop: 4,
    fontStyle: 'italic',
  },
  cupsControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  cupsBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cupsBtnText: {
    fontSize: 20,
    color: ACCENT,
    fontWeight: '700',
  },
  cupsValue: {
    minWidth: 36,
    textAlign: 'center',
    fontSize: 18,
    color: INK,
    fontWeight: '700',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingVertical: 10,
  },

  // Bean picker modal
  beanModalRoot: { flex: 1, justifyContent: 'flex-end' },
  beanModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,12,8,0.55)',
  },
  beanModalSheet: {
    backgroundColor: CARD,
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  beanModalTitle: {
    fontSize: 12,
    letterSpacing: 2,
    color: MUTED,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  beanModalList: {
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  beanModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  beanModalRowActive: { backgroundColor: '#f5e9df' },
  beanModalRowName: { fontSize: 14, color: INK, fontWeight: '700' },
  beanModalRowMeta: { fontSize: 11, color: MUTED, marginTop: 2 },
  beanModalEmpty: {
    padding: 18,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  beanModalEmptyText: {
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 18,
  },
  beanModalCancel: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT,
  },
  beanModalCancelText: {
    color: ACCENT,
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 11,
  },
});