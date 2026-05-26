// app/brew/log.jsx
// Reached from the "ADD BREW TO NOTES" button on the brew session done screen.
// Route params: notesId (required), recipeId?, beanId?, brewerId?
import { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  PanResponder,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/api/client';

// ---------- API ----------
async function patchNote({ id, body }) {
  const { data } = await apiClient.patch(`/notes/${id}`, body);
  return data;
}

async function decrementBean({ beanId, grams }) {
  // Optional: backend should decrement Quantity by `grams` for this bean.
  if (!beanId || !grams) return null;
  const { data } = await apiClient.patch(`/beans/${beanId}/consume`, { grams });
  return data;
}

// ---------- Screen ----------
export default function BrewLog() {
  const { notesId, beanId, recipeId } = useLocalSearchParams();
  const qc = useQueryClient();

  const [acidity,   setAcidity]   = useState(5);
  const [sweetness, setSweetness] = useState(5);
  const [body,      setBody]      = useState(5);
  const [finish,    setFinish]    = useState(5);
  const [notes,     setNotes]     = useState('');
  const [showDone,  setShowDone]  = useState(false);

  const overallRating = useMemo(
    () => Number(((acidity + sweetness + body + finish) / 4).toFixed(1)),
    [acidity, sweetness, body, finish]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updated = await patchNote({
        id: notesId,
        body: {
          acidity,
          body,
          // Notes schema has `bitterness` not `sweetness`/`finish` — store extras in trackedParameters
          trackedParameters: {
            sweetness,
            finish,
          },
          AdditionalNotes: notes.trim(),
          overallRating,
          // Parse the notes paragraph into tastingNotes chips (commas + "and")
          tastingNotes: notes
            .split(/[,;]| and /i)
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
      // Optional: decrement the bean's stock by the dose used (uses Notes.CoffeeIn)
      if (updated?.CoffeeIn && beanId) {
        await decrementBean({ beanId, grams: updated.CoffeeIn });
      }
      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['note', notesId] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['me-stats'] });
      if (beanId) qc.invalidateQueries({ queryKey: ['bean', beanId] });
      setShowDone(true);
    },
  });

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
            <Ionicons name="arrow-back" size={20} color={INK} />
          </Pressable>
          <Text style={styles.topTitle}>TASTING LOG</Text>
          <View style={{ width: 20 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <SliderRow label="ACIDITY"   value={acidity}   onChange={setAcidity} />
          <SliderRow label="SWEETNESS" value={sweetness} onChange={setSweetness} />
          <SliderRow label="BODY"      value={body}      onChange={setBody} />
          <SliderRow label="FINISH"    value={finish}    onChange={setFinish} />

          {/* Notes */}
          <View style={styles.notesBox}>
            <View style={styles.notesHeader}>
              <Text style={styles.notesLabel}>NOTES</Text>
              <Ionicons name="reorder-three-outline" size={16} color={MUTED} />
            </View>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Enter tasting notes, flavor profiles, and extraction observations..."
              placeholderTextColor="#a09a8d"
              multiline
              style={styles.notesInput}
              textAlignVertical="top"
            />
          </View>

          {/* Computed overall rating preview */}
          <View style={styles.ratingPreview}>
            <Text style={styles.ratingPreviewLabel}>OVERALL RATING (avg)</Text>
            <Text style={styles.ratingPreviewValue}>{overallRating.toFixed(1)}</Text>
          </View>
        </ScrollView>

        {/* Save */}
        <View style={styles.footer}>
          {saveMutation.isError && (
            <Text style={styles.errorText}>
              Couldn't save. Tap again to retry.
            </Text>
          )}
          <Pressable
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            style={[styles.saveBtn, saveMutation.isPending && { opacity: 0.5 }]}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>SAVE ENTRY</Text>
            )}
          </Pressable>
        </View>

        {/* Done overlay */}
        <DoneOverlay visible={showDone} />
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------- Subcomponents ----------
function SliderRow({ label, value, onChange }) {
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{value.toFixed(1)}</Text>
      </View>
      <Slider value={value} onChange={onChange} min={0} max={10} step={0.1} />
    </View>
  );
}

function Slider({ value, onChange, min = 0, max = 10, step = 0.1 }) {
  const widthRef = useRef(0);

  const updateFromX = (x) => {
    const w = widthRef.current;
    if (!w) return;
    const pct = Math.max(0, Math.min(1, x / w));
    const raw = min + (max - min) * pct;
    const rounded = Math.round(raw / step) * step;
    onChange(Number(rounded.toFixed(1)));
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => updateFromX(e.nativeEvent.locationX),
        onPanResponderMove:  (e) => updateFromX(e.nativeEvent.locationX),
      }),
    []
  );

  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));

  return (
    <View
      onLayout={(e) => (widthRef.current = e.nativeEvent.layout.width)}
      {...responder.panHandlers}
      style={styles.track}
    >
      <View style={styles.trackLine} />
      <View
        style={[
          styles.handle,
          { left: `${pct * 100}%` },
        ]}
      />
    </View>
  );
}

function DoneOverlay({ visible }) {
  // Auto-redirect to home after a moment
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => router.replace('/'), 2400);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.doneRoot}>
        <View style={styles.doneCard}>
          <View style={styles.doneBanner}>
            <Ionicons name="checkmark-circle" size={42} color="#fff" />
            <Text style={styles.doneBannerTitle}>NOTE LOGGED</Text>
            <Text style={styles.doneBannerSub}>NICE PALATE</Text>
          </View>

          <Text style={styles.doneMessage}>
            Your tasting log has been added to the ledger.
          </Text>

          <Pressable
            style={styles.doneBtn}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.doneBtnText}>BACK TO HOME</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ---------- Styles ----------
const CREAM = '#f3eee5';
const CARD = '#faf6ed';
const INPUT_BG = '#ebe5d6';
const ACCENT = '#c0432b';
const INK = '#1f1f1f';
const MUTED = '#6b6b6b';
const BORDER = '#cdc7b8';
const DARK = '#2a1a13';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  topTitle: { fontSize: 14, letterSpacing: 3, color: INK, fontWeight: '700' },

  sliderRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sliderLabel: { fontSize: 11, color: INK, letterSpacing: 1.5, fontWeight: '600' },
  sliderValue: { fontSize: 12, color: INK, fontWeight: '700' },

  track: {
    height: 36,
    justifyContent: 'center',
    marginTop: 4,
  },
  trackLine: { height: 1, backgroundColor: BORDER },
  handle: {
    position: 'absolute',
    width: 14,
    height: 14,
    marginLeft: -7,
    backgroundColor: DARK,
  },

  notesBox: {
    marginTop: 12,
    backgroundColor: INPUT_BG,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notesLabel: { fontSize: 11, color: INK, letterSpacing: 1.5, fontWeight: '600' },
  notesInput: {
    marginTop: 8,
    minHeight: 110,
    fontSize: 13,
    color: INK,
    lineHeight: 18,
  },

  ratingPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CARD,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    marginTop: 12,
  },
  ratingPreviewLabel: { fontSize: 11, color: MUTED, letterSpacing: 1.5, fontWeight: '600' },
  ratingPreviewValue: { fontSize: 22, color: ACCENT, fontWeight: '700' },

  footer: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: CREAM,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  errorText: { color: ACCENT, textAlign: 'center', marginBottom: 8 },
  saveBtn: {
    backgroundColor: DARK,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', letterSpacing: 2, fontSize: 12 },

  // Done overlay
  doneRoot: {
    flex: 1,
    backgroundColor: 'rgba(20, 12, 8, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  doneCard: {
    backgroundColor: CARD,
    width: '100%',
    maxWidth: 380,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  doneBanner: {
    backgroundColor: ACCENT,
    paddingVertical: 30,
    alignItems: 'center',
  },
  doneBannerTitle: {
    color: '#fff', fontSize: 18, fontWeight: '700',
    letterSpacing: 3, marginTop: 10,
  },
  doneBannerSub: {
    color: '#fce5de', fontSize: 11, letterSpacing: 2, marginTop: 2,
  },
  doneMessage: {
    fontSize: 13, color: INK, padding: 18,
    textAlign: 'center', lineHeight: 19,
  },
  doneBtn: {
    backgroundColor: DARK,
    margin: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '700', letterSpacing: 2, fontSize: 12 },
});