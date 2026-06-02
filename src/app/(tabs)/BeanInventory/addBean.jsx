// app/(tabs)/BeanInventory/addBean.jsx
// Reached from BeanInventory FAB → "Add Manually"
import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/api/client';
import { FONT_SERIF } from '@/constants/fonts';

// Values pulled directly from the Bean model schema.
const VARIETALS = [
  'Typica', 'Kona', 'Blue Mountain', 'Maragogype', 'Pacamara',
  'Bourbon', 'Catuai', 'Pacas', 'SL-28', 'SL-34', 'Gesha',
  'Wush Wush', 'Kurume', 'Dega', 'Catimor', 'Castillo', 'Ruiri 11',
];

const ROASTS = [
  'french', 'dark', 'dark-medium', 'medium', 'medium-light', 'light', 'green',
];

const PROCESSES = ['wash', 'natural', 'honey', 'anaerobic'];

// ---------- API ----------
/** Creates a bean via the API. */
async function createBean(body) {
  const { data } = await apiClient.post('/beans', body);
  return data;
}

// ---------- Helpers ----------
/** True if the string is a valid YYYY-MM-DD date. */
function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

// ---------- Screen ----------
/**
 * Add-bean form: collects identity, botanicals, roast, and stock, validates the
 * name and roast date, then POSTs a new bean (nested under `details`, matching
 * the Bean schema) and returns to the inventory.
 */
export default function AddBean() {
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [varietal, setVarietal] = useState(VARIETALS[0]);
  const [process, setProcess] = useState(PROCESSES[0]);
  const [altitude, setAltitude] = useState('');
  const [roastDate, setRoastDate] = useState('');
  const [roast, setRoast] = useState('medium');
  const [tastingNotes, setTastingNotes] = useState('');
  const [quantity, setQuantity] = useState('');

  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: createBean,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beans'] });
      router.replace('/BeanInventory');
    },
    onError: (err) => {
      const msg =
        err?.response?.data?.message ?? err?.message ?? 'Could not save bean.';
      setError(msg);
      Alert.alert('Could not save bean', msg);
    },
  });

  const handleSubmit = () => {
    setError(null);

    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    if (!isValidDate(roastDate)) {
      setError('Roast date must be in YYYY-MM-DD format.');
      return;
    }

    const body = {
      details: {
        Name: name.trim(),
        Origin: {
          Country: country.trim() || 'none',
          Region: region.trim() || 'none',
        },
        Varietal: varietal,
        Process: process,
        Altitude: Number(altitude) || 0,
        RoastDate: new Date(roastDate).toISOString(),
        tasteProfile: {
          Roast: roast,
          tastingNotes: tastingNotes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
      },
      ...(quantity ? { Quantity: Number(quantity) } : {}),
    };

    mutation.mutate(body);
  };

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
          <Text style={styles.topTitle}>NEW BEAN</Text>
          <View style={{ width: 20 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Identity */}
          <SectionHeader label="IDENTITY" />
          <Field label="NAME *">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ethiopia Yirgacheffe"
              placeholderTextColor={MUTED}
              style={styles.input}
            />
          </Field>
          <Field label="COUNTRY">
            <TextInput
              value={country}
              onChangeText={setCountry}
              placeholder="e.g. Ethiopia"
              placeholderTextColor={MUTED}
              style={styles.input}
            />
          </Field>
          <Field label="REGION">
            <TextInput
              value={region}
              onChangeText={setRegion}
              placeholder="e.g. Yirgacheffe"
              placeholderTextColor={MUTED}
              style={styles.input}
            />
          </Field>

          {/* Botanicals */}
          <SectionHeader label="BOTANICALS" />
          <Field label="VARIETAL">
            <ChipRow
              options={VARIETALS}
              selected={varietal}
              onSelect={setVarietal}
            />
          </Field>
          <Field label="PROCESS">
            <ChipRow
              options={PROCESSES}
              selected={process}
              onSelect={setProcess}
            />
          </Field>
          <Field label="ALTITUDE (m)">
            <TextInput
              value={altitude}
              onChangeText={setAltitude}
              placeholder="e.g. 1800"
              placeholderTextColor={MUTED}
              keyboardType="numeric"
              style={styles.input}
            />
          </Field>

          {/* Roast */}
          <SectionHeader label="ROAST" />
          <Field label="ROAST DATE *">
            <TextInput
              value={roastDate}
              onChangeText={setRoastDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={MUTED}
              autoCapitalize="none"
              style={styles.input}
            />
          </Field>
          <Field label="ROAST LEVEL">
            <ChipRow options={ROASTS} selected={roast} onSelect={setRoast} />
          </Field>
          <Field label="TASTING NOTES">
            <TextInput
              value={tastingNotes}
              onChangeText={setTastingNotes}
              placeholder="comma-separated, e.g. citrus, jasmine, honey"
              placeholderTextColor={MUTED}
              style={styles.input}
            />
          </Field>

          {/* Stock */}
          <SectionHeader label="STOCK" />
          <Field label="QUANTITY (g)">
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              placeholder="e.g. 250"
              placeholderTextColor={MUTED}
              keyboardType="numeric"
              style={styles.input}
            />
          </Field>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        {/* Save button */}
        <View style={styles.footer}>
          <Pressable
            style={[styles.saveBtn, mutation.isPending && styles.saveBtnDisabled]}
            onPress={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.saveText}>SAVE BEAN</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------- Subcomponents ----------
/** A labeled section-divider row. */
function SectionHeader({ label }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{label}</Text>
    </View>
  );
}

/** A labeled form-field wrapper around its input children. */
function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

/** A horizontally scrolling row of single-select option chips. */
function ChipRow({ options, selected, onSelect }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {options.map((opt) => {
        const active = opt === selected;
        return (
          <Pressable
            key={opt}
            onPress={() => onSelect(opt)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
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
  topTitle: { fontSize: 14, letterSpacing: 2, color: INK, fontWeight: '700', fontFamily: FONT_SERIF },

  sectionHeader: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#e9e3d4',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    marginTop: 14,
  },
  sectionHeaderText: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: INK,
    fontWeight: '700',
  },

  field: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  fieldLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: MUTED,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    fontSize: 14,
    color: INK,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  chipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  chipText: { fontSize: 12, color: INK, letterSpacing: 0.5 },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  errorText: {
    color: ACCENT,
    paddingHorizontal: 14,
    paddingTop: 14,
    fontSize: 12,
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    backgroundColor: CREAM,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  saveBtn: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 1.5,
    fontSize: 13,
  },
});
