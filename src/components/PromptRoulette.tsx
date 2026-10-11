import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, Easing, runOnJS } from 'react-native-reanimated';
import AeroBackground from './AeroBackground';
import ChunkyButton from './ChunkyButton';
import { Gloss } from './Glass';
import { colors, fonts, gradients, skyText } from '../theme';
import { promptPool } from '../data/prompts';

const ROW_H = 92;
const VISIBLE = 3;
const SPIN_MS = 3200;

type Props = {
  visible: boolean;
  /** today's prompt, shared by everyone; the reel lands on it */
  prompt: string;
  takers: number;
  onDone: () => void;
  onClose: () => void;
};

/** Shuffle the decoys, then put today's prompt last so the reel stops on it. */
function buildReel(prompt: string) {
  const decoys = promptPool.filter((p) => p !== prompt).sort(() => Math.random() - 0.5);
  return [...decoys.slice(0, 14), prompt];
}

/**
 * A slot-machine reel of prompts that decelerates onto today's. Makes the point that the prompt is
 * drawn fresh each day, and that everyone who plays today gets the same one.
 */
export default function PromptRoulette({ visible, prompt, takers, onDone, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      {/* mounted fresh on every open, so the reel always starts from the top */}
      {visible && <Reel prompt={prompt} takers={takers} onDone={onDone} />}
    </Modal>
  );
}

function Reel({ prompt, takers, onDone }: { prompt: string; takers: number; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const reel = useMemo(() => buildReel(prompt), [prompt]);
  const [landed, setLanded] = useState(false);
  const y = useSharedValue(0);
  const flash = useSharedValue(0);
  const pop = useSharedValue(1);

  // Runs on the JS thread once the reel stops: light it up and let the user through.
  const land = () => {
    setLanded(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // web
    }
    flash.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 700 }));
    pop.value = withSequence(withTiming(1.06, { duration: 160, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 260, easing: Easing.out(Easing.back(2)) }));
  };

  useEffect(() => {
    // Fast start, long ease-out: the last few rows crawl past before it settles.
    const target = -(reel.length - 1) * ROW_H;
    y.value = withSequence(
      withTiming(target * 0.4, { duration: SPIN_MS * 0.3, easing: Easing.in(Easing.quad) }),
      withTiming(target, { duration: SPIN_MS * 0.7, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(land)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value + ROW_H * Math.floor(VISIBLE / 2) }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const windowStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const captionStyle = useAnimatedStyle(() => ({ opacity: withDelay(200, withTiming(landed ? 1 : 0, { duration: 400 })), transform: [{ translateY: withTiming(landed ? 0 : 10, { duration: 400 }) }] }));

  const machineW = Math.min(width - 40, 380);

  return (
      <View style={styles.root}>
        <AeroBackground video="meadow" poster="meadow" />

        <View style={styles.top}>
          <Text style={styles.eyebrow}>Drawing today&apos;s prompt</Text>
          <Text style={styles.title}>{landed ? 'Locked in.' : 'One prompt a day…'}</Text>
        </View>

        <Animated.View style={[styles.machine, { width: machineW }, windowStyle]}>
          <LinearGradient colors={[...gradients.chrome]} locations={[0, 0.4, 0.85, 1]} style={StyleSheet.absoluteFill} />
          <Gloss height="40%" radius={30} />

          <View style={styles.window}>
            <LinearGradient colors={['#D9F0FA', '#FFFFFF', '#FFFFFF', '#D9F0FA']} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />
            <Animated.View style={[styles.reel, reelStyle]}>
              {reel.map((p, i) => (
                <View key={i} style={styles.row}>
                  <Text style={[styles.rowText, i === reel.length - 1 && landed && styles.rowTextHit]} numberOfLines={3}>
                    {p}
                  </Text>
                </View>
              ))}
            </Animated.View>
            {/* fade the rows above and below the payline, like glass curving away */}
            <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']} style={[styles.fade, { top: 0 }]} />
            <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)']} style={[styles.fade, { bottom: 0 }]} />
            <View pointerEvents="none" style={styles.payline}>
              <LinearGradient colors={['rgba(95,227,255,0)', 'rgba(95,227,255,0.35)', 'rgba(95,227,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </View>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#E9FF9A' }, flashStyle]} />
          </View>

          <View style={styles.lights}>
            {Array.from({ length: 7 }).map((_, i) => (
              <View key={i} style={[styles.light, landed && styles.lightOn]} />
            ))}
          </View>
        </Animated.View>

        <Animated.View style={[styles.captionWrap, captionStyle]}>
          <Text style={styles.caption}>Same prompt for everyone today.</Text>
          <Text style={styles.captionSub}>
            {takers === 0 ? 'You would be the first to take it.' : takers === 1 ? '1 person has taken it so far.' : `${takers.toLocaleString()} people have taken it so far. Beat them.`}
          </Text>
          <Text style={styles.captionSub}>New prompt at midnight.</Text>
        </Animated.View>

        <View style={styles.actions}>
          {landed ? (
            <ChunkyButton tone="green" label="Take it" depth={8} onPress={onDone} />
          ) : (
            <ChunkyButton tone="white" label="Skip the spin" depth={4} onPress={onDone} />
          )}
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  top: { alignItems: 'center', gap: 6, marginBottom: 22 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase', ...skyText },
  title: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -0.4, ...skyText },
  machine: {
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: 14,
    overflow: 'hidden',
    shadowColor: '#0A4E8A',
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  window: {
    height: ROW_H * VISIBLE,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#BFDDEC',
    overflow: 'hidden',
  },
  reel: { position: 'absolute', left: 0, right: 0, top: 0 },
  row: { height: ROW_H, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  rowText: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, textAlign: 'center', color: colors.navy },
  rowTextHit: { color: colors.greenText },
  fade: { position: 'absolute', left: 0, right: 0, height: ROW_H * 0.9 },
  payline: { position: 'absolute', left: 0, right: 0, top: ROW_H, height: ROW_H, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: 'rgba(15,168,222,0.45)' },
  lights: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: 12 },
  light: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#C9DCE7', borderWidth: 1, borderColor: '#fff' },
  lightOn: { backgroundColor: '#D8FF66', borderColor: '#8CD63D', shadowColor: '#9BE534', shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  captionWrap: { alignItems: 'center', gap: 4, marginTop: 22, minHeight: 72 },
  caption: { fontFamily: fonts.bold, fontSize: 20, ...skyText },
  captionSub: { fontFamily: fonts.medium, fontSize: 14, ...skyText },
  actions: { alignSelf: 'stretch', marginTop: 16, paddingHorizontal: 12 },
});
