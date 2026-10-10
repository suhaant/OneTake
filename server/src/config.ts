const env = process.env;

export const config = {
  port: Number(env.PORT ?? 8787),
  publicUrl: (env.PUBLIC_URL ?? `http://localhost:${env.PORT ?? 8787}`).replace(/\/$/, ''),
  photon: {
    projectId: env.PHOTON_PROJECT_ID ?? '',
    projectSecret: env.PHOTON_PROJECT_SECRET ?? '',
    webhookSecret: env.SPECTRUM_WEBHOOK_SECRET || undefined,
    api: 'https://spectrum.photon.codes',
  },
  gemini: { apiKey: env.GEMINI_API_KEY ?? '', model: env.GEMINI_MODEL ?? 'gemini-2.5-flash' },
  databaseUrl: env.DATABASE_URL ?? '',
  /** Origin of the FastAPI scoring backend (see /backend). */
  backendUrl: (env.BACKEND_URL ?? '').replace(/\/$/, ''),
  internalSecret: env.INTERNAL_SECRET ?? '',
  enableCron: env.ENABLE_CRON === '1',
  /** Hard cap on coach-initiated texts per user per day. Replies to the user's own texts do not count. */
  maxNudgesPerDay: 2,
  /** Local hour at which the streak-saver goes out. */
  streakSaverHour: 21,
};

export const photonEnabled = Boolean(config.photon.projectId && config.photon.projectSecret);
