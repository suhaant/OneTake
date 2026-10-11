# Connecting the Expo app to the backend

The backend returns a `take` object that uses the same field names as `TakeResult` in `src/data/mock.ts`. Wiring it up mostly means replacing `mockResult` with a real API call.

## 1. Point the app at the backend

Add `EXPO_PUBLIC_API_URL` to the app's `.env`. A phone can't reach `localhost` on your laptop, so use one of these:

- **Same Wi-Fi:** start the backend with `uvicorn app.main:app --host 0.0.0.0 --port 8000` and use `http://<laptop-ip>:8000`. Find the IP with `ipconfig getifaddr en0`. Campus Wi-Fi often blocks device-to-device traffic, so if this fails, use a tunnel.
- **Tunnel (works anywhere):** run `cloudflared tunnel --url http://localhost:8000` or `ngrok http 8000` and use the `https://…` URL it prints.

## 2. API client (`src/api.ts`)

```ts
import { Platform } from 'react-native';

const API = process.env.EXPO_PUBLIC_API_URL!;

export type Moment = { t: string; title: string; body: string; good: boolean };
export type Take = {
  score: number;                       // composite, 0–100
  breakdown: { key: string; label: string; weight: number; value: number }[]; // the 5 scored metrics
  voice: number; body: number | null; content: number; // 3-bar grouping (body is null for audio-only)
  groupWeights: { voice: number; body: number; content: number };            // 0.20 / 0.55 / 0.25
  rank: number | null; total: number | null; percentile: number | null;      // among takes on the same prompt day
  delta: number | null;                // vs. this user's previous take; null on first take
  attention: number[]; attentionAvg: number | null; // 12 samples 0..1, a delivery-based estimate
  moments: Moment[];
  focusTitle: string; focusBody: string;
  also: { label: string; value: string }[];
  /** 6 subcategories; suggestion is null when score >= 80 (nothing to fix) */
  subcategories: { key: string; label: string; score: number; measured: string | null; suggestion: string | null }[]; // measured: e.g. "On the lens 59% of the time"
  fillers: { total: number; per100Words: number; found: string[] }; // e.g. ["because", "and", "right?", "… (restart)"]
  transcript: string;
};

export async function submitTake(videoUri: string, userId: string): Promise<string> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    form.append('recording', await (await fetch(videoUri)).blob(), 'take.webm');
  } else {
    const isAndroid = Platform.OS === 'android';
    form.append('recording', { uri: videoUri, name: isAndroid ? 'take.mp4' : 'take.mov', type: isAndroid ? 'video/mp4' : 'video/quicktime' } as any);
  }
  form.append('user_id', userId);
  const res = await fetch(`${API}/api/submissions`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
  return (await res.json()).submission_id;
}

/** Analysis takes about 1–2 minutes. Poll until the take is ready. */
export async function waitForTake(id: string, timeoutMs = 5 * 60_000): Promise<Take> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const s = await (await fetch(`${API}/api/submissions/${id}`)).json();
    if (s.status === 'completed') return s.take;
    if (s.status === 'failed') throw new Error(s.error ?? 'Analysis failed');
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Analysis timed out');
}

/** Same prompt for everyone; switches at midnight US Eastern (APP_TIMEZONE). 60 prompts, no repeats per cycle. */
export const getDailyPrompt = async () => (await (await fetch(`${API}/api/daily-prompt`)).json()) as
  { date: string; prompt: string; tip: string; takers: number; timezone: string; starts_at: string; ends_at: string };

export const getLeaderboard = async () => (await (await fetch(`${API}/api/leaderboard`)).json()).entries as
  { rank: number; user_id: string; best_score: number; average_score: number; takes: number }[];

export const getProgress = async (userId: string, bucket: 'day' | 'week' = 'day') =>
  (await fetch(`${API}/api/users/${encodeURIComponent(userId)}/progress?bucket=${bucket}`)).json();
```

## 3. Changes in the app

| File | Change |
|---|---|
| `src/store.tsx` | Change `finishAnalysis` to an async function that calls `submitTake(videoUri, userId)` and then `waitForTake(id)`, and stores the result with `setResult`. Change `result`'s type to `Take`. |
| `src/app/thinking.tsx` | Replace the 5.2-second `setTimeout` with `await finishAnalysis()`, then `router.replace('/results')`. On an error, show a retry message. Keep the rotating panda lines, since the wait is now about 1–2 minutes. |
| `src/app/results.tsx` | The bar weights are hardcoded as 40/30/30. Either render `r.breakdown` (5 bars: label, `Math.round(weight*100)%`, value), or keep 3 bars and use `r.groupWeights` (20/55/25). `rank`, `percentile`, and `delta` can be `null`, so hide those parts of the header when they are. If `attention` is empty (audio-only), hide the curve. |
| `todaysPrompt` (mock.ts) | Replace with `getDailyPrompt()` and use `prompt`, `tip`, and `takers` (`takers` counts today's uploads). Fetch it on the home and prompt screens, and fetch it again right before recording in case the day changed (`ends_at` says when). |
| `src/app/(tabs)/ranks.tsx` | Use `getLeaderboard()` instead of mock data. There are no names or avatars yet, so show `user_id` and use its initials. |
| `src/app/(tabs)/you.tsx` and `streak.tsx` | Past scores come from `getProgress(userId).history`. |
| User ID | There's no login yet. Generate an ID once (e.g. `crypto.randomUUID()`), save it on the device with `expo-secure-store` (install it with `npx expo install expo-secure-store`), and send it with every take. |

## Notes
- **Prompt:** the server assigns today's prompt to every upload and ignores any `prompt` the app sends, so everyone answers the same one. It switches at midnight US Eastern, and "today" for rank and percentile uses the same clock.
- **Rankings:** `rank`, `total`, and `percentile` count all users' video takes for the same prompt day, so `total` is small until real users show up.
- **Moments:** these come from Gemini, so timestamps are approximate (about ±1 s).
