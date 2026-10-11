import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import AeroBackground from '../components/AeroBackground';
import BrainResponse from '../components/BrainResponse';
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

function Stat({ label, value, note, tone = 'navy' }: { label: string; value: string; note?: string; tone?: 'navy' | 'green' | 'orange' }) {
  const color = tone === 'green' ? colors.greenText : tone === 'orange' ? colors.orange : colors.navy;
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {note ? <Text style={styles.statNote}>{note}</Text> : null}
    </View>
  );
}

function Chips({ items, tone }: { items: string[]; tone: 'green' | 'orange' | 'grey' }) {
  if (!items.length) return null;
  const bg = tone === 'green' ? colors.greenLight : tone === 'orange' ? '#FFE3CC' : '#E9F3FA';
  const fg = tone === 'green' ? colors.greenText : tone === 'orange' ? colors.orange : colors.text2;
  return (
    <View style={styles.chips}>
      {items.map((t, n) => (
        <View key={`${n}-${t}`} style={[styles.chip, { backgroundColor: bg }]}>
          <Text style={[styles.chipText, { color: fg }]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function MiniBar({ label, rating }: { label: string; rating: number }) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.miniLabel}>{label}</Text>
        <Text style={styles.miniValue}>{rating}/5</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${((rating - 1) / 4) * 100}%`, backgroundColor: rating >= 4 ? colors.green : rating <= 2 ? colors.orange : colors.blue }]} />
      </View>
    </View>
  );
}

const LEVELS = { basic: 'Basic', everyday: 'Everyday', varied: 'Varied', precise: 'Precise' } as const;
const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${Math.round(s % 60).toString().padStart(2, '0')}`;

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
  const { result, scoreGuess } = useApp();
  const r = result ?? mockResult;
  const pose = r.score >= 75 ? 'celebrate' : r.score < 55 ? 'console' : 'idle';
  const bubble =
    pose === 'celebrate'
      ? 'Done. That was a strong take. Details below.'
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
          {scoreGuess != null && (
            <View style={styles.guessPill}>
              <Text style={styles.guessText}>
                {Math.abs(scoreGuess - r.score) <= 3
                  ? `You called it: guessed ${scoreGuess}.`
                  : scoreGuess > r.score
                    ? `You guessed ${scoreGuess}. Harsh crowd today.`
                    : `You guessed ${scoreGuess}. Better than you thought.`}
              </Text>
            </View>
          )}
          <Text style={styles.heroSub}>
            Top {r.percentile}% today &nbsp;·&nbsp; #{r.rank.toLocaleString()} of {r.total.toLocaleString()} &nbsp;·&nbsp; {r.delta >= 0 ? '+' : ''}
            {r.delta} on yesterday
          </Text>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]} onLayout={(e) => setCurveWidth(e.nativeEvent.layout.width - 48)}>
          <ExpoGradient colors={['#E6F7FF', '#FFFFFF']} locations={[0, 0.12]} pointerEvents="none" style={StyleSheet.absoluteFill} />
          <Text style={styles.section}>Score breakdown</Text>
          <View style={{ marginTop: 16, gap: 14 }}>
            {r.details?.delivery && <Bar label="Eye contact" weight="25%" value={r.details.delivery.eyeContact} />}
            <Bar label="Language" weight="25%" value={r.content} />
            <Bar label="Fillers" weight="20%" value={r.voice} />
            {r.details?.delivery && <Bar label="Posture" weight="15%" value={r.details.delivery.posture} />}
            {r.details?.delivery && <Bar label="Gestures" weight="15%" value={r.details.delivery.gestures} />}
          </View>
          {!r.details?.delivery && <Text style={styles.detailBody}>Audio-only take: eye contact, posture and gestures were not scored.</Text>}

          {r.details && (
            <>
              <View style={styles.hr} />
              <Text style={styles.section}>Details</Text>
              <View style={styles.statGrid}>
                <Stat label="Pace" value={`${r.details.pace.wpm}`} note={`wpm · ${r.details.pace.band}`} tone={r.details.pace.band === 'on target' ? 'green' : r.details.pace.band === 'fast' || r.details.pace.band === 'slow' ? 'orange' : 'navy'} />
                <Stat label="Fillers" value={`${r.details.fillers.total}`} note={`${r.details.fillers.per100} per 100`} tone={r.details.fillers.per100 <= 2 ? 'green' : r.details.fillers.per100 >= 5 ? 'orange' : 'navy'} />
                <Stat label="Words" value={`${r.details.words}`} note={`in ${fmtDuration(r.details.duration)}`} />
              </View>
              {r.details.fillers.total > 0 && (
                <Chips items={[...r.details.fillers.byWord.map((f) => `${f.word} ×${f.count}`), ...r.details.fillers.examples.map((e) => `"${e}"`)]} tone="orange" />
              )}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Vocabulary</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.levelPill}>
                    <Text style={styles.levelText}>{LEVELS[r.details.vocabulary.level]}</Text>
                  </View>
                  <Text style={styles.detailInline}>{r.details.vocabulary.score}</Text>
                </View>
              </View>
              {r.details.vocabulary.strongWords.length > 0 && <Chips items={r.details.vocabulary.strongWords} tone="green" />}
              {r.details.vocabulary.weakWords.length > 0 && <Chips items={r.details.vocabulary.weakWords} tone="orange" />}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Structure</Text>
                <Text style={styles.detailInline}>{r.details.structure.score}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
                <MiniBar label="Opening" rating={r.details.structure.opening} />
                <MiniBar label="Point" rating={r.details.structure.support} />
                <MiniBar label="Close" rating={r.details.structure.closing} />
              </View>
            </>
          )}

          <View style={styles.hr} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={styles.section}>Your 30 seconds</Text>
            {r.attention.length > 1 && <Text style={styles.sectionSub}>predicted attention · avg {r.attentionAvg}%</Text>}
          </View>
          {curveWidth > 0 && r.attention.length > 1 && <AttentionCurve data={r.attention} width={curveWidth} />}

          <View style={{ marginTop: 14 }}>
            {r.moments.map((m, i) => (
              <View key={i} style={styles.moment}>
                <Text style={styles.momentTime}>{m.t}</Text>
                <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
                  <View style={styles.momentDot} />
                  {i < r.moments.length - 1 && <View style={styles.momentLine} />}
                </View>
                <Text style={styles.momentText}>
                  {m.title ? <Text style={{ fontFamily: fonts.bold }}>{m.title} </Text> : null}
                  {m.body}
                </Text>
              </View>
            ))}
          </View>

          <BrainResponse submissionId={r.submissionId} />

          <View style={styles.hr} />

          <Text style={styles.section}>Focus for tomorrow</Text>
          <Text style={styles.focusTitle}>{r.focusTitle}</Text>
          <Text style={styles.focusBody}>{r.focusBody}</Text>
          {r.suggestions && r.suggestions.length > 0 && (
            <View style={{ marginTop: 18, gap: 12 }}>
              <Text style={styles.subheadTight}>Try next time</Text>
              {r.suggestions.map((text, n) => (
                <View key={n} style={styles.suggestion}>
                  <View style={styles.suggestionNum}>
                    <Text style={styles.suggestionNumText}>{n + 1}</Text>
                  </View>
                  <Text style={styles.suggestionText}>{text}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ marginTop: 32, gap: 14, alignItems: 'center' }}>
            <ChunkyButton tone="green" label="Share score card" icon={<Share />} depth={4} style={{ alignSelf: 'stretch' }} onPress={() => router.push('/share')} />
            <ChunkyButton tone="blue" label={`Dare a friend to beat ${r.score}`} depth={4} style={{ alignSelf: 'stretch' }} onPress={() => router.replace('/(tabs)/friends')} />
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
  guessPill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: '#fff' },
  guessText: { fontFamily: fonts.bold, fontSize: 13, color: colors.navy },
  sheet: {
    marginTop: 28,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.95)',
    overflow: 'hidden',
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
  statGrid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#EEF8FE', borderWidth: 1, borderColor: '#D6EAF5' },
  statLabel: { fontFamily: fonts.semi, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  statValue: { marginTop: 2, fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  statNote: { marginTop: 2, fontFamily: fonts.medium, fontSize: 12, color: colors.text2 },
  subhead: { marginTop: 22, marginBottom: 8, fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
  detailRow: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
  subheadTight: { fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
  detailBody: { marginTop: 8, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text2 },
  detailInline: { fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
  detailCaption: { marginTop: 10, fontFamily: fonts.semi, fontSize: 12, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999 },
  chipText: { fontFamily: fonts.semi, fontSize: 13 },
  levelPill: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.blue },
  levelText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff', letterSpacing: 0.3 },
  miniLabel: { fontFamily: fonts.semi, fontSize: 13, color: colors.navy },
  miniValue: { fontFamily: fonts.bold, fontSize: 13, color: colors.muted },
  suggestion: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  suggestionNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  suggestionNumText: { fontFamily: fonts.bold, fontSize: 13, color: colors.greenText },
  suggestionText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.navy },
});
