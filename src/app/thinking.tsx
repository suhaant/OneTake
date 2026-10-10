import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import AeroBackground from '../components/AeroBackground';
import ChunkyButton from '../components/ChunkyButton';
import Panda from '../components/Panda';
import { GlassCard, SpeechBubble } from '../components/Glass';
import { colors, fonts } from '../theme';
import { useApp } from '../store';

const lines = ['Give me a sec…', 'Listening back to your voice…', 'Checking eye contact…', 'Reading the structure…', 'Almost there…'];

/** Scoring usually lands in 15–30 s; the countdown starts here and holds at 0:00 if it runs over. */
const COUNTDOWN_SECONDS = 45;
const TIP_SECONDS = 5;

/** One tip per thing the scorer measures, so the wait teaches what the score will say. */
const tips: { tag: string; title: string; body: string }[] = [
  { tag: 'Pace', title: 'Slower than you think', body: 'Comfortable speech is 130–170 words a minute. Nerves push you faster; a breath between sentences brings you back.' },
  { tag: 'Fillers', title: 'Trade "um" for silence', body: 'Fluent speakers use one or two fillers per 100 words. A half-second pause sounds more confident than any filler.' },
  { tag: 'Eye contact', title: 'Look at the lens, not the screen', body: 'Watching yourself reads as looking down. The lens is where the listener is.' },
  { tag: 'Structure', title: 'One idea in thirty seconds', body: 'Hook, one supporting point, close. If you have three points, you have three takes.' },
  { tag: 'Opening', title: 'Start with the point', body: 'Skip "so, um, today I’m going to talk about". Your first sentence is your answer.' },
  { tag: 'Posture', title: 'Shoulders back, chin level', body: 'Sit or stand tall with your face and upper body in frame. Slumping reads as low energy before you say a word.' },
  { tag: 'Gestures', title: 'Let your hands move', body: 'Keep them in frame and use them on key words. Frozen hands read as nervous.' },
  { tag: 'Language', title: 'One precise word beats three vague ones', body: '"Protected bike lanes" says more than "better transportation stuff".' },
  { tag: 'Closing', title: 'Land the ending', body: 'Finish on your point, not on "yeah, so that’s it". Then stop talking.' },
];

export default function Thinking() {
  const { analyze } = useApp();
  const [i, setI] = useState(0);
  const [failed, setFailed] = useState(false);
  const [left, setLeft] = useState(COUNTDOWN_SECONDS);
  const [tip, setTip] = useState(() => Math.floor(Math.random() * tips.length));
  const [fade] = useState(() => new Animated.Value(1));

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

  // Countdown to the expected result; holds at 0:00 while scoring runs long, stops on failure.
  useEffect(() => {
    if (failed) return;
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [failed]);

  // Next tip every few seconds, fading out and back in.
  useEffect(() => {
    if (failed) return;
    const id = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setTip((t) => (t + 1) % tips.length);
        Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
      });
    }, TIP_SECONDS * 1000);
    return () => clearInterval(id);
  }, [failed, fade]);

  const clock = `${Math.floor(left / 60)}:${(left % 60).toString().padStart(2, '0')}`;
  const hint = left > 0 ? 'Your score is on its way' : 'Finishing up, hang on…';
  const current = tips[tip];

  return (
    <View style={styles.root}>
      <AeroBackground />
      <View style={styles.center}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 24, marginBottom: 16, width: '100%' }}>
          <View style={{ width: 84 }} />
          <SpeechBubble text={failed ? "I couldn't score that take. Your streak is safe; try recording again." : lines[i]} />
        </View>
        <Panda pose={failed ? 'console' : 'thinking'} size={failed ? 230 : 190} />
        {failed ? (
          <ChunkyButton tone="green" label="Record again" depth={4} style={{ marginTop: 24, alignSelf: 'stretch', marginHorizontal: 32 }} onPress={() => router.replace('/prompt')} />
        ) : (
          <>
            <Text style={styles.label}>Analyzing your take</Text>
            <Text style={styles.sub}>Voice · Body · Content</Text>
            <View style={styles.timer}>
              <View style={[styles.dot, left === 0 && styles.dotLate]} />
              <Text style={styles.timerText}>{clock}</Text>
            </View>
            <Text style={styles.hint}>{hint}</Text>

            <GlassCard style={styles.tipCard}>
              <Animated.View style={{ opacity: fade }}>
                <View style={styles.tipHeader}>
                  <Text style={styles.tipEyebrow}>While you wait</Text>
                  <View style={styles.tipTag}>
                    <Text style={styles.tipTagText}>{current.tag}</Text>
                  </View>
                </View>
                <Text style={styles.tipTitle}>{current.title}</Text>
                <Text style={styles.tipBody}>{current.body}</Text>
              </Animated.View>
              <View style={styles.dots}>
                {tips.map((_, n) => (
                  <View key={n} style={[styles.tipDot, n === tip && styles.tipDotOn]} />
                ))}
              </View>
            </GlassCard>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  label: { marginTop: 16, fontFamily: fonts.bold, fontSize: 22, color: '#fff', textShadowColor: 'rgba(0,80,140,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  sub: { fontFamily: fonts.semi, fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.navy, opacity: 0.8 },
  timer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  dotLate: { backgroundColor: colors.yellow },
  timerText: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy, fontVariant: ['tabular-nums'] },
  hint: { marginTop: 4, fontFamily: fonts.medium, fontSize: 13, color: colors.navy, opacity: 0.75 },
  tipCard: { marginTop: 18, alignSelf: 'stretch', paddingHorizontal: 18, paddingVertical: 16, minHeight: 150 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  tipEyebrow: { fontFamily: fonts.semi, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted },
  tipTag: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.greenLight },
  tipTagText: { fontFamily: fonts.bold, fontSize: 11, color: colors.greenText, letterSpacing: 0.4 },
  tipTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 23, color: colors.navy },
  tipBody: { marginTop: 6, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 12 },
  tipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.hair },
  tipDotOn: { backgroundColor: colors.blue, width: 14 },
});
