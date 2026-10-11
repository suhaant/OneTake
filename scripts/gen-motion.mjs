// Animates one of the backdrop stills with Veo (image to video): a gentle breeze, static camera.
// Usage: GEMINI_API_KEY=... node scripts/gen-motion.mjs island
// Writes assets/video/<scene>-veo.mp4; cut it into a loop with scripts/loop-clip.sh.
import { readFile, writeFile } from 'node:fs/promises';

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) throw new Error('GEMINI_API_KEY is not set');
const MODEL = process.env.MOTION_MODEL ?? 'veo-3.1-fast-generate-preview';
const scene = process.argv[2] ?? 'island';
const base = 'https://generativelanguage.googleapis.com/v1beta';

const PROMPT =
  'Animate this exact image. Locked-off static camera, no zoom, no pan. A gentle breeze: the grass blades sway softly and ripple in waves, ' +
  'tiny ripples drift slowly across the lake surface with soft glints, the clouds drift very slowly. Keep everything else unchanged. ' +
  'Subtle, calm, slow, seamless, Frutiger Aero, no people, no animals, no text, no new objects.';

/** Per-scene motion notes appended to the base prompt. */
const MOTION = {
  island:
    ' The clouds travel steadily from the left edge of the frame all the way across to the right edge over the eight seconds, ' +
    'new clouds entering from the left as others leave on the right, a continuous flow across the whole sky. ' +
    'The sun glow stays fixed. A clear steady wind combs the grass: the tall foreground blades bend and swing visibly, ' +
    'long waves roll across the whole hill, blade tips flick back and forth, dew glints as they move. The lake shimmers with ripples.',
  meadow: ' The grass blades sway gently, dew drops glint, no splashes, no falling water.',
};

const img = await readFile(`assets/art/${scene}.jpg`);
const start = await fetch(`${base}/models/${MODEL}:predictLongRunning?key=${KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    instances: [{ prompt: PROMPT + (MOTION[scene] ?? ''), image: { bytesBase64Encoded: img.toString('base64'), mimeType: 'image/jpeg' } }],
    parameters: { aspectRatio: '9:16', resolution: '720p', durationSeconds: 8 },
  }),
});
if (!start.ok) throw new Error(`start: ${start.status} ${await start.text()}`);
const { name } = await start.json();
console.log('operation', name);

let op;
for (;;) {
  await new Promise((r) => setTimeout(r, 10000));
  const res = await fetch(`${base}/${name}?key=${KEY}`);
  if (!res.ok) throw new Error(`poll: ${res.status} ${await res.text()}`);
  op = await res.json();
  if (op.done) break;
  process.stdout.write('.');
}
if (op.error) throw new Error(JSON.stringify(op.error));
const sample = op.response?.generateVideoResponse?.generatedSamples?.[0] ?? op.response?.generatedVideos?.[0];
const uri = sample?.video?.uri;
if (!uri) throw new Error(`no video in ${JSON.stringify(op).slice(0, 600)}`);
const vid = await fetch(`${uri}${uri.includes('?') ? '&' : '?'}key=${KEY}`, { headers: { 'x-goog-api-key': KEY } });
if (!vid.ok) throw new Error(`download: ${vid.status}`);
await writeFile(`assets/video/${scene}-veo.mp4`, Buffer.from(await vid.arrayBuffer()));
console.log(`\nwrote assets/video/${scene}-veo.mp4`);
