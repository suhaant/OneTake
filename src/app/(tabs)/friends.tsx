import React, { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share as NativeShare, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SMS from 'expo-sms';
import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';
import AeroBackground from '../../components/AeroBackground';
import ChunkyButton from '../../components/ChunkyButton';
import Field from '../../components/Field';
import Panda from '../../components/Panda';
import { Chip, GlassCard, SpeechBubble } from '../../components/Glass';
import { Friends as FriendsIcon, Share } from '../../components/Icons';
import { colors, fonts } from '../../theme';
import { api, ChallengeDraft, errorText, Friend } from '../../api';
import { useApp } from '../../store';

/**
 * Opens the user's own Messages composer with the challenge prefilled. Returns false only when
 * we know they backed out; Android cannot tell us, so anything else counts as sent.
 */
async function compose(draft: ChallengeDraft): Promise<boolean> {
  if (await SMS.isAvailableAsync()) {
    const { result } = await SMS.sendSMSAsync([draft.toPhone], draft.message);
    return result !== 'cancelled';
  }
  // Simulator and web have no SMS composer.
  if (Platform.OS === 'web') {
    await Linking.openURL(`sms:${draft.toPhone}?body=${encodeURIComponent(draft.message)}`);
    return true;
  }
  const shared = await NativeShare.share({ message: draft.message });
  return shared.action !== NativeShare.dismissedAction;
}

function FriendRow({ friend, onNudge, busy }: { friend: Friend; onNudge: () => void; busy: boolean }) {
  const status = friend.completedToday ? `${friend.todayScore} today` : friend.joined ? 'Not yet today' : 'Invited';
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{friend.name}</Text>
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          <Chip text={status} tone={friend.completedToday ? 'green' : 'blue'} />
        </View>
      </View>
      {!friend.completedToday && friend.phone && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Text ${friend.name}`} onPress={onNudge} disabled={busy} style={styles.nudge}>
          <Text style={styles.nudgeText}>Text</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function FriendsTab() {
  const insets = useSafeAreaInsets();
  const { me, saveName, result } = useApp();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [myName, setMyName] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const userId = me?.userId;
  const load = useCallback(() => {
    if (userId) api.friends(userId).then(setFriends).catch(() => {});
  }, [userId]);
  useFocusEffect(load);

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

  const challenge = (toPhone: string, toName: string) =>
    run(async () => {
      if (!userId) return;
      const draft = await api.createChallenge(userId, toPhone, toName);
      if (await compose(draft)) {
        await api.markChallengeSent(draft.id);
        setNotice(`Sent. We'll show ${toName || 'them'} here once they take today's prompt.`);
        setName('');
        setPhone('');
      }
      load();
    });

  const pickContact = () =>
    run(async () => {
      const permission = await requestPermissionsAsync();
      if (!permission.granted) {
        setError('Contacts access is off. Type a name and number below instead.');
        return;
      }
      const picked = await Contact.presentPicker();
      if (!picked) return;
      const [details, phones] = await Promise.all([picked.getDetails([ContactField.GIVEN_NAME, ContactField.FAMILY_NAME]), picked.getPhones()]);
      const number = (phones.find((p) => /mobile|iphone/i.test(p.label ?? '')) ?? phones[0])?.number;
      const pickedName = [details.givenName, details.familyName].filter(Boolean).join(' ');
      if (!number) {
        setError(`${pickedName || 'That contact'} has no phone number saved.`);
        return;
      }
      // Shown for review rather than sent straight away, so the user confirms who gets the text.
      setName(pickedName);
      setPhone(number);
    });

  const scored = result?.score ?? me?.todayScore ?? null;
  const named = Boolean(me?.name);
  const bubble = !named
    ? 'Tell me your name so your friends know who is calling them out.'
    : scored != null
      ? `You scored ${scored} today. Text a friend and dare them to beat it.`
      : "Invite a friend to today's prompt. The text comes from your own number.";

  return (
    <View style={{ flex: 1 }}>
      <AeroBackground hills={false} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Friends</Text>
        <View style={styles.pandaRow}>
          <Panda pose="encourage" headOnly size={84} />
          <SpeechBubble text={bubble} />
        </View>

        {!named ? (
          <GlassCard style={styles.card}>
            <Text style={styles.label}>Your name</Text>
            <Field value={myName} onChangeText={setMyName} placeholder="First name" autoCapitalize="words" returnKeyType="done" />
            <ChunkyButton tone="green" label={busy ? 'Saving…' : 'Continue'} depth={4} disabled={busy || !myName.trim()} onPress={() => run(async () => void (await saveName(myName.trim())))} />
          </GlassCard>
        ) : (
          <GlassCard style={styles.card}>
            <Text style={styles.label}>Challenge a friend</Text>
            {Platform.OS !== 'web' && <ChunkyButton tone="blue" label="Pick from contacts" icon={<FriendsIcon size={22} />} depth={4} disabled={busy} onPress={pickContact} />}
            <Field value={name} onChangeText={setName} placeholder="Friend's name" autoCapitalize="words" />
            <Field value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
            <ChunkyButton tone="green" label={busy ? 'Preparing…' : 'Write the text'} icon={<Share />} depth={4} disabled={busy || !phone.trim()} onPress={() => challenge(phone, name.trim())} />
            <Text style={styles.hint}>Opens Messages with the text ready. You hit send.</Text>
          </GlassCard>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        {friends.length > 0 && (
          <GlassCard solid style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
            {friends.map((f, i) => (
              <View key={f.phone ?? f.name} style={i > 0 && styles.divider}>
                <FriendRow friend={f} busy={busy} onNudge={() => f.phone && challenge(f.phone, f.name)} />
              </View>
            ))}
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
}

const shadowText = { textShadowColor: 'rgba(0,80,140,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 };

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 28, color: '#fff', ...shadowText },
  pandaRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  card: { padding: 16, gap: 12 },
  label: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.blue },
  hint: { fontFamily: fonts.medium, fontSize: 13, color: colors.text2, textAlign: 'center' },
  error: { fontFamily: fonts.semi, fontSize: 14, color: '#B3261E', backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 14, overflow: 'hidden' },
  notice: { fontFamily: fonts.semi, fontSize: 14, color: colors.greenText, backgroundColor: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  rowName: { fontFamily: fonts.semi, fontSize: 16, color: colors.navy },
  divider: { borderTopWidth: 1, borderTopColor: colors.hair },
  nudge: { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, backgroundColor: '#DDF4FF', borderWidth: 2, borderColor: '#84D8FF', alignItems: 'center', justifyContent: 'center' },
  nudgeText: { fontFamily: fonts.bold, fontSize: 14, color: colors.blue },
});
