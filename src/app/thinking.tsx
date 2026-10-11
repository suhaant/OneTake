import React, { useEffect, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AeroBackground from '../components/AeroBackground';
import ChunkyButton from '../components/ChunkyButton';
import Panda from '../components/Panda';
import { GlassCard, Gloss, SpeechBubble } from '../components/Glass';
import { Check, Sound } from '../components/Icons';
import { useAnalysisMusic } from '../components/AnalysisMusic';
import { colors, fonts, gradients } from '../theme';
import { useApp } from '../store';

const TIP_SECONDS = 6;

/**
 * What the scorer is doing, in order, with the second each step usually starts. Scoring lands in
 * 15–30 s; the last stage holds until the result arrives, so there is no countdown to run out.
 */
const stages = [
  { at: 0, label: 'Transcribing your words', doing: 'Give me a sec…' },
  { at: 7, label: 'Listening for pace and fillers', doing: 'Listening back to your voice…' },
  { at: 15, label: 'Watching eye contact and posture', doing: 'Checking eye contact…' },
  { at: 24, label: 'Scoring the structure', doing: 'Reading the structure…' },
];

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

const GUESS_MIN = 40;
const GUESS_MAX = 100;

/** A glass slider: drag or tap anywhere on the track. Built on the responder system so it works on web too. */
function GuessSlider({ value, onChange, locked }: { value: number; onChange: (v: number) => void; locked: boolean }) {
  const [w, setW] = useState(0);
  const pct = (value - GUESS_MIN) / (GUESS_MAX - GUESS_MIN);
  const set = (x: number) => {
    if (!w || locked) return;
    const p = Math.min(1, Math.max(0, x / w));
    onChange(Math.round(GUESS_MIN + p * (GUESS_MAX - GUESS_MIN)));
  };
  return (
    <View
      style={styles.sliderHit}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => !locked}
      onMoveShouldSetResponder={() => !locked}
      onResponderGrant={(e) => set(e.nativeEvent.locationX)}
      onResponderMove={(e) => set(e.nativeEvent.locationX)}
      accessibilityRole="adjustable"
      accessibilityValue={{ min: GUESS_MIN, max: GUESS_MAX, now: value }}
    >
      <View style={styles.sliderTrack}>
        <LinearGradient colors={['#E4F2FA', '#FFFFFF']} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={[...gradients.aqua]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.sliderFill, { width: `${pct * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: `${pct * 100}%` }]}>
        <LinearGradient colors={[...gradients.chrome]} style={StyleSheet.absoluteFill} />
        <Gloss height="50%" radius={17} />
        <Text style={styles.thumbText}>{value}</Text>
      </View>
    </View>
  );
}

export default function Thinking() {
  const insets = useSafeAreaInsets();
  const { analyze, scoreGuess, setScoreGuess } = useApp();
  const [failed, setFailed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [guess, setGuess] = useState(scoreGuess ?? 72);
  const [locked, setLocked] = useState(scoreGuess != null);
  const [tip, setTip] = useState(() => Math.floor(Math.random() * tips.length));
  const [fade] = useState(() => new Animated.Value(1));
  const music = useAnalysisMusic(!failed);
  const { fadeOut } = music;

  useEffect(() => {
    let active = true;
    analyze()
      .then(async () => {
        if (!active) return;
        await fadeOut();
        if (active) router.replace('/results');
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [analyze, fadeOut]);

  // Elapsed seconds drive the stage list; nothing counts down, so running long never looks broken.
  useEffect(() => {
    if (failed) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
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

  const stageIndex = stages.reduce((idx, s, n) => (elapsed >= s.at ? n : idx), 0);
  const current = tips[tip];

  const lock = () => {
    setLocked(true);
    setScoreGuess(guess);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {
      // web
    }
  };

  if (failed) {
    return (
      <View style={styles.root}>
        <AeroBackground />
        <View style={styles.center}>
          <View style={styles.pandaRow}>
            <View style={{ width: 84 }} />
            <SpeechBubble text="I couldn't score that take. Your streak is safe; try recording again." />
          </View>
          <Panda pose="console" size={230} />
          <ChunkyButton tone="green" label="Record again" depth={4} style={{ marginTop: 24, alignSelf: 'stretch', marginHorizontal: 32 }} onPress={() => router.replace('/prompt')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AeroBackground />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 30, paddingHorizontal: 20, gap: 14 }} showsVerticalScrollIndicator={false}>
        <View style={styles.pandaRow}>
          <Panda pose="thinking" headOnly size={84} />
          <SpeechBubble text={stages[stageIndex].doing} />
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={music.muted ? 'Turn music on' : 'Turn music off'} onPress={music.toggle} style={styles.soundBtn}>
          <Sound muted={music.muted} />
        </Pressable>

        {/* 1. what is happening, step by step */}
        <GlassCard style={styles.card}>
          <Text style={styles.eyebrow}>Scoring your take</Text>
          {stages.map((s, n) => {
            const done = n < stageIndex;
            const active = n === stageIndex;
            return (
              <View key={s.label} style={styles.stage}>
                <View style={[styles.stageDot, done && styles.stageDone, active && styles.stageActive]}>
                  {done ? <Check size={14} color="#fff" /> : active ? <Pulse /> : null}
                </View>
                <Text style={[styles.stageText, done && { color: colors.muted }, active && { fontFamily: fonts.bold }]}>{s.label}</Text>
              </View>
            );
          })}
          <Text style={styles.stageHint}>{elapsed > 40 ? 'Taking a little longer than usual. Hang on.' : 'Usually under half a minute.'}</Text>
        </GlassCard>

        {/* 2. commit to a number before the reveal */}
        <GlassCard tint="aqua" style={styles.card}>
          <Text style={styles.eyebrow}>Call your score</Text>
          <Text style={styles.guessTitle}>{locked ? `Locked in at ${guess}.` : 'How did that feel? Make a call.'}</Text>
          <Text style={styles.guessSub}>{locked ? 'We will tell you how close you were.' : 'Guess before you see it. People who do read their own delivery better over time.'}</Text>
          <GuessSlider value={guess} onChange={setGuess} locked={locked} />
          {!locked && <ChunkyButton tone="green" label="Lock it in" depth={4} onPress={lock} />}
        </GlassCard>

        {/* 3. one thing to take into tomorrow */}
        <GlassCard style={styles.card}>
          <Animated.View style={{ opacity: fade }}>
            <View style={styles.tipHeader}>
              <Text style={styles.eyebrow}>While you wait</Text>
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
      </ScrollView>
    </View>
  );
}

/** Breathing dot for the stage in progress. */
function Pulse() {
  const [a] = useState(() => new Animated.Value(0.4));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 1, duration: 600, useNativeDriver: true }), Animated.timing(a, { toValue: 0.4, duration: 600, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', opacity: a }} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  pandaRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  soundBtn: { position: 'absolute', right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  card: { padding: 16, gap: 10 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.blue },
  stage: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  stageDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#BFDDEC', alignItems: 'center', justifyContent: 'center' },
  stageDone: { backgroundColor: colors.leaf, borderColor: colors.greenDark },
  stageActive: { backgroundColor: colors.aquaDeep, borderColor: colors.blueDeep },
  stageText: { flex: 1, fontFamily: fonts.semi, fontSize: 15, color: colors.navy },
  stageHint: { marginTop: 4, fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  guessTitle: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24, color: colors.navy },
  guessSub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text2 },
  sliderHit: { height: 56, justifyContent: 'center', marginTop: 6, marginBottom: 4, marginHorizontal: 17 },
  sliderTrack: { height: 14, borderRadius: 7, borderWidth: 1, borderColor: '#BFDDEC', overflow: 'hidden' },
  sliderFill: { height: '100%', borderRadius: 7 },
  thumb: { position: 'absolute', top: 11, width: 34, height: 34, marginLeft: -17, borderRadius: 17, borderWidth: 1, borderColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbText: { fontFamily: fonts.bold, fontSize: 12, color: colors.navy },
  tipHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  tipTag: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.greenLight },
  tipTagText: { fontFamily: fonts.bold, fontSize: 11, color: colors.greenText, letterSpacing: 0.4 },
  tipTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 23, color: colors.navy },
  tipBody: { marginTop: 6, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 12 },
  tipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.hair },
  tipDotOn: { backgroundColor: colors.blue, width: 14 },
});
