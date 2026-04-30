#!/usr/bin/env node
/**
 * One-shot ElevenLabs asset generator for Gemini Runner.
 *
 * Hits the ElevenLabs TTS, Sound Effects, and Music APIs and writes MP3s
 * into ../public/audio/{voice,sfx,music}. Run once after setting
 * ELEVENLABS_API_KEY in your shell (or .env.local).
 *
 *   ELEVENLABS_API_KEY=sk_... node scripts/generate-audio.mjs
 *
 * Re-runs are safe — existing files are skipped unless --force is passed.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_AUDIO = path.join(ROOT, 'public', 'audio');

// Pull key from env or .env.local
async function loadEnvKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  try {
    const env = await fs.readFile(path.join(ROOT, '.env.local'), 'utf8');
    const m = env.match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  } catch {}
  return null;
}

const FORCE = process.argv.includes('--force');

// A retro-radio-DJ voice. "Rachel" / "Bella" lean warm; for a male synthwave
// announcer try "Antoni" (ErXwobaYiN019PkySvjV) or "Adam" (pNInz6obpgDQGcFmaJgB).
// Override with ELEVEN_VOICE_ID if you have a cloned voice you prefer.
const VOICE_ID = process.env.ELEVEN_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Adam
const VOICE_MODEL = 'eleven_multilingual_v2';
const VOICE_SETTINGS = { stability: 0.45, similarity_boost: 0.75, style: 0.65, use_speaker_boost: true };

const MUSIC_MODEL = 'music_v1';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function writeIfMissing(outPath, fetcher, label) {
  if (!FORCE && await fileExists(outPath)) {
    console.log(`  ✓ skip (exists) ${label}`);
    return;
  }
  process.stdout.write(`  → ${label} ... `);
  try {
    const buf = await fetcher();
    await fs.writeFile(outPath, buf);
    console.log(`done (${(buf.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
  }
}

async function tts(apiKey, text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: VOICE_MODEL,
      voice_settings: VOICE_SETTINGS,
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function sfx(apiKey, prompt, durationSeconds = 1.5) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: prompt,
      duration_seconds: durationSeconds,
      prompt_influence: 0.6,
    }),
  });
  if (!res.ok) throw new Error(`SFX ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function music(apiKey, prompt, lengthMs = 60000) {
  const res = await fetch('https://api.elevenlabs.io/v1/music', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      prompt,
      music_length_ms: lengthMs,
      model_id: MUSIC_MODEL,
    }),
  });
  if (!res.ok) throw new Error(`Music ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------- Asset manifests ----------

// Letters: G, E, M, I, N (I is reused).
// Each letter clip says only the letter, with a slight echo flair via the prompt.
const VOICE_LINES = [
  // Letter callouts (short, punchy, retro-DJ)
  ['voice/letter-G.mp3', 'G.'],
  ['voice/letter-E.mp3', 'E.'],
  ['voice/letter-M.mp3', 'M.'],
  ['voice/letter-I.mp3', 'I.'],
  ['voice/letter-N.mp3', 'N.'],

  // Word/level milestones — default-word stinger now spells OUTRUN. (For
  // custom 6-letter call-signs, a fresh per-word stinger is generated at
  // runtime via the live TTS pipeline.)
  ['voice/word-complete.mp3', 'O. U. T. R. U. N. The signal locks in.'],
  ['voice/level-2.mp3', 'Sector two. Throttle up, pilot.'],
  ['voice/level-3.mp3', 'Final sector. The cosmos is listening.'],

  // Combat / state
  ['voice/damage.mp3', 'Hull integrity falling.'],
  ['voice/last-life.mp3', 'Last life, pilot. Make it count.'],
  ['voice/game-over.mp3', 'Run terminated. The cosmos resets.'],
  ['voice/victory.mp3', 'You have spoken the name. The universe answers.'],

  // Shop
  ['voice/shop-welcome.mp3', "Welcome to the cyber shop, runner. What'll it be?"],

  // Intro
  ['voice/menu-intro.mp3', 'Pilot. Speak your call sign. Then run.'],
  ['voice/run-start.mp3', 'Initializing run. Stay sharp.'],

  // Ability
  ['voice/immortal.mp3', 'Shield online. Five seconds.'],
];

const SFX_LINES = [
  ['sfx/gem.mp3',         'short bright synthwave coin pickup chime, 80s arcade, crisp', 0.6],
  ['sfx/letter.mp3',      'magical retro synth arpeggio, ascending, neon shimmer, short', 1.2],
  ['sfx/jump.mp3',        'short retro synth whoosh, ascending pitch, 80s sci-fi', 0.5],
  ['sfx/double-jump.mp3', 'higher pitched retro synth whoosh with sparkle, 80s sci-fi', 0.6],
  ['sfx/damage.mp3',      'distorted synth zap with low rumble, retro arcade hit', 0.8],
  ['sfx/immortality.mp3', 'epic synth shield activation, charging energy, neon', 1.4],
  ['sfx/shop-portal.mp3', 'shimmering neon portal pulse, sci-fi door, retro synth', 1.6],
  ['sfx/game-over.mp3',   'descending synth fail tone, retro arcade game over, melancholic', 2.0],
  ['sfx/victory.mp3',     'triumphant 80s synthwave fanfare burst, neon, uplifting', 2.5],
];

// TTS-generated short vocalizations that live in /sfx/ — pulled in via
// the SFX bus by Audio.ts so they layer with the damage zap and don't
// fight the narrator voice channel.
const SPOKEN_SFX = [
  ['sfx/ouch-1.mp3', 'Ow!'],
  ['sfx/ouch-2.mp3', 'Argh!'],
  ['sfx/ouch-3.mp3', 'Oof.'],
];

const MUSIC_LINES = [
  ['music/level-1.mp3', 'driving synthwave outrun track, 110 bpm, neon arpeggios, retro 80s, instrumental loop, dreamy and hopeful', 75000],
  ['music/level-2.mp3', 'darker synthwave chase track, 124 bpm, pulsing bass, neon urgency, retro 80s, instrumental loop', 75000],
  ['music/level-3.mp3', 'climactic synthwave finale, 138 bpm, soaring lead synth, cosmic retrowave, instrumental loop, triumphant', 90000],
];

// ---------- Main ----------

async function main() {
  const apiKey = await loadEnvKey();
  if (!apiKey) {
    console.error('\nELEVENLABS_API_KEY not set. Add it to gemini-runner/.env.local or export it before running.\n');
    process.exit(1);
  }

  await ensureDir(path.join(PUBLIC_AUDIO, 'voice'));
  await ensureDir(path.join(PUBLIC_AUDIO, 'sfx'));
  await ensureDir(path.join(PUBLIC_AUDIO, 'music'));

  console.log(`\n[ElevenLabs Asset Generator] Voice ID: ${VOICE_ID}\n`);

  console.log('VOICE');
  for (const [rel, text] of VOICE_LINES) {
    const out = path.join(PUBLIC_AUDIO, rel);
    await writeIfMissing(out, () => tts(apiKey, text), `${rel}  "${text.slice(0, 50)}${text.length > 50 ? '…' : ''}"`);
  }

  console.log('\nSFX');
  for (const [rel, prompt, dur] of SFX_LINES) {
    const out = path.join(PUBLIC_AUDIO, rel);
    await writeIfMissing(out, () => sfx(apiKey, prompt, dur), `${rel}  (${dur}s)`);
  }

  console.log('\nSPOKEN SFX (TTS pulled into /sfx/)');
  for (const [rel, text] of SPOKEN_SFX) {
    const out = path.join(PUBLIC_AUDIO, rel);
    await writeIfMissing(out, () => tts(apiKey, text), `${rel}  "${text}"`);
  }

  console.log('\nMUSIC (this is slower — 30–90s per track)');
  for (const [rel, prompt, ms] of MUSIC_LINES) {
    const out = path.join(PUBLIC_AUDIO, rel);
    await writeIfMissing(out, () => music(apiKey, prompt, ms), `${rel}  (${(ms / 1000).toFixed(0)}s)`);
  }

  console.log('\n✓ Asset generation complete. Files in public/audio/.');
}

main().catch(err => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
