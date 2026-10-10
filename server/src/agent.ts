import { GoogleGenAI } from '@google/genai';
import { config } from './config.ts';
import { store, type Persona, type Profile } from './store/index.ts';
import { firstName } from './util.ts';

const ai = config.gemini.apiKey ? new GoogleGenAI({ apiKey: config.gemini.apiKey }) : null;

const VOICES: Record<Persona, string> = {
  mentor: 'a warm, specific speaking mentor. Calm, encouraging, concrete.',
  drill: 'a drill sergeant. Blunt, short, demanding, never cruel.',
  hype: 'a hype friend. High energy, playful, genuinely excited for them.',
};

const RULES = `You are the OneTake coach, texting one user over iMessage.
OneTake: everyone gets the same speaking prompt each day and records one 30-second take, which is scored 0-100.
Rules:
- Plain text only, like a real text message. No markdown, no lists, no emoji spam. Under 300 characters unless they ask for detail.
- Use only facts from the DATA block. If something is not there, say you do not have it. Never invent scores, names or stats.
- One take per day. There are no retakes, rematches or head-to-head duels, so never offer them.
- If they have not done today's take, you may encourage them to. If they have, do not push them to record again today.
- Timestamps, sub-scores and focus notes in their history are the best material for advice. Be specific.`;

/** Everything known about the user, in the shape handed to the model. */
export async function userContext(profile: Profile) {
  const [prompt, today, streak, history, extras, friends] = await Promise.all([
    store.todaysPrompt(),
    store.todaysAttempt(profile.userId),
    store.streak(profile.userId, profile.tz),
    store.history(profile.userId, 30),
    store.extras(profile.userId),
    store.friendsOf(profile.userId),
  ]);
  const friendsToday = await Promise.all(
    friends.map(async (f) => {
      const attempt = f.userId ? await store.todaysAttempt(f.userId) : null;
      return { name: f.name, onOneTake: Boolean(f.userId), todayScore: attempt?.score ?? null };
    }),
  );
  return {
    user: { name: profile.name || null, timeZone: profile.tz },
    today: { prompt: prompt.text, completed: Boolean(today), score: today?.score ?? null },
    streakDays: streak,
    friends: friendsToday,
    takes: history,
    ...extras,
  };
}

async function generate(profile: Profile, task: string, contents: string): Promise<string | null> {
  if (!ai) return null;
  try {
    const data = JSON.stringify(await userContext(profile));
    const res = await ai.models.generateContent({
      model: config.gemini.model,
      contents,
      config: {
        systemInstruction: `${RULES}\nVoice: ${VOICES[profile.persona]}\n\n${task}\n\nDATA:\n${data}`,
        temperature: 0.7,
        maxOutputTokens: 400,
        abortSignal: AbortSignal.timeout(12_000),
      },
    });
    return res.text?.trim() || null;
  } catch (err) {
    console.error('[agent] generation failed, using fallback:', err);
    return null;
  }
}

/** Reply to a text the user sent the coach. */
export async function coachReply(profile: Profile, inbound: string): Promise<string> {
  const past = await store.recentMessages(profile.userId, 12);
  const transcript = [...past.map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.body}`), `User: ${inbound}`, 'Coach:'].join('\n');
  const reply = await generate(profile, 'Task: reply to the last user message in the conversation.', transcript);
  if (reply) return reply;

  const ctx = await userContext(profile);
  return ctx.today.completed
    ? `You scored ${ctx.today.score} today and your streak is ${ctx.streakDays}. See you tomorrow.`
    : `Today's prompt: "${ctx.today.prompt}" Your streak is ${ctx.streakDays}. 30 seconds, one take.`;
}

export type Nudge =
  | { kind: 'friend_scored'; friendName: string; friendScore: number; link: string }
  | { kind: 'streak_saver'; streak: number; link: string };

/** A coach-initiated text. The model personalises it; the template is the fallback and the fact source. */
export async function composeNudge(profile: Profile, nudge: Nudge): Promise<string> {
  const me = firstName(profile.name);
  const template =
    nudge.kind === 'friend_scored'
      ? `${me}, ${firstName(nudge.friendName)} just scored ${nudge.friendScore} on today's OneTake and you haven't taken yours yet. 30 seconds: ${nudge.link}`
      : `${me}, your ${nudge.streak}-day streak ends at midnight. One 30-second take keeps it alive: ${nudge.link}`;

  const written = await generate(
    profile,
    `Task: write one text nudging the user to do today's take. Keep every fact and the exact link from this draft, and make it sound like you: "${template}" You may add one specific tip from their recent takes.`,
    'Write the text.',
  );
  return written && written.includes(nudge.link) ? written : template;
}
