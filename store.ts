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

  // Narrator personalization (does NOT affect in-game word — that stays GEMINI).
  callsign: string;
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

const GEMINI_TARGET = ['G', 'E', 'M', 'I', 'N', 'I'];
const MAX_LEVEL = 3;

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
  recapText: null,
  recapUrl: null,

  hasDoubleJump: false,
  hasImmortality: false,
  isImmortalityActive: false,

  setCallsign: (name: string) => {
    const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    set({ callsign: cleaned });
  },

  startGame: () => {
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
      recapText: null,
      recapUrl: null,
    });
    audio.preloadAll();
    const cs = get().callsign;
    if (cs && isLiveTtsAvailable()) {
      speakLive(composeGreeting(cs), 'run-start');
    } else {
      speak('run-start');
    }
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
    const { collectedLetters, level, speed } = get();

    if (!collectedLetters.includes(index)) {
      const newLetters = [...collectedLetters, index];
      const speedIncrease = RUN_SPEED_BASE * 0.10;
      const nextSpeed = speed + speedIncrease;

      set({
        collectedLetters: newLetters,
        speed: nextSpeed
      });

      // Voice: DJ calls out the letter from the GEMINI word.
      speak(letterVoiceId(index));

      if (newLetters.length === GEMINI_TARGET.length) {
        if (level < MAX_LEVEL) {
            speakDelayed('word-complete', 600);
            const nextLevel = level + 1;
            speakDelayed(nextLevel === 2 ? 'level-2' : 'level-3', 4500);
            get().advanceLevel();
        } else {
            set({
                status: GameStatus.VICTORY,
                score: get().score + 5000
            });
            speakDelayed('word-complete', 400);
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
