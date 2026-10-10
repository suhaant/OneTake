import React from 'react';
import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { colors, fonts, glassShadow } from '../theme';

export function GlassCard({
  children,
  style,
  solid = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  solid?: boolean;
}) {
  return (
    <View style={[styles.card, solid && styles.solid, style]}>
      <View style={styles.topHighlight} />
      {children}
    </View>
  );
}

/** Panda's speech bubble, tail on the left pointing at him. */
export function SpeechBubble({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.bubble, style]}>
      <View style={styles.topHighlight} />
      <Text style={styles.bubbleText}>{text}</Text>
      <View style={styles.tail} />
    </View>
  );
}

export function Chip({ text, tone = 'white' }: { text: string; tone?: 'white' | 'green' | 'blue' }) {
  const toneStyle =
    tone === 'green' ? styles.chipGreen : tone === 'blue' ? styles.chipBlue : styles.chipWhite;
  const textStyle =
    tone === 'green' ? { color: colors.greenText } : tone === 'blue' ? { color: colors.blue } : { color: '#7A4A00' };
  return (
    <View style={[styles.chip, toneStyle]}>
      <Text style={[styles.chipText, textStyle]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    overflow: 'hidden',
    ...glassShadow,
  },
  solid: { backgroundColor: '#FFFFFF' },
  topHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: '#fff',
  },
  bubble: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    ...glassShadow,
  },
  bubbleText: { fontFamily: fonts.semi, fontSize: 16, lineHeight: 21, color: colors.navy },
  tail: {
    position: 'absolute',
    left: -7,
    bottom: 18,
    width: 14,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    transform: [{ rotate: '45deg' }],
  },
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  chipText: { fontFamily: fonts.bold, fontSize: 12 },
  chipWhite: { backgroundColor: 'rgba(255,255,255,0.9)', borderColor: 'rgba(255,255,255,0.95)' },
  chipGreen: { backgroundColor: '#D9F7B0', borderColor: '#9ED85A' },
  chipBlue: { backgroundColor: '#DDF4FF', borderColor: '#84D8FF' },
});
