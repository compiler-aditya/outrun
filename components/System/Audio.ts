/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// AudioController
// ---------------
// - Web Audio synth fallbacks (ship-safe even with no ElevenLabs key).
// - File-backed SFX from public/audio/sfx/* when present.
// - Voice clip playback from public/audio/voice/* with music-ducking.
// - Music bus exposed via getMusicGain() for MusicPlayer.

type SfxId =
  | 'gem' | 'letter' | 'jump' | 'double-jump'
  | 'damage' | 'immortality' | 'shop-portal'
  | 'game-over' | 'victory'
  | 'ouch-1' | 'ouch-2' | 'ouch-3';

type VoiceId =
  | 'letter-G' | 'letter-E' | 'letter-M' | 'letter-I' | 'letter-N'
  | 'word-complete' | 'level-2' | 'level-3'
  | 'damage' | 'last-life' | 'game-over' | 'victory'
  | 'shop-welcome' | 'menu-intro' | 'run-start' | 'immortal';

const SFX_FILES: Record<SfxId, string> = {
  'gem': '/audio/sfx/gem.mp3',
  'letter': '/audio/sfx/letter.mp3',
  'jump': '/audio/sfx/jump.mp3',
  'double-jump': '/audio/sfx/double-jump.mp3',
  'damage': '/audio/sfx/damage.mp3',
  'immortality': '/audio/sfx/immortality.mp3',
  'shop-portal': '/audio/sfx/shop-portal.mp3',
  'game-over': '/audio/sfx/game-over.mp3',
  'victory': '/audio/sfx/victory.mp3',
  'ouch-1': '/audio/sfx/ouch-1.mp3',
  'ouch-2': '/audio/sfx/ouch-2.mp3',
  'ouch-3': '/audio/sfx/ouch-3.mp3',
};

const VOICE_FILES: Record<VoiceId, string> = {
  'letter-G': '/audio/voice/letter-G.mp3',
  'letter-E': '/audio/voice/letter-E.mp3',
  'letter-M': '/audio/voice/letter-M.mp3',
  'letter-I': '/audio/voice/letter-I.mp3',
  'letter-N': '/audio/voice/letter-N.mp3',
  'word-complete': '/audio/voice/word-complete.mp3',
  'level-2': '/audio/voice/level-2.mp3',
  'level-3': '/audio/voice/level-3.mp3',
  'damage': '/audio/voice/damage.mp3',
  'last-life': '/audio/voice/last-life.mp3',
  'game-over': '/audio/voice/game-over.mp3',
  'victory': '/audio/voice/victory.mp3',
  'shop-welcome': '/audio/voice/shop-welcome.mp3',
  'menu-intro': '/audio/voice/menu-intro.mp3',
  'run-start': '/audio/voice/run-start.mp3',
  'immortal': '/audio/voice/immortal.mp3',
};

const SFX_VOLUME = 0.55;
const VOICE_VOLUME = 1.0;
const MUSIC_DUCK_GAIN = 0.18;
const MUSIC_DUCK_RELEASE = 0.6;

export class AudioController {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  voiceGain: GainNode | null = null;
  musicGain: GainNode | null = null;

  private sfxBuffers = new Map<string, AudioBuffer | 'missing'>();
  private sfxLoading = new Map<string, Promise<AudioBuffer | null>>();

  private currentVoiceEl: HTMLAudioElement | null = null;
  private duckTimer: number | null = null;

  constructor() {}

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.55;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = SFX_VOLUME;
      this.sfxGain.connect(this.masterGain);

      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.value = VOICE_VOLUME;
      this.voiceGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.6;
      this.musicGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  getMusicGain(): GainNode | null {
    if (!this.ctx) this.init();
    return this.musicGain;
  }

  getContext(): AudioContext | null {
    if (!this.ctx) this.init();
    return this.ctx;
  }

  // ---------------- File-backed SFX with caching ----------------

  private async loadSfx(url: string): Promise<AudioBuffer | null> {
    if (!this.ctx) this.init();
    if (!this.ctx) return null;
    const cached = this.sfxBuffers.get(url);
    if (cached === 'missing') return null;
    if (cached) return cached;
    if (this.sfxLoading.has(url)) return this.sfxLoading.get(url)!;

    const p = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.arrayBuffer();
        const buf = await this.ctx!.decodeAudioData(arr);
        this.sfxBuffers.set(url, buf);
        return buf;
      } catch {
        this.sfxBuffers.set(url, 'missing');
        return null;
      } finally {
        this.sfxLoading.delete(url);
      }
    })();
    this.sfxLoading.set(url, p);
    return p;
  }

  private playBuffer(buf: AudioBuffer, gain = 1.0) {
    if (!this.ctx || !this.sfxGain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (gain !== 1.0) {
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g);
      g.connect(this.sfxGain);
    } else {
      src.connect(this.sfxGain);
    }
    src.start();
  }

  async playSfx(id: SfxId, fallback?: () => void) {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const url = SFX_FILES[id];
    const buf = await this.loadSfx(url);
    if (buf) this.playBuffer(buf);
    else if (fallback) fallback();
  }

  preloadAll() {
    if (!this.ctx) this.init();
    Object.values(SFX_FILES).forEach(url => { this.loadSfx(url); });
  }

  // ---------------- Voice (HTMLAudioElement, ducks music) ----------------

  playVoice(id: VoiceId): Promise<void> {
    return new Promise((resolve) => {
      const url = VOICE_FILES[id];
      this.playVoiceUrl(url).then(resolve);
    });
  }

  playVoiceUrl(url: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.currentVoiceEl) {
        try { this.currentVoiceEl.pause(); } catch {}
        this.currentVoiceEl = null;
      }

      const el = new Audio();
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      el.src = url;
      el.volume = VOICE_VOLUME;
      this.currentVoiceEl = el;

      this.duckMusic(true);

      const finish = () => {
        if (this.currentVoiceEl === el) this.currentVoiceEl = null;
        this.duckMusic(false);
        resolve();
      };
      el.addEventListener('ended', finish, { once: true });
      el.addEventListener('error', finish, { once: true });

      el.play().catch(() => finish());
    });
  }

  private duckMusic(down: boolean) {
    if (!this.musicGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.duckTimer) {
      window.clearTimeout(this.duckTimer);
      this.duckTimer = null;
    }
    const g = this.musicGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    if (down) {
      g.linearRampToValueAtTime(MUSIC_DUCK_GAIN, t + 0.15);
    } else {
      this.duckTimer = window.setTimeout(() => {
        if (!this.musicGain || !this.ctx) return;
        const t2 = this.ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(t2);
        this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t2);
        this.musicGain.gain.linearRampToValueAtTime(0.6, t2 + MUSIC_DUCK_RELEASE);
      }, 120);
    }
  }

  // ---------------- Original synth SFX (kept as fallback) ----------------

  playGemCollect = () => this.playSfx('gem', () => this.synthGemCollect());
  playLetterCollect = () => this.playSfx('letter', () => this.synthLetterCollect());
  playJump = (isDouble = false) =>
    this.playSfx(isDouble ? 'double-jump' : 'jump', () => this.synthJump(isDouble));
  playDamage = () => this.playSfx('damage', () => this.synthDamage());

  /**
   * Vocal yelp on damage — plays one of three TTS-generated "Ow!"/"Argh!"/"Oof."
   * variations for variety. Falls back to a synthesized vowel yelp (sawtooth +
   * bandpass + vibrato) if the files haven't been generated yet, so this works
   * immediately even before npm run generate-audio.
   */
  playOuch = () => {
    const i = Math.floor(Math.random() * 3) + 1;
    const id = (i === 1 ? 'ouch-1' : i === 2 ? 'ouch-2' : 'ouch-3') as SfxId;
    return this.playSfx(id, () => this.synthYelp());
  };

  private synthGemCollect() {
    if (!this.ctx || !this.sfxGain) this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(2000, t + 0.1);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.15);
  }

  private synthLetterCollect() {
    if (!this.ctx || !this.sfxGain) this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const start = t + i * 0.04;
      const dur = 0.3;
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + dur);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(start); osc.stop(start + dur);
    });
  }

  private synthJump(isDouble: boolean) {
    if (!this.ctx || !this.sfxGain) this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const startFreq = isDouble ? 400 : 200;
    const endFreq = isDouble ? 800 : 450;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.15);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.15);
  }

  private synthDamage() {
    if (!this.ctx || !this.sfxGain) this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.3);
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.connect(oscGain); oscGain.connect(this.sfxGain);
    noise.connect(noiseGain); noiseGain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.3);
    noise.start(t); noise.stop(t + 0.3);
  }

  // Vocal "ow!" yelp — sawtooth carrier shaped by a bandpass filter to mimic
  // a vowel formant, vibrato on the pitch for character, swooping pitch contour.
  // Randomized parameters so consecutive yelps aren't identical.
  private synthYelp() {
    if (!this.ctx || !this.sfxGain) this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();

    // Two-stage pitch contour: brief "OH" attack with a quick rise, then
    // long descending "ow" body. Sounds more like a real yelp than a single
    // glide.
    osc.type = 'sawtooth';
    const startFreq = 360 + Math.random() * 120;
    const peakFreq = startFreq * 1.15;
    const endFreq = 150 + Math.random() * 50;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.linearRampToValueAtTime(peakFreq, t + 0.04);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.40);

    // Vibrato modulates the carrier pitch for vocal character
    vibrato.frequency.value = 6 + Math.random() * 4;
    vibratoGain.gain.value = 18 + Math.random() * 10;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);

    // Bandpass shapes the buzz into a vowel-like "ow"
    filter.type = 'bandpass';
    filter.frequency.value = 750 + Math.random() * 350;
    filter.Q.value = 3.5;

    // Louder, longer envelope so it cuts cleanly through the damage zap.
    // 1.0 peak compounds through sfxGain (0.55) × master (0.55) ≈ 0.30 final,
    // which is twice as loud as the previous 0.55 peak.
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1.0, t + 0.025);
    gain.gain.linearRampToValueAtTime(0.7, t + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.55);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t); vibrato.start(t);
    osc.stop(t + 0.6); vibrato.stop(t + 0.6);
  }
}

export const audio = new AudioController();

// Helper: map a GEMINI letter index (0..5) to its voice clip id.
export function letterVoiceId(targetIndex: number): VoiceId {
  switch (targetIndex) {
    case 0: return 'letter-G';
    case 1: return 'letter-E';
    case 2: return 'letter-M';
    case 3: return 'letter-I';
    case 4: return 'letter-N';
    case 5: return 'letter-I';
    default: return 'letter-G';
  }
}
