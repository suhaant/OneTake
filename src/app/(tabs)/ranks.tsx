import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AeroBackground from '../../components/AeroBackground';
import Panda from '../../components/Panda';
import { Gloss, SpeechBubble } from '../../components/Glass';
import { Crown } from '../../components/Icons';
import { colors, fonts, gradients, skyText } from '../../theme';
import { api, Board, BoardEntry } from '../../api';
import { leaderboard as sampleBoard } from '../../data/mock';
import { useApp } from '../../store';

const tabs = ['Global', 'Friends'] as const;
type Tab = (typeof tabs)[number];

const PALETTES = [
  ['#5BD2FF', '#1273B5'],
  ['#B388FF', '#7E57C2'],
  ['#8FE34A', '#3E9A0A'],
  ['#FFB74D', '#E8731A'],
  ['#80DEEA', '#0097A7'],
  ['#F48FB1', '#C2185B'],
  ['#A5D6A7', '#388E3C'],
  ['#90CAF9', '#1565C0'],
  ['#CE93D8', '#7B1FA2'],
  ['#FFCC80', '#EF6C00'],
];

type Row = { userId: string; initials: string; name: string; score: number; sub: string; colors: string[] };

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

/** Deterministic avatar colour per user, so the same person keeps the same tile across refreshes. */
const paletteFor = (id: string) => PALETTES[[...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0) % PALETTES.length];

const toRow = (e: BoardEntry, meId?: string): Row => ({
  userId: e.userId,
  initials: e.userId === meId && !e.name.trim() ? 'Y' : initialsOf(e.name),
  name: e.userId === meId ? (e.name.trim() ? `${e.name} (you)` : 'You') : e.name,
  score: e.score,
  sub: e.streak > 1 ? `${e.streak}-day streak` : e.streak === 1 ? 'first take' : '',
  colors: paletteFor(e.userId),
});

const sampleRows: Row[] = sampleBoard.map((p) => ({ userId: p.initials, initials: p.initials, name: p.name, score: p.score, sub: p.sub, colors: p.colors }));

function Avatar({ initials, colors: c, size = 40, ring }: { initials: string; colors: string[]; size?: number; ring?: string }) {
  return (
    <LinearGradient
      colors={[c[0], c[1]]}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 3 : 0, borderColor: ring }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.36, color: '#fff' }}>{initials}</Text>
    </LinearGradient>
  );
}

function Podium({ p, place, height }: { p: Row | undefined; place: number; height: number }) {
  const first = place === 1;
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      {first && <Crown size={30} />}
      {p ? (
        <Avatar initials={p.initials} colors={p.colors} size={first ? 68 : 56} ring={first ? colors.yellow : '#fff'} />
      ) : (
        <View style={{ width: first ? 68 : 56, height: first ? 68 : 56, borderRadius: 34, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', borderStyle: 'dashed' }} />
      )}
      <Text style={styles.podiumName}>{p?.name ?? 'Open'}</Text>
      <View style={[styles.podiumBlock, { height }]}>
        <LinearGradient colors={first ? [...gradients.sun] : [...gradients.glass]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <Gloss height="45%" radius={16} />
        <Text style={[styles.podiumScore, first && { fontSize: 38 }]}>{p ? p.score : '–'}</Text>
        <Text style={[styles.podiumPlace, first && { color: '#C9A000' }]}>{place === 1 ? '1st' : place === 2 ? '2nd' : '3rd'}</Text>
      </View>
    </View>
  );
}

function resetsIn(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((midnight.getTime() - now.getTime()) / 60000));
  return `Resets in ${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function Ranks() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('Global');
  const { result, me, streak, promptText, rank } = useApp();
  const [board, setBoard] = useState<Board | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(() => {
    api
      .leaderboard(tab === 'Global' ? 'global' : 'friends', me?.userId)
      .then((b) => {
        setBoard(b);
        setOffline(false);
      })
      .catch(() => setOffline(true));
  }, [tab, me?.userId]);
  useFocusEffect(load);

  const live = board && !offline;
  const rows: Row[] = live ? board.entries.map((e) => toRow(e, me?.userId)) : tab === 'Global' ? sampleRows : [];
  const [p1, p2, p3, ...rest] = rows;
  const myScore = result?.score ?? me?.todayScore ?? null;
  const myRank = live ? board.me?.rank ?? null : rank;
  const emptyFriends = live && tab === 'Friends' && rows.length === 0;

  return (
    <View style={{ flex: 1 }}>
      <AeroBackground art="water" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.resets}>{resetsIn()}</Text>
        </View>

        <View style={styles.seg}>
          <Gloss height="55%" radius={16} />
          {tabs.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.segItem, tab === t && styles.segActive]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
              {tab === t && (
                <>
                  <LinearGradient colors={[...gradients.aqua]} style={StyleSheet.absoluteFill} />
                  <Gloss height="50%" radius={12} />
                </>
              )}
              <Text style={[styles.segText, tab === t && { fontFamily: fonts.bold, color: '#fff' }]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.promptLine}>{`Today's prompt · "${promptText}"`}</Text>
        {offline && <Text style={styles.note}>{"Showing a sample board. Start the server to see today's real one."}</Text>}

        {emptyFriends ? (
          <View style={styles.empty}>
            <Panda pose="encourage" headOnly size={84} />
            <SpeechBubble text="No friends on the board yet. Dare someone from the Friends tab and they'll show up here once they take today's prompt." />
          </View>
        ) : (
          <View style={styles.podium}>
            <Podium p={p2} place={2} height={96} />
            <Podium p={p1} place={1} height={128} />
            <Podium p={p3} place={3} height={76} />
          </View>
        )}

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 96 }]}>
          <LinearGradient colors={['rgba(255,255,255,0.86)', '#FFFFFF']} locations={[0, 0.25]} style={StyleSheet.absoluteFill} />
          {rest.map((p, i) => (
            <View key={p.userId} style={[styles.row, i < rest.length - 1 && styles.rowBorder]}>
              <Text style={styles.rank}>{i + 4}</Text>
              <Avatar initials={p.initials} colors={p.colors} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                {!!p.sub && <Text style={styles.sub}>{p.sub}</Text>}
              </View>
              <Text style={styles.score}>{p.score}</Text>
            </View>
          ))}
          {rows.length > 3 && <Text style={styles.dots}>· · ·</Text>}

          <LinearGradient colors={['#EAFBFF', '#BFEEFF']} style={styles.you}>
            <Gloss height="50%" radius={22} />
            <Text style={[styles.rank, { width: 54, color: colors.blue }]}>{myRank ? myRank.toLocaleString() : '—'}</Text>
            <Avatar initials={initialsOf(me?.name || 'You')} colors={['#4FC3F7', '#0C6FB3']} ring="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { fontFamily: fonts.bold }]}>{me?.name || 'You'}</Text>
              <Text style={[styles.sub, { color: colors.text2 }]}>
                {myScore != null
                  ? `${streak}-day streak · ${live ? `${board.total} on the board today` : "today's take"}`
                  : `${streak}-day streak · take today's prompt to rank`}
              </Text>
            </View>
            <Text style={[styles.score, { fontSize: 22 }]}>{myScore ?? '—'}</Text>
          </LinearGradient>
        </View>
      </ScrollView>
    </View>
  );
}

const shadowText = skyText;

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.bold, fontSize: 26, letterSpacing: -0.4, ...shadowText },
  resets: { fontFamily: fonts.semi, fontSize: 13, ...shadowText },
  seg: { marginHorizontal: 20, marginTop: 14, height: 46, padding: 4, flexDirection: 'row', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', overflow: 'hidden' },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, overflow: 'hidden' },
  segActive: { borderWidth: 1, borderColor: '#0A6DAE' },
  segText: { fontFamily: fonts.semi, fontSize: 14, color: colors.navy },
  promptLine: { marginHorizontal: 20, marginTop: 14, fontFamily: fonts.medium, fontSize: 14, ...shadowText },
  note: { marginHorizontal: 20, marginTop: 8, fontFamily: fonts.semi, fontSize: 12, color: colors.navy, backgroundColor: 'rgba(255,255,255,0.7)', padding: 8, borderRadius: 10, overflow: 'hidden' },
  empty: { marginHorizontal: 20, marginTop: 28, marginBottom: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  podium: { marginHorizontal: 20, marginTop: 28, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  podiumName: { fontFamily: fonts.bold, fontSize: 14, ...shadowText },
  podiumBlock: { width: '100%', borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  podiumScore: { fontFamily: fonts.display, fontSize: 30, color: colors.navy, includeFontPadding: false },
  podiumPlace: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted },
  sheet: { flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.92)', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1.5, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.95)', overflow: 'hidden', paddingTop: 14, paddingHorizontal: 20, shadowColor: '#003C78', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: -8 } },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#E3EEF6' },
  rank: { width: 30, fontFamily: fonts.bold, fontSize: 15, color: colors.muted },
  name: { fontFamily: fonts.semi, fontSize: 16, color: colors.navy },
  sub: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  score: { fontFamily: fonts.bold, fontSize: 20, color: colors.navy },
  dots: { textAlign: 'center', fontFamily: fonts.semi, fontSize: 13, color: colors.muted, paddingVertical: 10 },
  you: { marginTop: 'auto', marginBottom: 6, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, borderWidth: 1.5, borderColor: '#84D8FF', overflow: 'hidden' },
});
