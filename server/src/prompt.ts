import { config } from './config.ts';
import type { Prompt } from './store/types.ts';

/** Same text the FastAPI backend falls back to, used when it cannot be reached. */
const FALLBACK = 'Explain one change that would improve your community and why.';
const TTL_MS = 5 * 60_000;

let cached: { prompt: Prompt; at: number } | null = null;

/** Today's prompt as served by the scoring backend (`GET /api/daily-prompt`), so texts quote what the app shows. */
export async function dailyPrompt(): Promise<Prompt> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.prompt;
  let prompt: Prompt = { id: new Date().toISOString().slice(0, 10), text: FALLBACK };
  if (config.backendUrl) {
    try {
      const res = await fetch(`${config.backendUrl}/api/daily-prompt`, { signal: AbortSignal.timeout(4000) });
      const json = (await res.json()) as { date?: string; prompt?: string };
      if (res.ok && json.prompt) prompt = { id: json.date ?? prompt.id, text: json.prompt };
    } catch (err) {
      console.warn('[prompt] backend unreachable, using fallback prompt:', (err as Error).message);
    }
  }
  cached = { prompt, at: Date.now() };
  return prompt;
}
