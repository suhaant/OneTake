import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { dailyPrompt } from '../prompt.ts';
import { dayIn, safeTz, streakFromDays } from '../util.ts';
import type { Challenge, Friend, OptIn, Persona, Profile, Row, Store } from './types.ts';

/**
 * Takes are written by the FastAPI backend (backend/app/store.py) into `submissions` and
 * `score_events`; this server only reads them. A take belongs to "today" by the user's own
 * calendar day, the same clock the streak uses.
 */
const UNDEFINED_TABLE = '42P01';
const USER_TZ = "coalesce((select tz from messaging_profiles where user_id = $1), 'UTC')";

type ProfileRow = { user_id: string; name: string; phone: string | null; push_token: string | null; opt_in: OptIn; persona: Persona; tz: string };

const toProfile = (r: ProfileRow): Profile => ({
  userId: r.user_id,
  name: r.name,
  phone: r.phone,
  pushToken: r.push_token,
  optIn: r.opt_in,
  persona: r.persona,
  tz: r.tz,
});

const PROFILE_COLUMNS: Record<keyof Omit<Profile, 'userId'>, string> = {
  name: 'name',
  phone: 'phone',
  pushToken: 'push_token',
  optIn: 'opt_in',
  persona: 'persona',
  tz: 'tz',
};

export function tigerStore(connectionString: string): Store {
  const pool = new pg.Pool({ connectionString, max: 5 });
  // Like the backend, create our own tables on startup so there is no separate migration step.
  const ready = pool.query(readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8'));
  ready.catch((err) => console.error('[tiger] could not apply schema.sql:', err));
  const q = async <T extends Row = Row>(sql: string, params: unknown[] = []) => {
    await ready;
    return (await pool.query(sql, params)).rows as T[];
  };

  /** Reads the backend's tables. They do not exist until the backend has started once against this database. */
  const takes = async (sql: string, params: unknown[]) => {
    try {
      return await q(sql, params);
    } catch (err) {
      if ((err as { code?: string }).code !== UNDEFINED_TABLE) throw err;
      console.warn('[tiger] score_events/submissions not found; start the backend once to create them');
      return [];
    }
  };

  const profileById = async (userId: string) => {
    const [r] = await q<ProfileRow>('select * from messaging_profiles where user_id = $1', [userId]);
    return r ? toProfile(r) : null;
  };

  const store: Store = {
    async createUser(name, tz) {
      const [r] = await q<ProfileRow>('insert into messaging_profiles (user_id, name, tz) values ($1, $2, $3) returning *', [randomUUID(), name, tz]);
      return toProfile(r);
    },
    getProfile: profileById,
    async getProfileByPhone(phone) {
      const [r] = await q<ProfileRow>('select * from messaging_profiles where phone = $1', [phone]);
      return r ? toProfile(r) : null;
    },
    async updateProfile(userId, patch) {
      const keys = (Object.keys(patch) as (keyof typeof PROFILE_COLUMNS)[]).filter((k) => k in PROFILE_COLUMNS);
      if (keys.length === 0) return profileById(userId);
      const sets = keys.map((k, i) => `${PROFILE_COLUMNS[k]} = $${i + 2}`).join(', ');
      const [r] = await q<ProfileRow>(`update messaging_profiles set ${sets} where user_id = $1 returning *`, [userId, ...keys.map((k) => patch[k])]);
      return r ? toProfile(r) : null;
    },
    async activeProfiles() {
      return (await q<ProfileRow>("select * from messaging_profiles where opt_in = 'active'")).map(toProfile);
    },

    todaysPrompt: dailyPrompt,
    async todaysAttempt(userId) {
      const [r] = await takes(
        `with z as (select ${USER_TZ} as tz)
         select max(e.overall) as score from score_events e, z
          where e.user_id = $1 and (e.time at time zone z.tz)::date = (now() at time zone z.tz)::date`,
        [userId],
      );
      return r?.score == null ? null : { score: Math.round(Number(r.score)) };
    },
    async recordAttempt() {
      // The backend inserts into score_events when a submission finishes scoring.
    },
    async streak(userId, tz) {
      const zone = safeTz(tz);
      const rows = await takes(
        `select distinct (time at time zone $2)::date::text as day from score_events
          where user_id = $1 and time > now() - interval '400 days'`,
        [userId, zone],
      );
      return streakFromDays(rows.map((r) => String(r.day)), dayIn(zone));
    },
    async history(userId, limit) {
      return takes(
        `select e.time, e.overall, e.eye_contact, e.posture, e.body_language, e.fillers, e.language,
                e.word_count, e.wpm, e.fillers_per_100_words, e.is_video, s.prompt,
                s.result->'feedback' as feedback, s.result->'metric_details' as metric_details,
                s.result->'transcript'->>'text' as transcript
           from score_events e left join submissions s using (submission_id)
          where e.user_id = $1 order by e.time desc limit $2`,
        [userId, limit],
      );
    },
    async extras(userId) {
      const weekly = await takes(
        `select date_trunc('week', time)::date::text as week, count(*)::int as takes,
                round(avg(overall)::numeric, 1)::float as overall, round(avg(eye_contact)::numeric, 1)::float as eye_contact,
                round(avg(posture)::numeric, 1)::float as posture, round(avg(body_language)::numeric, 1)::float as body_language,
                round(avg(fillers)::numeric, 1)::float as fillers, round(avg(language)::numeric, 1)::float as language
           from score_events where user_id = $1 and time > now() - interval '90 days' group by 1 order by 1`,
        [userId],
      );
      return { weeklyAverages: weekly };
    },
    async todaysBoard(limit) {
      const rows = await takes(
        `select p.user_id, p.name, max(e.overall) as score
           from score_events e join messaging_profiles p on p.user_id = e.user_id
          where e.is_video and (e.time at time zone p.tz)::date = (now() at time zone p.tz)::date
          group by p.user_id, p.name order by score desc limit $1`,
        [limit],
      );
      return rows.map((r) => ({ userId: String(r.user_id), name: String(r.name), score: Math.round(Number(r.score)) }));
    },

    async addFriend(userId, phone, name) {
      await q(
        `insert into friend_edges (user_id, friend_phone, friend_name) values ($1, $2, $3)
         on conflict (user_id, friend_phone) do update set friend_name = excluded.friend_name`,
        [userId, phone, name],
      );
    },
    async linkFriend(userId, phone, friendUserId) {
      await q('update friend_edges set friend_user_id = $3 where user_id = $1 and friend_phone = $2', [userId, phone, friendUserId]);
    },
    async friendsOf(userId) {
      const rows = await q<{ user_id: string | null; name: string; phone: string | null }>(
        `with me as (select phone from messaging_profiles where user_id = $1)
         select coalesce(p.user_id, e.friend_user_id) as user_id, coalesce(p.name, e.friend_name) as name, e.friend_phone as phone
           from friend_edges e
           left join messaging_profiles p on p.user_id = e.friend_user_id or (e.friend_user_id is null and p.phone = e.friend_phone)
          where e.user_id = $1
         union
         select p.user_id, p.name, p.phone
           from friend_edges e
           join messaging_profiles p on p.user_id = e.user_id
          where e.friend_user_id = $1 or e.friend_phone = (select phone from me)`,
        [userId],
      );
      const out = new Map<string, Friend>();
      for (const r of rows) {
        if (r.user_id === userId) continue;
        out.set(r.user_id ?? r.phone ?? r.name, { userId: r.user_id, name: r.name, phone: r.phone });
      }
      return [...out.values()];
    },

    async createChallenge(c) {
      const id = randomUUID().slice(0, 8);
      await q('insert into challenges (id, from_user_id, to_phone, to_name, prompt_id, score) values ($1, $2, $3, $4, $5, $6)', [
        id,
        c.fromUserId,
        c.toPhone,
        c.toName,
        c.promptId,
        c.score,
      ]);
      return { ...c, id, sentAt: null };
    },
    async getChallenge(id) {
      const [r] = await q('select * from challenges where id = $1', [id]);
      if (!r) return null;
      const c: Challenge = {
        id: String(r.id),
        fromUserId: String(r.from_user_id),
        toPhone: String(r.to_phone),
        toName: String(r.to_name),
        promptId: String(r.prompt_id),
        score: r.score == null ? null : Number(r.score),
        sentAt: r.sent_at ? new Date(r.sent_at as string).toISOString() : null,
      };
      return c;
    },
    async markChallengeSent(id) {
      await q('update challenges set sent_at = now() where id = $1', [id]);
    },

    async logNotification(userId, kind, subject, day, body) {
      const rows = await q(
        'insert into notification_log (user_id, kind, subject, day, body) values ($1, $2, $3, $4, $5) on conflict do nothing returning 1 as ok',
        [userId, kind, subject, day, body],
      );
      return rows.length > 0;
    },
    async notificationCount(userId, day) {
      const [r] = await q('select count(*)::int as n from notification_log where user_id = $1 and day = $2', [userId, day]);
      return Number(r.n);
    },

  };
  return store;
}
