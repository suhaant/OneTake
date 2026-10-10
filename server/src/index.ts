import { timingSafeEqual } from 'node:crypto';
import { serve } from '@hono/node-server';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { coachReply } from './agent.ts';
import { acceptChallenge, createChallenge } from './challenges.ts';
import { config, photonEnabled } from './config.ts';
import { onAttemptCompleted, runStreakSaver } from './notifications.ts';
import { optInLink, registerPhotonUser, spectrum } from './photon.ts';
import { store, type Persona, type Profile } from './store/index.ts';
import { firstName, safeTz, toE164 } from './util.ts';

const PERSONAS: Persona[] = ['mentor', 'drill', 'hype'];
const OPT_IN_TEXT = 'Turn on my OneTake coach';

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
  return { userId: p.userId, name: p.name, phone: p.phone, optIn: p.optIn, persona: p.persona, completedToday: Boolean(attempt), todayScore: attempt?.score ?? null, streak };
}

server.get('/health', (c) => c.json({ ok: true, photon: photonEnabled, store: config.databaseUrl ? 'tiger' : 'memory' }));

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
  const p = await store.updateProfile(c.req.param('id'), patch);
  return p ? c.json(await publicProfile(p)) : c.json({ error: 'not_found' }, 404);
});

/**
 * Step one of coach opt-in: register the number with Photon and hand back a link that opens
 * Messages with a prefilled text. Texting stays off until that first text arrives (see the
 * webhook), which is both the consent record and proof that the number is theirs.
 */
server.post('/users/:id/coach/opt-in', async (c) => {
  const p = await store.getProfile(c.req.param('id'));
  if (!p) return c.json({ error: 'not_found' }, 404);
  const phone = toE164(str((await body(c)).phone));
  if (!phone) return c.json({ error: 'invalid_phone' }, 400);
  const owner = await store.getProfileByPhone(phone);
  if (owner && owner.userId !== p.userId) return c.json({ error: 'phone_in_use' }, 409);

  const photonUser = await registerPhotonUser(phone, firstName(p.name));
  // Without Photon credentials there is no inbound text to wait for, so dev mode activates directly.
  const optIn = photonEnabled ? (p.phone === phone && p.optIn === 'active' ? 'active' : 'pending') : 'active';
  const updated = await store.updateProfile(p.userId, { phone, photonUserId: photonUser.id, optIn });
  return c.json({ ...(await publicProfile(updated!)), confirmUrl: optInLink(photonUser.id, OPT_IN_TEXT) });
});

server.post('/users/:id/coach/opt-out', async (c) => {
  const p = await store.updateProfile(c.req.param('id'), { optIn: 'stopped' });
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

// ---- inbound texts ---------------------------------------------------------

server.post('/spectrum/webhook', async (c) => {
  const app = await spectrum();
  if (!app) return c.json({ error: 'photon_not_configured' }, 503);
  return app.webhook(c.req.raw, async (space, message) => {
    if (message.direction !== 'inbound' || message.content.type !== 'text' || !message.sender) return;
    const phone = toE164(message.sender.id);
    const profile = phone ? await store.getProfileByPhone(phone) : null;
    if (!profile) return;
    const said = message.content.text.trim();

    if (/^(stop|unsubscribe|quit)$/i.test(said)) {
      await store.updateProfile(profile.userId, { optIn: 'stopped' });
      await space.send("Done. I won't text you again. Turn me back on any time from the You tab.");
      return;
    }
    // After STOP only an explicit START (or opting in again from the app) turns texting back on.
    if (profile.optIn === 'stopped' && !/^start$/i.test(said)) return;
    if (profile.optIn !== 'active') {
      // Their first text is the opt-in.
      await store.updateProfile(profile.userId, { optIn: 'active' });
      await space.send(`You're in, ${firstName(profile.name)}. I'll text when a friend posts a score before you do, and when your streak is about to end. Ask me anything about your takes. Reply STOP to turn me off.`);
      return;
    }

    await store.appendMessage(profile.userId, 'user', said);
    const reply = await coachReply(profile, said);
    await space.send(reply);
    await store.appendMessage(profile.userId, 'coach', reply);
  });
});

serve({ fetch: server.fetch, port: config.port }, ({ port }) => {
  console.log(`onetake server on :${port} | photon ${photonEnabled ? 'live' : 'dry-run'} | store ${config.databaseUrl ? 'tiger' : 'memory'} | coach ${config.gemini.apiKey ? config.gemini.model : 'templates'}`);
});

if (config.enableCron) {
  // The notification log dedupes per user per day, so running more often than hourly is safe.
  setInterval(() => runStreakSaver().catch((err) => console.error('[cron] streak-saver failed:', err)), 15 * 60_000);
}

export { server };
