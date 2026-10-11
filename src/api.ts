/** Client for the OneTake server (see /server). Set EXPO_PUBLIC_API_URL to its https origin. */
import { API_URL as BASE } from './config';

export type Persona = 'mentor' | 'drill' | 'hype';
export type OptIn = 'none' | 'active' | 'stopped';

export type Me = {
  userId: string;
  name: string;
  phone: string | null;
  optIn: OptIn;
  /** notifications are on and the server holds a live push token for this device */
  pushEnabled: boolean;
  persona: Persona;
  completedToday: boolean;
  todayScore: number | null;
  streak: number;
};

export type Friend = { name: string; phone: string | null; joined: boolean; completedToday: boolean; todayScore: number | null };

/** A challenge the server has prepared; the user sends `message` from their own number. */
export type ChallengeDraft = { id: string; toPhone: string; message: string; url: string };

export type BoardEntry = { rank: number; userId: string; name: string; score: number; streak: number };
export type Board = { scope: 'global' | 'friends'; total: number; entries: BoardEntry[]; me: BoardEntry | null };

export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('offline');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(json?.error ?? 'server_error');
  return json as T;
}

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const api = {
  createUser: (name: string) => call<Me>('POST', '/users', { name, tz: tz() }),
  getUser: (userId: string) => call<Me>('GET', `/users/${userId}`),
  updateUser: (userId: string, patch: { name?: string; persona?: Persona; phone?: string }) => call<Me>('PATCH', `/users/${userId}`, { ...patch, tz: tz() }),
  registerPush: (userId: string, token: string) => call<Me>('POST', `/users/${userId}/push-token`, { token }),
  unregisterPush: (userId: string) => call<Me>('DELETE', `/users/${userId}/push-token`),
  friends: (userId: string) => call<Friend[]>('GET', `/users/${userId}/friends`),
  reportAttempt: (userId: string, score: number, detail: unknown) => call<{ notified: number }>('POST', `/users/${userId}/attempts`, { score, detail }),
  createChallenge: (fromUserId: string, toPhone: string, toName: string) => call<ChallengeDraft>('POST', '/challenges', { fromUserId, toPhone, toName }),
  markChallengeSent: (id: string) => call<{ ok: true }>('POST', `/challenges/${id}/sent`),
  acceptChallenge: (id: string, userId: string) => call<{ from: string | null }>('POST', `/challenges/${id}/accept`, { userId }),
  leaderboard: (scope: 'global' | 'friends', userId?: string, limit = 50) =>
    call<Board>('GET', `/leaderboard?scope=${scope}&limit=${limit}${userId ? `&userId=${encodeURIComponent(userId)}` : ''}`),
};

const MESSAGES: Record<string, string> = {
  offline: "Can't reach the server. Check your connection and try again.",
  invalid_phone: "That doesn't look like a phone number. Include the area code.",
  phone_in_use: 'That number is already linked to another account.',
  cannot_challenge_self: "That's your own number.",
  invalid_token: 'Could not register this device for notifications.',
  notifications_denied: 'Notifications are off for OneTake in Settings. Turn them on there, then try again.',
  push_unavailable: 'Push needs a development build or an EAS project id; the 9pm reminder still works on this device.',
  name_required: 'Add your name first.',
};

export const errorText = (err: unknown) => MESSAGES[err instanceof ApiError ? err.code : ''] ?? 'Something went wrong. Try again.';
