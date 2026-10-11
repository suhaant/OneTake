import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AeroBackground from '../../components/AeroBackground';
import ChunkyButton from '../../components/ChunkyButton';
import Field from '../../components/Field';
import Panda from '../../components/Panda';
import { GlassCard, Gloss, SpeechBubble } from '../../components/Glass';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, skyText } from '../../theme';
import { api, errorText, Persona } from '../../api';
import { ensurePermission, getPushToken, scheduleStreakReminder } from '../../notifications';
import { useApp } from '../../store';

const personas: { id: Persona; label: string; sample: string }[] = [
  { id: 'mentor', label: 'Mentor', sample: 'Calm and specific.' },
  { id: 'drill', label: 'Drill sergeant', sample: 'Blunt. No excuses.' },
  { id: 'hype', label: 'Hype', sample: 'Loud and on your side.' },
];

export default function YouTab() {
  const insets = useSafeAreaInsets();
  const { me, setMe, saveName, doneToday, streak, notificationsOn, setNotificationsOn, resetDay } = useApp();
  const [name, setName] = useState(me?.name ?? '');
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The account loads after first render; seed the form once it arrives.
  const [seededFor, setSeededFor] = useState(me?.userId);
  if (me && seededFor !== me.userId) {
    setSeededFor(me.userId);
    setName(me.name);
    setPhone(me.phone ?? '');
  }

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const dirty = me ? name.trim() !== me.name || phone.trim() !== (me.phone ?? '') : name.trim() !== '';

  const save = () =>
    run(async () => {
      const account = !me || name.trim() !== me.name ? await saveName(name.trim()) : me;
      if (phone.trim() !== (account.phone ?? '')) setMe(await api.updateUser(account.userId, { phone: phone.trim() }));
      setNotice('Saved.');
    });

  const turnOn = () =>
    run(async () => {
      const account = me ?? (await saveName(name.trim()));
      await ensurePermission();
      // The local 9pm reminder works everywhere; the server's nudges need a push token too.
      setNotificationsOn(true);
      await scheduleStreakReminder(true, doneToday, streak);
      const token = await getPushToken();
      if (token) {
        setMe(await api.registerPush(account.userId, token));
        setNotice("On. I'll ping you when a friend scores before you do, and at 9pm if your streak is on the line.");
      } else {
        setNotice('Reminder set for 9pm on this device. Friend alerts need a development build (see You tab hint).');
      }
    });

  const turnOff = () =>
    run(async () => {
      setNotificationsOn(false);
      await scheduleStreakReminder(false, doneToday, streak);
      if (me?.pushEnabled) setMe(await api.unregisterPush(me.userId));
      setNotice('Off. No more nudges.');
    });

  const pickPersona = (persona: Persona) =>
    run(async () => {
      if (me) setMe(await api.updateUser(me.userId, { persona }));
    });

  const on = notificationsOn;
  const bubble = on
    ? me?.pushEnabled
      ? "I'll nudge you when a friend posts a score first, and at 9pm if your streak is about to end."
      : "Your 9pm reminder is set on this phone. Friend alerts arrive once the app runs as a real build."
    : "Want a nudge? Only when a friend scores before you do, or your streak is about to end. Never after you've taken today's.";

  return (
    <View style={{ flex: 1 }}>
      <AeroBackground hills={false} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 120, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>You</Text>
        <View style={styles.pandaRow}>
          <Panda pose={on ? 'celebrate' : 'idle'} headOnly size={84} />
          <SpeechBubble text={bubble} />
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.label}>Profile</Text>
          <Field value={name} onChangeText={setName} placeholder="Your first name" autoCapitalize="words" />
          <Field value={phone} onChangeText={setPhone} placeholder="Phone number (optional)" keyboardType="phone-pad" />
          <ChunkyButton tone={dirty ? 'green' : 'white'} label={busy ? 'Saving…' : 'Save'} depth={4} disabled={busy || !dirty || !name.trim()} onPress={save} />
          <Text style={styles.hint}>Your number lets friends&apos; challenges find your account. It is never shown to anyone.</Text>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.label}>Notifications</Text>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{on ? 'On' : 'Off'}</Text>
              <Text style={styles.rowSub}>{on ? (me?.pushEnabled ? 'Friend alerts and the 9pm streak saver' : '9pm streak saver on this device') : 'Friend scored first · 9pm streak saver'}</Text>
            </View>
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={on ? turnOff : turnOn} disabled={busy || (!me && !name.trim())} style={[styles.toggle, on && styles.toggleOn]}>
              {on && <LinearGradient colors={[...gradients.lime]} style={StyleSheet.absoluteFill} />}
              <Gloss height="50%" radius={17} />
              <View style={[styles.knob, on && styles.knobOn]}>
                <LinearGradient colors={[...gradients.chrome]} style={StyleSheet.absoluteFill} />
              </View>
            </Pressable>
          </View>
          <Text style={styles.hint}>At most two a day, and none once you have done your take.</Text>
        </GlassCard>

        {me && (
          <GlassCard style={styles.card}>
            <Text style={styles.label}>Coach voice</Text>
            {personas.map((p) => {
              const active = me.persona === p.id;
              return (
                <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => pickPersona(p.id)} disabled={busy} style={[styles.persona, active && styles.personaActive]}>
                  {active && (
                    <>
                      <LinearGradient colors={['#F0FCFF', '#BDEEFF']} style={StyleSheet.absoluteFill} />
                      <Gloss height="50%" radius={14} />
                    </>
                  )}
                  <Text style={styles.personaLabel}>{p.label}</Text>
                  <Text style={styles.personaSample}>{p.sample}</Text>
                </Pressable>
              );
            })}
          </GlassCard>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        {/* demo: forget today's take so the envelope can be opened again */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset today's take"
          disabled={busy || !doneToday}
          onPress={() =>
            run(async () => {
              await resetDay();
              setNotice("Today's take is forgotten. The envelope is sealed again.");
            })
          }
          hitSlop={8}
          style={{ alignSelf: 'center', opacity: doneToday ? 0.7 : 0.35 }}
        >
          <Text style={styles.demo}>{busy ? 'Resetting…' : 'Demo · reset my OneTake for today'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 28, ...skyText },
  pandaRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  card: { padding: 16, gap: 12 },
  label: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.blue },
  hint: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text2, textAlign: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.navy },
  rowSub: { marginTop: 2, fontFamily: fonts.medium, fontSize: 13, color: colors.text2 },
  toggle: { width: 58, height: 34, borderRadius: 17, backgroundColor: '#CFDCE6', padding: 3, justifyContent: 'center', borderWidth: 1, borderColor: '#B7C9D5', overflow: 'hidden' },
  toggleOn: { borderColor: '#3FA51C' },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', overflow: 'hidden' },
  knobOn: { alignSelf: 'flex-end' },
  persona: { minHeight: 56, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#BFDDEC', justifyContent: 'center', overflow: 'hidden' },
  personaActive: { borderColor: '#6ED2FB' },
  personaLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.navy },
  personaSample: { fontFamily: fonts.medium, fontSize: 13, color: colors.text2 },
  error: { fontFamily: fonts.semi, fontSize: 14, color: '#B3261E', backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 14, overflow: 'hidden' },
  demo: { fontFamily: fonts.semi, fontSize: 11, letterSpacing: 0.3, ...skyText },
  notice: { fontFamily: fonts.semi, fontSize: 14, color: colors.greenText, backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 14, overflow: 'hidden' },
});
