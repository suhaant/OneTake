import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import AeroBackground from '../components/AeroBackground';
import ChunkyButton from '../components/ChunkyButton';
import Panda from '../components/Panda';
import ScoreRing from '../components/ScoreRing';
import { Close, Envelope, Share } from '../components/Icons';
import { colors, fonts, sky } from '../theme';
import { mockResult, todaysPrompt } from '../data/mock';
import { useApp } from '../store';

const CARD_W = 1080;
const CARD_H = 1350;

function MiniBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={card.barLabel}>{label}</Text>
        <Text style={card.barValue}>{value}</Text>
      </View>
      <View style={card.track}>
        <View style={[card.fill, { width: `${value}%` }]} />
      </View>
    </View>
  );
}

/** The 1080×1350 card, drawn at full size and scaled down to fit the screen. */
function ScoreCard() {
  const { result, streak, promptText } = useApp();
  const r = result ?? mockResult;
  return (
    <View style={{ width: CARD_W, height: CARD_H, overflow: 'hidden' }}>
      <LinearGradient colors={[...sky]} locations={[0, 0.4, 0.8, 1]} style={StyleSheet.absoluteFill} />
      <View style={card.hillA} />
      <View style={card.hillB} />

      <View style={card.brand}>
        <View style={card.brandTile}>
          <Envelope size={30} />
        </View>
        <Text style={card.brandText}>OneTake</Text>
      </View>
      <Text style={card.day}>
        Day {todaysPrompt.day} · {streak}-day streak
      </Text>

      <Text style={card.prompt}>{`"${promptText}"`}</Text>

      <View style={{ position: 'absolute', left: 72, top: 330 }}>
        <ScoreRing score={r.score} size={440} stroke={28} />
        <Text style={card.ringSub}>Top {r.percentile}% today</Text>
      </View>

      <View style={{ position: 'absolute', left: 560, top: 300 }}>
        <Panda pose="celebrate" size={460} animated={false} />
      </View>

      <View style={card.strip}>
        <MiniBar label="Voice" value={r.voice} />
        <MiniBar label="Body" value={r.body} />
        <MiniBar label="Content" value={r.content} />
      </View>

      <View style={card.footer}>
        <Text style={card.footerText}>{`#${r.rank.toLocaleString()} of ${r.total.toLocaleString()} · beat me on today's prompt`}</Text>
        <View style={card.pill}>
          <Text style={card.pillText}>onetake.app</Text>
        </View>
      </View>
      <Text style={card.tag}>One prompt. One take. Thirty seconds.</Text>
    </View>
  );
}

export default function SharePage() {
  const insets = useSafeAreaInsets();
  const shot = useRef<React.ComponentRef<typeof ViewShot>>(null);
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(0);
  const scale = Math.max(width - 48, 1) / CARD_W;

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await shot.current?.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <AeroBackground hills={false} />
      <View style={[styles.header, { top: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Share</Text>
        <Pressable accessibilityLabel="Close" onPress={() => router.back()} style={styles.roundBtn}>
          <Close />
        </Pressable>
      </View>

      {width > 0 && (
      <View style={{ position: 'absolute', top: insets.top + 70, left: 24, width: CARD_W * scale, height: CARD_H * scale, borderRadius: 24, overflow: 'hidden' }}>
        <View style={{ width: CARD_W, height: CARD_H, transform: [{ translateX: -(CARD_W * (1 - scale)) / 2 }, { translateY: -(CARD_H * (1 - scale)) / 2 }, { scale }] }}>
          <ViewShot ref={shot} options={{ format: 'png', quality: 1, width: CARD_W, height: CARD_H }} style={{ width: CARD_W, height: CARD_H }}>
            <ScoreCard />
          </ViewShot>
        </View>
      </View>
      )}

      <View style={[styles.actions, { bottom: insets.bottom + 20 }]}>
        <ChunkyButton tone="green" label={busy ? 'Preparing…' : 'Share to Instagram, iMessage…'} icon={<Share />} depth={4} onPress={share} disabled={busy} />
      </View>
    </View>
  );
}

const shadowText = { textShadowColor: 'rgba(0,80,140,0.45)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 };

const styles = StyleSheet.create({
  header: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: 1.4, textTransform: 'uppercase', color: '#fff', ...shadowText },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  actions: { position: 'absolute', left: 24, right: 24 },
});

const card = StyleSheet.create({
  hillA: { position: 'absolute', left: -300, top: 1060, width: 1200, height: 700, borderRadius: 600, backgroundColor: '#8FD93A' },
  hillB: { position: 'absolute', left: 500, top: 1120, width: 1100, height: 700, borderRadius: 550, backgroundColor: '#74C62C' },
  brand: { position: 'absolute', left: 72, top: 64, flexDirection: 'row', alignItems: 'center', gap: 14 },
  brandTile: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.green, borderWidth: 2, borderColor: '#3F8F16', borderBottomWidth: 6, borderBottomColor: colors.greenDark, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontFamily: fonts.bold, fontSize: 40, letterSpacing: -1, color: '#fff', ...shadowText },
  day: { position: 'absolute', right: 72, top: 76, fontFamily: fonts.semi, fontSize: 24, color: '#fff', ...shadowText },
  prompt: { position: 'absolute', left: 72, right: 72, top: 180, fontFamily: fonts.medium, fontSize: 34, lineHeight: 44, color: '#fff', ...shadowText },
  ringSub: { position: 'absolute', left: 0, right: 0, top: 290, textAlign: 'center', fontFamily: fonts.bold, fontSize: 22, letterSpacing: 3, textTransform: 'uppercase', color: colors.blue },
  strip: {
    position: 'absolute',
    left: 72,
    right: 72,
    top: 860,
    padding: 34,
    paddingHorizontal: 40,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 2,
    borderColor: '#fff',
    flexDirection: 'row',
    gap: 36,
  },
  barLabel: { fontFamily: fonts.semi, fontSize: 24, color: colors.navy },
  barValue: { fontFamily: fonts.bold, fontSize: 40, color: colors.navy },
  track: { marginTop: 10, height: 10, borderRadius: 5, backgroundColor: '#E1EEF7', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: colors.blue },
  footer: { position: 'absolute', left: 72, right: 72, top: 1080, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerText: { fontFamily: fonts.semi, fontSize: 28, color: '#fff', flex: 1, ...shadowText },
  pill: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999, backgroundColor: '#fff', borderWidth: 2, borderColor: '#CFE8F6', borderBottomWidth: 6 },
  pillText: { fontFamily: fonts.bold, fontSize: 24, color: colors.navy },
  tag: { position: 'absolute', left: 72, top: 1240, fontFamily: fonts.medium, fontSize: 24, color: '#fff', ...shadowText },
});
