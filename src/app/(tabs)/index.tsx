import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import AeroBackground from '../../components/AeroBackground';
import ChunkyButton from '../../components/ChunkyButton';
import Panda from '../../components/Panda';
import PromptRoulette from '../../components/PromptRoulette';
import { Chip, Gloss } from '../../components/Glass';
import { Check, Envelope, Flame, Gem, Crown, List, Lock } from '../../components/Icons';
import { colors, fonts, glassShadow, gradients } from '../../theme';
import { useApp } from '../../store';

function DoneNode({ label, score }: { label: string; score: number }) {
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <ChunkyButton tone="yellow" circle={74} depth={7} icon={<Check size={34} />} accessibilityLabel={`${label}, scored ${score}`} />
      <Chip text={`${label} · ${score}`} />
    </View>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { streak, xp, rank, result, me, doneToday: done, pastTakes, totalTakes, promptText, takers, refreshStats } = useApp();
  const [spinning, setSpinning] = useState(false);
  // The envelope spins the day's prompt into view first; the reel hands off to the recorder.
  const openEnvelope = () => (done ? router.push('/results') : setSpinning(true));
  const todayScore = result?.score ?? me?.todayScore ?? null;
  const dayNumber = Math.max(1, totalTakes + (done ? 0 : 1));

  useFocusEffect(
    React.useCallback(() => {
      refreshStats().catch(() => {});
    }, [refreshStats]),
  );

  return (
    <View style={styles.root}>
      {/* one shot: clouds up top, the grass island and water below the path */}
      <AeroBackground video="island" />

      {/* stat bar */}
      <View style={[styles.statBar, { top: insets.top + 8 }]}>
        <LinearGradient colors={[...gradients.glass]} style={StyleSheet.absoluteFill} />
        <Gloss height="50%" radius={22} />
        <View style={styles.stat}>
          <Flame size={26} />
          <Text style={[styles.statText, { color: colors.orange }]}>{streak}</Text>
        </View>
        <View style={styles.stat}>
          <Gem size={24} />
          <Text style={[styles.statText, { color: colors.blue }]}>{xp.toLocaleString()}</Text>
        </View>
        <View style={styles.stat}>
          <Crown size={26} />
          <Text style={[styles.statText, { color: '#C9A000' }]}>{rank ? `#${rank.toLocaleString()}` : '—'}</Text>
        </View>
      </View>

      {/* unit banner */}
      <View style={[styles.banner, { top: insets.top + 78 }]}>
        <LinearGradient colors={[...gradients.aqua]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
        <Gloss height="52%" radius={22} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>{done && todayScore != null ? `Today · ${todayScore}` : `Day ${dayNumber}`}</Text>
          <Text style={styles.bannerSub} numberOfLines={2}>
            {done ? 'Done for today. Back tomorrow!' : promptText}
          </Text>
        </View>
        <Pressable accessibilityLabel="Past takes" onPress={() => router.push('/results')} style={styles.bannerBtn}>
          <LinearGradient colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.12)']} style={StyleSheet.absoluteFill} />
          <Gloss height="50%" radius={16} />
          <List size={24} />
        </Pressable>
      </View>

      {/* path: sits right under the banner so today's node and the panda land near the middle of the screen */}
      <View style={[styles.path, { top: insets.top + 190 }]}>
        {/* the trail: a dotted road through the two earlier takes, today, and the locked days ahead */}
        <Svg pointerEvents="none" width={400} height={480} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Path
            d="M290 44 C 262 44, 232 50, 207 66 C 170 90, 118 128, 110 178 C 104 250, 134 326, 187 393 C 215 433, 262 408, 287 427"
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray="0.1 15"
          />
        </Svg>

        {/* the two takes before today climb away up and to the right; empty slots stay empty for a new user */}
        {pastTakes.length > 1 && (
          <View style={{ position: 'absolute', left: 253, top: 7 }}>
            <DoneNode label={pastTakes[0].day} score={pastTakes[0].score} />
          </View>
        )}
        {pastTakes.length > 0 && (
          <View style={{ position: 'absolute', left: 170, top: 26 }}>
            <DoneNode label={pastTakes[pastTakes.length - 1].day} score={pastTakes[pastTakes.length - 1].score} />
          </View>
        )}

        {/* today */}
        <View style={{ position: 'absolute', left: 40, top: 100, width: 140, alignItems: 'center' }}>
          <View>
            <View style={styles.openTag}>
              <LinearGradient colors={['#FFFFFF', '#F2FAFF', '#DFF2FB']} style={StyleSheet.absoluteFill} />
              <Gloss height="50%" radius={14} />
              <Text style={styles.openTagText}>{done ? 'DONE' : 'OPEN'}</Text>
            </View>
            <View style={styles.openTagTail} />
          </View>
          <View style={{ marginTop: 16, width: 124, height: 124, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={124} height={124} style={StyleSheet.absoluteFill}>
              <Circle cx={62} cy={62} r={56} stroke="rgba(255,255,255,0.7)" strokeWidth={8} fill="none" />
              <Circle
                cx={62}
                cy={62}
                r={56}
                stroke={colors.yellow}
                strokeWidth={8}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={done ? '352 352' : '88 352'}
                transform="rotate(-90 62 62)"
              />
            </Svg>
            <ChunkyButton
              tone={done ? 'yellow' : 'green'}
              circle={92}
              depth={8}
              icon={done ? <Check size={44} /> : <Envelope size={44} />}
              accessibilityLabel="Open today's envelope"
              onPress={openEnvelope}
            />
          </View>
          <View style={{ marginTop: 14 }}>
            <Chip text={done && todayScore != null ? `Today · ${todayScore}` : 'Today'} tone="green" />
          </View>
        </View>

        {/* panda beside the node */}
        <Pressable onPress={openEnvelope} style={{ position: 'absolute', left: 222, top: 142 }}>
          <Panda pose="idle" size={180} envelope={!done} />
        </Pressable>

        {/* locked */}
        <View style={{ position: 'absolute', left: 150, top: 356 }}>
          <ChunkyButton tone="locked" circle={74} depth={7} icon={<Lock size={30} />} accessibilityLabel="Tomorrow, locked" />
        </View>
        <View style={{ position: 'absolute', left: 250, top: 390 }}>
          <ChunkyButton tone="locked" circle={74} depth={7} icon={<Lock size={30} />} accessibilityLabel="Locked" />
        </View>
      </View>

      <PromptRoulette
        visible={spinning}
        prompt={promptText}
        takers={takers}
        onClose={() => setSpinning(false)}
        onDone={() => {
          setSpinning(false);
          router.push('/prompt');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  statBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 56,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    ...glassShadow,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statText: { fontFamily: fonts.displayBold, fontSize: 18 },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 22,
    padding: 14,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: '#3FCBF8',
    overflow: 'hidden',
    shadowColor: '#0A6DAE',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  bannerTitle: { fontFamily: fonts.display, fontSize: 22, color: '#fff', letterSpacing: -0.3, textShadowColor: 'rgba(0,60,120,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  bannerSub: { fontFamily: fonts.medium, fontSize: 15, color: '#fff', marginTop: 2, textShadowColor: 'rgba(0,60,120,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  bannerBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  path: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  openTag: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#BFDDEC',
    overflow: 'hidden',
    ...glassShadow,
  },
  openTagText: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 1.5, color: '#2E9E12' },
  openTagTail: {
    position: 'absolute',
    left: '50%',
    bottom: -8,
    width: 12,
    height: 12,
    marginLeft: 2,
    backgroundColor: '#DFF2FB',
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#BFDDEC',
    transform: [{ rotate: '45deg' }],
  },
});
