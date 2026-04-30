/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { create } from 'zustand';
import { GameStatus, RUN_SPEED_BASE } from './types';
import { audio, letterVoiceId } from './components/System/Audio';
import {
  generateTtsUrl,
  composeRecap,
  composeGreeting,
  isLiveTtsAvailable,
  prefetchCallsignAudio,
  getLetterUrl,
  getWordCompleteUrl,
} from './services/elevenlabs';

interface GameState {
  status: GameStatus;
  score: number;
  lives: number;
  maxLives: number;
  speed: number;
  collectedLetters: number[];
  level: number;
  laneCount: number;
  gemsCollected: number;
  distance: number;

  // ElevenLabs / pilot identity
  callsign: string;
  wordTarget: string[]; // 6-letter word actually spelled in this run
  recapText: string | null;
  recapUrl: string | null;

  // Inventory / Abilities
  hasDoubleJump: boolean;
  hasImmortality: boolean;
  isImmortalityActive: boolean;

  // Actions
  startGame: () => void;
  restartGame: () => void;
  takeDamage: () => void;
  addScore: (amount: number) => void;
  collectGem: (value: number) => void;
  collectLetter: (index: number) => void;
  setStatus: (status: GameStatus) => void;
  setDistance: (dist: number) => void;
  setCallsign: (name: string) => void;

  // Shop / Abilities
  buyItem: (type: 'DOUBLE_JUMP' | 'MAX_LIFE' | 'HEAL' | 'IMMORTAL', cost: number) => boolean;
  advanceLevel: () => void;
  openShop: () => void;
  closeShop: () => void;
  activateImmortality: () => void;
}

const DEFAULT_WORD = ['O', 'U', 'T', 'R', 'U', 'N'];
const MIN_WORD_LENGTH = 6;
const MAX_WORD_LENGTH = 10;
import { MAX_SECTOR } from './services/sectors';
const MAX_LEVEL = MAX_SECTOR; // now 6 — see services/sectors.ts

function deriveWordTarget(callsign: string): string[] {
  // 6-10 alphanumeric characters -> use the call-sign as the word.
  // Anything else -> default OUTRUN.
  if (new RegExp(`^[A-Z0-9]{${MIN_WORD_LENGTH},${MAX_WORD_LENGTH}}$`).test(callsign)) {
    return callsign.split('');
  }
  return DEFAULT_WORD;
}

const BAKED_LETTER_VOICE: Record<string, ReturnType<typeof letterVoiceId>> = {
  G: 'letter-G', E: 'letter-E', M: 'letter-M', I: 'letter-I', N: 'letter-N',
};

function speakLetter(letter: string, fallbackIndex: number) {
  const baked = BAKED_LETTER_VOICE[letter];
  if (baked) {
    audio.playVoice(baked).catch(() => {});
    return;
  }
  const url = getLetterUrl(letter);
  if (url) {
    audio.playVoiceUrl(url).catch(() => {});
  } else {
    // Live TTS hasn't returned yet — fall back to baked clip by index.
    audio.playVoice(letterVoiceId(fallbackIndex)).catch(() => {});
  }
}

// --- Voice helpers ---
const speak = (id: Parameters<typeof audio.playVoice>[0]) => { audio.playVoice(id).catch(() => {}); };
const speakDelayed = (id: Parameters<typeof audio.playVoice>[0], ms: number) =>
  setTimeout(() => speak(id), ms);

async function speakLive(text: string, fallbackId: Parameters<typeof audio.playVoice>[0]) {
  if (!isLiveTtsAvailable()) {
    speak(fallbackId);
    return;
  }
  const url = await generateTtsUrl(text);
  if (url) {
    audio.playVoiceUrl(url).catch(() => {});
  } else {
    speak(fallbackId);
  }
}

async function generateRecapAndStore(set: any, get: any, victory: boolean) {
  const { callsign, level, gemsCollected, distance, score } = get();
  const text = composeRecap({ callsign, level, gems: gemsCollected, distance, score, victory });
  set({ recapText: text, recapUrl: null });
  if (isLiveTtsAvailable()) {
    const url = await generateTtsUrl(text);
    if (url) {
      set({ recapUrl: url });
      setTimeout(() => audio.playVoiceUrl(url).catch(() => {}), 1800);
    } else {
      speakDelayed(victory ? 'victory' : 'game-over', 200);
    }
  } else {
    speakDelayed(victory ? 'victory' : 'game-over', 200);
  }
}

export const useStore = create<GameState>((set, get) => ({
  status: GameStatus.MENU,
  score: 0,
  lives: 3,
  maxLives: 3,
  speed: 0,
  collectedLetters: [],
  level: 1,
  laneCount: 3,
  gemsCollected: 0,
  distance: 0,

  callsign: '',
  wordTarget: DEFAULT_WORD,
  recapText: null,
  recapUrl: null,

  hasDoubleJump: false,
  hasImmortality: false,
  isImmortalityActive: false,

  setCallsign: (name: string) => {
    // Uppercase alphanumeric only, capped at MAX_WORD_LENGTH (10).
    const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MAX_WORD_LENGTH);
    set({ callsign: cleaned });
  },

  startGame: () => {
    const cs = get().callsign;
    const target = deriveWordTarget(cs);
    set({
      status: GameStatus.PLAYING,
      score: 0,
      lives: 3,
      maxLives: 3,
      speed: RUN_SPEED_BASE,
      collectedLetters: [],
      level: 1,
      laneCount: 3,
      gemsCollected: 0,
      distance: 0,
      hasDoubleJump: false,
      hasImmortality: false,
      isImmortalityActive: false,
      wordTarget: target,
      recapText: null,
      recapUrl: null,
    });
    audio.preloadAll();
    // Always prefetch — the default word (OUTRUN) has letters (O/U/T/R) that
    // aren't baked, plus the word-complete stinger needs to spell OUTRUN, not GEMINI.
    prefetchCallsignAudio(target).catch(() => {});
    // Give the music ~700ms to fade in before the narrator speaks, so the bed
    // is audible from the very first beat of the run instead of starting after.
    setTimeout(() => {
      if (cs && isLiveTtsAvailable()) {
        speakLive(composeGreeting(cs), 'run-start');
      } else {
        speak('run-start');
      }
    }, 700);
  },

  restartGame: () => {
    get().startGame();
  },

  takeDamage: () => {
    const { lives, isImmortalityActive } = get();
    if (isImmortalityActive) return;

    if (lives > 1) {
      const next = lives - 1;
      set({ lives: next });
      speak(next === 1 ? 'last-life' : 'damage');
    } else {
      set({ lives: 0, status: GameStatus.GAME_OVER, speed: 0 });
      generateRecapAndStore(set, get, false);
    }
  },

  addScore: (amount) => set((state) => ({ score: state.score + amount })),

  collectGem: (value) => set((state) => ({
    score: state.score + value,
    gemsCollected: state.gemsCollected + 1
  })),

  setDistance: (dist) => set({ distance: dist }),

  collectLetter: (index) => {
    const { collectedLetters, level, speed, wordTarget } = get();

    if (!collectedLetters.includes(index)) {
      const newLetters = [...collectedLetters, index];
      const speedIncrease = RUN_SPEED_BASE * 0.10;
      const nextSpeed = speed + speedIncrease;

      set({
        collectedLetters: newLetters,
        speed: nextSpeed
      });

      // Voice: DJ calls out the actual letter from the player's word.
      const letter = wordTarget[index];
      if (letter) speakLetter(letter, index);

      if (newLetters.length === wordTarget.length) {
        const customWordUrl = getWordCompleteUrl(wordTarget);
        const playWordComplete = () => {
          if (customWordUrl) {
            audio.playVoiceUrl(customWordUrl).catch(() => {});
          } else {
            audio.playVoice('word-complete').catch(() => {});
          }
        };

        if (level < MAX_LEVEL) {
            setTimeout(playWordComplete, 600);
            const nextLevel = level + 1;
            // Per-sector callout: level-2 / level-3 are baked, 4-6 are new entries
            // (run npm run generate-audio to populate them; otherwise silent fallback).
            const callout = (`level-${nextLevel}` as Parameters<typeof audio.playVoice>[0]);
            speakDelayed(callout, 4500);
            get().advanceLevel();
        } else {
            set({
                status: GameStatus.VICTORY,
                score: get().score + 5000
            });
            setTimeout(playWordComplete, 400);
            generateRecapAndStore(set, get, true);
        }
      }
    }
  },

  advanceLevel: () => {
      const { level, laneCount, speed } = get();
      const nextLevel = level + 1;
      const speedIncrease = RUN_SPEED_BASE * 0.40;
      const newSpeed = speed + speedIncrease;

      set({
          level: nextLevel,
          laneCount: Math.min(laneCount + 2, 9),
          status: GameStatus.PLAYING,
          speed: newSpeed,
          collectedLetters: []
      });
  },

  openShop: () => {
    set({ status: GameStatus.SHOP });
    speak('shop-welcome');
  },

  closeShop: () => set({ status: GameStatus.PLAYING }),

  buyItem: (type, cost) => {
      const { score, maxLives, lives } = get();

      if (score >= cost) {
          set({ score: score - cost });

          switch (type) {
              case 'DOUBLE_JUMP':
                  set({ hasDoubleJump: true });
                  break;
              case 'MAX_LIFE':
                  set({ maxLives: maxLives + 1, lives: lives + 1 });
                  break;
              case 'HEAL':
                  set({ lives: Math.min(lives + 1, maxLives) });
                  break;
              case 'IMMORTAL':
                  set({ hasImmortality: true });
                  break;
          }
          return true;
      }
      return false;
  },

  activateImmortality: () => {
      const { hasImmortality, isImmortalityActive } = get();
      if (hasImmortality && !isImmortalityActive) {
          set({ isImmortalityActive: true });
          audio.playSfx('immortality');
          speak('immortal');

          setTimeout(() => {
              set({ isImmortalityActive: false });
          }, 5000);
      }
  },

  setStatus: (status) => set({ status }),
}));
