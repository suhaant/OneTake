import { Spectrum, text } from 'spectrum-ts';
import { imessage } from 'spectrum-ts/providers/imessage';
import { config, photonEnabled } from './config.ts';

const connect = () =>
  Spectrum({
    projectId: config.photon.projectId,
    projectSecret: config.photon.projectSecret,
    providers: [imessage.config()],
    webhookSecret: config.photon.webhookSecret,
  });

let app: ReturnType<typeof connect> | null = null;

/** One long-lived Spectrum instance for the process. Null when Photon credentials are not set. */
export function spectrum() {
  if (!photonEnabled) return null;
  app ??= connect().catch((err) => {
    app = null;
    throw err;
  });
  return app;
}

/** Sends one iMessage from the coach. Without credentials it logs instead, so the rest of the flow can be exercised locally. */
export async function sendText(phone: string, body: string): Promise<void> {
  const instance = await spectrum();
  if (!instance) {
    console.log(`[photon dry-run] to ${phone}: ${body}`);
    return;
  }
  const space = await imessage(instance).space.create(phone);
  await space.send(text(body));
}

/**
 * Registers a phone number with the project. Free and Pro projects sit on a shared line pool,
 * which only delivers to numbers registered this way.
 */
export async function registerPhotonUser(phone: string, name: string): Promise<{ id: string }> {
  if (!photonEnabled) return { id: `dry-run-${phone}` };
  const auth = Buffer.from(`${config.photon.projectId}:${config.photon.projectSecret}`).toString('base64');
  const res = await fetch(`${config.photon.api}/projects/${config.photon.projectId}/users/`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'shared', phoneNumber: phone, firstName: name }),
  });
  const json = (await res.json().catch(() => null)) as { id?: string; data?: { id?: string } } | null;
  const id = json?.data?.id ?? json?.id;
  if (!res.ok || !id) throw new Error(`Photon create user failed (${res.status}): ${JSON.stringify(json)}`);
  return { id };
}

/** Link that opens the user's Messages app with a prefilled first text to their assigned coach number. */
export function optInLink(photonUserId: string, message: string): string | null {
  if (!photonEnabled) return null;
  return `${config.photon.api}/users/${photonUserId}/redirect?msg=${encodeURIComponent(message)}`;
}
