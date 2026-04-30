/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Sector configs — drive the per-level theme (Environment colors + fog),
// gameplay flags (reverse spawn, obstacle density), and HUD label.

export interface SectorColors {
  bg: string;
  fog: string;
  ambient: string;
  directional: string;
  point: string;
  sunTop: string;
  sunBottom: string;
  grid: string;
  lane: string;
  laneFloor: string;
}

export interface SectorConfig {
  level: number;
  name: string;             // shown in HUD
  reverseSpawn: boolean;    // spawn letters from highest -> lowest index
  obstacleDensity: number;  // 1.0 = standard
  fogNear: number;          // fog start distance
  fogFar: number;           // fog end distance
  starOpacity: number;      // 0..1
  colors: SectorColors;
}

// --- Color palettes ---

const SYNTHWAVE: SectorColors = {
  bg: '#050011',
  fog: '#050011',
  ambient: '#400080',
  directional: '#00ffff',
  point: '#ff00aa',
  sunTop: '#ffe600',
  sunBottom: '#ff0077',
  grid: '#8800ff',
  lane: '#00ffff',
  laneFloor: '#1a0b2e',
};

const STORM: SectorColors = {
  bg: '#1a0008',
  fog: '#3a0005',
  ambient: '#660011',
  directional: '#ff3344',
  point: '#ffaa00',
  sunTop: '#ff5511',
  sunBottom: '#aa0022',
  grid: '#ff2244',
  lane: '#ff5577',
  laneFloor: '#220004',
};

const VOID: SectorColors = {
  bg: '#000000',
  fog: '#080808',
  ambient: '#222222',
  directional: '#dddddd',
  point: '#bbbbbb',
  sunTop: '#888888',
  sunBottom: '#222222',
  grid: '#444444',
  lane: '#aaaaaa',
  laneFloor: '#0a0a0a',
};

const REVERSE: SectorColors = {
  bg: '#020014',
  fog: '#0a0030',
  ambient: '#220044',
  directional: '#ffaaff',
  point: '#88ffff',
  sunTop: '#ffff77',
  sunBottom: '#ff44aa',
  grid: '#ff77ff',
  lane: '#ffaaff',
  laneFloor: '#1a0033',
};

// --- The sectors ---

export const SECTORS: SectorConfig[] = [
  // 1 — original synthwave opening
  { level: 1, name: 'AWAKEN',  reverseSpawn: false, obstacleDensity: 1.0, fogNear: 40, fogFar: 160, starOpacity: 0.8, colors: SYNTHWAVE },
  // 2 — same palette, aliens enter
  { level: 2, name: 'CHASE',   reverseSpawn: false, obstacleDensity: 1.0, fogNear: 40, fogFar: 160, starOpacity: 0.8, colors: SYNTHWAVE },
  // 3 — original climax
  { level: 3, name: 'SIGNAL',  reverseSpawn: false, obstacleDensity: 1.1, fogNear: 40, fogFar: 160, starOpacity: 0.8, colors: SYNTHWAVE },
  // 4 — STORM: red palette, thick fog, denser obstacles
  { level: 4, name: 'STORM',   reverseSpawn: false, obstacleDensity: 1.5, fogNear: 25, fogFar: 90,  starOpacity: 0.4, colors: STORM },
  // 5 — VOID: black/white, sparse stars, far visibility, sparse obstacles
  { level: 5, name: 'VOID',    reverseSpawn: false, obstacleDensity: 0.7, fogNear: 60, fogFar: 220, starOpacity: 0.3, colors: VOID },
  // 6 — REVERSE: pink/cyan, spell your name BACKWARDS, dense obstacles
  { level: 6, name: 'REVERSE', reverseSpawn: true,  obstacleDensity: 1.4, fogNear: 35, fogFar: 140, starOpacity: 0.7, colors: REVERSE },
];

export const MAX_SECTOR = SECTORS.length;

export function getSector(level: number): SectorConfig {
  return SECTORS[Math.min(Math.max(level - 1, 0), SECTORS.length - 1)];
}
