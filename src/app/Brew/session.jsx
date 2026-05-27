// app/brew/session.jsx
// Reached from /brew/config after CONFIRM PARAMETERS.
// Route params: recipeId, notesId?, brewerId?, beanId?
import { useState, useEffect, useRef, useMemo } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/api/client';

const PREP_SECONDS = 10;

// ---------- API ----------
async function fetchRecipe(id) {
  const { data } = await apiClient.get(`/recipes/${id}`);
  return data;
}

async function fetchBrewer(id) {
  const { data } = await apiClient.get(`/brewers/${id}`);
  return data;
}

// ---------- Helpers ----------
function fmtMS(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

// Compute per-step duration from cumulative `at` values
function buildSteps(pours, brewTime) {
  if (!pours?.length) return [];
  return pours.map((p, i) => {
    const nextAt =
      i < pours.length - 1
        ? pours[i + 1].at
        : Math.max(brewTime ?? p.at, p.at);
    const duration = Math.max(0, nextAt - p.at);
    return {
      ...p,
      duration,
      timed: duration > 0,
    };
  });
}

// ---------- Screen ----------
export default function BrewSession() {
  const { recipeId, notesId, brewerId, beanId } = useLocalSearchParams();

  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', recipeId],
    queryFn: () => fetchRecipe(recipeId),
    enabled: !!recipeId,
  });

  const { data: brewer } = useQuery({
    queryKey: ['brewer', brewerId ?? recipe?.Brewer],
    queryFn: () => fetchBrewer(brewerId ?? recipe?.Brewer),
    enabled: !!(brewerId || recipe?.Brewer),
  });

  const steps = useMemo(
    () => buildSteps(recipe?.pours, recipe?.BrewTime),
    [recipe]
  );

  // ----- Session state -----
  const [currentIdx, setCurrentIdx] = useState(0);
  const [completed,  setCompleted]  = useState(new Set());
  // phase: 'idle' (waiting for user) | 'prep' (10s prep) | 'running' (step timer)
  const [phase,      setPhase]      = useState('idle');
  const [prepLeft,   setPrepLeft]   = useState(PREP_SECONDS);
  const [stepLeft,   setStepLeft]   = useState(0);
  const [done,       setDone]       = useState(false);
  const tickRef = useRef(null);

  const currentStep = steps[currentIdx];

  // ----- Timer effects -----
  useEffect(() => {
    if (phase === 'prep') {
      tickRef.current = setInterval(() => {
        setPrepLeft((v) => {
          if (v <= 1) {
            clearInterval(tickRef.current);
            // Move to running phase
            setPhase('running');
            setStepLeft(currentStep?.duration ?? 0);
            return 0;
          }
          return v - 1;
        });
      }, 1000);
    } else if (phase === 'running') {
      tickRef.current = setInterval(() => {
        setStepLeft((v) => {
          if (v <= 1) {
            clearInterval(tickRef.current);
            // Step complete — advance
            handleStepDone();
            return 0;
          }
          return v - 1;
        });
      }, 1000);
    }
    return () => clearInterval(tickRef.current);
  }, [phase, currentIdx]);

  // ----- Handlers -----
  const handleStepDone = () => {
    setCompleted((s) => new Set(s).add(currentIdx));
    if (currentIdx >= steps.length - 1) {
      setPhase('idle');
      setDone(true);
      return;
    }
    setCurrentIdx((i) => i + 1);
    setPhase('idle');
    setPrepLeft(PREP_SECONDS);
    setStepLeft(0);
  };

  const handleAdvance = () => {
    if (!currentStep) return;
    if (!currentStep.timed) {
      // Untimed step — just mark done and move on
      handleStepDone();
      return;
    }
    // Timed step — kick off the 10s prep window
    setPrepLeft(PREP_SECONDS);
    setPhase('prep');
  };

  const handleStartNow = () => {
    clearInterval(tickRef.current);
    setPhase('running');
    setStepLeft(currentStep?.duration ?? 0);
  };

  const handleSkip = () => {
    clearInterval(tickRef.current);
    handleStepDone();
  };

  // ----- Loading -----
  if (isLoading || !recipe) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  const brewerName = brewer?.Name?.split(/\s+/).slice(1).join(' ') || brewer?.Name || 'BREWER';

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={INK} />
        </Pressable>
        <Text style={styles.topTitle}>SETUP: {brewerName.toUpperCase()}</Text>
        <View style={{ width: 20 }} />
      </View>

      {/* Steps checklist */}
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 24 }}>
        {steps.map((s, i) => {
          const isCurrent = i === currentIdx && !done;
          const isDone    = completed.has(i) || done;
          return (
            <View
              key={i}
              style={[
                styles.stepRow,
                isCurrent && styles.stepRowCurrent,
                isDone && styles.stepRowDone,
              ]}
            >
              <View style={styles.checkbox}>
                {isDone ? (
                  <Ionicons name="checkmark" size={14} color={ACCENT} />
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepText, isDone && styles.stepTextDone]}>
                  {i + 1}. {s.note || s.label || `Step ${i + 1}`}
                </Text>
                {(s.type || s.to != null || s.duration > 0) && (
                  <Text style={styles.stepMeta}>
                    {s.type ? s.type.toUpperCase() : 'STEP'}
                    {s.to != null ? `  •  pour to ${s.to}g` : ''}
                    {s.duration > 0 ? `  •  ${s.duration}s` : ''}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Action bar */}
      <View style={styles.actionBar}>
        {!done && currentStep && (
          <>
            {phase === 'idle' && (
              currentStep.timed ? (
                <Pressable style={styles.primaryBtn} onPress={handleAdvance}>
                  <Ionicons name="timer-outline" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>START TIMER</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.primaryBtn} onPress={handleAdvance}>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>CONTINUE TO NEXT STEP</Text>
                </Pressable>
              )
            )}

            {phase === 'prep' && (
              <View style={styles.timerBox}>
                <Text style={styles.timerLabel}>GET READY</Text>
                <Text style={styles.timerValue}>- {fmtMS(prepLeft)} -</Text>
                <Pressable style={styles.secondaryBtn} onPress={handleStartNow}>
                  <Text style={styles.secondaryBtnText}>START NOW</Text>
                </Pressable>
              </View>
            )}

            {phase === 'running' && (
              <View style={styles.timerBox}>
                <Text style={styles.timerLabel}>
                  STEP {currentIdx + 1} • {(currentStep.type || 'STEP').toUpperCase()}
                </Text>
                <Text style={[styles.timerValue, { color: ACCENT }]}>
                  - {fmtMS(stepLeft)} -
                </Text>
                <Pressable style={styles.secondaryBtn} onPress={handleSkip}>
                  <Text style={styles.secondaryBtnText}>SKIP STEP</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>

      {/* Done overlay */}
      <DoneOverlay
        visible={done}
        notesId={notesId}
        beanId={beanId}
        brewerId={brewerId}
        recipeId={recipeId}
      />
    </View>
  );
}

// ---------- Done Overlay ----------
function DoneOverlay({ visible, notesId, beanId, brewerId, recipeId }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.doneRoot}>
        {/* Close (X) → home */}
        <Pressable
          style={styles.doneClose}
          onPress={() => router.replace('/Dashboard')}
          hitSlop={10}
        >
          <Ionicons name="close" size={26} color={INK} />
        </Pressable>

        <View style={styles.doneCard}>
          <View style={styles.doneBanner}>
            <Ionicons name="cafe" size={36} color="#fff" />
            <Text style={styles.doneBannerTitle}>BREW COMPLETE</Text>
            <Text style={styles.doneBannerSub}>NICE WORK</Text>
          </View>

          <Text style={styles.doneMessage}>
            Your brew is ready. Want to log how it turned out?
          </Text>

          <Pressable
            style={styles.doneAddBtn}
            onPress={() =>
              router.replace({
                pathname: '/Brew/Log',
                params: { notesId, recipeId, beanId, brewerId },
              })
            }
          >
            <Ionicons name="document-text-outline" size={16} color="#fff" />
            <Text style={styles.doneAddText}>ADD BREW TO NOTES</Text>
          </Pressable>

          <Pressable
            style={styles.doneSkipBtn}
            onPress={() => router.replace('/Dashboard')}
          >
            <Text style={styles.doneSkipText}>SKIP — BACK TO HOME</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
  topTitle: { fontSize: 13, letterSpacing: 2, color: INK, fontWeight: '700' },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: CARD,
    padding: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    gap: 10,
  },
  stepRowCurrent: {
    borderColor: ACCENT,
    borderWidth: 1.5,
    backgroundColor: '#fbf3ec',
  },
  stepRowDone: { backgroundColor: '#ece6d6' },

  checkbox: {
    width: 18, height: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },

  stepText: { fontSize: 13, color: INK, lineHeight: 18 },
  stepTextDone: { color: MUTED, textDecorationLine: 'line-through' },
  stepMeta: {
    fontSize: 10, color: MUTED, letterSpacing: 1, fontWeight: '600',
    marginTop: 4,
  },

  actionBar: {
    padding: 14,
    backgroundColor: DARK,
    minHeight: 90,
    justifyContent: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#fff', fontWeight: '700', letterSpacing: 1.5, fontSize: 12,
  },

  timerBox: { alignItems: 'center' },
  timerLabel: {
    fontSize: 10, color: '#dccfc4', letterSpacing: 1.5, fontWeight: '700',
  },
  timerValue: {
    fontSize: 30, color: '#fff', fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 6,
    letterSpacing: 2,
  },
  secondaryBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#dccfc4',
  },
  secondaryBtnText: {
    color: '#fff', fontSize: 11, letterSpacing: 1.5, fontWeight: '700',
  },

  // Done overlay
  doneRoot: {
    flex: 1,
    backgroundColor: 'rgba(20, 12, 8, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  doneClose: {
    position: 'absolute',
    top: 56,
    right: 18,
    backgroundColor: CARD,
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
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
    paddingVertical: 28,
    alignItems: 'center',
  },
  doneBannerTitle: {
    color: '#fff', fontSize: 18, fontWeight: '700',
    letterSpacing: 3, marginTop: 8,
  },
  doneBannerSub: {
    color: '#fce5de', fontSize: 11, letterSpacing: 2, marginTop: 2,
  },
  doneMessage: {
    fontSize: 13, color: INK, padding: 18,
    textAlign: 'center', lineHeight: 19,
  },
  doneAddBtn: {
    flexDirection: 'row',
    backgroundColor: DARK,
    marginHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  doneAddText: { color: '#fff', fontWeight: '700', letterSpacing: 1.5, fontSize: 12 },
  doneSkipBtn: {
    margin: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    alignItems: 'center',
  },
  doneSkipText: { color: MUTED, fontWeight: '700', letterSpacing: 1.5, fontSize: 11 },
});