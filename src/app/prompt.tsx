import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import AeroBackground from '../components/AeroBackground';
import ChunkyButton from '../components/ChunkyButton';
import Panda from '../components/Panda';
import { SpeechBubble } from '../components/Glass';
import { Back } from '../components/Icons';
import { colors, fonts, skyText } from '../theme';
import { useApp } from '../store';
import { POSE, introLines } from '../coachLines';
import { firstName, prefetch, useCoach } from '../voice';

const TAKE_SECONDS = 30;
/** idle: waiting for Start · intro: the panda greets and reads the prompt · countdown: 5..1 · recording */
type Phase = 'idle' | 'intro' | 'countdown' | 'recording';

export default function Prompt() {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const { setVideoUri, promptText, takers, doneToday, me } = useApp();
  const [cam, requestCam] = useCameraPermissions();
  const [mic, requestMic] = useMicrophonePermissions();
  const camera = useRef<CameraView>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const recording = phase === 'recording';
  const [count, setCount] = useState<number | null>(null);
  const [left, setLeft] = useState(TAKE_SECONDS);
  const [ready, setReady] = useState(false);
  const { coach, talking, line, said } = useCoach();
  const name = firstName(me?.name);
  const lines = useMemo(() => introLines(name, promptText), [name, promptText]);

  // Fetch the greeting and countdown while the user reads, so Start is instant.
  useEffect(() => {
    prefetch(lines.intro.text);
    prefetch(lines.countdown.text);
  }, [lines]);

  useEffect(() => {
    console.log('[onetake] prompt mounted');
    return () => console.log('[onetake] prompt unmounted');
  }, []);

  // One take a day. This also catches a tap that beat the account load: once today's take shows up, leave.
  useEffect(() => {
    if (doneToday && phase === 'idle') router.replace('/results');
  }, [doneToday, phase]);

  useEffect(() => {
    if (cam && !cam.granted && cam.canAskAgain) requestCam();
    if (mic && !mic.granted && mic.canAskAgain) requestMic();
  }, [cam, mic, requestCam, requestMic]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [recording]);

  // Time's up: stop from JS as well as native maxDuration, so the take ends on the countdown
  // and recordAsync resolves (which sends it to analysis) without waiting on the camera.
  useEffect(() => {
    if (recording && left === 0) {
      console.log('[onetake] 30s reached, stopping');
      camera.current?.stopRecording();
    }
  }, [recording, left]);

  /** Start: the panda greets you, reads the prompt and counts down; the camera rolls on "1". */
  const begin = async () => {
    if (phase !== 'idle' || !camera.current || doneToday) return;
    setPhase('intro');
    const finished = await coach.say([lines.intro, lines.countdown], {
      onLine: (l) => {
        if (l === lines.countdown) setPhase('countdown');
      },
      onChar: (l, ch) => {
        if (l === lines.countdown && /[1-5]/.test(ch)) setCount(Number(ch));
      },
    });
    if (!finished) {
      setCount(null);
      return;
    }
    // The "1" is spoken at the very end of the clip; keep it on screen into the first beat of recording
    // so the countdown reads 5-4-3-2-1 rather than 5-4-3-2-blink.
    setTimeout(() => setCount(null), 700);
    await record();
  };

  /** Skip the talk and roll now. */
  const skip = () => {
    coach.stop();
    setCount(null);
    record();
  };

  const record = async () => {
    if (!camera.current || doneToday) return;
    setPhase('recording');
    setLeft(TAKE_SECONDS);
    console.log('[onetake] recording started');
    try {
      const video = await camera.current.recordAsync({ maxDuration: TAKE_SECONDS });
      console.log('[onetake] recorded', video?.uri ?? '(no uri)');
      setVideoUri(video?.uri ?? null);
    } catch (err) {
      console.warn('[onetake] recording failed:', err instanceof Error ? err.message : String(err));
      setVideoUri(null);
    }
    router.replace('/thinking');
  };

  const stop = () => {
    console.log('[onetake] stop pressed');
    camera.current?.stopRecording();
  };

  // Leaving the screen mid-intro: no stray voice, no camera.
  useEffect(() => () => coach.stop(), [coach]);

  const granted = cam?.granted && mic?.granted;
  const mm = `0:${left.toString().padStart(2, '0')}`;

  return (
    <View style={styles.root}>
      <AeroBackground art="meadow" drift={0} />

      <View style={[styles.header, { marginTop: insets.top + 8 }]}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.roundBtn}>
          <Back />
        </Pressable>
        <Text style={styles.headerTitle}>{recording ? 'Recording' : "Today's prompt"}</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.pandaRow}>
        <Panda pose={talking && line?.mood ? POSE[line.mood] : recording ? 'encourage' : 'idle'} size={76} mouth={coach.mouth} beat={coach.beat} gesture={talking ? line?.gesture : undefined} />
        <SpeechBubble
          text={
            talking && said
              ? said
              : recording
                ? 'Eyes on the lens. You are doing great.'
                : phase === 'idle'
                  ? "Read it twice, then tap Start. I'll read it back and count you in."
                  : '…'
          }
        />
      </View>

      <View style={styles.promptWrap}>
        <Text style={styles.prompt}>{promptText}</Text>
        <Text style={styles.promptSub}>
          {takers === 0 ? 'Be the first to take this one today.' : takers === 1 ? '1 person has taken this one today.' : `${takers.toLocaleString()} people have taken this one today.`}
        </Text>
      </View>

      {/* viewfinder: at least half the screen, tall enough to keep face, shoulders and hands in frame */}
      <View style={[styles.finder, { minHeight: Math.round(screenH * 0.5) }]}>
        {granted ? (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="front" mode="video" mirror zoom={0} onCameraReady={() => { console.log('[onetake] camera ready'); setReady(true); }} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1C2833', alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
            <Text style={styles.permText}>OneTake needs the camera and mic to score your take.</Text>
            <Pressable onPress={() => { requestCam(); requestMic(); }} style={styles.permBtn}>
              <Text style={styles.permBtnText}>Allow</Text>
            </Pressable>
          </View>
        )}
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 350 420" preserveAspectRatio="xMidYMid slice">
          {/* Face guide sits in the upper third so the chest and hands have room below it. */}
          <Ellipse cx={175} cy={120} rx={66} ry={84} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} strokeDasharray="6 7" />
        </Svg>
        {count != null && (
          <View pointerEvents="none" style={styles.countWrap}>
            <Text key={count} style={styles.count}>{count}</Text>
          </View>
        )}
        <Text style={styles.finderStatus}>{recording ? 'REC' : phase !== 'idle' ? 'GET READY' : ready ? 'READY' : '…'}</Text>
        <View style={styles.timer}>
          <Text style={styles.timerText}>{mm}</Text>
        </View>
        <Text style={styles.finderHint}>Face in the oval · hands in frame · eyes on the lens</Text>
      </View>

      {/* start, then the shutter to finish early */}
      <View style={[styles.shutterWrap, { paddingBottom: insets.bottom + 16 }]}>
        {phase === 'idle' ? (
          <>
            <ChunkyButton tone="green" label="Start" depth={6} disabled={!granted || !ready} onPress={begin} style={{ alignSelf: 'stretch', marginHorizontal: 12 }} />
            <Text style={styles.shutterHint}>He counts you in · one take, no retakes</Text>
          </>
        ) : recording ? (
          <>
            <Pressable accessibilityLabel="Stop recording" onPress={stop} style={styles.shutter}>
              <Svg width={78} height={78} style={StyleSheet.absoluteFill}>
                <Circle cx={39} cy={39} r={37} stroke="rgba(255,255,255,0.9)" strokeWidth={3} fill="none" />
                <Circle
                  cx={39}
                  cy={39}
                  r={37}
                  stroke={colors.yellow}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(left / TAKE_SECONDS) * 232.5} 232.5`}
                  transform="rotate(-90 39 39)"
                />
              </Svg>
              <View style={[styles.shutterDot, styles.shutterStop]} />
            </Pressable>
            <Text style={styles.shutterHint}>Tap to finish early</Text>
          </>
        ) : (
          <>
            <View style={styles.shutter}>
              <Svg width={78} height={78} style={StyleSheet.absoluteFill}>
                <Circle cx={39} cy={39} r={37} stroke="rgba(255,255,255,0.5)" strokeWidth={3} fill="none" strokeDasharray="4 6" />
              </Svg>
              <View style={[styles.shutterDot, { opacity: 0.45 }]} />
            </View>
            <Pressable accessibilityLabel="Skip the countdown" onPress={skip} hitSlop={10}>
              <Text style={styles.shutterHint}>Skip · start recording now</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const shadowText = skyText;

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: 1.4, textTransform: 'uppercase', ...shadowText },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pandaRow: { marginTop: 10, marginHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  promptWrap: { marginTop: 10, marginHorizontal: 24 },
  prompt: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24, letterSpacing: -0.2, color: '#fff', textShadowColor: 'rgba(0,80,140,0.45)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  promptSub: { marginTop: 4, fontFamily: fonts.medium, fontSize: 12, opacity: 0.92, ...shadowText },
  finder: {
    flex: 1,
    marginTop: 10,
    marginHorizontal: 16,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#1C2833',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#003264',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  countWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  count: {
    fontFamily: fonts.bold,
    fontSize: 128,
    lineHeight: 160,
    includeFontPadding: false,
    textAlign: 'center',
    minWidth: 160,
    paddingHorizontal: 12,
    color: '#fff',
    textShadowColor: 'rgba(0,60,120,0.6)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 18,
  },
  finderStatus: { position: 'absolute', left: 16, top: 14, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1, color: '#fff', opacity: 0.9 },
  timer: { position: 'absolute', right: 14, top: 12, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  timerText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  finderHint: { position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', fontFamily: fonts.semi, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  permText: { fontFamily: fonts.semi, fontSize: 15, color: '#fff', textAlign: 'center', lineHeight: 21 },
  permBtn: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 22, borderRadius: 999, backgroundColor: '#fff' },
  permBtnText: { fontFamily: fonts.bold, color: colors.navy },
  shutterWrap: { paddingTop: 12, alignItems: 'center', gap: 8 },
  shutter: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center' },
  shutterDot: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E8261E' },
  shutterStop: { width: 30, height: 30, borderRadius: 7 },
  shutterHint: { fontFamily: fonts.semi, fontSize: 13, ...shadowText },
});
