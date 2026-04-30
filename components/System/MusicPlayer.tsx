/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { GameStatus } from '../../types';
import { audio } from './Audio';

const TRACKS: Record<number, string> = {
  1: '/audio/music/level-1.mp3',
  2: '/audio/music/level-2.mp3',
  3: '/audio/music/level-3.mp3',
};

const FADE_DURATION_MS = 1200;

interface PlayingTrack {
  el: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  url: string;
}

export const MusicPlayer: React.FC = () => {
  const status = useStore(s => s.status);
  const level = useStore(s => s.level);
  const currentRef = useRef<PlayingTrack | null>(null);

  useEffect(() => {
    if (status === GameStatus.MENU) {
      stopCurrent();
      return;
    }
    if (status === GameStatus.GAME_OVER || status === GameStatus.VICTORY) {
      stopCurrent();
      return;
    }
    const url = TRACKS[level] || TRACKS[1];
    swapTo(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, level]);

  const stopCurrent = () => {
    const cur = currentRef.current;
    if (!cur) return;
    fadeOut(cur, FADE_DURATION_MS);
    currentRef.current = null;
  };

  const swapTo = (url: string) => {
    const cur = currentRef.current;
    if (cur && cur.url === url) return;

    if (cur) fadeOut(cur, FADE_DURATION_MS);

    const ctx = audio.getContext();
    const musicGain = audio.getMusicGain();
    if (!ctx || !musicGain) return;

    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.loop = true;
    el.preload = 'auto';
    el.src = url;
    el.volume = 1.0;
    let source: MediaElementAudioSourceNode;
    try {
      source = ctx.createMediaElementSource(el);
    } catch {
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(musicGain);

    el.play().catch(() => {});

    fadeIn(gain, FADE_DURATION_MS, ctx);

    currentRef.current = { el, source, gain, url };
  };

  return null;
};

function fadeIn(gain: GainNode, durationMs: number, ctx: AudioContext) {
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.7, t + durationMs / 1000);
}

function fadeOut(track: PlayingTrack, durationMs: number) {
  const ctx = audio.getContext();
  if (!ctx) {
    try { track.el.pause(); } catch {}
    return;
  }
  const t = ctx.currentTime;
  track.gain.gain.cancelScheduledValues(t);
  track.gain.gain.setValueAtTime(track.gain.gain.value, t);
  track.gain.gain.linearRampToValueAtTime(0, t + durationMs / 1000);
  setTimeout(() => {
    try { track.el.pause(); } catch {}
    try { track.source.disconnect(); } catch {}
    try { track.gain.disconnect(); } catch {}
  }, durationMs + 50);
}
