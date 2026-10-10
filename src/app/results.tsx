import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import AeroBackground from '../components/AeroBackground';
import ChunkyButton from '../components/ChunkyButton';
import Panda from '../components/Panda';
import ScoreRing from '../components/ScoreRing';
import { SpeechBubble } from '../components/Glass';
import { Close, Share } from '../components/Icons';
import { colors, fonts } from '../theme';
import { mockResult } from '../data/mock';
import { useApp } from '../store';

function Bar({ label, weight, value }: { label: string; weight: string; value: number }) {
  return (
    <View style={styles.barRow}>
      <View style={{ width: 84 }}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barWeight}>{weight} weight</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${value}%` }]} />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
}

function AttentionCurve({ data, width }: { data: number[]; width: number }) {
  const h = 120;
  const top = 20;
  const base = 100;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, base - v * (base - top)]);
  const d = pts
    .map((p, i) => {
      if (i === 0) return `M${p[0]} ${p[1]}`;
      const prev = pts[i - 1];
      const cx = (prev[0] + p[0]) / 2;
      return `C${cx} ${prev[1]} ${cx} ${p[1]} ${p[0]} ${p[1]}`;
    })
    .join(' ');
  const markers = [0.47, 0.6];
  return (
    <Svg width={width} height={h} style={{ marginTop: 10 }}>
      <Defs>
        <LinearGradient id="att" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2FA6E8" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#2FA6E8" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={`${d} L${width} ${base} L0 ${base} Z`} fill="url(#att)" />
      <Path d={d} fill="none" stroke={colors.blue} strokeWidth={2.5} strokeLinecap="round" />
      {markers.map((m) => {
        const x = m * width;
        const idx = m * (data.length - 1);
        const lo = Math.floor(idx);
        const y = base - (data[lo] + (data[Math.min(lo + 1, data.length - 1)] - data[lo]) * (idx - lo)) * (base - top);
        return (
          <React.Fragment key={m}>
            <Line x1={x} y1={top} x2={x} y2={base} stroke="#8FB7D3" strokeWidth={1.5} strokeDasharray="3 4" />
            <Circle cx={x} cy={y} r={5} fill="#fff" stroke={colors.blue} strokeWidth={2.5} />
          </React.Fragment>
        );
      })}
      <Line x1={0} y1={base} x2={width} y2={base} stroke={colors.hair} />
      <SvgText x={0} y={116} fontSize={11} fontFamily={fonts.semi} fill={colors.muted}>0:00</SvgText>
      <SvgText x={width / 2 - 12} y={116} fontSize={11} fontFamily={fonts.semi} fill={colors.muted}>0:15</SvgText>
      <SvgText x={width - 26} y={116} fontSize={11} fontFamily={fonts.semi} fill={colors.muted}>0:30</SvgText>
    </Svg>
  );
}

export default function Results() {
  const insets = useSafeAreaInsets();
  const [curveWidth, setCurveWidth] = useState(0);
  const { result } = useApp();
  const r = result ?? mockResult;
  const pose = r.score >= 75 ? 'celebrate' : r.score < 55 ? 'console' : 'idle';
  const bubble =
    pose === 'celebrate'
      ? 'Done. Strong open, a wobble in the middle, clean finish. Details below.'
      : pose === 'console'
        ? "Rough one. Here's the one thing to fix."
        : 'Solid take. A couple of things to tighten up below.';

  return (
    <View style={{ flex: 1 }}>
      <AeroBackground hills={false} locations={[0, 0.4, 1, 1]} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your take</Text>
          <Pressable accessibilityLabel="Close" onPress={() => router.replace('/(tabs)')} style={styles.roundBtn}>
            <Close />
          </Pressable>
        </View>

        <View style={styles.pandaRow}>
          <Panda pose={pose} headOnly size={84} />
          <SpeechBubble text={bubble} />
        </View>

        <View style={styles.hero}>
          <ScoreRing score={r.score} />
          <Text style={styles.heroTitle}>{r.score >= 75 ? 'Nice take.' : r.score < 55 ? 'Tomorrow is a new take.' : 'Good take.'}</Text>
          <Text style={styles.heroSub}>
            Top {r.percentile}% today &nbsp;·&nbsp; #{r.rank.toLocaleString()} of {r.total.toLocaleString()} &nbsp;·&nbsp; {r.delta >= 0 ? '+' : ''}
            {r.delta} on yesterday
          </Text>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]} onLayout={(e) => setCurveWidth(e.nativeEvent.layout.width - 48)}>
          <Text style={styles.section}>Breakdown</Text>
          <View style={{ marginTop: 16, gap: 16 }}>
            <Bar label="Voice" weight="40%" value={r.voice} />
            <Bar label="Body" weight="30%" value={r.body} />
            <Bar label="Content" weight="30%" value={r.content} />
          </View>

          <View style={styles.hr} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={styles.section}>Your 30 seconds</Text>
            <Text style={styles.sectionSub}>predicted attention · avg {r.attentionAvg}%</Text>
          </View>
          {curveWidth > 0 && <AttentionCurve data={r.attention} width={curveWidth} />}

          <View style={{ marginTop: 14 }}>
            {r.moments.map((m, i) => (
              <View key={m.t} style={styles.moment}>
                <Text style={styles.momentTime}>{m.t}</Text>
                <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
                  <View style={styles.momentDot} />
                  {i < r.moments.length - 1 && <View style={styles.momentLine} />}
                </View>
                <Text style={styles.momentText}>
                  <Text style={{ fontFamily: fonts.bold }}>{m.title} </Text>
                  {m.body}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.hr} />

          <Text style={styles.section}>Focus for tomorrow</Text>
          <Text style={styles.focusTitle}>{r.focusTitle}</Text>
          <Text style={styles.focusBody}>{r.focusBody}</Text>
          <View style={{ marginTop: 16, gap: 10 }}>
            {r.also.map((a) => (
              <View key={a.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.alsoLabel}>{a.label}</Text>
                <Text style={styles.alsoValue}>{a.value}</Text>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 32, gap: 14, alignItems: 'center' }}>
            <ChunkyButton tone="green" label="Share score card" icon={<Share />} depth={4} style={{ alignSelf: 'stretch' }} onPress={() => router.push('/share')} />
            <Pressable onPress={() => router.replace('/(tabs)/friends')} style={{ padding: 8 }}>
              <Text style={styles.link}>Challenge a friend to this prompt</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const shadowText = { textShadowColor: 'rgba(0,80,140,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 };

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: 1.4, textTransform: 'uppercase', color: '#fff', ...shadowText },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  pandaRow: { marginTop: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  hero: { alignItems: 'center', marginTop: 24, gap: 10 },
  heroTitle: { fontFamily: fonts.bold, fontSize: 26, color: '#fff', letterSpacing: -0.3, textShadowColor: 'rgba(0,80,140,0.45)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  heroSub: { fontFamily: fonts.semi, fontSize: 14, color: '#fff', ...shadowText },
  sheet: {
    marginTop: 28,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: '#fff',
    paddingTop: 30,
    paddingHorizontal: 24,
    shadowColor: '#003C78',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -10 },
  },
  section: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.blue },
  sectionSub: { fontFamily: fonts.semi, fontSize: 12, color: colors.muted },
  hr: { height: 1, backgroundColor: colors.hair, marginVertical: 26 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  barLabel: { fontFamily: fonts.semi, fontSize: 16, color: colors.navy },
  barWeight: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#E1EEF7', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.blue },
  barValue: { width: 34, textAlign: 'right', fontFamily: fonts.bold, fontSize: 20, color: colors.navy },
  moment: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 8 },
  momentTime: { width: 38, fontFamily: fonts.bold, fontSize: 13, color: colors.muted, paddingTop: 2 },
  momentDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', borderWidth: 2, borderColor: colors.blue, marginTop: 5 },
  momentLine: { flex: 1, width: 2, backgroundColor: colors.hair, marginTop: 4 },
  momentText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.navy, paddingBottom: 6 },
  focusTitle: { marginTop: 10, fontFamily: fonts.bold, fontSize: 24, lineHeight: 29, letterSpacing: -0.3, color: colors.navy },
  focusBody: { marginTop: 8, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text2 },
  alsoLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.text2 },
  alsoValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.navy },
  link: { fontFamily: fonts.bold, fontSize: 16, color: colors.blue },
});
