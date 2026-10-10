import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import AeroBackground from '../../components/AeroBackground';
import ChunkyButton from '../../components/ChunkyButton';
import Panda from '../../components/Panda';
import { Chip } from '../../components/Glass';
import { Check, Envelope, Flame, Gem, Crown, List, Lock } from '../../components/Icons';
import { colors, fonts, glassShadow } from '../../theme';
import { useApp } from '../../store';

function DoneNode({ label, score }: { label: string; score: number }) {
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <ChunkyButton tone="yellow" circle={74} depth={7} icon={<Check size={34} />} accessibilityLabel={`${label}, scored ${score}`} />
      <Chip text={`${label} · ${score}`} />
    </View>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { streak, xp, rank, result, me, doneToday: done, pastTakes, totalTakes, promptText, refreshStats } = useApp();
  const todayScore = result?.score ?? me?.todayScore ?? null;
  const dayNumber = totalTakes + (done ? 0 : 1);

  useFocusEffect(
    React.useCallback(() => {
      refreshStats().catch(() => {});
    }, [refreshStats]),
  );

  return (
    <View style={styles.root}>
      <AeroBackground />

      {/* stat bar */}
      <View style={[styles.statBar, { top: insets.top + 8 }]}>
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
      <LinearGradient colors={['#4FC3F7', '#1E9EE6']} style={[styles.banner, { top: insets.top + 78 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>{done && todayScore != null ? `Today · ${todayScore}` : `Day ${dayNumber}`}</Text>
          <Text style={styles.bannerSub} numberOfLines={2}>
            {done ? 'Done for today. Back tomorrow!' : promptText}
          </Text>
        </View>
        <Pressable accessibilityLabel="Past takes" onPress={() => router.push('/results')} style={styles.bannerBtn}>
          <List size={24} />
        </Pressable>
      </LinearGradient>

      {/* path */}
      <View style={[styles.path, { top: insets.top + 190 }]}>
        {/* the two takes before today; empty slots stay empty for a new user */}
        {pastTakes.length > 1 && (
          <View style={{ position: 'absolute', left: 230 }}>
            <DoneNode label={pastTakes[0].day} score={pastTakes[0].score} />
          </View>
        )}
        {pastTakes.length > 0 && (
          <View style={{ position: 'absolute', left: 150, top: 90 }}>
            <DoneNode label={pastTakes[pastTakes.length - 1].day} score={pastTakes[pastTakes.length - 1].score} />
          </View>
        )}

        {/* today */}
        <View style={{ position: 'absolute', left: 50, top: 200, width: 140, alignItems: 'center' }}>
          <View style={styles.openTag}>
            <Text style={styles.openTagText}>{done ? 'DONE' : 'OPEN'}</Text>
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
              onPress={() => router.push(done ? '/results' : '/prompt')}
            />
          </View>
          <View style={{ marginTop: 14 }}>
            <Chip text={done && todayScore != null ? `Today · ${todayScore}` : 'Today'} tone="green" />
          </View>
        </View>

        {/* panda beside the node */}
        <Pressable onPress={() => router.push('/prompt')} style={{ position: 'absolute', left: 196, top: 200 }}>
          <Panda pose="idle" size={180} envelope={!done} />
        </Pressable>

        {/* locked */}
        <View style={{ position: 'absolute', left: 150, top: 436 }}>
          <ChunkyButton tone="locked" circle={74} depth={7} icon={<Lock size={30} />} accessibilityLabel="Tomorrow, locked" />
        </View>
        <View style={{ position: 'absolute', left: 230, top: 504 }}>
          <ChunkyButton tone="locked" circle={74} depth={7} icon={<Lock size={30} />} accessibilityLabel="Locked" />
        </View>
      </View>
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
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
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
    borderRadius: 20,
    padding: 14,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#0C6FB3',
    shadowColor: '#00508C',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  bannerTitle: { fontFamily: fonts.display, fontSize: 22, color: '#fff', letterSpacing: -0.3 },
  bannerSub: { fontFamily: fonts.medium, fontSize: 15, color: '#fff', opacity: 0.95, marginTop: 2 },
  bannerBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#3CB5F2',
    borderWidth: 1,
    borderColor: '#0C6FB3',
    borderBottomWidth: 4,
    borderBottomColor: '#0A5F99',
    alignItems: 'center',
    justifyContent: 'center',
  },
  path: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  openTag: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#CFE8F6',
    borderBottomWidth: 4,
  },
  openTagText: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 1.5, color: '#2E9E12' },
  openTagTail: {
    position: 'absolute',
    left: '50%',
    bottom: -8,
    width: 12,
    height: 12,
    marginLeft: 2,
    backgroundColor: '#fff',
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#CFE8F6',
    transform: [{ rotate: '45deg' }],
  },
});
