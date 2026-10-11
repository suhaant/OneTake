import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AeroBackground from '../../components/AeroBackground';
import Panda from '../../components/Panda';
import ProgressChart, { Point } from '../../components/ProgressChart';
import { GlassCard, Gloss, SpeechBubble } from '../../components/Glass';
import { Flame } from '../../components/Icons';
import { colors, fonts, gradients, skyText } from '../../theme';
import { HistoryRow } from '../../backend';
import { useApp } from '../../store';

const ranges = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: 'All', days: 60 },
] as const;

/** What the score is made of, in the order the results screen shows it. */
const metrics: { key: keyof HistoryRow; label: string }[] = [
  { key: 'eye_contact', label: 'Eye contact' },
  { key: 'language', label: 'Language' },
  { key: 'fillers', label: 'Fillers' },
  { key: 'posture', label: 'Posture' },
  { key: 'body_language', label: 'Gestures' },
];

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export default function ProgressTab() {
  const insets = useSafeAreaInsets();
  const { history, streak, doneToday, refreshStats } = useApp();
  const [range, setRange] = useState<(typeof ranges)[number]>(ranges[1]);
  const [chartW, setChartW] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      refreshStats().catch(() => {});
    }, [refreshStats]),
  );

  // Window measured back from the most recent take, which keeps the memo pure and still reads as "last N days".
  const rows = useMemo(() => {
    const last = history.at(-1);
    if (!last) return [];
    const since = new Date(last.time).getTime() - range.days * 86_400_000;
    return history.filter((h) => new Date(h.time).getTime() >= since);
  }, [history, range]);

  const points: Point[] = rows.map((h) => ({ t: new Date(h.time).getTime(), v: Math.round(h.overall), label: dayLabel(h.time) }));
  const scores = rows.map((h) => h.overall);
  const best = scores.length ? Math.round(Math.max(...scores)) : null;
  const avg = scores.length ? Math.round(mean(scores)) : null;
  // First third vs last third of the window: how much the user has moved, not just the last two takes.
  const third = Math.max(1, Math.floor(scores.length / 3));
  const change = scores.length >= 2 ? Math.round(mean(scores.slice(-third)) - mean(scores.slice(0, third))) : null;

  // Per-metric: latest take against the window's average, so the user sees what is actually moving.
  const latest = rows.at(-1);
  const metricRows = metrics
    .map((m) => {
      const vals = rows.map((h) => h[m.key]).filter((v): v is number => typeof v === 'number');
      const now = latest?.[m.key];
      return vals.length ? { ...m, now: typeof now === 'number' ? Math.round(now) : null, avg: Math.round(mean(vals)) } : null;
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const bubble =
    history.length === 0
      ? 'Take your first prompt and I will start charting you from day one.'
      : history.length === 1
        ? 'One take on the board. Tomorrow gives us a line.'
        : change != null && change > 0
          ? `Up ${change} points across this window. That is practice showing.`
          : change != null && change < 0
            ? `Down ${Math.abs(change)} this window. Rough patches happen; the trend line is what matters.`
            : 'Holding steady. Pick one metric below and push it.';

  return (
    <View style={{ flex: 1 }}>
      <AeroBackground video="river" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 120, gap: 16 }} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Progress</Text>
          <View style={styles.streakPill}>
            <LinearGradient colors={[...gradients.sun]} style={StyleSheet.absoluteFill} />
            <Gloss height="50%" radius={999} />
            <Flame size={20} />
            <Text style={styles.streakText}>{streak} day{streak === 1 ? '' : 's'}</Text>
          </View>
        </View>
        <View style={styles.pandaRow}>
          <Panda pose={change != null && change > 0 ? 'celebrate' : 'encourage'} headOnly size={84} />
          <SpeechBubble text={bubble} />
        </View>

        <GlassCard style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.label}>Score over time</Text>
            <View style={styles.seg}>
              {ranges.map((r) => {
                const on = r.days === range.days;
                return (
                  <Pressable key={r.days} onPress={() => setRange(r)} style={[styles.segItem, on && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                    {on && <LinearGradient colors={[...gradients.aqua]} style={StyleSheet.absoluteFill} />}
                    <Text style={[styles.segText, on && { color: '#fff', fontFamily: fonts.bold }]}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View onLayout={(e) => setChartW(e.nativeEvent.layout.width)}>
            {chartW > 0 && points.length > 0 ? (
              <ProgressChart points={points} width={chartW} />
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>{history.length ? 'Nothing in this window' : 'No takes yet'}</Text>
                <Text style={styles.emptyBody}>{history.length ? 'Widen the range to see earlier takes.' : doneToday ? 'Your first score will appear once it syncs.' : "Open today's envelope to put the first point on the chart."}</Text>
              </View>
            )}
          </View>

          <View style={styles.stats}>
            <Stat label="Best" value={best} />
            <Stat label="Average" value={avg} />
            <Stat label="Change" value={change} signed tone={change == null ? 'navy' : change > 0 ? 'green' : change < 0 ? 'orange' : 'navy'} />
          </View>
        </GlassCard>

        {metricRows.length > 0 && (
          <GlassCard style={styles.card}>
            <Text style={styles.label}>What is moving</Text>
            <Text style={styles.hint}>Latest take against your {range.label.toLowerCase()} average.</Text>
            <View style={{ gap: 14, marginTop: 4 }}>
              {metricRows.map((m) => {
                const diff = m.now != null ? m.now - m.avg : null;
                return (
                  <View key={m.key}>
                    <View style={styles.metricHead}>
                      <Text style={styles.metricLabel}>{m.label}</Text>
                      <Text style={styles.metricValue}>
                        {m.now ?? '–'}
                        {diff != null && diff !== 0 && <Text style={[styles.metricDiff, { color: diff > 0 ? colors.greenText : colors.orange }]}>{`  ${diff > 0 ? '+' : ''}${diff}`}</Text>}
                      </Text>
                    </View>
                    <View style={styles.track}>
                      <View style={[styles.avgMark, { left: `${m.avg}%` }]} />
                      <LinearGradient colors={[...gradients.aqua]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${m.now ?? 0}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
            <Text style={styles.hint}>The tick on each bar is your average.</Text>
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, signed, tone = 'navy' }: { label: string; value: number | null; signed?: boolean; tone?: 'navy' | 'green' | 'orange' }) {
  const color = tone === 'green' ? colors.greenText : tone === 'orange' ? colors.orange : colors.navy;
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value == null ? '–' : signed && value > 0 ? `+${value}` : `${value}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.bold, fontSize: 28, ...skyText },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)', overflow: 'hidden' },
  streakText: { fontFamily: fonts.bold, fontSize: 14, color: '#7A4A00' },
  pandaRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  card: { padding: 16, gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  label: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.blue },
  seg: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: '#BFDDEC' },
  segItem: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9, overflow: 'hidden' },
  segOn: { borderWidth: 1, borderColor: '#0A6DAE' },
  segText: { fontFamily: fonts.semi, fontSize: 12, color: colors.navy },
  empty: { height: 190, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy },
  emptyBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text2, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1, borderColor: '#D6EAF5' },
  statLabel: { fontFamily: fonts.semi, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  statValue: { marginTop: 2, fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.3 },
  hint: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text2 },
  metricHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  metricLabel: { fontFamily: fonts.semi, fontSize: 15, color: colors.navy },
  metricValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
  metricDiff: { fontFamily: fonts.bold, fontSize: 13 },
  track: { height: 10, borderRadius: 5, backgroundColor: '#E1EEF7', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  avgMark: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: colors.navy, zIndex: 1, opacity: 0.6 },
});
