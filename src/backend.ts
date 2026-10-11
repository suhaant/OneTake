/** Client for the FastAPI scoring backend (see /backend). Set EXPO_PUBLIC_BACKEND_URL to its origin. */
import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import type { Moment, PaceBand, TakeDetails, TakeResult } from './data/mock';
import { BACKEND_URL as BASE } from './config';

const POLL_MS = 2000;
const TIMEOUT_MS = 150_000;

/** The backend could not be reached at all (not running, wrong host). Scoring errors are plain Errors. */
export class BackendUnreachable extends Error {}

type Submission = {
  submission_id: string;
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
  /** v2.1 */
  breakdown?: {
    words: number;
    duration_seconds: number;
    pace: { wpm: number; band: PaceBand };
    fillers: { total: number; verbal: number; contextual: number; per_100_words: number; by_word: Record<string, number>; examples: string[] };
    vocabulary: { rating: number; score: number; level: TakeDetails['vocabulary']['level']; strong_words: string[]; weak_words: string[] };
    structure: { rating: number; score: number; opening: number; support: number; closing: number };
    delivery?: { eye_contact: number; posture: number; body_language: number };
  };
  suggestions?: string[];
};

function toDetails(b: NonNullable<Submission['breakdown']>): TakeDetails {
  return {
    words: b.words,
    duration: b.duration_seconds,
    pace: { wpm: Math.round(b.pace.wpm), band: b.pace.band },
    fillers: {
      total: b.fillers.total,
      per100: Math.round(b.fillers.per_100_words * 10) / 10,
      byWord: Object.entries(b.fillers.by_word ?? {}).map(([word, count]) => ({ word, count })),
      examples: b.fillers.examples ?? [],
    },
    vocabulary: { level: b.vocabulary.level, score: Math.round(b.vocabulary.score), strongWords: b.vocabulary.strong_words ?? [], weakWords: b.vocabulary.weak_words ?? [] },
    structure: { score: Math.round(b.structure.score), opening: b.structure.opening, support: b.structure.support, closing: b.structure.closing },
    delivery: b.delivery ? { eyeContact: Math.round(b.delivery.eye_contact), posture: Math.round(b.delivery.posture), gestures: Math.round(b.delivery.body_language) } : undefined,
  };
}

/** One scored take. The per-metric columns are null for audio-only takes and absent from older rows. */
export type HistoryRow = {
  submission_id: string;
  time: string;
  overall: number;
  eye_contact?: number | null;
  posture?: number | null;
  body_language?: number | null;
  fillers?: number | null;
  language?: number | null;
};

async function getJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`);
  } catch {
    throw new BackendUnreachable(`Cannot reach ${BASE}`);
  }
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchDailyPrompt(): Promise<string | null> {
  try {
    return (await getJson<{ prompt: string }>('/api/daily-prompt')).prompt;
  } catch {
    return null;
  }
}

/** The user's scored takes in the last `days`, oldest first. Empty when the backend is down. */
export async function fetchHistory(userId: string, days = 30): Promise<HistoryRow[]> {
  try {
    return (await getJson<{ history: HistoryRow[] }>(`/api/users/${encodeURIComponent(userId)}/progress?days=${days}`)).history;
  } catch {
    return [];
  }
}

async function recordingPart(uri: string): Promise<{ part: Blob; name: string }> {
  if (Platform.OS === 'web') return { part: await (await fetch(uri)).blob(), name: 'take.webm' };
  // Expo's fetch rejects React Native's { uri, name, type } descriptor ("Unsupported FormDataPart
  // implementation"); it wants a Blob or an expo-file-system File, which it reads with bytes().
  // The File's own name keeps the recording's extension, which is what the backend checks.
  const file = new File(uri);
  return { part: file as unknown as Blob, name: file.name };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Where this take sits among today's ranked users, and how it compares with the user's previous take. */
async function standing(userId: string | undefined, score: number) {
  const fallback = { rank: 1, total: 1, delta: 0 };
  if (!userId) return fallback;
  try {
    const [board, history] = await Promise.all([
      getJson<{ entries: { user_id: string; best_score: number }[] }>('/api/leaderboard?limit=100'),
      fetchHistory(userId),
    ]);
    const index = board.entries.findIndex((e) => e.user_id === userId);
    const rank = index >= 0 ? index + 1 : board.entries.filter((e) => e.best_score > score).length + 1;
    const previous = history.at(-2)?.overall;
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
    details: s.breakdown ? toDetails(s.breakdown) : undefined,
    suggestions: s.suggestions?.length ? s.suggestions : undefined,
  };
}

/** A take that was scored earlier (e.g. before the app restarted), in the shape the results screen draws. */
export async function fetchTakeResult(submissionId: string, userId?: string): Promise<TakeResult | null> {
  const s = await getJson<Submission>(`/api/submissions/${submissionId}`);
  if (s.status !== 'completed') return null;
  return toResult(s, await standing(userId, s.overall_score), submissionId);
}

/** Uploads the recording, waits for scoring, and returns it in the shape the results screen draws. */
export async function scoreTake(videoUri: string, prompt: string, userId?: string): Promise<TakeResult> {
  const { part, name } = await recordingPart(videoUri);
  const form = new FormData();
  form.append('recording', part, name);
  form.append('prompt', prompt);
  if (userId) form.append('user_id', userId);

  let res: Response;
  try {
    res = await fetch(`${BASE}/api/submissions`, { method: 'POST', body: form });
  } catch (err) {
    throw new BackendUnreachable(`Cannot reach ${BASE} (upload ${name}): ${err instanceof Error ? err.message : String(err)}`);
  }
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

/** Demo helper: deletes today's takes for this user on the scoring backend. */
export async function resetToday(userId: string): Promise<void> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/users/${encodeURIComponent(userId)}/today?tz=${encodeURIComponent(tz)}`, { method: 'DELETE' });
  } catch {
    throw new BackendUnreachable(`Cannot reach ${BASE}`);
  }
  if (!res.ok) throw new Error(`reset returned ${res.status}`);
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
