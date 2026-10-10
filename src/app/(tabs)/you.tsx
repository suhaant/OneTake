import React, { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AeroBackground from '../../components/AeroBackground';
import ChunkyButton from '../../components/ChunkyButton';
import Field from '../../components/Field';
import Panda from '../../components/Panda';
import { GlassCard, SpeechBubble } from '../../components/Glass';
import { colors, fonts } from '../../theme';
import { api, errorText, Persona } from '../../api';
import { useApp } from '../../store';

const personas: { id: Persona; label: string; sample: string }[] = [
  { id: 'mentor', label: 'Mentor', sample: 'Calm and specific.' },
  { id: 'drill', label: 'Drill sergeant', sample: 'Blunt. No excuses.' },
  { id: 'hype', label: 'Hype', sample: 'Loud and on your side.' },
];

export default function YouTab() {
  const insets = useSafeAreaInsets();
  const { me, setMe, saveName, refreshMe } = useApp();
  const [name, setName] = useState(me?.name ?? '');
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [confirmUrl, setConfirmUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The account loads after first render; seed the form once it arrives.
  const [seededFor, setSeededFor] = useState(me?.userId);
  if (me && seededFor !== me.userId) {
    setSeededFor(me.userId);
    setName(me.name);
    setPhone(me.phone ?? '');
  }

  // Coming back from Messages after sending the opt-in text should flip the status to on.
  useFocusEffect(
    useCallback(() => {
      refreshMe().catch(() => {});
    }, [refreshMe]),
  );

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const turnOn = () =>
    run(async () => {
      const account = name.trim() !== me?.name || !me ? await saveName(name.trim()) : me;
      const res = await api.coachOptIn(account.userId, phone);
      setMe(res);
      setConfirmUrl(res.confirmUrl);
      if (res.confirmUrl) await Linking.openURL(res.confirmUrl);
    });

  const turnOff = () =>
    run(async () => {
      if (me) setMe(await api.coachOptOut(me.userId));
    });
  const pickPersona = (persona: Persona) =>
    run(async () => {
      if (me) setMe(await api.updateUser(me.userId, { persona }));
    });

  const on = me?.optIn === 'active';
  const pending = me?.optIn === 'pending';
  const bubble = on
    ? "I'm in your texts. Ask me about any take, any time."
    : pending
      ? 'One step left: send me the text that just opened in Messages.'
      : "Want me in your texts? I'll only ping you when a friend scores before you do, or your streak is about to end.";

  return (
    <View style={{ flex: 1 }}>
      <AeroBackground hills={false} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>You</Text>
        <View style={styles.pandaRow}>
          <Panda pose={on ? 'celebrate' : 'idle'} headOnly size={84} />
          <SpeechBubble text={bubble} />
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.label}>Coach texts</Text>
          <Field value={name} onChangeText={setName} placeholder="Your first name" autoCapitalize="words" />
          <Field value={phone} onChangeText={setPhone} placeholder="Your phone number" keyboardType="phone-pad" editable={!on} />
          {on ? (
            <ChunkyButton tone="white" label={busy ? 'Working…' : 'Turn off coach texts'} depth={4} disabled={busy} onPress={turnOff} />
          ) : (
            <ChunkyButton tone="green" label={busy ? 'Working…' : pending ? 'Open Messages again' : 'Turn on coach texts'} depth={4} disabled={busy || !name.trim() || !phone.trim()} onPress={turnOn} />
          )}
          <Text style={styles.hint}>
            {on ? 'At most two texts a day, and none once you have done your take. Reply STOP any time.' : pending && !confirmUrl ? 'Tap the button to reopen Messages, then hit send.' : 'Texts come over iMessage. Standard message rates may apply.'}
          </Text>
        </GlassCard>

        {me && (
          <GlassCard style={styles.card}>
            <Text style={styles.label}>Coach voice</Text>
            {personas.map((p) => {
              const active = me.persona === p.id;
              return (
                <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => pickPersona(p.id)} disabled={busy} style={[styles.persona, active && styles.personaActive]}>
                  <Text style={styles.personaLabel}>{p.label}</Text>
                  <Text style={styles.personaSample}>{p.sample}</Text>
                </Pressable>
              );
            })}
          </GlassCard>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 28, color: '#fff', textShadowColor: 'rgba(0,80,140,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  pandaRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  card: { padding: 16, gap: 12 },
  label: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.blue },
  hint: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text2, textAlign: 'center' },
  persona: { minHeight: 56, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 2, borderColor: '#CFE8F6', justifyContent: 'center' },
  personaActive: { backgroundColor: '#DDF4FF', borderColor: '#84D8FF' },
  personaLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
  personaSample: { fontFamily: fonts.medium, fontSize: 13, color: colors.text2 },
  error: { fontFamily: fonts.semi, fontSize: 14, color: '#B3261E', backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 14, overflow: 'hidden' },
});
