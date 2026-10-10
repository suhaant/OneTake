import { config } from './config.ts';
import { store, type Challenge, type Profile } from './store/index.ts';
import { firstName } from './util.ts';

export const challengeUrl = (id: string) => `${config.publicUrl}/c/${id}`;

/** The text the challenger sends from their own number. Written in first person because it comes from them. */
export function challengeMessage(c: Challenge, promptText: string): string {
  const url = challengeUrl(c.id);
  return c.score == null
    ? `Do today's OneTake with me: "${promptText}" 30 seconds, one take. ${url}`
    : `I scored ${c.score} on today's OneTake: "${promptText}" 30 seconds, one take. Beat it: ${url}`;
}

/**
 * Creates the challenge and remembers the friendship. Nothing is sent from here: the app opens
 * the user's own Messages composer with the returned text.
 */
export async function createChallenge(from: Profile, toPhone: string, toName: string) {
  const [prompt, attempt] = await Promise.all([store.todaysPrompt(), store.todaysAttempt(from.userId)]);
  const challenge = await store.createChallenge({
    fromUserId: from.userId,
    toPhone,
    toName,
    promptId: prompt.id,
    score: attempt?.score ?? null,
  });
  await store.addFriend(from.userId, toPhone, toName);
  return { id: challenge.id, toPhone, message: challengeMessage(challenge, prompt.text), url: challengeUrl(challenge.id) };
}

/** The friend opened the link in the app: tie their account to the challenger's. */
export async function acceptChallenge(id: string, acceptor: Profile): Promise<{ from: string } | null> {
  const challenge = await store.getChallenge(id);
  if (!challenge || challenge.fromUserId === acceptor.userId) return null;
  await store.linkFriend(challenge.fromUserId, challenge.toPhone, acceptor.userId);
  const from = await store.getProfile(challenge.fromUserId);
  return { from: firstName(from?.name ?? '') };
}
