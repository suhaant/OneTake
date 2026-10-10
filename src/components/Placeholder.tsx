import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AeroBackground from './AeroBackground';
import Panda, { PandaPose } from './Panda';
import { colors, fonts } from '../theme';

export default function Placeholder({ title, body, pose }: { title: string; body: string; pose: PandaPose }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <AeroBackground />
      <View style={[styles.wrap, { paddingTop: insets.top + 60 }]}>
        <Panda pose={pose} size={200} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingHorizontal: 32, gap: 14 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: '#fff',
    textShadowColor: 'rgba(0,80,140,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  body: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, color: colors.navy, textAlign: 'center' },
});
