// app/notes/[id].jsx
import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/api/client';

// ---------- API ----------
async function fetchNote(id) {
  const { data } = await apiClient.get(`/notes/${id}`);
  return data;
}

async function deleteNote(id) {
  const { data } = await apiClient.delete(`/notes/${id}`);
  return data;
}

// ---------- Helpers ----------
function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).toUpperCase();
}

function fmtTime(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtSeconds(s) {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function ratioOf(coffee, water) {
  if (!coffee || !water) return '—';
  const r = (water / coffee).toFixed(1).replace(/\.0$/, '');
  return `1:${r}`;
}

function paramEntries(tracked) {
  if (!tracked) return [];
  if (tracked instanceof Map) return Array.from(tracked.entries());
  return Object.entries(tracked);
}

// ---------- Screen ----------
export default function NoteDetail() {
  const { NotesId: id } = useLocalSearchParams();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: note, isLoading, isError, refetch } = useQuery({
    queryKey: ['note', id],
    queryFn: () => fetchNote(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteNote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      setConfirmOpen(false);
      router.back();
    },
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (isError || !note) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn't load this entry.</Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const beanName =
    note.Recipe?.bean?.details?.Name ||
    note.Recipe?.bean?.Name ||
    'Unknown Bean';
  const brewerName = note.Recipe?.Brewer?.Name || 'Unknown Brewer';
  const recipeNum  = note.Recipe?.ID ? `RECIPE #${String(note.Recipe.ID).padStart(3, '0')}` : '';
  const tracked    = paramEntries(note.trackedParameters);

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={ACCENT} />
        </Pressable>
        <Text style={styles.topTitle}>
          LEDGER ENTRY #{String(note.ID).padStart(3, '0')}
        </Text>
        <Pressable hitSlop={10} onPress={() => setConfirmOpen(true)}>
          <Ionicons name="trash-outline" size={18} color={ACCENT} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero — rating + date */}
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroDate}>{fmtDate(note.Date)}</Text>
            <Text style={styles.heroTime}>{fmtTime(note.Date)}</Text>
            <Text style={styles.heroBean} numberOfLines={2}>{beanName}</Text>
            <Text style={styles.heroBrewer}>
              {brewerName.toUpperCase()}
              {recipeNum ? `  •  ${recipeNum}` : ''}
            </Text>
          </View>
          <View style={styles.ratingBlock}>
            <Text style={styles.ratingValue}>
              {note.overallRating != null ? note.overallRating.toFixed(1) : '—'}
            </Text>
            <Text style={styles.ratingLabel}>RATING</Text>
          </View>
        </View>

        {/* BREW PARAMETERS */}
        <SectionHeader icon="cog-outline" label="BREW PARAMETERS" />
        <View style={styles.paramGrid}>
          <ParamCell label="DOSE"        value={note.CoffeeIn  != null ? `${note.CoffeeIn}g`   : '—'} right />
          <ParamCell label="WATER"       value={note.WaterIn   != null ? `${note.WaterIn}g`    : '—'} />
        </View>
        <View style={styles.paramGrid}>
          <ParamCell label="TEMP"        value={note.WaterTemp != null ? `${note.WaterTemp}°C` : '—'} right />
          <ParamCell label="RATIO"       value={ratioOf(note.CoffeeIn, note.WaterIn)} />
        </View>
        <View style={styles.paramGrid}>
          <ParamCell label="GRIND"       value={note.grindSize != null ? `${note.grindSize} clicks` : '—'} right />
          <ParamCell label="BLOOM"       value={note.bloomTime != null ? `${note.bloomTime}s`     : '—'} />
        </View>
        <View style={styles.paramGrid}>
          <ParamCell label="BREW TIME"   value={fmtSeconds(note.BrewTime)} right />
          <ParamCell label="AGITATION"   value={(note.Agitation || '—').toUpperCase()} />
        </View>

        {/* TASTING PROFILE */}
        <SectionHeader icon="analytics-outline" label="TASTING PROFILE" />
        <View style={styles.profileBox}>
          <Meter label="BODY"       value={note.body} />
          <Meter label="ACIDITY"    value={note.acidity} />
          <Meter label="BITTERNESS" value={note.bitterness} />
        </View>

        {/* TASTING NOTES */}
        <SectionHeader icon="flower-outline" label="TASTING NOTES" />
        <View style={styles.chipsBox}>
          {note.tastingNotes?.length ? (
            note.tastingNotes.map((t, i) => (
              <View key={`${t}-${i}`} style={styles.chip}>
                <Text style={styles.chipText}>{t}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.placeholder}>No tasting notes recorded.</Text>
          )}
        </View>

        {/* ADDITIONAL NOTES */}
        <SectionHeader icon="document-text-outline" label="ADDITIONAL NOTES" />
        <View style={styles.notesBox}>
          <Text style={styles.notesBody}>
            {note.AdditionalNotes?.trim() || 'No additional notes.'}
          </Text>
        </View>

        {/* TRACKED PARAMETERS */}
        {tracked.length > 0 && (
          <>
            <SectionHeader icon="list-outline" label="TRACKED PARAMETERS" />
            <View style={styles.trackedBox}>
              {tracked.map(([k, v]) => (
                <View key={k} style={styles.trackedRow}>
                  <Text style={styles.trackedLabel}>{k.toUpperCase()}</Text>
                  <Text style={styles.trackedValue}>{String(v)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Metadata footer */}
        <View style={styles.metaFooter}>
          <Text style={styles.metaText}>
            Logged {fmtDate(note.createdAt)} · Entry #{note.ID}
          </Text>
        </View>
      </ScrollView>

      {/* Delete button (sticky bottom) */}
      <View style={styles.footer}>
        <Pressable
          onPress={() => setConfirmOpen(true)}
          style={styles.deleteBtn}
        >
          <Ionicons name="trash-outline" size={16} color="#fff" />
          <Text style={styles.deleteText}>DELETE ENTRY</Text>
        </Pressable>
      </View>

      {/* Confirmation modal */}
      <Modal
        transparent
        animationType="fade"
        visible={confirmOpen}
        onRequestClose={() => setConfirmOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setConfirmOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Ionicons name="warning-outline" size={28} color={ACCENT} />
            <Text style={styles.modalTitle}>DELETE ENTRY?</Text>
            <Text style={styles.modalBody}>
              This will permanently remove ledger entry #
              {String(note.ID).padStart(3, '0')}. This action can't be undone.
            </Text>

            {deleteMutation.isError && (
              <Text style={styles.modalError}>
                Couldn't delete. Tap confirm to retry.
              </Text>
            )}

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setConfirmOpen(false)}
                style={styles.modalCancel}
                disabled={deleteMutation.isPending}
              >
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                onPress={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                style={[
                  styles.modalConfirm,
                  deleteMutation.isPending && { opacity: 0.5 },
                ]}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>DELETE</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------- Subcomponents ----------
function SectionHeader({ icon, label }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={13} color={INK} />
      <Text style={styles.sectionHeaderText}>{label}</Text>
    </View>
  );
}

function ParamCell({ label, value, right }) {
  return (
    <View style={[styles.paramCell, right && styles.paramCellRight]}>
      <Text style={styles.paramLabel}>{label}</Text>
      <Text style={styles.paramValue}>{value}</Text>
    </View>
  );
}

function Meter({ label, value }) {
  const v = value != null ? Math.max(0, Math.min(10, value)) : null;
  return (
    <View style={styles.meterRow}>
      <Text style={styles.meterLabel}>{label}</Text>
      <View style={styles.meterTrack}>
        <View
          style={[
            styles.meterFill,
            { width: v != null ? `${v * 10}%` : '0%' },
          ]}
        />
      </View>
      <Text style={styles.meterValue}>{v != null ? v.toFixed(1) : '—'}</Text>
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
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  topTitle: {
    fontSize: 12, letterSpacing: 2, color: INK, fontWeight: '700',
  },

  hero: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  heroDate: { fontSize: 11, color: ACCENT, fontWeight: '700', letterSpacing: 1.5 },
  heroTime: { fontSize: 11, color: MUTED, marginTop: 2 },
  heroBean: { fontSize: 20, color: INK, fontWeight: '700', marginTop: 8 },
  heroBrewer: { fontSize: 10, color: MUTED, letterSpacing: 1.5, marginTop: 6, fontWeight: '600' },

  ratingBlock: {
    width: 80,
    backgroundColor: TINT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e9c4b8',
    marginLeft: 10,
  },
  ratingValue: { fontSize: 26, fontWeight: '700', color: INK },
  ratingLabel: { fontSize: 9, color: MUTED, letterSpacing: 1.5, fontWeight: '700', marginTop: 2 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#e9e3d4',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  sectionHeaderText: {
    fontSize: 10, letterSpacing: 1.5, color: INK, fontWeight: '700',
  },

  paramGrid: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  paramCell: { flex: 1, padding: 12 },
  paramCellRight: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: BORDER,
  },
  paramLabel: { fontSize: 10, color: MUTED, letterSpacing: 1.5, fontWeight: '600' },
  paramValue: { fontSize: 15, color: INK, fontWeight: '700', marginTop: 4 },

  profileBox: {
    backgroundColor: CARD,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  meterLabel: {
    width: 90, fontSize: 10, color: MUTED, letterSpacing: 1.5, fontWeight: '700',
  },
  meterTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#f1d9d3',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT,
    overflow: 'hidden',
  },
  meterFill: { height: '100%', backgroundColor: ACCENT, opacity: 0.5 },
  meterValue: { width: 32, textAlign: 'right', fontSize: 12, color: INK, fontWeight: '700' },

  chipsBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 14,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: TINT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT,
  },
  chipText: { fontSize: 11, color: INK, fontWeight: '600' },

  notesBox: {
    padding: 14,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  notesBody: { fontSize: 13, color: INK, lineHeight: 19 },
  placeholder: { fontSize: 12, color: MUTED, fontStyle: 'italic' },

  trackedBox: {
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  trackedRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  trackedLabel: { flex: 1, fontSize: 11, color: MUTED, letterSpacing: 1, fontWeight: '600' },
  trackedValue: { fontSize: 12, color: INK, fontWeight: '600' },

  metaFooter: { padding: 14, alignItems: 'center' },
  metaText: { fontSize: 10, color: MUTED, letterSpacing: 1 },

  footer: {
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    backgroundColor: CREAM,
  },
  deleteBtn: {
    flexDirection: 'row',
    backgroundColor: ACCENT,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteText: {
    color: '#fff', fontWeight: '700', letterSpacing: 1.5, fontSize: 12,
  },

  errorText: { color: INK, marginBottom: 12 },
  retryBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '600' },

  // Confirmation modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 12, 8, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: CARD,
    padding: 22,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 14, fontWeight: '700', color: INK,
    letterSpacing: 2, marginTop: 10,
  },
  modalBody: {
    fontSize: 12, color: MUTED, textAlign: 'center',
    marginTop: 8, lineHeight: 18,
  },
  modalError: {
    fontSize: 11, color: ACCENT, marginTop: 10, fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    width: '100%',
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
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#fff', fontWeight: '700', letterSpacing: 1.5, fontSize: 11,
  },
});