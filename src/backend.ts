/** Client for the FastAPI scoring backend (see /backend). Set EXPO_PUBLIC_BACKEND_URL to its origin. */
import { Platform } from 'react-native';
import type { Moment, TakeResult } from './data/mock';

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');

/** Without a backend URL the app stays on the built-in sample result. */
export const backendEnabled = Boolean(BASE);

const POLL_MS = 2000;
const TIMEOUT_MS = 150_000;

type Submission = {
  status: 'processing' | 'completed' | 'failed';
  error?: string;
  overall_score: number;
  categories: { body?: number; speech?: number };
  metrics: { eye_contact?: number; posture?: number; body_language?: number; fillers: number; language: number };
  audio: { wpm: number; fillers: number; fillers_per_100_words: number; word_count: number };
  feedback: {
    strength: string;
    improvement: string;
    next_exercise: string;
    content_notes?: { strengths: string[]; weaknesses: string[] };
    delivery_notes?: { strengths: string[]; improvements: string[] };
  };
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchDailyPrompt(): Promise<string | null> {
  if (!backendEnabled) return null;
  try {
    return (await getJson<{ prompt: string }>('/api/daily-prompt')).prompt;
  } catch {
    return null;
  }
}

async function recordingPart(uri: string): Promise<{ part: Blob; name: string }> {
  if (Platform.OS === 'web') return { part: await (await fetch(uri)).blob(), name: 'take.webm' };
  const ext = /\.(mov|mp4|webm)$/i.exec(uri)?.[1].toLowerCase() ?? 'mp4';
  const type = ext === 'mov' ? 'video/quicktime' : `video/${ext}`;
  // React Native's FormData takes a file descriptor in place of a Blob.
  return { part: { uri, name: `take.${ext}`, type } as unknown as Blob, name: `take.${ext}` };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Where this take sits among today's ranked users, and how it compares with the user's previous take. */
async function standing(userId: string | undefined, score: number) {
  const fallback = { rank: 1, total: 1, delta: 0 };
  if (!userId) return fallback;
  try {
    const [board, progress] = await Promise.all([
      getJson<{ entries: { user_id: string; best_score: number }[] }>('/api/leaderboard?limit=100'),
      getJson<{ history: { overall: number }[] }>(`/api/users/${encodeURIComponent(userId)}/progress?days=30`),
    ]);
    const index = board.entries.findIndex((e) => e.user_id === userId);
    const rank = index >= 0 ? index + 1 : board.entries.filter((e) => e.best_score > score).length + 1;
    const previous = progress.history.at(-2)?.overall;
    return { rank, total: Math.max(board.entries.length, rank), delta: previous == null ? 0 : Math.round(score - previous) };
  } catch {
    return fallback;
  }
}

function toResult(s: Submission, place: { rank: number; total: number; delta: number }, submissionId: string): TakeResult {
  const good = [...(s.feedback.content_notes?.strengths ?? [s.feedback.strength]), ...(s.feedback.delivery_notes?.strengths ?? [])];
  const bad = [...(s.feedback.delivery_notes?.improvements ?? []), ...(s.feedback.content_notes?.weaknesses ?? [s.feedback.improvement])];
  const moments: Moment[] = [
    ...good.slice(0, 2).map((body) => ({ t: 'Good', title: '', body, good: true })),
    ...bad.slice(0, 2).map((body) => ({ t: 'Fix', title: '', body, good: false })),
  ];
  const also = [
    { label: 'Pace', value: `${Math.round(s.audio.wpm)} wpm` },
    { label: 'Fillers', value: `${s.audio.fillers} in ${s.audio.word_count} words` },
  ];
  if (s.metrics.eye_contact != null) also.push({ label: 'Eye contact', value: `${Math.round(s.metrics.eye_contact)} / 100` });

  return {
    score: Math.round(s.overall_score),
    voice: Math.round(s.metrics.fillers),
    body: Math.round(s.categories.body ?? 0),
    content: Math.round(s.metrics.language),
    percentile: Math.max(1, Math.round((place.rank / place.total) * 100)),
    rank: place.rank,
    total: place.total,
    delta: place.delta,
    // The backend does not predict attention yet; the results screen hides the curve when this is empty.
    attentionAvg: 0,
    attention: [],
    moments,
    focusTitle: bad[0] ?? s.feedback.improvement,
    focusBody: s.feedback.next_exercise,
    also,
    submissionId,
  };
}

/** Uploads the recording, waits for scoring, and returns it in the shape the results screen draws. */
export async function scoreTake(videoUri: string, prompt: string, userId?: string): Promise<TakeResult> {
  const { part, name } = await recordingPart(videoUri);
  const form = new FormData();
  form.append('recording', part, name);
  form.append('prompt', prompt);
  if (userId) form.append('user_id', userId);

  const res = await fetch(`${BASE}/api/submissions`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const { submission_id } = (await res.json()) as { submission_id: string };

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    const s = await getJson<Submission>(`/api/submissions/${submission_id}`);
    if (s.status === 'failed') throw new Error(s.error ?? 'Scoring failed');
    if (s.status === 'completed') return toResult(s, await standing(userId, s.overall_score), submission_id);
  }
  throw new Error('Scoring is taking too long');
}

/** Rank of one value against the neuro calibration texts (see /neuro/ANALYSIS.md). */
export type NeuroRank = { value: number; percentile: number; beats_flat_texts: number; beats_vivid_texts: number; band?: string };

/** Predicted brain response for a take (TRIBE v2). Display-only; it is not part of the score. */
export type Neuro = {
  status: 'processing' | 'completed' | 'unavailable' | 'disabled';
  reason?: string;
  ranking?: {
    raw_score: NeuroRank;
    vividness_score: NeuroRank;
    networks: Record<string, NeuroRank>;
    most_activated_regions: { region: string; role: string; activation: number }[];
    notes: string[];
  };
  peak?: { t: number; text: string };
  dip?: { t: number; text: string };
  /** predicted response per second; null where there was no prediction */
  curve?: (number | null)[];
};

const NEURO_POLL_MS = 3000;
const NEURO_TIMEOUT_MS = 240_000;

/** Waits for the brain-response prediction. Resolves with a non-completed status rather than throwing. */
export async function fetchNeuro(submissionId: string, isActive: () => boolean = () => true): Promise<Neuro> {
  const deadline = Date.now() + NEURO_TIMEOUT_MS;
  while (isActive() && Date.now() < deadline) {
    try {
      const neuro = await getJson<Neuro>(`/api/submissions/${submissionId}/neuro?brain=false`);
      if (neuro.status !== 'processing') return neuro;
    } catch {
      return { status: 'unavailable', reason: 'The backend could not be reached' };
    }
    await sleep(NEURO_POLL_MS);
  }
  return { status: 'unavailable', reason: 'The prediction is taking too long' };
}

/** Page with the 3D brain for a take; served by the backend, shown in an iframe or web view. */
export function neuroViewerUrl(submissionId: string): string {
  const result = `${BASE}/api/submissions/${submissionId}/neuro`;
  return `${BASE}/neuro/viewer/index.html?embed=1&result=${encodeURIComponent(result)}`;
}
