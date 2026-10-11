import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AeroBackground from '../components/AeroBackground';
import ChunkyButton from '../components/ChunkyButton';
import Panda from '../components/Panda';
import { GlassCard, SpeechBubble } from '../components/Glass';
import EcoProgress from '../components/EcoProgress';
import { Check, Sound } from '../components/Icons';
import { useAnalysisMusic } from '../components/AnalysisMusic';
import { colors, fonts } from '../theme';
import { useApp } from '../store';
import { POSE, almostDone, dontLine, tipLine, waitingIntro } from '../coachLines';
import { firstName, useCoach } from '../voice';

/** The island clip's grass sits at the foot of the screen; the cards stop above it. */
const GRASS_HEIGHT = 300;
/** Once the scorer is this far along he says "almost done". */
const ALMOST_AT = 15;

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

export default function Thinking() {
  const insets = useSafeAreaInsets();
  const { analyze, me } = useApp();
  const { coach, talking, line, said } = useCoach();
  const [failed, setFailed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [tip, setTip] = useState(() => Math.floor(Math.random() * tips.length));
  const [fade] = useState(() => new Animated.Value(1));
  const elapsedRef = useRef(0);
  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);
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

  // The panda talks you through the wait: a tip, a don't, "almost done", the next tip… until the
  // result lands (unmounting stops him). The tip card follows his voice rather than a timer.
  useEffect(() => {
    if (failed) return;
    let active = true;
    const showTip = (n: number) =>
      Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        if (!active) return;
        setTip(n);
        Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
      });
    (async () => {
      const name = firstName(me?.name);
      if (!(await coach.say([waitingIntro(name)]))) return;
      let n = tip;
      let saidAlmost = false;
      while (active) {
        const lines = [tipLine(n, tips[n % tips.length]), dontLine(n)];
        if (!saidAlmost && elapsedRef.current >= ALMOST_AT) {
          lines.push(almostDone);
          saidAlmost = true;
        }
        const ok = await coach.say(lines, { onLine: (l) => l.tag === `tip:${n}` && showTip(n % tips.length) });
        if (!ok) return;
        n += 1;
      }
    })();
    return () => {
      active = false;
      coach.stop();
    };
    // Runs once per visit: the tip index it starts from is read on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed, fade, coach, me?.name]);

  const stageIndex = stages.reduce((idx, s, n) => (elapsed >= s.at ? n : idx), 0);
  const current = tips[tip];

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
      <AeroBackground video="grass" poster="island" drift={0} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: GRASS_HEIGHT * 0.55 + insets.bottom, paddingHorizontal: 20, gap: 14 }} showsVerticalScrollIndicator={false}>
        <View style={styles.pandaRow}>
          <Panda pose={talking && line?.mood ? POSE[line.mood] : 'thinking'} size={104} mouth={coach.mouth} beat={coach.beat} gesture={talking ? line?.gesture : undefined} />
          <SpeechBubble text={talking && said ? said : stages[stageIndex].doing} />
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={music.muted ? 'Turn music on' : 'Turn music off'} onPress={music.toggle} style={styles.soundBtn}>
          <Sound muted={music.muted} />
        </Pressable>

        {/* 1. what is happening, step by step */}
        <GlassCard style={styles.card}>
          <Text style={styles.eyebrow}>Scoring your take</Text>
          {/* fills toward the usual finish and holds near the end rather than lying about being done */}
          <EcoProgress progress={Math.min(0.92, elapsed / 34)} />
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

        {/* 2. one thing to take into tomorrow */}
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
  tipHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  tipTag: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.greenLight },
  tipTagText: { fontFamily: fonts.bold, fontSize: 11, color: colors.greenText, letterSpacing: 0.4 },
  tipTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 23, color: colors.navy },
  tipBody: { marginTop: 6, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 12 },
  tipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.hair },
  tipDotOn: { backgroundColor: colors.blue, width: 14 },
});
