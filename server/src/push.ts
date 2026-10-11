/**
 * Push notifications through Expo's push service. The app registers its Expo push token
 * (`POST /users/:id/push-token`); nothing here needs a public URL or an APNs/FCM key.
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type PushMessage = { title: string; body: string; data?: Record<string, unknown> };

export type PushResult = { ok: true } | { ok: false; error: string; unregistered: boolean };

export const isExpoPushToken = (token: string) => /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token);

/** Sends one notification. `unregistered` means the token is dead and should be dropped. */
export async function sendPush(token: string, message: PushMessage): Promise<PushResult> {
  if (!isExpoPushToken(token)) return { ok: false, error: 'invalid_token', unregistered: true };
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: token, sound: 'default', title: message.title, body: message.body, data: message.data ?? {} }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => null)) as { data?: { status: string; message?: string; details?: { error?: string } }; errors?: { message: string }[] } | null;
  if (!res.ok || !json?.data) return { ok: false, error: json?.errors?.[0]?.message ?? `http_${res.status}`, unregistered: false };
  if (json.data.status === 'ok') return { ok: true };
  const code = json.data.details?.error ?? json.data.message ?? 'unknown';
  return { ok: false, error: code, unregistered: code === 'DeviceNotRegistered' };
}
