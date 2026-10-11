import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Gloss } from './Glass';

const SEGMENTS = 12;

/**
 * The Vista copy-dialog bar, Aero style: a glass trough of segments that fill lime-green behind a
 * leaf, the leading segment breathing while work continues. `progress` is 0..1.
 */
export default function EcoProgress({ progress }: { progress: number }) {
  const lit = Math.round(Math.min(1, Math.max(0, progress)) * SEGMENTS);
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.35, { duration: 700 })), -1);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={styles.row}>
      <View style={styles.leaf}>
        <LinearGradient colors={['#F0FFC8', '#C6F57F', '#9BDE4A']} style={StyleSheet.absoluteFill} />
        <Gloss height="55%" radius={14} />
        <Svg width={18} height={18} viewBox="0 0 20 20">
          <Path d="M2 18 C 2 8, 10 2, 18 2 C 18 10, 12 18, 2 18 Z" fill="#3FA51C" />
          <Path d="M3 17 L15 5" stroke="#E6FF9A" strokeWidth={1.2} />
        </Svg>
      </View>
      <View style={styles.trough}>
        <LinearGradient colors={['#C9DCE7', '#F4FAFD', '#FFFFFF']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const on = i < lit;
          const head = on && i === lit - 1 && lit < SEGMENTS;
          const Seg = head ? Animated.View : View;
          return (
            <Seg key={i} style={[styles.seg, on && styles.segOn, head && pulseStyle]}>
              {on && <LinearGradient colors={['#E9FF9A', '#8BE534', '#45B41C']} style={StyleSheet.absoluteFill} />}
              {on && <Gloss height="50%" radius={3} />}
            </Seg>
          );
        })}
        <Gloss height="45%" radius={10} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leaf: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#8CD63D', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  trough: { flex: 1, height: 22, borderRadius: 10, borderWidth: 1.5, borderColor: '#B9D3E2', padding: 3, flexDirection: 'row', gap: 3, overflow: 'hidden' },
  seg: { flex: 1, borderRadius: 3, backgroundColor: 'rgba(11,61,92,0.06)', overflow: 'hidden' },
  segOn: { backgroundColor: '#8BE534' },
});
