// app/(tabs)/journal/index.jsx  (or app/notes/index.jsx — either works)
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

// ---------- API ----------
async function fetchNotes() {
  // Expect backend to populate Recipe (and through it: Brewer + bean).
  const { data } = await apiClient.get('/notes');
  return data;
}

// ---------- Helpers ----------
function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  const m = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  return `${m} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
}

function brewerName(note) {
  return note.Recipe?.Brewer?.Name || 'BREWER';
}

function beanName(note) {
  return note.Recipe?.bean?.Name || 'UNKNOWN BEAN';
}

function tastingLine(note) {
  if (note.tastingNotes?.length) return note.tastingNotes.join(', ');
  if (note.AdditionalNotes) return note.AdditionalNotes;
  return '—';
}

function brewerIconName(type) {
  switch (type) {
    case 'espresso':    return 'flash-outline';
    case 'immersion':   return 'water-outline';
    case 'Perculation': return 'funnel-outline';
    default:            return 'cafe-outline';
  }
}

// ---------- Screen ----------
export default function NotesJournal() {
  const [search, setSearch] = useState('');
  const [beanFilter, setBeanFilter]     = useState(null); // bean.Name
  const [brewerFilter, setBrewerFilter] = useState(null); // brewer.Name
  const [picker, setPicker] = useState(null);             // 'bean' | 'brewer' | null

  const { data: notes, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['notes'],
    queryFn: fetchNotes,
  });

  // Unique filter options derived from the data
  const beanOptions = useMemo(() => {
    const s = new Set();
    notes?.forEach((n) => n.Recipe?.bean?.Name && s.add(n.Recipe.bean.Name));
    return Array.from(s).sort();
  }, [notes]);

  const brewerOptions = useMemo(() => {
    const s = new Set();
    notes?.forEach((n) => n.Recipe?.Brewer?.Name && s.add(n.Recipe.Brewer.Name));
    return Array.from(s).sort();
  }, [notes]);

  // Filter + search
  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (beanFilter   && n.Recipe?.bean?.Name   !== beanFilter)   return false;
      if (brewerFilter && n.Recipe?.Brewer?.Name !== brewerFilter) return false;
      if (!q) return true;
      const hay = [
        beanName(n),
        brewerName(n),
        tastingLine(n),
        n.AdditionalNotes ?? '',
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [notes, search, beanFilter, brewerFilter]);

  const resetFilters = () => {
    setBeanFilter(null);
    setBrewerFilter(null);
    setSearch('');
  };

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
        <Text style={styles.errorText}>Couldn't load your journal.</Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header + search */}
      <View style={styles.headerBox}>
        <Text style={styles.headerTitle}>Journal</Text>
        <Pressable hitSlop={10}>
          <Ionicons name="search" size={20} color={INK} />
        </Pressable>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search notes, beans, brewers…"
        placeholderTextColor={MUTED}
        style={styles.search}
      />

      {/* Filter chips */}
      <View style={styles.chipsRow}>
        <Chip
          label={beanFilter ? beanFilter.toUpperCase() : 'BY BEAN'}
          active={!!beanFilter}
          onPress={() => setPicker('bean')}
          dropdown
        />
        <Chip
          label={brewerFilter ? brewerFilter.toUpperCase() : 'BY BREWER'}
          active={!!brewerFilter}
          onPress={() => setPicker('brewer')}
          dropdown
        />
        <Pressable onPress={resetFilters} hitSlop={6}>
          <Text style={styles.resetText}>RESET</Text>
        </Pressable>
      </View>

      {/* List */}
      <FlatList
        data={filteredNotes}
        keyExtractor={(n) => String(n._id ?? n.ID)}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No entries yet.</Text>
          </View>
        }
        renderItem={({ item }) => <NoteRow note={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => router.push('/brew/start')}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {/* Filter picker modal */}
      <FilterModal
        title={picker === 'bean' ? 'FILTER BY BEAN' : 'FILTER BY BREWER'}
        options={picker === 'bean' ? beanOptions : brewerOptions}
        visible={!!picker}
        current={picker === 'bean' ? beanFilter : brewerFilter}
        onClose={() => setPicker(null)}
        onPick={(val) => {
          if (picker === 'bean') setBeanFilter(val);
          else setBrewerFilter(val);
          setPicker(null);
        }}
      />
    </SafeAreaView>
  );
}

// ---------- Subcomponents ----------
function NoteRow({ note }) {
  const rating = note.overallRating ?? null;
  const dim = rating != null && rating < 7;

  return (
    <Pressable
      style={[styles.row, dim && styles.rowDim]}
      onPress={() => router.push(`/notes/${note.ID}`)}
    >
      <View style={{ flex: 1, paddingRight: 10 }}>
        <View style={styles.rowTopLine}>
          <Text style={[styles.dateText, dim && styles.textDim]}>
            {fmtDate(note.Date)}
          </Text>
          <Text style={[styles.bulletText, dim && styles.textDim]}>•</Text>
          <Ionicons
            name={brewerIconName(note.Recipe?.Brewer?.Type)}
            size={11}
            color={dim ? '#a9a395' : MUTED}
          />
          <Text style={[styles.brewerText, dim && styles.textDim]}>
            {brewerName(note).toUpperCase()}
          </Text>
        </View>

        <Text style={[styles.beanText, dim && styles.textDim]} numberOfLines={1}>
          {beanName(note)}
        </Text>

        <Text style={[styles.notesText, dim && styles.textDim]} numberOfLines={1}>
          {tastingLine(note)}
        </Text>
      </View>

      <View style={[styles.ratingBox, dim && styles.ratingBoxDim]}>
        <Text style={[styles.ratingValue, dim && styles.textDim]}>
          {rating != null ? rating.toFixed(1) : '—'}
        </Text>
        <Text style={[styles.ratingLabel, dim && styles.textDim]}>RATING</Text>
      </View>
    </Pressable>
  );
}

function Chip({ label, active, onPress, dropdown }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
      {dropdown ? (
        <Ionicons
          name="chevron-down"
          size={10}
          color={active ? ACCENT : INK}
          style={{ marginLeft: 4 }}
        />
      ) : null}
    </Pressable>
  );
}

function FilterModal({ title, options, visible, current, onClose, onPick }) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={styles.modalSheet}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.modalLabel}>{title}</Text>
          <Pressable
            onPress={() => onPick(null)}
            style={styles.modalRow}
          >
            <Text
              style={[
                styles.modalRowText,
                current == null && styles.modalRowTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>
          {options.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => onPick(opt)}
              style={styles.modalRow}
            >
              <Text
                style={[
                  styles.modalRowText,
                  opt === current && styles.modalRowTextActive,
                ]}
              >
                {opt}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------- Styles ----------
const CREAM = '#f3eee5';
const CARD = '#faf6ed';
const CARD_DIM = '#ece6d6';
const ACCENT = '#c0432b';
const TINT  = '#f1dad2';
const INK = '#1f1f1f';
const MUTED = '#6b6b6b';
const BORDER = '#cdc7b8';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 24, backgroundColor: CREAM,
  },

  headerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: INK },

  search: {
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: CARD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    color: INK,
    fontSize: 13,
  },

  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INK,
    backgroundColor: CREAM,
  },
  chipActive: { borderColor: ACCENT, backgroundColor: TINT },
  chipText: { fontSize: 10, letterSpacing: 1, color: INK, fontWeight: '700' },
  chipTextActive: { color: ACCENT },
  resetText: {
    fontSize: 10, letterSpacing: 1, color: MUTED, fontWeight: '700',
    marginLeft: 'auto',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: CARD,
  },
  rowDim: { backgroundColor: CARD_DIM },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginHorizontal: 14,
  },

  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dateText: { fontSize: 10, color: ACCENT, fontWeight: '700', letterSpacing: 1 },
  bulletText: { fontSize: 10, color: MUTED },
  brewerText: { fontSize: 10, color: MUTED, letterSpacing: 1, fontWeight: '600' },

  beanText: { fontSize: 14, color: INK, fontWeight: '700' },
  notesText: { fontSize: 11, color: MUTED, marginTop: 3 },

  ratingBox: {
    minWidth: 70,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: TINT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e9c4b8',
  },
  ratingBoxDim: { backgroundColor: '#ece0d9', borderColor: '#d6c9c0' },
  ratingValue: { fontSize: 16, fontWeight: '700', color: INK },
  ratingLabel: {
    fontSize: 9, color: MUTED, letterSpacing: 1.5, fontWeight: '700', marginTop: 2,
  },

  textDim: { color: '#a9a395' },

  fab: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 48,
    height: 48,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  empty: { padding: 30, alignItems: 'center' },
  emptyText: { color: MUTED },
  errorText: { color: INK, marginBottom: 12 },
  retryBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '600' },

  // filter modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(20, 12, 8, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: CARD,
    paddingTop: 20, paddingBottom: 30,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER,
  },
  modalLabel: {
    textAlign: 'center', fontSize: 11, letterSpacing: 2,
    color: MUTED, fontWeight: '700', marginBottom: 12,
  },
  modalRow: { paddingVertical: 12, paddingHorizontal: 20 },
  modalRowText: { fontSize: 14, color: INK },
  modalRowTextActive: { color: ACCENT, fontWeight: '700' },
});