import { timingSafeEqual } from 'node:crypto';
import { serve } from '@hono/node-server';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { acceptChallenge, createChallenge } from './challenges.ts';
import { config } from './config.ts';
import { onAttemptCompleted, runStreakSaver } from './notifications.ts';
import { isExpoPushToken } from './push.ts';
import { store, type Persona, type Profile } from './store/index.ts';
import { safeTz, toE164 } from './util.ts';

const PERSONAS: Persona[] = ['mentor', 'drill', 'hype'];

const server = new Hono();
server.use('*', cors());
server.onError((err, c) => {
  console.error(`[${c.req.method} ${c.req.path}]`, err);
  return c.json({ error: 'server_error' }, 500);
});

const body = async (c: Context) => ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
const str = (v: unknown, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Server-to-server routes. Open only when no secret is configured, i.e. local development. */
function internalOnly(c: Context): Response | null {
  if (!config.internalSecret) return null;
  const given = Buffer.from(c.req.header('authorization')?.replace(/^Bearer /, '') ?? '');
  const want = Buffer.from(config.internalSecret);
  return given.length === want.length && timingSafeEqual(given, want) ? null : c.json({ error: 'unauthorized' }, 401);
}

async function publicProfile(p: Profile) {
  const [attempt, streak] = await Promise.all([store.todaysAttempt(p.userId), store.streak(p.userId, p.tz)]);
  return { userId: p.userId, name: p.name, phone: p.phone, optIn: p.optIn, pushEnabled: p.optIn === 'active' && Boolean(p.pushToken), persona: p.persona, completedToday: Boolean(attempt), todayScore: attempt?.score ?? null, streak };
}

server.get('/health', (c) => c.json({ ok: true, push: 'expo', store: config.databaseUrl ? 'tiger' : 'memory' }));

// ---- users -----------------------------------------------------------------

server.post('/users', async (c) => {
  const b = await body(c);
  // The name may be empty: the app opens an account before the first take so the take has an owner.
  return c.json(await publicProfile(await store.createUser(str(b.name), safeTz(str(b.tz)))));
});

server.get('/users/:id', async (c) => {
  const p = await store.getProfile(c.req.param('id'));
  return p ? c.json(await publicProfile(p)) : c.json({ error: 'not_found' }, 404);
});

server.patch('/users/:id', async (c) => {
  const b = await body(c);
  const patch: Partial<Profile> = {};
  if (str(b.name)) patch.name = str(b.name);
  if (str(b.tz)) patch.tz = safeTz(str(b.tz));
  if (PERSONAS.includes(b.persona as Persona)) patch.persona = b.persona as Persona;
  if (typeof b.phone === 'string') {
    // Optional: lets friends' challenges link to this account. Empty string clears it.
    const phone = str(b.phone) ? toE164(str(b.phone)) : null;
    if (str(b.phone) && !phone) return c.json({ error: 'invalid_phone' }, 400);
    const owner = phone ? await store.getProfileByPhone(phone) : null;
    if (owner && owner.userId !== c.req.param('id')) return c.json({ error: 'phone_in_use' }, 409);
    patch.phone = phone;
  }
  const p = await store.updateProfile(c.req.param('id'), patch);
  return p ? c.json(await publicProfile(p)) : c.json({ error: 'not_found' }, 404);
});

// ---- push notifications ------------------------------------------------------

/** The app sends its Expo push token after the user allows notifications. Turning them on again after a STOP is the same call. */
server.post('/users/:id/push-token', async (c) => {
  const p = await store.getProfile(c.req.param('id'));
  if (!p) return c.json({ error: 'not_found' }, 404);
  const token = str((await body(c)).token, 200);
  if (!isExpoPushToken(token)) return c.json({ error: 'invalid_token' }, 400);
  const updated = await store.updateProfile(p.userId, { pushToken: token, optIn: 'active' });
  return c.json(await publicProfile(updated!));
});

server.delete('/users/:id/push-token', async (c) => {
  const p = await store.updateProfile(c.req.param('id'), { pushToken: null, optIn: 'stopped' });
  return p ? c.json(await publicProfile(p)) : c.json({ error: 'not_found' }, 404);
});

server.get('/users/:id/friends', async (c) => {
  const friends = await store.friendsOf(c.req.param('id'));
  return c.json(
    await Promise.all(
      friends.map(async (f) => {
        const attempt = f.userId ? await store.todaysAttempt(f.userId) : null;
        return { name: f.name, phone: f.phone, joined: Boolean(f.userId), completedToday: Boolean(attempt), todayScore: attempt?.score ?? null };
      }),
    ),
  );
});

/**
 * The app reports a finished take here. With the in-memory store this is the only record of it;
 * with Tiger the backend has already written the score_events row and this just triggers the texts.
 */
server.post('/users/:id/attempts', async (c) => {
  const p = await store.getProfile(c.req.param('id'));
  if (!p) return c.json({ error: 'not_found' }, 404);
  const b = await body(c);
  const score = Number(b.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) return c.json({ error: 'invalid_score' }, 400);
  if (!(await store.todaysAttempt(p.userId))) {
    await store.recordAttempt(p.userId, Math.round(score), typeof b.detail === 'object' && b.detail ? (b.detail as Record<string, unknown>) : {});
  }
  // The stored score is what friends are told, not the number the client sent.
  const stored = await store.todaysAttempt(p.userId);
  return c.json(stored ? await onAttemptCompleted(p.userId, stored.score) : { notified: 0 });
});

// ---- leaderboard -----------------------------------------------------------

/**
 * Today's board. Global is everyone who has taken today's prompt; friends is the caller's
 * friends who have. Names come from this server's profiles, scores from the backend's rows.
 */
server.get('/leaderboard', async (c) => {
  const scope = c.req.query('scope') === 'friends' ? 'friends' : 'global';
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 50) || 50, 1), 100);
  const userId = str(c.req.query('userId') ?? '');

  let entries: { userId: string; name: string; score: number }[];
  if (scope === 'friends') {
    if (!userId) return c.json({ error: 'user_required' }, 400);
    const friends = await store.friendsOf(userId);
    const [mine, ...theirs] = await Promise.all([
      store.getProfile(userId).then(async (p) => (p ? { p, a: await store.todaysAttempt(userId) } : null)),
      ...friends.filter((f) => f.userId).map(async (f) => ({ f, a: await store.todaysAttempt(f.userId!) })),
    ]);
    entries = theirs.filter((x) => x.a).map((x) => ({ userId: x.f.userId!, name: x.f.name, score: x.a!.score }));
    if (mine?.a) entries.push({ userId, name: mine.p.name || 'You', score: mine.a.score });
    entries.sort((x, y) => y.score - x.score);
  } else {
    entries = await store.todaysBoard(limit);
  }
  const withStreaks = await Promise.all(
    entries.slice(0, limit).map(async (e, i) => {
      const p = await store.getProfile(e.userId);
      return { rank: i + 1, ...e, name: e.name || 'Anonymous', streak: p ? await store.streak(p.userId, p.tz) : 0 };
    }),
  );
  const me = userId ? withStreaks.find((e) => e.userId === userId) ?? null : null;
  return c.json({ scope, total: entries.length, entries: withStreaks, me });
});

// ---- challenges ------------------------------------------------------------

server.post('/challenges', async (c) => {
  const b = await body(c);
  const from = await store.getProfile(str(b.fromUserId));
  if (!from) return c.json({ error: 'not_found' }, 404);
  const toPhone = toE164(str(b.toPhone));
  if (!toPhone) return c.json({ error: 'invalid_phone' }, 400);
  if (toPhone === from.phone) return c.json({ error: 'cannot_challenge_self' }, 400);
  return c.json(await createChallenge(from, toPhone, str(b.toName) || 'Friend'));
});

server.post('/challenges/:id/sent', async (c) => {
  await store.markChallengeSent(c.req.param('id'));
  return c.json({ ok: true });
});

server.post('/challenges/:id/accept', async (c) => {
  const acceptor = await store.getProfile(str((await body(c)).userId));
  if (!acceptor) return c.json({ error: 'not_found' }, 404);
  return c.json((await acceptChallenge(c.req.param('id'), acceptor)) ?? { from: null });
});

// Links inside texts must be https to be tappable, so these bounce into the app's own scheme.
const bounce = (target: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OneTake</title>` +
  `<meta http-equiv="refresh" content="0;url=${target}"><body style="font-family:system-ui;padding:32px;text-align:center">` +
  `<h2>OneTake</h2><p>One prompt. One take. Thirty seconds.</p><p><a href="${target}">Open in OneTake</a></p></body>`;

server.get('/c/:id', (c) => {
  const id = c.req.param('id');
  return /^[a-f0-9-]{6,40}$/.test(id) ? c.html(bounce(`onetake://c/${id}`)) : c.notFound();
});
server.get('/open', (c) => c.html(bounce('onetake://')));

// ---- internal --------------------------------------------------------------

/** For the scoring backend: call after a submission is scored, as an alternative to the app reporting it. */
server.post('/events/attempt-completed', async (c) => {
  const denied = internalOnly(c);
  if (denied) return denied;
  const userId = str((await body(c)).userId);
  const stored = userId ? await store.todaysAttempt(userId) : null;
  return c.json(stored ? await onAttemptCompleted(userId, stored.score) : { notified: 0 });
});

server.post('/cron/streak-saver', async (c) => internalOnly(c) ?? c.json(await runStreakSaver()));

serve({ fetch: server.fetch, port: config.port }, ({ port }) => {
  console.log(`onetake server on :${port} | push expo | store ${config.databaseUrl ? 'tiger' : 'memory'} | coach ${config.gemini.apiKey ? config.gemini.model : 'templates'}`);
});

if (config.enableCron) {
  // The notification log dedupes per user per day, so running more often than hourly is safe.
  setInterval(() => runStreakSaver().catch((err) => console.error('[cron] streak-saver failed:', err)), 15 * 60_000);
}

export { server };
