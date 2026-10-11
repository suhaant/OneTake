import { composeNudge, type Nudge } from './agent.ts';
import { config } from './config.ts';
import { sendPush } from './push.ts';
import { store, type Profile } from './store/index.ts';
import { dayIn, hourIn } from './util.ts';

/** Deep link the app handles; a push tap opens it directly, so no public URL is involved. */
const openLink = () => 'onetake://';

const TITLES: Record<Nudge['kind'], string> = { friend_scored: 'A friend just posted a score', streak_saver: 'Your streak ends tonight' };

/**
 * Sends one coach-initiated push, but only to users who turned notifications on, have not taken
 * today's prompt, and are under the daily cap. Returns whether a notification went out.
 */
async function nudge(profile: Profile, subject: string, n: Nudge): Promise<boolean> {
  if (profile.optIn !== 'active' || !profile.pushToken) return false;
  if (await store.todaysAttempt(profile.userId)) return false;

  const day = dayIn(profile.tz);
  if ((await store.notificationCount(profile.userId, day)) >= config.maxNudgesPerDay) return false;

  const body = await composeNudge(profile, n);
  // Logged before sending: a crash between the two drops one notification rather than sending it twice.
  if (!(await store.logNotification(profile.userId, n.kind, subject, day, body))) return false;

  const sent = await sendPush(profile.pushToken, { title: TITLES[n.kind], body, data: { url: n.link, kind: n.kind } });
  if (!sent.ok) {
    console.warn(`[push] ${n.kind} to ${profile.userId} failed: ${sent.error}`);
    // The app was uninstalled or the token rotated: stop trying until they turn it on again.
    if (sent.unregistered) await store.updateProfile(profile.userId, { pushToken: null, optIn: 'none' });
    return false;
  }
  return true;
}

/** Called when a user finishes today's take: tells their friends who have not done theirs yet. */
export async function onAttemptCompleted(userId: string, score: number): Promise<{ notified: number }> {
  const scorer = await store.getProfile(userId);
  if (!scorer) return { notified: 0 };

  let notified = 0;
  for (const friend of await store.friendsOf(userId)) {
    if (!friend.userId) continue;
    const profile = await store.getProfile(friend.userId);
    if (!profile) continue;
    try {
      const sent = await nudge(profile, userId, { kind: 'friend_scored', friendName: scorer.name, friendScore: score, link: openLink() });
      if (sent) notified += 1;
    } catch (err) {
      console.error(`[nudge] friend_scored to ${profile.userId} failed:`, err);
    }
  }
  return { notified };
}

/** Notifies users whose streak is alive but who have not taken today's prompt, once it is evening where they are. */
export async function runStreakSaver(now: Date = new Date()): Promise<{ notified: number }> {
  let notified = 0;
  for (const profile of await store.activeProfiles()) {
    if (hourIn(profile.tz, now) !== config.streakSaverHour) continue;
    try {
      const streak = await store.streak(profile.userId, profile.tz);
      if (streak < 1) continue;
      if (await nudge(profile, 'streak', { kind: 'streak_saver', streak, link: openLink() })) notified += 1;
    } catch (err) {
      console.error(`[nudge] streak_saver to ${profile.userId} failed:`, err);
    }
  }
  return { notified };
}
