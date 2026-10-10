import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import AeroBackground from '../components/AeroBackground';
import Panda from '../components/Panda';
import { SpeechBubble } from '../components/Glass';
import { Back } from '../components/Icons';
import { colors, fonts } from '../theme';
import { useApp } from '../store';

const TAKE_SECONDS = 30;

export default function Prompt() {
  const insets = useSafeAreaInsets();
  const { setVideoUri, promptText, takers } = useApp();
  const [cam, requestCam] = useCameraPermissions();
  const [mic, requestMic] = useMicrophonePermissions();
  const camera = useRef<CameraView>(null);
  const [recording, setRecording] = useState(false);
  const [left, setLeft] = useState(TAKE_SECONDS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    console.log('[onetake] prompt mounted');
    return () => console.log('[onetake] prompt unmounted');
  }, []);

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

  const start = async () => {
    if (recording || !camera.current) return;
    setRecording(true);
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

  const granted = cam?.granted && mic?.granted;
  const mm = `0:${left.toString().padStart(2, '0')}`;

  return (
    <View style={styles.root}>
      <AeroBackground bubbles={[{ x: 0.1, y: 0.4, r: 23 }]} />

      <View style={[styles.header, { top: insets.top + 8 }]}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.roundBtn}>
          <Back />
        </Pressable>
        <Text style={styles.headerTitle}>{recording ? 'Recording' : "Today's prompt"}</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={[styles.pandaRow, { top: insets.top + 68 }]}>
        <Panda pose="encourage" headOnly size={84} />
        <SpeechBubble text={recording ? 'Eyes on the lens. You are doing great.' : "Read it twice, then look at the lens. I'll start the clock when you tap."} />
      </View>

      <View style={[styles.promptWrap, { top: insets.top + 176 }]}>
        <Text style={styles.prompt}>{promptText}</Text>
        <Text style={styles.promptSub}>
          {takers === 0 ? 'Be the first to take this one today.' : takers === 1 ? '1 person has taken this one today.' : `${takers.toLocaleString()} people have taken this one today.`}
        </Text>
      </View>

      {/* viewfinder */}
      <View style={[styles.finder, { top: insets.top + 300, bottom: insets.bottom + 124 }]}>
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
          <Ellipse cx={175} cy={140} rx={72} ry={92} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} strokeDasharray="6 7" />
        </Svg>
        <Text style={styles.finderStatus}>{recording ? 'REC' : ready ? 'READY' : '…'}</Text>
        <View style={styles.timer}>
          <Text style={styles.timerText}>{mm}</Text>
        </View>
        <Text style={styles.finderHint}>Face in the oval · hands in frame · eyes on the lens</Text>
      </View>

      {/* shutter */}
      <View style={[styles.shutterWrap, { bottom: insets.bottom + 28 }]}>
        <Pressable
          accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
          onPress={recording ? stop : start}
          disabled={!granted || !ready}
          style={[styles.shutter, (!granted || !ready) && { opacity: 0.5 }]}
        >
          <Svg width={78} height={78} style={StyleSheet.absoluteFill}>
            <Circle cx={39} cy={39} r={37} stroke="rgba(255,255,255,0.9)" strokeWidth={3} fill="none" />
            {recording && (
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
            )}
          </Svg>
          <View style={[styles.shutterDot, recording && styles.shutterStop]} />
        </Pressable>
        <Text style={styles.shutterHint}>{recording ? 'Tap to finish early' : 'Tap to start · one take, no retakes'}</Text>
      </View>
    </View>
  );
}

const shadowText = { textShadowColor: 'rgba(0,80,140,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 };

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: 1.4, textTransform: 'uppercase', color: '#fff', ...shadowText },
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
  pandaRow: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  promptWrap: { position: 'absolute', left: 28, right: 28 },
  prompt: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 35, letterSpacing: -0.4, color: '#fff', textShadowColor: 'rgba(0,80,140,0.45)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  promptSub: { marginTop: 10, fontFamily: fonts.medium, fontSize: 14, color: '#fff', opacity: 0.92, ...shadowText },
  finder: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#1C2833',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#003264',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  finderStatus: { position: 'absolute', left: 16, top: 14, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1, color: '#fff', opacity: 0.9 },
  timer: { position: 'absolute', right: 14, top: 12, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  timerText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  finderHint: { position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', fontFamily: fonts.semi, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  permText: { fontFamily: fonts.semi, fontSize: 15, color: '#fff', textAlign: 'center', lineHeight: 21 },
  permBtn: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 22, borderRadius: 999, backgroundColor: '#fff' },
  permBtnText: { fontFamily: fonts.bold, color: colors.navy },
  shutterWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 12 },
  shutter: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center' },
  shutterDot: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E8261E' },
  shutterStop: { width: 30, height: 30, borderRadius: 7 },
  shutterHint: { fontFamily: fonts.semi, fontSize: 13, color: '#fff', ...shadowText },
});
