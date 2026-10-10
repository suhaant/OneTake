import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, fonts } from '../theme';

type Tone = 'green' | 'blue' | 'white' | 'yellow' | 'locked';

const tones: Record<Tone, { face: [string, string]; edge: string; border: string; text: string }> = {
  green: { face: ['#A6F06A', '#58CC02'], edge: '#3E9A0A', border: '#3F8F16', text: '#fff' },
  blue: { face: ['#4FC3F7', '#1E9EE6'], edge: '#0A5F99', border: '#0C6FB3', text: '#fff' },
  yellow: { face: ['#FFE566', '#FFC800'], edge: '#C98F00', border: '#D59A00', text: '#7A4A00' },
  white: { face: ['#FFFFFF', '#FFFFFF'], edge: '#CFE8F6', border: '#CFE8F6', text: colors.navy },
  locked: { face: ['#F2F6F8', '#D5DEE4'], edge: '#A9B8C3', border: '#AEBCC6', text: '#7E919F' },
};

type Props = {
  onPress?: () => void;
  tone?: Tone;
  label?: string;
  icon?: React.ReactNode;
  /** circle button of this diameter instead of a pill */
  circle?: number;
  depth?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/** Duolingo-style pressable: a hard bottom edge that collapses on press. */
export default function ChunkyButton({
  onPress,
  tone = 'green',
  label,
  icon,
  circle,
  depth = 6,
  style,
  disabled,
  accessibilityLabel,
}: Props) {
  const [down, setDown] = useState(false);
  const t = tones[tone];
  const size = circle ? { width: circle, height: circle, borderRadius: circle / 2 } : { height: 58, borderRadius: 999 };

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
      style={[{ paddingBottom: depth }, style]}
    >
      <View style={[styles.edge, size, { backgroundColor: t.edge }]}>
        <LinearGradient
          colors={t.face}
          style={[
            styles.face,
            size,
            { borderColor: t.border, transform: [{ translateY: down ? depth - 1 : 0 }] },
            circle ? undefined : styles.pillPad,
          ]}
        >
          <View style={styles.sheen} />
          {icon}
          {label ? <Text style={[styles.label, { color: t.text }, tone === 'white' && styles.labelDark]}>{label}</Text> : null}
        </LinearGradient>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  edge: { position: 'relative' },
  face: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
  },
  pillPad: { paddingHorizontal: 22 },
  sheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 18,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  labelDark: { textShadowColor: 'transparent' },
});
