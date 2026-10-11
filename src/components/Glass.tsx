import React from 'react';
import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, glassShadow, gradients } from '../theme';

/**
 * The Aero specular: a bright band across the top half of a surface that fades to nothing,
 * plus a hairline white rim. Drop it inside any `overflow: hidden` rounded view.
 */
export function Gloss({
  height = '52%',
  opacity = 1,
  radius = 26,
  style,
}: {
  height?: `${number}%` | number;
  opacity?: number;
  /** must match the parent's corner radius so the rim hugs the edge */
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
        locations={[0, 0.6, 1]}
        style={[styles.sheen, { height, opacity }]}
      />
      <View style={[styles.rim, { borderRadius: radius }]} />
    </View>
  );
}

export function GlassCard({
  children,
  style,
  solid = false,
  tint = 'white',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** opaque body for dense content (lists, forms) */
  solid?: boolean;
  tint?: 'white' | 'aqua' | 'lime';
}) {
  const face = solid
    ? (['#FFFFFF', '#FFFFFF', '#F3FAFE'] as const)
    : tint === 'aqua'
      ? gradients.glassDeep
      : tint === 'lime'
        ? (['rgba(255,255,255,0.9)', 'rgba(236,255,200,0.75)', 'rgba(200,245,150,0.7)'] as const)
        : gradients.glass;
  return (
    <View style={[styles.cardShadow, style]}>
      <LinearGradient colors={[...face]} style={StyleSheet.absoluteFill} />
      <Gloss height="46%" opacity={solid ? 0.6 : 1} />
      {children}
    </View>
  );
}

/** Panda's speech bubble, tail on the left pointing at him. */
export function SpeechBubble({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.bubbleWrap, style]}>
      <View style={styles.bubble}>
        <LinearGradient colors={[...gradients.glass]} style={StyleSheet.absoluteFill} />
        <Gloss height="50%" radius={20} />
        <Text style={styles.bubbleText}>{text}</Text>
      </View>
      <View style={styles.tail} />
    </View>
  );
}

export function Chip({ text, tone = 'white' }: { text: string; tone?: 'white' | 'green' | 'blue' | 'solidBlue' }) {
  const face =
    tone === 'green'
      ? (['#F0FFC8', '#C6F57F', '#9BDE4A'] as const)
      : tone === 'blue'
        ? (['#F0FCFF', '#B9EEFF', '#7ADBFF'] as const)
        : tone === 'solidBlue'
          ? (['#2A8FE6', '#1E74D2', '#1A66C0'] as const)
          : (['#FFFFFF', '#F6FBFF', '#E6F4FB'] as const);
  const textColor = tone === 'green' ? colors.greenText : tone === 'blue' ? colors.blue : tone === 'solidBlue' ? '#FFFFFF' : '#7A4A00';
  const border = tone === 'green' ? '#8CD63D' : tone === 'blue' ? '#6ED2FB' : tone === 'solidBlue' ? '#FFFFFF' : '#D9EBF5';
  return (
    <View style={[styles.chip, { borderColor: border }]}>
      <LinearGradient colors={[...face]} style={StyleSheet.absoluteFill} />
      {tone !== 'solidBlue' && <Gloss height="55%" radius={999} />}
      <Text style={[styles.chipText, { color: textColor }, tone === 'solidBlue' && styles.chipTextOnBlue]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chipTextOnBlue: { textShadowColor: 'rgba(0,60,120,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  cardShadow: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    overflow: 'hidden',
    ...glassShadow,
  },
  sheen: { position: 'absolute', left: 0, right: 0, top: 0, borderBottomLeftRadius: 999, borderBottomRightRadius: 999 },
  rim: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  bubbleWrap: { flex: 1 },
  bubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(255,255,255,0.6)',
    overflow: 'hidden',
    ...glassShadow,
  },
  bubbleText: { fontFamily: fonts.semi, fontSize: 16, lineHeight: 21, color: colors.navy },
  tail: {
    position: 'absolute',
    left: -6,
    bottom: 18,
    width: 14,
    height: 14,
    backgroundColor: 'rgba(242,251,255,0.95)',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    transform: [{ rotate: '45deg' }],
  },
  chip: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, overflow: 'hidden' },
  chipText: { fontFamily: fonts.bold, fontSize: 12 },
});
