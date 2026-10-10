import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AeroBackground from '../../components/AeroBackground';
import { Crown } from '../../components/Icons';
import { colors, fonts } from '../../theme';
import { leaderboard, todaysPrompt } from '../../data/mock';
import { useApp } from '../../store';

const tabs = ['Global', 'Friends', 'Nearby'] as const;

function Avatar({ initials, colors: c, size = 40, ring }: { initials: string; colors: string[]; size?: number; ring?: string }) {
  return (
    <LinearGradient
      colors={[c[0], c[1]]}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 3 : 0,
        borderColor: ring,
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.36, color: '#fff' }}>{initials}</Text>
    </LinearGradient>
  );
}

function Podium({ p, place, height }: { p: (typeof leaderboard)[number]; place: number; height: number }) {
  const first = place === 1;
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      {first && <Crown size={30} />}
      <Avatar initials={p.initials} colors={p.colors} size={first ? 68 : 56} ring={first ? colors.yellow : '#fff'} />
      <Text style={styles.podiumName}>{p.name}</Text>
      <View style={[styles.podiumBlock, { height }, first && { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
        <Text style={[styles.podiumScore, first && { fontSize: 38 }]}>{p.score}</Text>
        <Text style={[styles.podiumPlace, first && { color: '#C9A000' }]}>{place === 1 ? '1st' : place === 2 ? '2nd' : '3rd'}</Text>
      </View>
    </View>
  );
}

export default function Ranks() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<(typeof tabs)[number]>('Global');
  const { result, rank, streak } = useApp();
  const [p1, p2, p3, ...rest] = leaderboard;

  return (
    <View style={{ flex: 1 }}>
      <AeroBackground hills={false} locations={[0, 0.3, 0.7, 1]} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.resets}>Resets in 6h 12m</Text>
        </View>

        <View style={styles.seg}>
          {tabs.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.segItem, tab === t && styles.segActive]} accessibilityRole="tab">
              <Text style={[styles.segText, tab === t && { fontFamily: fonts.bold }]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.promptLine}>{`Today's prompt · "${todaysPrompt.text}"`}</Text>

        <View style={styles.podium}>
          <Podium p={p2} place={2} height={96} />
          <Podium p={p1} place={1} height={128} />
          <Podium p={p3} place={3} height={76} />
        </View>

        <View style={styles.sheet}>
          {rest.map((p, i) => (
            <View key={p.rank} style={[styles.row, i < rest.length - 1 && styles.rowBorder]}>
              <Text style={styles.rank}>{p.rank}</Text>
              <Avatar initials={p.initials} colors={p.colors} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                {!!p.sub && <Text style={styles.sub}>{p.sub}</Text>}
              </View>
              <Text style={styles.score}>{p.score}</Text>
            </View>
          ))}
          <Text style={styles.dots}>· · ·</Text>

          <LinearGradient colors={['#DDF4FF', '#C8ECFF']} style={styles.you}>
            <Text style={[styles.rank, { width: 54, color: colors.blue }]}>{rank.toLocaleString()}</Text>
            <Avatar initials="ST" colors={['#4FC3F7', '#0C6FB3']} ring="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { fontFamily: fonts.bold }]}>You</Text>
              <Text style={[styles.sub, { color: colors.text2 }]}>
                {result ? `Top ${result.percentile}% · ${streak}-day streak · ↑ 318 since yesterday` : `${streak}-day streak · take today's prompt to rank`}
              </Text>
            </View>
            <Text style={[styles.score, { fontSize: 22 }]}>{result ? result.score : '—'}</Text>
          </LinearGradient>
        </View>
      </ScrollView>
    </View>
  );
}

const shadowText = {
  textShadowColor: 'rgba(0,80,140,0.5)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
};

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.bold, fontSize: 26, color: '#fff', letterSpacing: -0.4, ...shadowText },
  resets: { fontFamily: fonts.semi, fontSize: 13, color: '#fff', ...shadowText },
  seg: {
    marginHorizontal: 20,
    marginTop: 14,
    height: 44,
    padding: 4,
    flexDirection: 'row',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  segActive: { backgroundColor: '#fff', shadowColor: '#003C78', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segText: { fontFamily: fonts.semi, fontSize: 14, color: colors.navy },
  promptLine: { marginHorizontal: 20, marginTop: 14, fontFamily: fonts.medium, fontSize: 14, color: '#fff', ...shadowText },
  podium: { marginHorizontal: 20, marginTop: 28, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  podiumName: { fontFamily: fonts.bold, fontSize: 14, color: '#fff', ...shadowText },
  podiumBlock: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumScore: { fontFamily: fonts.display, fontSize: 30, color: colors.navy, includeFontPadding: false },
  podiumPlace: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted },
  sheet: {
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingHorizontal: 20,
    minHeight: 500,
    shadowColor: '#003C78',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#E3EEF6' },
  rank: { width: 30, fontFamily: fonts.bold, fontSize: 15, color: colors.muted },
  name: { fontFamily: fonts.semi, fontSize: 16, color: colors.navy },
  sub: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  score: { fontFamily: fonts.bold, fontSize: 20, color: colors.navy },
  dots: { textAlign: 'center', fontFamily: fonts.semi, fontSize: 13, color: colors.muted, paddingVertical: 10 },
  you: {
    marginHorizontal: -20,
    marginTop: 'auto',
    paddingVertical: 14,
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 2,
    borderTopColor: '#84D8FF',
  },
});
