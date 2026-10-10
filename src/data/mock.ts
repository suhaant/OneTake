export type Moment = { t: string; title: string; body: string; good: boolean };

export type TakeResult = {
  score: number;
  voice: number;
  body: number;
  content: number;
  percentile: number;
  rank: number;
  total: number;
  delta: number;
  attentionAvg: number;
  /** 0..1 samples across the 30 seconds */
  attention: number[];
  moments: Moment[];
  focusTitle: string;
  focusBody: string;
  also: { label: string; value: string }[];
  /** backend submission this result came from; absent for the sample result */
  submissionId?: string;
  /** Detailed numbers behind the score (backend v2.1); absent on older results. */
  details?: TakeDetails;
  /** Concrete rewrites and delivery changes for next time, most valuable first. */
  suggestions?: string[];
};

export type PaceBand = 'slow' | 'a bit slow' | 'on target' | 'a bit fast' | 'fast';

export type TakeDetails = {
  words: number;
  /** seconds */
  duration: number;
  pace: { wpm: number; band: PaceBand };
  fillers: {
    total: number;
    per100: number;
    /** um/uh style fillers by word, most frequent first */
    byWord: { word: string; count: number }[];
    /** contextual fillers Gemini counted ("like", "you know", restarts) */
    examples: string[];
  };
  vocabulary: { level: 'basic' | 'everyday' | 'varied' | 'precise'; score: number; strongWords: string[]; weakWords: string[] };
  /** 0..100 overall, 1..5 for each part */
  structure: { score: number; opening: number; support: number; closing: number };
  /** 0..100 each; absent for audio-only takes */
  delivery?: { eyeContact: number; posture: number; gestures: number };
};

export const todaysPrompt = {
  text: 'Convince a stranger to try your favorite food.',
  tip: 'Open with the taste, not the name.',
  takers: 12408,
  day: 5,
  week: 1,
};

export const mockResult: TakeResult = {
  score: 78,
  voice: 82,
  body: 68,
  content: 83,
  percentile: 14,
  rank: 1712,
  total: 12408,
  delta: 6,
  attentionAvg: 71,
  attention: [0.82, 0.9, 0.86, 0.8, 0.72, 0.62, 0.55, 0.48, 0.6, 0.78, 0.84, 0.86],
  moments: [
    { t: '0:00', title: 'Strong hook.', body: 'You opened with the taste, not the name. Attention peaked here.', good: true },
    { t: '0:14', title: 'Looked down for 8 s.', body: 'Eye contact dropped to 54% overall, mostly here.', good: false },
    { t: '0:18', title: 'Pace jumped to 181 wpm', body: 'and four of your seven "um"s landed in this stretch.', good: false },
    { t: '0:26', title: 'Clean close.', body: 'Pitch range 3.1 semitones, you landed the ask.', good: true },
  ],
  focusTitle: 'Trade the "um" for a pause.',
  focusBody:
    '7 fillers in 135 words is 5.2 per 100; fluent speakers sit near 1–2. A half-second of silence reads as confidence, and it fixes your pace at the same time.',
  also: [
    { label: 'Also: eye contact', value: '54% → aim for 80%' },
    { label: 'Also: pace', value: '181 wpm → ~160' },
  ],
  details: {
    words: 135,
    duration: 30,
    pace: { wpm: 181, band: 'a bit fast' },
    fillers: { total: 7, per100: 5.2, byWord: [{ word: 'um', count: 5 }, { word: 'uh', count: 2 }], examples: ['like', 'you know'] },
    vocabulary: { level: 'varied', score: 75, strongWords: ['crackle', 'smoky', 'tangy'], weakWords: ['really good', 'stuff'] },
    structure: { score: 75, opening: 5, support: 3, closing: 4 },
    delivery: { eyeContact: 54, posture: 75, gestures: 70 },
  },
  suggestions: [
    'Replace "it\'s really good" with "the crust crackles and the inside stays smoky".',
    'Swap each "um" for a half-second pause; you had five in the middle stretch.',
    'Keep your eyes on the lens from 0:14 to 0:22 instead of checking the screen.',
  ],
};

export const pastTakes = [
  { label: 'Wed', score: 71 },
  { label: 'Thu', score: 72 },
];

export const leaderboard = [
  { rank: 1, initials: 'JR', name: 'Jordan R.', score: 97, sub: '', colors: ['#5BD2FF', '#1273B5'] },
  { rank: 2, initials: 'MK', name: 'Maya K.', score: 94, sub: '', colors: ['#B388FF', '#7E57C2'] },
  { rank: 3, initials: 'AP', name: 'Arjun P.', score: 93, sub: '', colors: ['#8FE34A', '#3E9A0A'] },
  { rank: 4, initials: 'SL', name: 'Sofia L.', score: 91, sub: '12-day streak', colors: ['#FFB74D', '#E8731A'] },
  { rank: 5, initials: 'DN', name: 'Dev N.', score: 90, sub: '3-day streak', colors: ['#80DEEA', '#0097A7'] },
  { rank: 6, initials: 'EW', name: 'Elena W.', score: 89, sub: '21-day streak', colors: ['#F48FB1', '#C2185B'] },
  { rank: 7, initials: 'TB', name: 'Theo B.', score: 88, sub: 'first take', colors: ['#A5D6A7', '#388E3C'] },
  { rank: 8, initials: 'PO', name: 'Priya O.', score: 88, sub: '8-day streak', colors: ['#90CAF9', '#1565C0'] },
  { rank: 9, initials: 'LM', name: 'Liam M.', score: 87, sub: '5-day streak', colors: ['#CE93D8', '#7B1FA2'] },
  { rank: 10, initials: 'HC', name: 'Hana C.', score: 86, sub: '2-day streak', colors: ['#FFCC80', '#EF6C00'] },
];
