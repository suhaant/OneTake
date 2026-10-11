import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BrainView from './BrainView';
import { Gloss } from './Glass';
import { fetchNeuro, Neuro, neuroViewerUrl } from '../backend';
import { colors, fonts, gradients } from '../theme';

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** Wording bands on the backend's 0 (plain, casual) to 100 (formal) scale. It describes word style. It is not a quality grade. */
function wording(f: number): { title: string; body: string } {
  if (f >= 67) return { title: 'Formal wording', body: 'Longer, precise words and few fillers. It sounds prepared; one plain, concrete example would warm it up.' };
  if (f >= 34) return { title: 'Balanced wording', body: 'A mix of formal and everyday words.' };
  return { title: 'Plain, casual wording', body: 'Short, everyday words. Easy to follow; this says nothing about structure or delivery.' };
}

/** A track from plain to formal with a marker at the take's position. */
function WordingMeter({ position }: { position: number }) {
  const at = Math.min(Math.max(position, 3), 97);
  return (
    <View style={{ marginTop: 16 }}>
      <View style={styles.track}>
        <LinearGradient colors={['#C9DDEA', '#8FD9F7', '#19A7E6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </View>
      <View style={[styles.marker, { left: `${at}%` }]} />
      <View style={styles.ends}>
        <Text style={styles.end}>Plain and casual</Text>
        <Text style={styles.end}>Formal</Text>
      </View>
    </View>
  );
}

/**
 * The fMRI response TRIBE v2 predicts for an average listener hearing this take's words: the strongest
 * moment and the 3D brain, under a meter of how formal the wording is. The meter is counted from the
 * transcript by the backend, not predicted (neuro/ANALYSIS.md, Test 4). Display-only, with no score.
 * Renders nothing when the backend has no neuro API.
 */
export default function BrainResponse({ submissionId }: { submissionId?: string }) {
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

  const position = neuro.wording?.formality;

  return (
    <View>
      <View style={styles.hr} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={styles.section}>Your words on the brain</Text>
        <Text style={styles.sectionSub}>predicted · not scored</Text>
      </View>

      {neuro.status === 'processing' ? (
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.waitingText}>Running your words through a listener&apos;s brain…</Text>
        </View>
      ) : (
        <>
          {/* 1. where the wording sits */}
          {position == null ? null : (
            <View style={styles.verdict}>
              <LinearGradient colors={[...gradients.glassDeep]} style={StyleSheet.absoluteFill} />
              <Gloss height="48%" radius={22} />
              <Text style={styles.verdictTitle}>{wording(position).title}</Text>
              <Text style={styles.verdictBody}>{wording(position).body}</Text>
              <WordingMeter position={position} />
            </View>
          )}

          {/* 2. strongest moment */}
          {neuro.peak?.text ? (
            <View style={styles.peak}>
              <Text style={styles.peakWhen}>Strongest predicted response at {clock(neuro.peak.t)}</Text>
              <Text style={styles.peakText}>“{neuro.peak.text}”</Text>
            </View>
          ) : null}

          {/* 3. the brain itself */}
          <Text style={styles.subhead}>See it on the brain</Text>
          <View style={styles.brain}>
            <BrainView url={neuroViewerUrl(submissionId)} />
          </View>
          <Text style={styles.caption}>Drag to turn. Brighter means a stronger predicted response.</Text>

          <Text style={styles.note}>
            The brain is predicted by Meta&apos;s TRIBE v2 for an average listener, from your words alone. It is not a scan of anyone and not a
            measure of how engaged an audience was. The meter is counted from your words: more long words read formal, more fillers read casual.
            Neither is part of your score.
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
  verdict: { marginTop: 14, padding: 16, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)', backgroundColor: '#CDEFFF', overflow: 'hidden' },
  verdictTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22, color: colors.navy },
  verdictBody: { marginTop: 4, fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.text2 },
  subhead: { marginTop: 24, fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E1EEF7', overflow: 'hidden' },
  marker: { position: 'absolute', top: -5, width: 18, height: 18, marginLeft: -9, borderRadius: 9, backgroundColor: '#fff', borderWidth: 4, borderColor: colors.blue },
  ends: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  end: { fontFamily: fonts.semi, fontSize: 12, color: colors.text2 },
  peak: { marginTop: 22, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: colors.blueLight },
  peakWhen: { fontFamily: fonts.semi, fontSize: 12, color: colors.muted },
  peakText: { marginTop: 2, fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.navy },
  brain: { marginTop: 10, height: 300, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.sheet, borderWidth: 1, borderColor: colors.hair },
  caption: { marginTop: 8, fontFamily: fonts.medium, fontSize: 12, color: colors.muted, textAlign: 'center' },
  note: { marginTop: 16, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
});
