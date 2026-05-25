// app/beans/[id].jsx
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import apiClient from '@/api/client';

const DEFAULT_CAPACITY_G = 250;

// Coffee-producing countries — extend as needed.
// Coords are approximate country centers; deltas control zoom.
const COUNTRY_COORDS = {
  Ethiopia:    { latitude: 9.145,   longitude: 40.4897, latitudeDelta: 12, longitudeDelta: 12 },
  Kenya:       { latitude: -0.0236, longitude: 37.9062, latitudeDelta: 10, longitudeDelta: 10 },
  Colombia:    { latitude: 4.5709,  longitude: -74.2973, latitudeDelta: 12, longitudeDelta: 12 },
  Brazil:      { latitude: -14.235, longitude: -51.9253, latitudeDelta: 30, longitudeDelta: 30 },
  Guatemala:   { latitude: 15.7835, longitude: -90.2308, latitudeDelta: 6,  longitudeDelta: 6 },
  CostaRica:   { latitude: 9.7489,  longitude: -83.7534, latitudeDelta: 5,  longitudeDelta: 5 },
  Panama:      { latitude: 8.5380,  longitude: -80.7821, latitudeDelta: 5,  longitudeDelta: 5 },
  Ecuador:     { latitude: -1.8312, longitude: -78.1834, latitudeDelta: 7,  longitudeDelta: 7 },
  Honduras:    { latitude: 15.2,    longitude: -86.2419, latitudeDelta: 6,  longitudeDelta: 6 },
  Peru:        { latitude: -9.19,   longitude: -75.0152, latitudeDelta: 12, longitudeDelta: 12 },
  Indonesia:   { latitude: -0.7893, longitude: 113.9213, latitudeDelta: 20, longitudeDelta: 20 },
  Rwanda:      { latitude: -1.9403, longitude: 29.8739, latitudeDelta: 4,  longitudeDelta: 4 },
  Burundi:     { latitude: -3.3731, longitude: 29.9189, latitudeDelta: 4,  longitudeDelta: 4 },
  Yemen:       { latitude: 15.5527, longitude: 48.5164, latitudeDelta: 8,  longitudeDelta: 8 },
  ElSalvador:  { latitude: 13.7942, longitude: -88.8965, latitudeDelta: 4,  longitudeDelta: 4 },
  Mexico:      { latitude: 23.6345, longitude: -102.5528, latitudeDelta: 18, longitudeDelta: 18 },
};

// Normalize country name to the lookup keys above
function normalizeCountry(name) {
  if (!name) return null;
  const key = name.replace(/\s+/g, '');
  return COUNTRY_COORDS[key] ? key : null;
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

// ---------- Screen ----------
export default function BeanDetail() {
  const { id } = useLocalSearchParams();

  const { data: bean, isLoading, isError, refetch } = useQuery({
    queryKey: ['bean', id],
    queryFn: () => fetchBean(id),
  });

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

  const country = bean.Origin?.Country;
  const region = bean.Origin?.Region;
  const countryKey = normalizeCountry(country);
  const mapRegion = countryKey ? COUNTRY_COORDS[countryKey] : null;

  const remaining = bean.Quantity ?? 0;
  const pct = Math.max(0, Math.min(1, remaining / DEFAULT_CAPACITY_G));

  const notes = bean.tasteProfile?.tastingNotes?.join(', ') || '—';
  const roastType = bean.tasteProfile?.Roast ?? 'none';

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

      {/* Map / placeholder image */}
      <View style={styles.mediaBox}>
        {mapRegion ? (
          <MapView
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            initialRegion={mapRegion}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Marker
              coordinate={{
                latitude: mapRegion.latitude,
                longitude: mapRegion.longitude,
              }}
              pinColor={ACCENT}
            />
          </MapView>
        ) : (
          <Image
            source={require('@/assets/bean-placeholder.png')}
            style={styles.placeholderImg}
            resizeMode="cover"
          />
        )}

        {/* Floating brew icon (top-right of media) */}
        <Pressable
          style={styles.brewBtn}
          onPress={() => router.push(`/beans/${bean.beanId}/brew`)}
        >
          <Ionicons name="cafe-outline" size={18} color={INK} />
        </Pressable>
      </View>

      {/* Title block */}
      <View style={styles.titleBlock}>
        <Text style={styles.beanName}>{bean.Name}</Text>
        <Text style={styles.originLine}>
          ORIGIN: {(country || 'NONE').toUpperCase()}
          {region && region !== 'none' ? `  •  REGION: ${region.toUpperCase()}` : ''}
        </Text>
      </View>

      {/* Info grid */}
      <View style={styles.grid}>
        <Row label="ALTITUDE" value={bean.Altitude ? `${bean.Altitude}m` : '—'} />
        <Row label="PROCESS" value={capitalize(bean.Process) || 'Washed'} />
        <Row label="VARIETAL" value={bean.Varietal || '—'} />
        <Row label="TASTING NOTES" value={notes} />
        <Row label="ROAST DATE" value={formatDate(bean.RoastDate)} />
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
  const parts = [];
  if (bean.Varietal) parts.push(`This ${bean.Varietal} variety`);
  else parts.push('This bean');
  if (bean.Altitude) parts.push(`is cultivated at ${bean.Altitude} meters`);
  if (bean.Process) parts.push(`and goes through a ${bean.Process.toLowerCase()} process`);
  const notes = bean.tasteProfile?.tastingNotes;
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
    paddingTop: 50,
    paddingBottom: 12,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ledgerTitle: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: INK,
    fontWeight: '700',
  },

  mediaBox: {
    marginHorizontal: 14,
    height: 220,
    backgroundColor: '#000',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  map: { flex: 1 },
  placeholderImg: { width: '100%', height: '100%' },

  brewBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: CARD,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },

  titleBlock: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  beanName: { fontSize: 16, fontWeight: '600', color: INK },
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
});