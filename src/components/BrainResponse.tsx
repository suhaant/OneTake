import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BrainView from './BrainView';
import { Gloss } from './Glass';
import { fetchNeuro, Neuro, NeuroRank, neuroViewerUrl } from '../backend';
import { colors, fonts, gradients } from '../theme';

/** Each brain network in listener terms: what it means when it lights up. */
const NETWORKS: Record<string, { label: string; feels: string }> = {
  language: { label: 'Language', feels: 'Following your words' },
  social: { label: 'Social', feels: 'Relating to you as a person' },
  auditory: { label: 'Auditory', feels: 'Tuned in to your voice' },
  default_mode: { label: 'Imagination', feels: 'Picturing what you describe' },
};

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** One plain sentence for the headline, from the overall response percentile. */
function verdict(p: number): { title: string; body: string } {
  if (p >= 80) return { title: 'Your audience is hooked.', body: `Your words light up a listener's brain more than ${p}% of speakers. They are leaning in.` };
  if (p >= 60) return { title: 'Your audience is with you.', body: `A listener's brain responds more to your words than to ${p}% of speakers. Solid pull.` };
  if (p >= 40) return { title: 'Your audience is listening, not feeling.', body: `Your words land about average: a stronger response than ${p}% of speakers. More concrete detail would turn the volume up.` };
  return { title: 'Your audience is drifting.', body: `Only ${p}% of speakers get a weaker response. Swap abstract words for things a listener can see and hear.` };
}

const level = (p: number) => (p >= 75 ? 'Strong' : p >= 50 ? 'Good' : p >= 30 ? 'Mild' : 'Faint');
const levelColor = (p: number) => (p >= 75 ? colors.greenText : p >= 50 ? colors.blue : p >= 30 ? colors.yellowDark : colors.muted);

function Meter({ rank }: { rank: NeuroRank }) {
  return (
    <View style={styles.track}>
      <LinearGradient colors={['#9FF1FF', '#3CCBF7', '#0E9BDC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${Math.max(rank.percentile, 3)}%` }]} />
    </View>
  );
}

/**
 * "What your audience feels": the fMRI response TRIBE v2 predicts for an average listener hearing this
 * take's words, said plainly. Display-only. Renders nothing when the backend has no neuro API.
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

  const k = neuro.ranking;
  const v = k ? verdict(k.raw_score.percentile) : null;

  return (
    <View>
      <View style={styles.hr} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={styles.section}>What your audience feels</Text>
        <Text style={styles.sectionSub}>predicted · not scored</Text>
      </View>

      {neuro.status === 'processing' || !k || !v ? (
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.waitingText}>Running your words through a listener&apos;s brain…</Text>
        </View>
      ) : (
        <>
          {/* 1. the verdict */}
          <View style={styles.verdict}>
            <LinearGradient colors={[...gradients.glassDeep]} style={StyleSheet.absoluteFill} />
            <Gloss height="48%" radius={22} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={styles.big}>
                <Text style={styles.bigNum}>{k.raw_score.percentile}</Text>
                <Text style={styles.bigOf}>/100</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.verdictTitle}>{v.title}</Text>
                <Text style={styles.verdictBody}>{v.body}</Text>
              </View>
            </View>
          </View>

          {/* 2. what they feel, by network */}
          <Text style={styles.subhead}>What is going on in their head</Text>
          <View style={{ marginTop: 10, gap: 12 }}>
            {Object.entries(k.networks).map(([name, n]) => {
              const meta = NETWORKS[name] ?? { label: name, feels: name };
              return (
                <View key={name}>
                  <View style={styles.feelRow}>
                    <Text style={styles.feelText}>{meta.feels}</Text>
                    <Text style={[styles.feelLevel, { color: levelColor(n.percentile) }]}>{level(n.percentile)}</Text>
                  </View>
                  <Meter rank={n} />
                  <Text style={styles.feelSub}>{meta.label} network · more than {n.percentile}% of speakers</Text>
                </View>
              );
            })}
          </View>

          {/* 3. strongest moment */}
          {neuro.peak?.text ? (
            <View style={styles.peak}>
              <Text style={styles.peakWhen}>Biggest reaction at {clock(neuro.peak.t)}</Text>
              <Text style={styles.peakText}>“{neuro.peak.text}”</Text>
            </View>
          ) : null}

          {/* 4. the brain itself */}
          <Text style={styles.subhead}>See it on the brain</Text>
          <View style={styles.brain}>
            <BrainView url={neuroViewerUrl(submissionId)} />
          </View>
          <Text style={styles.caption}>Drag to turn. Brighter means a stronger predicted response.</Text>

          <Text style={styles.note}>
            Predicted by Meta&apos;s TRIBE v2 for an average listener, from your words alone. Vividness score: ahead of {k.vividness_score.beats_vivid_texts}% of
            vivid reference texts. Not a scan of anyone, and not part of your score.
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
  big: { flexDirection: 'row', alignItems: 'baseline' },
  bigNum: { fontFamily: fonts.display, fontSize: 44, lineHeight: 48, color: colors.navy, letterSpacing: -1.5 },
  bigOf: { fontFamily: fonts.semi, fontSize: 13, color: colors.text2 },
  verdictTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22, color: colors.navy },
  verdictBody: { marginTop: 4, fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.text2 },
  subhead: { marginTop: 24, fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
  feelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  feelText: { fontFamily: fonts.semi, fontSize: 15, color: colors.navy },
  feelLevel: { fontFamily: fonts.bold, fontSize: 13 },
  feelSub: { marginTop: 4, fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  track: { marginTop: 6, height: 8, borderRadius: 4, backgroundColor: '#E1EEF7', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  peak: { marginTop: 22, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: colors.blueLight },
  peakWhen: { fontFamily: fonts.semi, fontSize: 12, color: colors.muted },
  peakText: { marginTop: 2, fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.navy },
  brain: { marginTop: 10, height: 300, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.sheet, borderWidth: 1, borderColor: colors.hair },
  caption: { marginTop: 8, fontFamily: fonts.medium, fontSize: 12, color: colors.muted, textAlign: 'center' },
  note: { marginTop: 16, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
});
