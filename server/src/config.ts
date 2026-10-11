const env = process.env;

export const config = {
  port: Number(env.PORT ?? 8787),
  /** Origin challenge links are built from; only needs to be public if friends open links outside the app. */
  publicUrl: (env.PUBLIC_URL ?? `http://localhost:${env.PORT ?? 8787}`).replace(/\/$/, ''),
  gemini: { apiKey: env.GEMINI_API_KEY ?? '', model: env.GEMINI_MODEL ?? 'gemini-2.5-flash' },
  databaseUrl: env.DATABASE_URL ?? '',
  /** Origin of the FastAPI scoring backend (see /backend). */
  backendUrl: (env.BACKEND_URL ?? '').replace(/\/$/, ''),
  internalSecret: env.INTERNAL_SECRET ?? '',
  enableCron: env.ENABLE_CRON === '1',
  /** Hard cap on coach-initiated notifications per user per day. */
  maxNudgesPerDay: 2,
  /** Local hour at which the streak-saver goes out. */
  streakSaverHour: 21,
};
