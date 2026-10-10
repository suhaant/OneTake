import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import AeroBackground from '../components/AeroBackground';
import ChunkyButton from '../components/ChunkyButton';
import Panda from '../components/Panda';
import { SpeechBubble } from '../components/Glass';
import { colors, fonts } from '../theme';
import { useApp } from '../store';

const lines = ['Give me a sec…', 'Listening back to your voice…', 'Checking eye contact…', 'Reading the structure…', 'Almost there…'];

export default function Thinking() {
  const { analyze } = useApp();
  const [i, setI] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const tick = setInterval(() => setI((n) => Math.min(n + 1, lines.length - 1)), 1100);
    analyze()
      .then(() => active && router.replace('/results'))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      clearInterval(tick);
    };
  }, [analyze]);

  return (
    <View style={styles.root}>
      <AeroBackground />
      <View style={styles.center}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 24, marginBottom: 24, width: '100%' }}>
          <View style={{ width: 84 }} />
          <SpeechBubble text={failed ? "I couldn't score that take. Your streak is safe; try recording again." : lines[i]} />
        </View>
        <Panda pose={failed ? 'console' : 'thinking'} size={230} />
        {failed ? (
          <ChunkyButton tone="green" label="Record again" depth={4} style={{ marginTop: 24, alignSelf: 'stretch', marginHorizontal: 32 }} onPress={() => router.replace('/prompt')} />
        ) : (
          <>
            <Text style={styles.label}>Analyzing your take</Text>
            <Text style={styles.sub}>Voice · Body · Content</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  label: { marginTop: 24, fontFamily: fonts.bold, fontSize: 22, color: '#fff', textShadowColor: 'rgba(0,80,140,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  sub: { fontFamily: fonts.semi, fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.navy, opacity: 0.8 },
});
