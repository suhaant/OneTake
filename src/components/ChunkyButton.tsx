import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, fonts, glow } from '../theme';
import { Gloss } from './Glass';

type Tone = 'green' | 'blue' | 'white' | 'yellow' | 'locked';

const tones: Record<Tone, { face: readonly [string, string, string]; border: string; text: string; halo: string; underglow: string }> = {
  green: { face: ['#E9FF9A', '#7EDC2E', '#3DAE18'], border: '#2E8F12', text: '#fff', halo: '#58CC02', underglow: '#D8FF66' },
  blue: { face: ['#B8F3FF', '#3FCBF8', '#0C8FD2'], border: '#0A6DAE', text: '#fff', halo: '#1E9EE6', underglow: '#9FF1FF' },
  yellow: { face: ['#FFF7B8', '#FFD93D', '#F2A900'], border: '#C98F00', text: '#7A4A00', halo: '#FFC800', underglow: '#FFF2A0' },
  white: { face: ['#FFFFFF', '#F2FAFF', '#D9EEF9'], border: '#BFDDEC', text: colors.navy, halo: '#7FC8EE', underglow: '#FFFFFF' },
  locked: { face: ['#F7FAFC', '#DCE5EB', '#B9C7D1'], border: '#A3B3BF', text: '#7E919F', halo: '#9FB3C0', underglow: '#FFFFFF' },
};

type Props = {
  onPress?: () => void;
  tone?: Tone;
  label?: string;
  icon?: React.ReactNode;
  /** circle button of this diameter instead of a pill */
  circle?: number;
  /** how far the button sits off the page: drives the halo size */
  depth?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/** Aero gel button: gradient body, specular across the top half, light bouncing in from below. */
export default function ChunkyButton({ onPress, tone = 'green', label, icon, circle, depth = 6, style, disabled, accessibilityLabel }: Props) {
  const [down, setDown] = useState(false);
  const t = tones[tone];
  const r = circle ? circle / 2 : 999;
  const size = circle ? { width: circle, height: circle, borderRadius: r } : { height: 58, borderRadius: r };
  const halo = tone === 'locked' ? glow(t.halo, 0.2) : glow(t.halo, 0.45 + Math.min(depth, 8) * 0.03);

  return (
    <Pressable
      onPress={() => {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        } catch {
          // haptics unavailable (web)
        }
        onPress?.();
      }}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[{ paddingBottom: Math.max(depth - 4, 2) }, style]}
    >
      <View style={[size, halo, { transform: [{ scale: down ? 0.96 : 1 }] }]}>
        <LinearGradient colors={[...t.face]} locations={[0, 0.55, 1]} style={[styles.face, size, { borderColor: t.border }, circle ? undefined : styles.pillPad]}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0)', t.underglow]}
            style={[styles.underglow, { opacity: 0.55 }]}
          />
          <Gloss height={circle ? '50%' : '52%'} radius={r} />
          {down && <View pointerEvents="none" style={styles.pressShade} />}
          {icon}
          {label ? <Text style={[styles.label, { color: t.text }, (tone === 'white' || tone === 'locked') && styles.labelDark]}>{label}</Text> : null}
        </LinearGradient>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
  },
  pillPad: { paddingHorizontal: 24 },
  underglow: { position: 'absolute', left: '12%', right: '12%', bottom: 0, height: '38%', borderTopLeftRadius: 999, borderTopRightRadius: 999 },
  pressShade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,40,80,0.12)' },
  label: {
    fontFamily: fonts.bold,
    fontSize: 18,
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  labelDark: { textShadowColor: 'rgba(255,255,255,0.8)', textShadowOffset: { width: 0, height: 1 } },
});
