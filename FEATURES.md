# OUTRUN — Features & Build

> *"Speak the name. Run the cosmos."*

A synthwave endless runner where an AI radio DJ chants a 6-to-10-letter word as you race through three sectors. Type your own call-sign and the game spells **your** name across the lanes — letter by letter, sector by sector — voiced live by ElevenLabs. Submitted for **ElevenHacks** as a showcase of what their TTS, Sound Effects, and Music APIs can do for emotional, dynamic, in-game audio.

---

## 1. The pitch (15 seconds)

You play Rocky — a pentapodal alien creature scampering through a neon cosmos on five articulated legs. To beat each sector you have to **collect glowing letters** scattered across the lanes. As you grab each one, **a synthwave AI radio DJ calls it out by name**. Type your own 6-to-10-letter call-sign on the menu and that becomes the word — the AI literally spells *you* across three sectors.

Three sectors. Cyber shop between levels. Shield power-ups. AI-narrated recap that reads back your run with your call-sign and stats baked in. Everything you hear — every letter, every milestone, every "last life, pilot," every personalized greeting — comes from **ElevenLabs**.

---

## 2. Game features

### 2.1 The core mechanic — spell the word

- **6-10 letters** scattered along the runway, one per spawn cycle.
- Collect them in any order. Speed climbs **10% per letter** so the runway accelerates as you progress.
- Complete the word → next sector starts. New sector adds **+40% base speed** and 2 more lanes (max 9).
- Win = complete the word in **Sector 3**.
- 3 sectors × your word = a full run.

### 2.2 The player — Rocky the pentapod

- Rocky is a 5-legged alien creature with a chitinous dodecahedron body, a green "vest" shell, and a glowing amber eye.
- **Run cycle** — pentapedal gait with each leg phased 72° apart, IK-style hip + knee + foot articulation.
- **Jump arc** — first jump (200→450 Hz whoosh), double-jump unlocks a 360° flip mid-air.
- **Banking** on lane changes, **squash + stretch** on landings, **hit recoil** on damage.
- **Gold armor** during invincibility — same model, color-shifted materials.

### 2.3 The runway

- 3 → 5 → 7 lanes (sector 1 → 2 → 3), each with glowing cyan separators on a dark purple floor.
- **Synthwave moving grid** — purple wireframe sweeping toward the camera.
- **Star field** — thousands of parallaxed points across a 400×200 backdrop.
- **Retro sun** — giant gradient sphere on the horizon, yellow→pink scanlines, gently bobbing.

### 2.4 What's on the lanes

| Object | Effect |
|---|---|
| **Glowing letter** | Pickup advances your word + DJ chants the letter |
| **Cyan gem** | +50 score |
| **Gold gem on top of obstacle** | +100 score |
| **Spike obstacle** (red glow) | Lose a life |
| **Alien saucer** (sectors 2+) | Fires a missile down the lane |
| **Red missile** | Lose a life on contact |
| **Shop portal** (between sectors) | Enter the Cyber Shop |

### 2.5 The cyber shop

| Item | Cost | Effect |
|---|---|---|
| **Double Jump** | 1,000 | Mid-air re-jump (one-time unlock) |
| **Max Life Up** | 1,500 | +1 heart slot, heals you |
| **Repair Kit** | 1,000 | Restores 1 heart |
| **Immortality** | 3,000 | Unlocks Space-bar 5-second invincibility |

### 2.6 Audio — fully ElevenLabs-driven

**16 baked TTS lines** (voice "Adam", `eleven_multilingual_v2`):

| Trigger | Exact line |
|---|---|
| Menu loads | *"Pilot. Speak your call sign. Then run."* |
| Run starts | *"Initializing run. Stay sharp."* |
| Pickup G/E/M/I/N | *"G."* / *"E."* / *"M."* / *"I."* / *"N."* |
| Word complete (default) | *"O. U. T. R. U. N. The signal locks in."* |
| Sector 2 | *"Sector two. Throttle up, pilot."* |
| Sector 3 | *"Final sector. The cosmos is listening."* |
| Take damage | *"Hull integrity falling."* |
| Last life | *"Last life, pilot. Make it count."* |
| Game over | *"Run terminated. The cosmos resets."* |
| Victory | *"You have spoken the name. The universe answers."* |
| Enter shop | *"Welcome to the cyber shop, runner. What'll it be?"* |
| Shield activated | *"Shield online. Five seconds."* |

**Live TTS at runtime** (personalized to the player):

| Trigger | Format |
|---|---|
| Run starts (with call-sign) | *"Welcome, pilot {NAME}. Initializing run. Stay sharp."* |
| Pickup non-baked letter | *"{LETTER}."* (live for any letter not in G/E/M/I/N) |
| Word complete (custom) | *"A. D. I. T. Y. A. The signal locks in."* (matches the player's word) |
| Game over recap | *"Pilot {NAME}. Run terminated at sector {N}. {GEMS} gems collected, {DISTANCE} light years behind you, {SCORE} points on the board. The cosmos waits."* |
| Victory recap | *"Pilot {NAME}. You spoke the name across three sectors, gathered {GEMS} gems, traveled {DISTANCE} light years, and locked in {SCORE} points. The cosmos remembers your call sign."* |

**3 music tracks** (ElevenLabs Music API):
- Sector 1 — driving outrun, 110 BPM, dreamy and hopeful
- Sector 2 — darker chase, 124 BPM, pulsing bass urgency
- Sector 3 — climactic finale, 138 BPM, soaring lead synth

**9 SFX** (ElevenLabs Sound Effects API): gem chime, letter shimmer, jump whoosh, double-jump sparkle, damage zap, immortality charge, shop-portal pulse, game-over fail tone, victory fanfare.

**Damage yelp** — 3 short *"Ow!"* / *"Argh!"* / *"Oof."* clips picked at random on damage. Falls back to a synthesized vocal yelp (sawtooth + bandpass formant + vibrato) if the files aren't present, so the game ships with vocal feedback even before regenerating.

### 2.7 Personalization — your name in the game

- **Call-sign input** on the menu, 6-10 alphanumeric chars.
- **Exactly 6-10 chars** → those letters become the word spelled across all three sectors. Letters appear on the lanes; HUD slots reflect your word; narrator chants your name.
- **Empty / shorter** → defaults to **OUTRUN**.
- Live TTS pre-fetches non-baked letters at run start in parallel; cached after first use.

### 2.8 Power-ups & defenses

- **Immortality** (shop unlock) — Space/tap activates 5-second invincibility. Gold armor + body flickers under the **shimmer shield aura**.
- **Shimmer shield aura** — when invincible (post-damage 1.5s window or shop-bought immortality), a layered effect wraps the player:
  - **Wireframe energy bubble** — pulsing icosphere shell with opacity-shimmering between 12% and 48%
  - **Two counter-rotated halo rings** — perpendicular toruses with phase-offset opacity
  - **Four orbiting sparks** — small spheres at staggered Y heights with 10Hz twinkle
  - Color: **gold** during immortality, **cyan** during post-damage invincibility
- **Double-jump** (shop unlock) — second jump in mid-air with a 360° flip animation.

### 2.9 End-of-run recap

Game-over and victory screens both surface a **Narrator** card:
- Italicized recap text composed from your stats (level, gems, distance, score, call-sign)
- Live TTS plays the recap aloud with a Replay button
- Stats grid below
- **RUN AGAIN / RESTART MISSION** button

---

## 3. Tech stack

### Frontend

- **React 19** + **TypeScript** + **Vite 6**
- **React Three Fiber 9** + **@react-three/drei 10** (3D scene)
- **Three.js** (WebGL rendering)
- **Zustand 5** (game state)
- **Tailwind CSS** via CDN
- **lucide-react** (icons)

### Audio engine

- **ElevenLabs APIs**:
  - **Text-to-Speech** (`eleven_multilingual_v2`, voice "Adam" `pNInz6obpgDQGcFmaJgB`) — 16 baked clips + live TTS for greeting, recap, custom-word letters and stinger, ouch yelps
  - **Sound Effects API** — 9 synthwave SFX
  - **Music API** (`music_v1`) — 3 looping per-sector tracks
- **Web Audio API** — custom `AudioController` with separate `sfx` / `voice` / `music` gain buses; music auto-ducks under voice (0.18 floor, 0.6s release); Web-Audio synthesis fallbacks for every SFX so the game ships audible without any baked file.

### Build / dev environment

- Built and prototyped in **Zed** (the Rust-based AI code editor — required by ElevenHacks).
- Asset generation: a one-shot Node script (`scripts/generate-audio.mjs`) hits the ElevenLabs APIs and writes 28+ MP3s to `public/audio/`. Skip-if-exists; `--force` to regenerate.

### Deploy

- **Vercel** (production), single-page static site.
- Vite's `define` injects `ELEVENLABS_API_KEY` at build time so the live-TTS service has it in the bundle.

### What's deliberately *not* in the stack

- No backend, no database, no authentication. Pure client-side.
- No localStorage / persistence. Each run is fresh.
- No analytics or telemetry. Network egress is only `api.elevenlabs.io` for live TTS.

---

## 4. How we built this

### 4.1 Layer structure

```
remix_-gemini-runner/
├── App.tsx                              # 3D <Canvas> + HUD + MusicPlayer
├── store.ts                             # zustand — game state + voice triggers
├── types.ts                             # GameStatus, ObjectType, constants
├── vite.config.ts                       # injects ELEVENLABS_API_KEY
├── components/
│   ├── System/
│   │   ├── Audio.ts                     # AudioController class — buses, ducking, fallbacks
│   │   └── MusicPlayer.tsx              # per-level crossfading music
│   ├── UI/
│   │   └── HUD.tsx                      # menu, in-game HUD, shop, recap, end screens
│   └── World/
│       ├── Player.tsx                   # Rocky — pentapodal animation + shield aura
│       ├── LevelManager.tsx             # spawning, collision, letter targeting
│       ├── Environment.tsx              # runway, sun, stars, grid
│       └── Effects.tsx                  # postprocessing
├── services/
│   └── elevenlabs.ts                    # live TTS + custom-word prefetch
├── scripts/
│   └── generate-audio.mjs               # one-shot ElevenLabs asset generator
└── public/audio/                        # 28+ generated MP3s (voice/sfx/music)
```

### 4.2 The audio pipeline (the thing that makes the game)

1. **Asset generator** (`scripts/generate-audio.mjs`) reads manifests from the source and hits TTS / SFX / Music endpoints. Writes results to `public/audio/{voice,sfx,music}/`. Skip-if-exists to keep re-runs cheap.

2. **AudioController** (`components/System/Audio.ts`) sets up four Web Audio gain nodes:
   - `master` (0.55) → speakers
   - `sfx` (0.55) → master, used for Web-Audio buffer playback of SFX MP3s + synth fallbacks
   - `voice` (1.0) → master, voice clips play through HTMLAudioElement (independent path)
   - `music` (0.6) → master, exposed to MusicPlayer via `getMusicGain()`
   - `duckMusic(true|false)` smoothly ramps the music bus to 0.18 / back when voice fires.

3. **MusicPlayer** (`components/System/MusicPlayer.tsx`) listens to `status` + `level`, crossfades between three music tracks, routes them through the music gain bus.

4. **Live TTS service** (`services/elevenlabs.ts`) — `generateTtsUrl(text)` hits the API, returns a blob URL, caches by `(voiceId, text)`. `prefetchCallsignAudio(target[])` parallel-fetches all non-baked letters + the customized word-complete stinger.

5. **Voice triggers in the store** — every game-state transition fires through `audio.playVoice()` or live TTS:
   - `collectLetter` → `speakLetter(wordTarget[index], index)` — baked clip if available, else live TTS, else baked-by-index fallback.
   - `advanceLevel` → `speakDelayed('level-2' | 'level-3', 4500)`.
   - `takeDamage` → `speak('damage' | 'last-life')` plus `playOuch()` from Player.
   - `openShop`, `activateImmortality`, victory, game-over → respective baked clips or live TTS recap.

### 4.3 The custom-word system

When the player types a 6-10 letter call-sign and hits launch:
1. `setCallsign(name)` cleans + caps to MAX_WORD_LENGTH (10).
2. `startGame` calls `deriveWordTarget(callsign)` which validates the regex and returns the letters as a string array (or default `OUTRUN`).
3. `prefetchCallsignAudio(target)` fires in parallel — for each non-baked letter (anything that isn't G/E/M/I/N), live TTS generates a `{letter}.` clip; one extra request generates the customized word-complete stinger spelling the full word.
4. While the player runs, `LevelManager` spawns letters using `wordTarget[index]` so the actual letters appear on the runway.
5. On pickup, `speakLetter(letter, index)` looks up the baked clip first, the cached live URL second, and falls back to baked-by-index third.
6. On full word, `getWordCompleteUrl(target)` returns the cached personalized stinger and plays it.

### 4.4 The shield aura

Implemented in `Player.tsx` as a sibling group to the pentapod body:
- 3 layers: **wireframe energy bubble** (icosphere) + **two counter-rotated halo rings** (toruses) + **four orbiting sparks** (small spheres).
- Materials are memoized once with throwaway colors and updated in-place every frame inside `useFrame` so we don't allocate new GPU buffers — `mat.color.set(tone)` and `mat.opacity = …` per tick.
- Color tone is decided by `isImmortalityActive ? '#ffd700' : '#00ffff'`.
- The post-damage flicker (was: toggling `groupRef.visible` 50ms) was moved to flicker `bodyRef.visible` only, so the **body strobes** under a **solid aura** during the 1.5-second invincibility window.
- Sparks orbit on three different axes with phase-offset radii, randomized per ship — looks alive, never robotic.

---

## 5. Setup

```bash
cd remix_-gemini-runner
npm install
echo "ELEVENLABS_API_KEY=sk_your_key_here" > .env.local
npm run generate-audio   # ~2 min, generates 28+ baked MP3s
npm run dev              # Vite dev server on :3000
```

Built for production:
```bash
npm run build            # writes to dist/
```

Deployed via Vercel:
```bash
cd dist
vercel deploy --prod --yes --scope <your-team>
```

The game is fully playable even without `npm run generate-audio` — voice clips fall back to silent / Web Audio synthesis for SFX, music stays silent. With assets generated AND `ELEVENLABS_API_KEY` set, every milestone is voiced, music swells per level, and the AI narrator reads your run back to you with your call-sign and actual stats.

---

## 6. What makes this different

- The runner mechanic isn't the hook — **the AI narrator chanting your name is**.
- Type ADITYA, see ADITYA spawn on the lanes letter by letter, hear ADITYA chanted back at you in the same voice that says *"Welcome, pilot Aditya. Initializing run."* and *"Pilot Aditya. The cosmos remembers your call sign."*
- All four ElevenLabs APIs in one game: TTS, Music, Sound Effects, and the multi-voice model used for the multilingual fallback.
- Music ducking is automatic and audio-bus-level — every chant cuts through cleanly without any per-clip timer juggling.
- Every visual moment has a sound and every sound moment has a visual: the gold trail on shield matches the gold halo on the power-up matches the *"Shield online"* voice line. One coherent system.

---

*Last updated alongside commit `875ba6f` — vocal damage yelp + shimmer shield aura.*
