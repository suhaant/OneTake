import Constants from 'expo-constants';

/**
 * Where the two services live. An EXPO_PUBLIC_* variable wins; otherwise, in development,
 * they are assumed to run on the same machine as the Metro dev server (so a phone on the
 * same Wi-Fi reaches them without any .env), on their default ports.
 */
function devHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  return host && host !== 'localhost' && host !== '127.0.0.1' ? host : 'localhost';
}

function resolve(explicit: string | undefined, port: number): string {
  if (explicit) return explicit.replace(/\/$/, '');
  return `http://${devHost()}:${port}`;
}

/** FastAPI scoring backend (see /backend). */
export const BACKEND_URL = resolve(process.env.EXPO_PUBLIC_BACKEND_URL, 8000);
/** Node messaging server: accounts, friends, challenges, coach texts (see /server). */
export const API_URL = resolve(process.env.EXPO_PUBLIC_API_URL, 8787);
