import { randomUUID } from 'node:crypto';
import { dailyPrompt } from '../prompt.ts';
import { dayIn, streakFromDays } from '../util.ts';
import type { BoardEntry, Challenge, Friend, Profile, Row, Store } from './types.ts';

type Edge = { userId: string; phone: string; name: string; friendUserId: string | null };

/** Dev store: lets the whole flow run before the Tiger integration lands. Data is lost on restart. */
export function memoryStore(): Store {
  const profiles = new Map<string, Profile>();
  const attempts = new Map<string, (Row & { time: string; prompt_id: string; score: number })[]>();
  const edges: Edge[] = [];
  const challenges = new Map<string, Challenge>();
  const notifications = new Map<string, string>();

  const byPhone = (phone: string) => [...profiles.values()].find((p) => p.phone === phone) ?? null;

  return {
    async createUser(name, tz) {
      const p: Profile = { userId: randomUUID(), name, phone: null, pushToken: null, optIn: 'none', persona: 'mentor', tz };
      profiles.set(p.userId, p);
      return p;
    },
    async getProfile(userId) {
      return profiles.get(userId) ?? null;
    },
    async getProfileByPhone(phone) {
      return byPhone(phone);
    },
    async updateProfile(userId, patch) {
      const p = profiles.get(userId);
      if (!p) return null;
      Object.assign(p, patch);
      return p;
    },
    async activeProfiles() {
      return [...profiles.values()].filter((p) => p.optIn === 'active');
    },

    todaysPrompt: dailyPrompt,
    async todaysAttempt(userId) {
      const prompt = await dailyPrompt();
      const a = attempts.get(userId)?.find((r) => r.prompt_id === prompt.id);
      return a ? { score: a.score } : null;
    },
    async recordAttempt(userId, score, detail) {
      const prompt = await dailyPrompt();
      const list = attempts.get(userId) ?? [];
      if (list.some((r) => r.prompt_id === prompt.id)) return;
      list.unshift({ ...detail, time: new Date().toISOString(), prompt_id: prompt.id, prompt: prompt.text, score });
      attempts.set(userId, list);
    },
    async resetToday(userId) {
      const prompt = await dailyPrompt();
      attempts.set(userId, (attempts.get(userId) ?? []).filter((r) => r.prompt_id !== prompt.id));
    },
    async streak(userId, tz) {
      return streakFromDays((attempts.get(userId) ?? []).map((r) => dayIn(tz, new Date(r.time))), dayIn(tz));
    },
    async history(userId, limit) {
      return (attempts.get(userId) ?? []).slice(0, limit);
    },
    async extras() {
      return {};
    },
    async todaysBoard(limit) {
      const prompt = await dailyPrompt();
      const rows: BoardEntry[] = [];
      for (const p of profiles.values()) {
        const a = attempts.get(p.userId)?.find((r) => r.prompt_id === prompt.id);
        if (a) rows.push({ userId: p.userId, name: p.name, score: a.score });
      }
      return rows.sort((x, y) => y.score - x.score).slice(0, limit);
    },

    async addFriend(userId, phone, name) {
      const existing = edges.find((e) => e.userId === userId && e.phone === phone);
      if (existing) existing.name = name;
      else edges.push({ userId, phone, name, friendUserId: null });
    },
    async linkFriend(userId, phone, friendUserId) {
      const e = edges.find((x) => x.userId === userId && x.phone === phone);
      if (e) e.friendUserId = friendUserId;
    },
    async friendsOf(userId) {
      const me = profiles.get(userId);
      const out = new Map<string, Friend>();
      for (const e of edges) {
        if (e.userId === userId) {
          const p = (e.friendUserId && profiles.get(e.friendUserId)) || byPhone(e.phone);
          out.set(p?.userId ?? e.phone, { userId: p?.userId ?? null, name: p?.name ?? e.name, phone: e.phone });
        } else if (e.friendUserId === userId || (me?.phone && e.phone === me.phone)) {
          const p = profiles.get(e.userId);
          if (p) out.set(p.userId, { userId: p.userId, name: p.name, phone: p.phone });
        }
      }
      out.delete(userId);
      return [...out.values()];
    },

    async createChallenge(c) {
      const full: Challenge = { ...c, id: randomUUID().slice(0, 8), sentAt: null };
      challenges.set(full.id, full);
      return full;
    },
    async getChallenge(id) {
      return challenges.get(id) ?? null;
    },
    async markChallengeSent(id) {
      const c = challenges.get(id);
      if (c) c.sentAt = new Date().toISOString();
    },

    async logNotification(userId, kind, subject, day, body) {
      const key = `${userId}|${kind}|${subject}|${day}`;
      if (notifications.has(key)) return false;
      notifications.set(key, body);
      return true;
    },
    async notificationCount(userId, day) {
      return [...notifications.keys()].filter((k) => k.startsWith(`${userId}|`) && k.endsWith(`|${day}`)).length;
    },

  };
}
