/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Live ElevenLabs TTS for runtime-only lines:
//   - Personalized pilot greeting ("Welcome, pilot {NAME}…")
//   - End-of-run narrator recap (with actual stats)
//
// Pre-baked clips (letters, milestones, damage, etc.) live in /public/audio/
// and ship without an API key — see scripts/generate-audio.mjs.

declare const process: any;
const RAW_KEY: string | undefined = process.env.ELEVENLABS_API_KEY;
const API_KEY: string | undefined =
  typeof RAW_KEY === 'string' && RAW_KEY.length > 4 ? RAW_KEY : undefined;

const VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam — match the asset-gen default
const MODEL_ID = 'eleven_multilingual_v2';
const VOICE_SETTINGS = { stability: 0.45, similarity_boost: 0.75, style: 0.65, use_speaker_boost: true };

// In-memory cache: voiceId+text → object URL (per session).
const cache = new Map<string, string>();

export function isLiveTtsAvailable(): boolean {
  return !!API_KEY;
}

export async function generateTtsUrl(text: string, voiceId: string = VOICE_ID): Promise<string | null> {
  if (!API_KEY) return null;
  const key = `${voiceId}::${text}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: VOICE_SETTINGS,
        }),
      },
    );
    if (!res.ok) {
      console.warn('[ElevenLabs] TTS request failed:', res.status, await res.text().catch(() => ''));
      return null;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    cache.set(key, url);
    return url;
  } catch (err) {
    console.warn('[ElevenLabs] TTS network error:', err);
    return null;
  }
}

// ---------- Recap line composer ----------

export function composeRecap(opts: {
  callsign: string;
  level: number;
  gems: number;
  distance: number;
  score: number;
  victory: boolean;
}): string {
  const { callsign, level, gems, distance, score, victory } = opts;
  const name = (callsign || 'pilot').trim();
  if (victory) {
    return `Pilot ${name}. You spoke the name across three sectors, gathered ${gems} gems, ` +
           `traveled ${Math.floor(distance)} light years, and locked in ${score.toLocaleString()} points. ` +
           `The cosmos remembers your call sign.`;
  }
  return `Pilot ${name}. Run terminated at sector ${level}. ` +
         `${gems} gems collected, ${Math.floor(distance)} light years behind you, ` +
         `${score.toLocaleString()} points on the board. The cosmos waits.`;
}

export function composeGreeting(callsign: string): string {
  const name = (callsign || 'runner').trim();
  return `Welcome, pilot ${name}. Initializing run. Stay sharp.`;
}
