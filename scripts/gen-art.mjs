// Generates the Frutiger Aero backdrop stills with Gemini's image model.
// Usage: GEMINI_API_KEY=... node scripts/gen-art.mjs [scene ...]
// Writes assets/art/<scene>.png; run scripts/pack-art.sh afterwards to shrink them.
import { writeFile, mkdir } from 'node:fs/promises';

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) throw new Error('GEMINI_API_KEY is not set');
const MODEL = process.env.ART_MODEL ?? 'gemini-3.1-flash-image';

const STYLE =
  'Frutiger Aero aesthetic, 2007 glossy optimism: clean high-key lighting, soft depth of field, crisp aqua and sky blue, ' +
  'fresh lime green, translucent glass surfaces, subtle lens bokeh, gentle specular highlights. Photoreal 3D render, airy and calm. ' +
  'This is a phone app background: keep the middle of the frame quiet and low-contrast so white text and glass cards stay readable, ' +
  'put detail toward the edges and bottom, no text, no letters, no logos, no people, no animals, no UI elements, no borders, no vignette.';

const SCENES = {
  // home and the waiting screen: the island
  island:
    'Vertical 9:16 scene. Top two thirds: wide clear sky blue gradient with two or three soft white cumulus clouds near the top corners and plenty of open sky. ' +
    'Bottom third: a lush, smooth, glossy green hill rolling down to a still turquoise lake, a few dew drops on the grass at the very bottom edge, ' +
    'soft sun glow at upper left. Serene, spacious.',
  // friends, you, results
  sky:
    'Vertical 9:16 scene. Almost entirely open sky blue gradient, brighter and paler toward the bottom, a few thin wispy clouds high up, ' +
    'a faint sun flare in the upper left and tiny out-of-focus light orbs. Minimal, calm, spacious. Nothing in the center.',
  // share
  bubbles:
    'Vertical 9:16 scene. Soft sky blue gradient with four or five large translucent iridescent soap bubbles floating near the edges and corners, ' +
    'each with a thin glossy rim and a small specular highlight, out of focus ones in the distance. Center of the frame empty. Light, playful, calm.',
  // progress and leaderboard
  water:
    'Vertical 9:16 scene. Top half: pale clear sky blue fading to white. Bottom half: a calm, glassy turquoise water surface seen from low above, ' +
    'gentle light caustics and a soft horizon glow where sky meets water, one or two small ripples. Clean, cool, quiet.',
  // the prompt reel and the record screen
  meadow:
    'Vertical 9:16 scene. Clear sky blue at the top with a soft sun glow. Lower third: glossy, dewy, bright green grass blades seen close up and slightly out of focus, ' +
    'a couple of large crystal dew drops catching the light. Middle of the frame open sky. Fresh, hopeful, calm.',
};

async function gen(name, prompt) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nStyle: ${STYLE}` }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16' } },
    }),
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error(`${name}: no image in response ${JSON.stringify(json).slice(0, 400)}`);
  await writeFile(`assets/art/${name}.png`, Buffer.from(part.inlineData.data, 'base64'));
  console.log(`wrote assets/art/${name}.png (${part.inlineData.mimeType})`);
}

await mkdir('assets/art', { recursive: true });
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES);
for (const name of wanted) {
  if (!SCENES[name]) throw new Error(`unknown scene ${name}`);
  await gen(name, SCENES[name]);
}
