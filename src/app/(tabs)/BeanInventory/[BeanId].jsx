// app/beans/[id].jsx
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import apiClient from '@/api/client';
import { FONT_SERIF } from '@/constants/fonts';

const DEFAULT_CAPACITY_G = 250;

const MAPTILER_KEY =
  Constants.expoConfig?.extra?.maptilerKey ?? process.env.EXPO_PUBLIC_MAPTILER_KEY;
// Pick whichever MapTiler style matches the app aesthetic.
// Other good options: 'streets-v2', 'basic-v2', 'outdoor-v2', 'satellite'.
const MAP_STYLE = 'streets-v2';
const MAP_WIDTH = 600;
const MAP_HEIGHT = 280;
const MAP_ZOOM = 5;

// Approximate country-center coords for major coffee origins.
const COUNTRY_COORDS = {
  Ethiopia:     [40.4897,   9.1450],
  Kenya:        [37.9062,  -0.0236],
  Colombia:     [-74.2973,  4.5709],
  Brazil:       [-51.9253, -14.2350],
  Guatemala:    [-90.2308, 15.7835],
  'Costa Rica': [-83.7534,  9.7489],
  Panama:       [-80.7821,  8.5380],
  Ecuador:      [-78.1834, -1.8312],
  Honduras:     [-86.2419, 15.2000],
  Peru:         [-75.0152, -9.1900],
  Indonesia:    [113.9213, -0.7893],
  Rwanda:       [29.8739,  -1.9403],
  Burundi:      [29.9189,  -3.3731],
  Yemen:        [48.5164,  15.5527],
  'El Salvador':[-88.8965, 13.7942],
  Mexico:       [-102.5528, 23.6345],
  Vietnam:      [108.2772, 14.0583],
  India:        [78.9629,  20.5937],
  Tanzania:     [34.8888,  -6.3690],
  Uganda:       [32.2903,   1.3733],
  Nicaragua:    [-85.2072, 12.8654],
  Jamaica:      [-77.2975, 18.1096],
};

function lookupCoords(name) {
  if (!name) return null;
  if (COUNTRY_COORDS[name]) return COUNTRY_COORDS[name];
  const lower = name.toLowerCase().trim();
  const match = Object.keys(COUNTRY_COORDS).find(
    (k) => k.toLowerCase() === lower
  );
  return match ? COUNTRY_COORDS[match] : null;
}

function buildStaticMapUrl(coords) {
  if (!MAPTILER_KEY || !coords) return null;
  const [lng, lat] = coords;
  return `https://api.maptiler.com/maps/${MAP_STYLE}/static/${lng},${lat},${MAP_ZOOM}/${MAP_WIDTH}x${MAP_HEIGHT}.png?key=${MAPTILER_KEY}`;
}

// ---------- API ----------
async function fetchBean(id) {
  const { data } = await apiClient.get(`/beans/${id}`);
  return data;
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

async function deleteBeanRequest(id) {
  const { data } = await apiClient.delete(`/beans/${id}`);
  return data;
}

// ---------- Screen ----------
export default function BeanDetail() {
  const { BeanId: id } = useLocalSearchParams();
  const qc = useQueryClient();

  const { data: bean, isLoading, isError, refetch } = useQuery({
    queryKey: ['bean', id],
    queryFn: () => fetchBean(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteBeanRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beans'] });
      qc.removeQueries({ queryKey: ['bean', id] });
      router.replace('/BeanInventory');
    },
    onError: (err) => {
      const msg =
        err?.response?.data?.message ?? err?.message ?? 'Could not delete bean.';
      Alert.alert('Delete failed', msg);
    },
  });

  const confirmDelete = () => {
    Alert.alert(
      'Delete this bean?',
      "This removes the bean from your ledger. Past notes that reference it will still keep their data.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (isError || !bean) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn't load this bean.</Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  const d = bean.details ?? {};
  const country = d.Origin?.Country;
  const region = d.Origin?.Region;
  const hasOrigin = country && country !== 'none';
  const mapUrl = buildStaticMapUrl(lookupCoords(country));

  const remaining = bean.Quantity ?? 0;
  const pct = Math.max(0, Math.min(1, remaining / DEFAULT_CAPACITY_G));

  const rawNotes = d.tasteProfile?.tastingNotes;
  const notes = Array.isArray(rawNotes)
    ? (rawNotes.join(', ') || '—')
    : (typeof rawNotes === 'string' && rawNotes.trim() ? rawNotes : '—');
  const roastType = d.tasteProfile?.Roast ?? 'none';

  return (
    <ScrollView style={styles.safe} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={INK} />
          <Text style={styles.ledgerTitle}>
            LEDGER ENTRY #{String(bean.beanId).padStart(3, '0')}
          </Text>
        </Pressable>
      </View>

      {/* Origin — static map if we have a key + known country, else card */}
      {mapUrl ? (
        <View style={styles.mapBox}>
          <Image
            source={{ uri: mapUrl }}
            style={styles.mapImage}
            resizeMode="cover"
            onError={(e) =>
              console.warn('MapTiler image failed', mapUrl, e.nativeEvent)
            }
          />
          <View style={styles.mapOverlay}>
            <Text style={styles.mapCountry}>
              {country.toUpperCase()}
            </Text>
            {region && region !== 'none' ? (
              <Text style={styles.mapRegion}>{region.toUpperCase()}</Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.originCard}>
          <Ionicons name="location-outline" size={28} color={ACCENT} />
          <Text style={styles.originCountry}>
            {(hasOrigin ? country : 'Unknown Origin').toUpperCase()}
          </Text>
          {hasOrigin && region && region !== 'none' ? (
            <Text style={styles.originRegion}>{region.toUpperCase()}</Text>
          ) : null}
        </View>
      )}

      {/* Title block */}
      <View style={styles.titleBlock}>
        <Text style={styles.beanName}>{d.Name}</Text>
        <Text style={styles.originLine}>
          ORIGIN: {(country || 'NONE').toUpperCase()}
          {region && region !== 'none' ? `  •  REGION: ${region.toUpperCase()}` : ''}
        </Text>
      </View>

      {/* Info grid */}
      <View style={styles.grid}>
        <Row label="ALTITUDE" value={d.Altitude ? `${d.Altitude}m` : '—'} />
        <Row label="PROCESS" value={capitalize(d.Process) || 'Washed'} />
        <Row label="VARIETAL" value={d.Varietal || '—'} />
        <Row label="TASTING NOTES" value={notes} />
        <Row label="ROAST DATE" value={formatDate(d.RoastDate)} />
        <Row label="ROAST TYPE" value={capitalize(roastType)} />
        <Row
          label="CURRENT STOCK"
          custom={
            <View style={styles.stockBarOuter}>
              <View style={[styles.stockBarInner, { width: `${pct * 100}%` }]} />
              <Text style={styles.stockGrams}>{remaining}g</Text>
            </View>
          }
        />
      </View>

      {/* Description / lore */}
      {bean.description ? (
        <View style={styles.descBlock}>
          <Text style={styles.descText}>{bean.description}</Text>
        </View>
      ) : (
        <View style={styles.descBlock}>
          <Text style={styles.descText}>
            {buildAutoDescription(bean)}
          </Text>
        </View>
      )}

      {/* Delete bean */}
      <Pressable
        style={[styles.deleteBtn, deleteMutation.isPending && { opacity: 0.5 }]}
        onPress={confirmDelete}
        disabled={deleteMutation.isPending}
      >
        {deleteMutation.isPending ? (
          <ActivityIndicator size="small" color={ACCENT} />
        ) : (
          <>
            <Ionicons name="trash-outline" size={16} color={ACCENT} />
            <Text style={styles.deleteText}>DELETE BEAN</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

// ---------- Subcomponents ----------
function Row({ label, value, custom }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {custom ?? <Text style={styles.rowValue}>{value}</Text>}
      </View>
    </View>
  );
}

// ---------- Helpers ----------
function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildAutoDescription(bean) {
  const d = bean.details ?? {};
  const parts = [];
  if (d.Varietal) parts.push(`This ${d.Varietal} variety`);
  else parts.push('This bean');
  if (d.Altitude) parts.push(`is cultivated at ${d.Altitude} meters`);
  if (d.Process) parts.push(`and goes through a ${d.Process.toLowerCase()} process`);
  const notes = d.tasteProfile?.tastingNotes;
  if (notes?.length) parts.push(`presenting notes of ${notes.join(', ').toLowerCase()}`);
  return parts.join(' ') + '.';
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: CREAM },

  topBar: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ledgerTitle: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: INK,
    fontWeight: '700',
  },

  mapBox: {
    marginHorizontal: 14,
    height: 220,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: CARD,
  },
  mapImage: { width: '100%', height: '100%' },
  mapOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(243, 238, 229, 0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  mapCountry: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    letterSpacing: 2,
    fontFamily: FONT_SERIF,
  },
  mapRegion: {
    fontSize: 11,
    color: MUTED,
    letterSpacing: 1.5,
    fontWeight: '600',
    marginTop: 2,
  },

  originCard: {
    marginHorizontal: 14,
    paddingVertical: 32,
    backgroundColor: CARD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  originCountry: {
    fontSize: 22,
    fontWeight: '700',
    color: INK,
    letterSpacing: 2,
    marginTop: 6,
    fontFamily: FONT_SERIF,
  },
  originRegion: {
    fontSize: 12,
    color: MUTED,
    letterSpacing: 2,
    fontWeight: '600',
  },

  titleBlock: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  beanName: { fontSize: 20, fontWeight: '600', color: INK, fontFamily: FONT_SERIF },
  originLine: {
    fontSize: 11,
    color: MUTED,
    letterSpacing: 1,
    marginTop: 6,
  },

  grid: {
    marginHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    minHeight: 44,
  },
  rowLabel: {
    flex: 1,
    fontSize: 12,
    color: INK,
    letterSpacing: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: BORDER,
    fontWeight: '500',
  },
  rowRight: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  rowValue: { fontSize: 12, color: INK, textAlign: 'right' },

  stockBarOuter: {
    height: 14,
    backgroundColor: '#f1d9d3',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stockBarInner: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: ACCENT,
    opacity: 0.35,
  },
  stockGrams: {
    fontSize: 10,
    color: INK,
    textAlign: 'right',
    paddingRight: 6,
    fontWeight: '700',
  },

  descBlock: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  descText: {
    fontSize: 13,
    lineHeight: 20,
    color: INK,
    textAlign: 'center',
  },

  errorText: { color: INK, marginBottom: 12 },
  retryBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
  },
  retryText: { color: '#fff', fontWeight: '600' },

  deleteBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 14,
    marginTop: 24,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT,
  },
  deleteText: {
    color: ACCENT,
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 12,
  },
});