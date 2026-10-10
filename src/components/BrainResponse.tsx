import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import BrainView from './BrainView';
import { fetchNeuro, Neuro, neuroViewerUrl } from '../backend';
import { colors, fonts } from '../theme';

const NETWORK_LABELS: Record<string, string> = { language: 'Language', social: 'Social', auditory: 'Auditory', default_mode: 'Default mode' };
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** Predicted response per second, with the strongest moment marked. */
function Curve({ data, peak, width }: { data: number[]; peak: number; width: number }) {
  const h = 64;
  const lo = Math.min(...data);
  const span = Math.max(...data) - lo || 1;
  const x = (i: number) => (i / (data.length - 1)) * width;
  const y = (v: number) => h - 6 - ((v - lo) / span) * (h - 14);
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const at = Math.min(Math.max(peak, 0), data.length - 1);
  return (
    <Svg width={width} height={h} style={{ marginTop: 12 }}>
      <Path d={d} fill="none" stroke={colors.blue} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={x(at)} cy={y(data[at])} r={5} fill="#fff" stroke={colors.blue} strokeWidth={2.5} />
    </Svg>
  );
}

/**
 * "Brain response" section of the results screen: the fMRI response TRIBE v2 predicts for an average
 * listener hearing this take's words. Display-only. Renders nothing when the backend has no neuro API.
 */
export default function BrainResponse({ submissionId, width }: { submissionId?: string; width: number }) {
  const [neuro, setNeuro] = useState<Neuro>({ status: 'processing' });

  useEffect(() => {
    if (!submissionId) return;
    let active = true;
    fetchNeuro(submissionId, () => active).then((n) => active && setNeuro(n));
    return () => {
      active = false;
    };
  }, [submissionId]);

  if (!submissionId || neuro.status === 'disabled' || neuro.status === 'unavailable') return null;

  const k = neuro.ranking;
  const curve = (neuro.curve ?? []).filter((v): v is number => v != null);
  return (
    <View>
      <View style={styles.hr} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={styles.section}>Brain response</Text>
        <Text style={styles.sectionSub}>predicted · not part of your score</Text>
      </View>

      {neuro.status === 'processing' || !k ? (
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.waitingText}>Predicting how a listener&apos;s brain responds to your words…</Text>
        </View>
      ) : (
        <>
          <View style={styles.brain}>
            <BrainView url={neuroViewerUrl(submissionId)} />
          </View>

          <View style={styles.ranks}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rankValue}>
                {k.raw_score.percentile}
                <Text style={styles.rankOf}> /100</Text>
              </Text>
              <Text style={styles.rankLabel}>Response strength</Text>
              <Text style={styles.rankHint}>stronger than {k.raw_score.beats_flat_texts}% of bland reference texts</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rankValue}>
                {k.vividness_score.percentile}
                <Text style={styles.rankOf}> /100</Text>
              </Text>
              <Text style={styles.rankLabel}>Language vividness</Text>
              <Text style={styles.rankHint}>ahead of {k.vividness_score.beats_vivid_texts}% of vivid reference texts</Text>
            </View>
          </View>

          <View style={{ marginTop: 18, gap: 10 }}>
            {Object.entries(k.networks).map(([name, n]) => (
              <View key={name} style={styles.barRow}>
                <Text style={styles.barLabel}>{NETWORK_LABELS[name] ?? name}</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${n.percentile}%` }]} />
                </View>
                <Text style={styles.barValue}>{n.percentile}</Text>
              </View>
            ))}
          </View>

          {width > 0 && curve.length > 2 && <Curve data={curve} peak={neuro.peak?.t ?? 0} width={width} />}
          {neuro.peak?.text ? (
            <Text style={styles.peak}>
              Strongest predicted response at {clock(neuro.peak.t)}: <Text style={{ fontFamily: fonts.bold }}>“{neuro.peak.text}”</Text>
            </Text>
          ) : null}

          <Text style={styles.note}>
            A model&apos;s prediction (Meta TRIBE v2) for an average listener, from your words and their timing only. It reflects how vivid
            and concrete the language is. It is not a scan of anyone and not a measure of how engaged an audience was.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hr: { height: 1, backgroundColor: colors.hair, marginVertical: 26 },
  section: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.blue },
  sectionSub: { fontFamily: fonts.semi, fontSize: 12, color: colors.muted },
  waiting: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  waitingText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text2 },
  brain: { marginTop: 14, height: 380, borderRadius: 22, overflow: 'hidden', backgroundColor: '#0d0f14' },
  ranks: { marginTop: 18, flexDirection: 'row', gap: 16 },
  rankValue: { fontFamily: fonts.bold, fontSize: 30, color: colors.navy },
  rankOf: { fontFamily: fonts.semi, fontSize: 14, color: colors.muted },
  rankLabel: { fontFamily: fonts.semi, fontSize: 14, color: colors.navy },
  rankHint: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  barLabel: { width: 96, fontFamily: fonts.semi, fontSize: 14, color: colors.navy },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#E1EEF7', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.blue },
  barValue: { width: 30, textAlign: 'right', fontFamily: fonts.bold, fontSize: 15, color: colors.navy },
  peak: { marginTop: 10, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.navy },
  note: { marginTop: 12, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
});
