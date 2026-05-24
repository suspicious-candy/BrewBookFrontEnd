// app/recipes/add.jsx
// Reached from app/brewers/[id].jsx via an "Add Recipe" button:
//   router.push(`/recipes/add?brewerId=${brewer.BrewerID}`)
import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/src/api/client';

const STEP_TYPES = ['bloom', 'pour', 'wait', 'swirl', 'stir', 'drawdown', 'plunge'];

// ---------- API ----------
async function fetchBrewer(id) {
  const { data } = await apiClient.get(`/brewers/${id}`);
  return data;
}

async function fetchBeans() {
  const { data } = await apiClient.get('/beans');
  return data;
}

async function createRecipe(body) {
  const { data } = await apiClient.post('/recipes', body);
  return data;
}

// ---------- Auto-detection helpers ----------
function extractSeconds(t) {
  const lower = t.toLowerCase();
  const mmss = lower.match(/(\d+):(\d{2})/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const sec = lower.match(/(\d+)\s*(s|sec|second)/);
  if (sec) return Number(sec[1]);
  const min = lower.match(/(\d+)\s*(min|minute|m\b)/);
  if (min) return Number(min[1]) * 60;
  return null;
}

function extractGrams(t) {
  const lower = t.toLowerCase();
  const toX = lower.match(/(?:to|until|at|reach)\s*(\d+)\s*g/);
  if (toX) return Number(toX[1]);
  const anyG = lower.match(/(\d+)\s*g(?:rams?)?\b/);
  return anyG ? Number(anyG[1]) : null;
}

function guessType(t) {
  const lower = t.toLowerCase();
  if (/bloom/.test(lower))                    return 'bloom';
  if (/swirl/.test(lower))                    return 'swirl';
  if (/stir|spoon/.test(lower))               return 'stir';
  if (/plunge|press/.test(lower))             return 'plunge';
  if (/wait|rest|drop|drawdown/.test(lower))  return 'wait';
  if (/pour|stream|circle/.test(lower))       return 'pour';
  return 'pour';
}

function detectStep(paragraph) {
  return {
    text:     paragraph.trim(),
    type:     guessType(paragraph),
    duration: extractSeconds(paragraph) ?? 30,
    timed:    extractSeconds(paragraph) != null,
    to:       extractGrams(paragraph) ?? null,
    label:    '',
  };
}

function splitParagraphs(text) {
  return text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

let _id = 0;
const newId = () => `s_${++_id}`;

// ---------- Screen ----------
export default function AddRecipe() {
  const { brewerId } = useLocalSearchParams();
  const qc = useQueryClient();

  // Pre-fetch the brewer so we can show its name in the header
  const { data: brewer, isLoading: brewerLoading } = useQuery({
    queryKey: ['brewer', brewerId],
    queryFn: () => fetchBrewer(brewerId),
    enabled: !!brewerId,
  });

  const { data: beans } = useQuery({
    queryKey: ['beans'],
    queryFn: fetchBeans,
  });

  // ----- Form state -----
  const [beanId,    setBeanId]    = useState(null);
  const [coffeeIn,  setCoffeeIn]  = useState('15');
  const [waterIn,   setWaterIn]   = useState('250');
  const [waterTemp, setWaterTemp] = useState('93');
  const [bloomTime, setBloomTime] = useState('45');
  const [agitation, setAgitation] = useState(false);
  const [recipeBody, setRecipeBody] = useState('');
  const [rawText,   setRawText]   = useState('');
  const [steps,     setSteps]     = useState([]);  // step cards
  const [showBeanPicker, setShowBeanPicker] = useState(false);

  // ----- Derived values -----
  const dose  = Number(coffeeIn) || 0;
  const water = Number(waterIn)  || 0;
  const ratio = dose && water ? `1:${(water / dose).toFixed(1).replace(/\.0$/, '')}` : '—';

  const runningTotals = useMemo(() => {
    let time = 0;
    let lastTo = 0;
    for (const s of steps) {
      if (s.timed) time += Number(s.duration) || 0;
      if (s.to != null) lastTo = Number(s.to);
    }
    return { time, water: lastTo };
  }, [steps]);

  // ----- Mutations -----
  const saveMutation = useMutation({
    mutationFn: createRecipe,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['brewer-recipes', brewerId] });
      qc.invalidateQueries({ queryKey: ['recipes'] });
      router.replace(`/brewers/${brewerId}`);
    },
  });

  // ----- Handlers -----
  const handleSplit = () => {
    const paras = splitParagraphs(rawText);
    if (!paras.length) return;
    const detected = paras.map((p) => ({ id: newId(), ...detectStep(p) }));
    setSteps(detected);
  };

  const updateStep = (id, patch) =>
    setSteps((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const deleteStep = (id) =>
    setSteps((arr) => arr.filter((s) => s.id !== id));

  const moveStep = (id, dir) => {
    setSteps((arr) => {
      const i = arr.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return arr;
      const copy = [...arr];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  const addBlankStep = () => {
    setSteps((arr) => [
      ...arr,
      {
        id: newId(),
        text: '',
        type: 'pour',
        timed: true,
        duration: 30,
        to: arr.length ? arr[arr.length - 1].to ?? 0 : 0,
        label: '',
      },
    ]);
  };

  const handleSave = () => {
    if (!steps.length) return;
    let at = 0;
    const pours = steps.map((s) => {
      const entry = {
        at,
        to: Number(s.to) || 0,
        note: s.text,
        type: s.type,
        label: s.label || undefined,
      };
      if (s.timed) at += Number(s.duration) || 0;
      return entry;
    });
    saveMutation.mutate({
      Brewer: brewer?._id,
      bean: beanId ?? undefined,
      RecipeBody: recipeBody?.trim() || `${brewer?.Name ?? 'Recipe'} · ${dose}g : ${water}g`,
      CoffeeIn:  dose,
      WaterIn:   water,
      WaterTemp: Number(waterTemp) || undefined,
      bloomTime: Number(bloomTime) || undefined,
      BrewTime:  at,
      Agitation: agitation ? 'yes' : 'no',
      pours,
    });
  };

  // ----- Validation -----
  const lastPourMatches =
    steps.length === 0 || Math.abs((Number(steps[steps.length - 1]?.to) || 0) - water) <= 1;
  const canSave = steps.length > 0 && dose > 0 && water > 0 && lastPourMatches;

  if (brewerLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.safe}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="arrow-back" size={20} color={ACCENT} />
          </Pressable>
          <Text style={styles.topTitle}>NEW RECIPE</Text>
          <View style={{ width: 20 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Brewer header (pre-filled) */}
          <View style={styles.brewerCard}>
            <Text style={styles.brewerLabel}>BREWER</Text>
            <Text style={styles.brewerName}>
              {(brewer?.Name || 'Unknown').toUpperCase()}
            </Text>
            <Text style={styles.brewerSub}>
              UNIT #{String(brewer?.BrewerID ?? '—').padStart(3, '0')}
              {brewer?.Type ? `  •  ${brewer.Type.toUpperCase()}` : ''}
            </Text>
          </View>

          {/* Bean (optional) */}
          <SectionHeader label="BEAN (OPTIONAL)" />
          <View style={styles.beanBox}>
            <Pressable
              style={styles.beanSelector}
              onPress={() => setShowBeanPicker((v) => !v)}
            >
              <Text style={styles.beanSelectorText}>
                {beanId
                  ? (beans?.find((b) => b._id === beanId)?.Name ?? 'Select…')
                  : 'No bean attached'}
              </Text>
              <Ionicons
                name={showBeanPicker ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={MUTED}
              />
            </Pressable>
            {showBeanPicker && (
              <View style={styles.beanList}>
                <Pressable
                  style={styles.beanOption}
                  onPress={() => {
                    setBeanId(null);
                    setShowBeanPicker(false);
                  }}
                >
                  <Text style={styles.beanOptionText}>None</Text>
                </Pressable>
                {beans?.map((b) => (
                  <Pressable
                    key={b._id}
                    style={[styles.beanOption, beanId === b._id && styles.beanOptionActive]}
                    onPress={() => {
                      setBeanId(b._id);
                      setShowBeanPicker(false);
                    }}
                  >
                    <Text style={styles.beanOptionText}>{b.Name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Parameters */}
          <SectionHeader label="BREW PARAMETERS" />
          <View style={styles.paramGrid}>
            <ParamInput label="DOSE"  value={coffeeIn}  onChange={setCoffeeIn}  unit="g"  right />
            <ParamInput label="WATER" value={waterIn}   onChange={setWaterIn}   unit="g" />
          </View>
          <View style={styles.paramGrid}>
            <ParamInput label="TEMP"   value={waterTemp} onChange={setWaterTemp} unit="°C" right />
            <View style={styles.paramCell}>
              <Text style={styles.paramLabel}>RATIO</Text>
              <Text style={styles.paramReadOnly}>{ratio}</Text>
            </View>
          </View>
          <View style={styles.paramGrid}>
            <ParamInput label="BLOOM" value={bloomTime} onChange={setBloomTime} unit="s"  right />
            <View style={[styles.paramCell, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={styles.paramLabel}>AGITATION</Text>
              <Switch
                value={agitation}
                onValueChange={setAgitation}
                trackColor={{ true: ACCENT, false: '#bdb6a4' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Summary line (optional) */}
          <SectionHeader label="SUMMARY (1 LINE)" />
          <TextInput
            value={recipeBody}
            onChangeText={setRecipeBody}
            placeholder="e.g. Tetsu 4:6 method, 5 pours, ~3:30 total"
            placeholderTextColor="#9a9a9a"
            style={styles.summaryInput}
          />

          {/* Paste recipe text */}
          <SectionHeader label="PASTE RECIPE TEXT" />
          <View style={styles.pasteBox}>
            <Text style={styles.pasteHint}>
              One paragraph per step. Separate steps with a blank line.
            </Text>
            <TextInput
              value={rawText}
              onChangeText={setRawText}
              placeholder={
                "Pour 30g of water for the bloom and swirl gently. Wait 45s.\n\nPour to 100g in slow circles over 15 seconds.\n\nWait for the bed to drop.\n\n..."
              }
              placeholderTextColor="#9a9a9a"
              multiline
              style={styles.pasteInput}
              textAlignVertical="top"
            />
            <Pressable
              style={[styles.splitBtn, !rawText.trim() && { opacity: 0.4 }]}
              onPress={handleSplit}
              disabled={!rawText.trim()}
            >
              <Ionicons name="git-branch-outline" size={16} color="#fff" />
              <Text style={styles.splitBtnText}>SPLIT INTO STEPS</Text>
            </Pressable>
          </View>

          {/* Steps */}
          {steps.length > 0 && (
            <>
              <SectionHeader label={`STEPS (${steps.length})`} />
              {steps.map((s, i) => (
                <StepCard
                  key={s.id}
                  index={i + 1}
                  step={s}
                  isFirst={i === 0}
                  isLast={i === steps.length - 1}
                  onChange={(patch) => updateStep(s.id, patch)}
                  onDelete={() => deleteStep(s.id)}
                  onMoveUp={() => moveStep(s.id, -1)}
                  onMoveDown={() => moveStep(s.id, +1)}
                />
              ))}

              <Pressable style={styles.addStepBtn} onPress={addBlankStep}>
                <Ionicons name="add" size={16} color={ACCENT} />
                <Text style={styles.addStepText}>ADD STEP</Text>
              </Pressable>
            </>
          )}
        </ScrollView>

        {/* Running totals + Save (sticky) */}
        <View style={styles.footer}>
          <View style={styles.totalsRow}>
            <View>
              <Text style={styles.totalsLabel}>TOTAL TIME</Text>
              <Text style={styles.totalsValue}>
                {Math.floor(runningTotals.time / 60)}:
                {String(runningTotals.time % 60).padStart(2, '0')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.totalsLabel}>WATER</Text>
              <Text
                style={[
                  styles.totalsValue,
                  !lastPourMatches && { color: ACCENT },
                ]}
              >
                {runningTotals.water}g / {water}g
              </Text>
            </View>
          </View>
          {!lastPourMatches && steps.length > 0 && (
            <Text style={styles.warnText}>
              ⚠ Last step's "pour to" must equal {water}g
            </Text>
          )}
          {saveMutation.isError && (
            <Text style={styles.warnText}>
              {saveMutation.error?.message ?? 'Save failed. Tap to retry.'}
            </Text>
          )}
          <Pressable
            style={[styles.saveBtn, (!canSave || saveMutation.isPending) && { opacity: 0.4 }]}
            onPress={handleSave}
            disabled={!canSave || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>SAVE RECIPE</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
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

function ParamInput({ label, value, onChange, unit, right }) {
  return (
    <View style={[styles.paramCell, right && styles.paramCellRight]}>
      <Text style={styles.paramLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          style={styles.paramInput}
        />
        <Text style={styles.paramUnit}>{unit}</Text>
      </View>
    </View>
  );
}

function StepCard({ index, step, isFirst, isLast, onChange, onDelete, onMoveUp, onMoveDown }) {
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepIndex}>STEP {String(index).padStart(2, '0')}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable onPress={onMoveUp} disabled={isFirst} hitSlop={6}>
            <Ionicons name="chevron-up" size={16} color={isFirst ? '#bdb6a4' : INK} />
          </Pressable>
          <Pressable onPress={onMoveDown} disabled={isLast} hitSlop={6}>
            <Ionicons name="chevron-down" size={16} color={isLast ? '#bdb6a4' : INK} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={6}>
            <Ionicons name="trash-outline" size={16} color={ACCENT} />
          </Pressable>
        </View>
      </View>

      <TextInput
        value={step.text}
        onChangeText={(t) => onChange({ text: t })}
        placeholder="Step description"
        placeholderTextColor="#9a9a9a"
        multiline
        style={styles.stepText}
        textAlignVertical="top"
      />

      {/* Type chips */}
      <View style={styles.chipRow}>
        {STEP_TYPES.map((t) => (
          <Pressable
            key={t}
            onPress={() => onChange({ type: t })}
            style={[styles.chip, step.type === t && styles.chipActive]}
          >
            <Text style={[styles.chipText, step.type === t && styles.chipTextActive]}>
              {t.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.stepFieldsRow}>
        {/* Timed toggle + duration */}
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={styles.toggleRow}>
            <Text style={styles.fieldLabel}>TIMED?</Text>
            <Switch
              value={step.timed}
              onValueChange={(v) => onChange({ timed: v })}
              trackColor={{ true: ACCENT, false: '#bdb6a4' }}
              thumbColor="#fff"
            />
          </View>
          {step.timed && (
            <View style={styles.inlineInputRow}>
              <Text style={styles.fieldLabel}>DURATION</Text>
              <TextInput
                value={String(step.duration ?? '')}
                onChangeText={(t) => onChange({ duration: Number(t.replace(/\D/g, '')) || 0 })}
                keyboardType="numeric"
                style={styles.inlineInput}
              />
              <Text style={styles.fieldUnit}>s</Text>
            </View>
          )}
        </View>

        {/* Pour to target */}
        <View style={{ flex: 1, paddingLeft: 8, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: BORDER }}>
          <View style={styles.inlineInputRow}>
            <Text style={styles.fieldLabel}>POUR TO</Text>
            <TextInput
              value={step.to != null ? String(step.to) : ''}
              onChangeText={(t) => onChange({ to: t === '' ? null : Number(t.replace(/\D/g, '')) || 0 })}
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor="#9a9a9a"
              style={styles.inlineInput}
            />
            <Text style={styles.fieldUnit}>g</Text>
          </View>
        </View>
      </View>
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
const DARK = '#2a1a13';

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
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  topTitle: { fontSize: 14, letterSpacing: 2, color: ACCENT, fontWeight: '700' },

  brewerCard: {
    padding: 16,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  brewerLabel: { fontSize: 10, color: MUTED, letterSpacing: 1.5, fontWeight: '600' },
  brewerName:  { fontSize: 18, color: INK, fontWeight: '700', marginTop: 4 },
  brewerSub:   { fontSize: 11, color: MUTED, letterSpacing: 1, marginTop: 4 },

  sectionHeader: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#e9e3d4',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  sectionHeaderText: { fontSize: 10, letterSpacing: 1.5, color: INK, fontWeight: '700' },

  beanBox: { backgroundColor: CARD },
  beanSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  beanSelectorText: { fontSize: 13, color: INK, fontWeight: '600' },
  beanList: { backgroundColor: '#fff' },
  beanOption: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  beanOptionActive: { backgroundColor: TINT },
  beanOptionText: { fontSize: 12, color: INK },

  paramGrid: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  paramCell: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  paramCellRight: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: BORDER,
  },
  paramLabel: { fontSize: 10, color: MUTED, letterSpacing: 1.5, fontWeight: '600' },
  paramInput: {
    fontSize: 20, color: INK, fontWeight: '700',
    minWidth: 50, paddingVertical: 0,
  },
  paramUnit: { fontSize: 13, color: MUTED, marginLeft: 4 },
  paramReadOnly: { fontSize: 20, color: INK, fontWeight: '700', marginTop: 4 },

  summaryInput: {
    backgroundColor: CARD,
    padding: 12,
    fontSize: 13,
    color: INK,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },

  pasteBox: {
    backgroundColor: CARD,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  pasteHint: { fontSize: 11, color: MUTED, marginBottom: 6 },
  pasteInput: {
    minHeight: 130,
    backgroundColor: '#fff',
    padding: 10,
    fontSize: 13,
    color: INK,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  splitBtn: {
    flexDirection: 'row',
    backgroundColor: DARK,
    paddingVertical: 12,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  splitBtnText: { color: '#fff', fontWeight: '700', letterSpacing: 1.5, fontSize: 11 },

  stepCard: {
    backgroundColor: CARD,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepIndex: { fontSize: 10, color: ACCENT, letterSpacing: 1.5, fontWeight: '700' },
  stepText: {
    backgroundColor: '#fff',
    padding: 10,
    fontSize: 13,
    color: INK,
    minHeight: 60,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipText: { fontSize: 10, color: MUTED, letterSpacing: 1, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  stepFieldsRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineInputRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 6, gap: 6,
  },
  fieldLabel: { fontSize: 10, color: MUTED, letterSpacing: 1, fontWeight: '600' },
  inlineInput: {
    minWidth: 50,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13, color: INK, fontWeight: '700',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    textAlign: 'center',
  },
  fieldUnit: { fontSize: 11, color: MUTED },

  addStepBtn: {
    flexDirection: 'row',
    gap: 6,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  addStepText: { fontSize: 11, color: ACCENT, fontWeight: '700', letterSpacing: 1.5 },

  footer: {
    padding: 14,
    backgroundColor: CARD,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  totalsLabel: { fontSize: 10, color: MUTED, letterSpacing: 1.5, fontWeight: '600' },
  totalsValue: { fontSize: 16, color: INK, fontWeight: '700', marginTop: 2 },
  warnText: { fontSize: 11, color: ACCENT, marginBottom: 8 },

  saveBtn: {
    backgroundColor: DARK,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', letterSpacing: 1.5, fontSize: 12 },
});