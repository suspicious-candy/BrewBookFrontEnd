// src/components/WheelPickerModal.jsx
// Bottom-sheet modal with a horizontally scrollable number wheel.
// The item snapped to the center is shown bold + accent; items farther from
// the center fade out. Used by the New Recipe screen for TEMP and BLOOM.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  Pressable,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { FONT_SERIF } from '@/constants/fonts';

const ITEM_WIDTH = 64;
const SCREEN_W = Dimensions.get('window').width;
const SIDE_PAD = (SCREEN_W - ITEM_WIDTH) / 2;

const CREAM = '#f3eee5';
const CARD = '#faf6ed';
const ACCENT = '#c0432b';
const INK = '#1f1f1f';
const MUTED = '#6b6b6b';
const BORDER = '#cdc7b8';

export default function WheelPickerModal({
  visible,
  title,
  unit,
  min,
  max,
  step = 1,
  value,
  onConfirm,
  onClose,
}) {
  const items = useMemo(() => {
    const arr = [];
    for (let v = min; v <= max; v += step) arr.push(v);
    return arr;
  }, [min, max, step]);

  const initialIndex = Math.max(0, items.indexOf(Number(value)));
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const listRef = useRef(null);

  // Snap to the current value whenever the modal opens
  useEffect(() => {
    if (!visible) return;
    setActiveIndex(initialIndex);
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: initialIndex * ITEM_WIDTH,
        animated: false,
      });
    }, 30);
    return () => clearTimeout(t);
  }, [visible, initialIndex]);

  const updateIndexFromOffset = (offset) => {
    const idx = Math.round(offset / ITEM_WIDTH);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    setActiveIndex(clamped);
  };

  const handleConfirm = () => {
    onConfirm?.(items[activeIndex]);
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/*
        Sibling layout: a full-screen backdrop sits behind the sheet, and the
        sheet is a plain View so the inner FlatList can claim the scroll
        responder without a wrapping Pressable hijacking the gesture.
      */}
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.wheelBox}>
            <View style={styles.centerMarker} pointerEvents="none" />

            <FlatList
              ref={listRef}
              data={items}
              keyExtractor={(item) => String(item)}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={ITEM_WIDTH}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: SIDE_PAD }}
              onMomentumScrollEnd={(e) =>
                updateIndexFromOffset(e.nativeEvent.contentOffset.x)
              }
              onScrollEndDrag={(e) =>
                updateIndexFromOffset(e.nativeEvent.contentOffset.x)
              }
              getItemLayout={(_, index) => ({
                length: ITEM_WIDTH,
                offset: ITEM_WIDTH * index,
                index,
              })}
              extraData={activeIndex}
              renderItem={({ item, index }) => {
                const distance = Math.abs(index - activeIndex);
                const isActive = distance === 0;
                const opacity =
                  isActive ? 1 : Math.max(0.18, 0.6 - distance * 0.12);
                return (
                  <View style={[styles.item, { opacity }]}>
                    <Text
                      style={[
                        styles.itemText,
                        isActive && styles.itemTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </View>
                );
              }}
            />

            <Text style={styles.unit}>{unit}</Text>
          </View>

          <View style={styles.btnRow}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmText}>SET</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: CREAM,
    paddingTop: 20,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  title: {
    fontSize: 14,
    color: INK,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: FONT_SERIF,
  },

  wheelBox: {
    backgroundColor: CARD,
    paddingTop: 18,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    position: 'relative',
  },
  centerMarker: {
    position: 'absolute',
    left: SCREEN_W / 2 - ITEM_WIDTH / 2,
    top: 8,
    bottom: 44,
    width: ITEM_WIDTH,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT,
  },

  item: {
    width: ITEM_WIDTH,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 22,
    color: INK,
    fontWeight: '600',
  },
  itemTextActive: {
    fontSize: 30,
    fontWeight: '700',
    color: ACCENT,
  },

  unit: {
    fontSize: 11,
    color: MUTED,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '700',
  },

  btnRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT,
    alignItems: 'center',
  },
  cancelText: {
    color: ACCENT,
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 12,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: ACCENT,
    alignItems: 'center',
  },
  confirmText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 12,
  },
});
