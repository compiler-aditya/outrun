# OUTRUN

> *Speak the name. Run the cosmos.*

A synthwave endless runner where an AI radio DJ chants a 6-to-10-letter word as you race a five-legged alien through three sectors of neon space. **Type your name, hear your name** — every letter you collect is voiced live by ElevenLabs. Built for **ElevenHacks** as a showcase of what the ElevenLabs API can do for emotional, dynamic, in-game audio.

🚀 **Play it live:** https://outrun-remix.vercel.app

---

## What it is

You play **Rocky** — a pentapodal alien creature scampering through a neon cosmos on five articulated legs. To beat each sector you have to **collect glowing letters** scattered across the lanes. As you grab each one, an AI radio DJ calls it out by name. Type your own 6-to-10-letter call-sign on the menu and **that becomes the word** spelled across all three sectors. The narrator literally chants *you* across the universe.

Three sectors. Cyber shop between levels. Shield power-ups. AI-narrated recap that reads back your run with your call-sign and stats baked in. Everything you hear — every letter, every milestone, every "last life, pilot," every personalized greeting — comes from **ElevenLabs**.

---

## ✨ Features at a glance

- **AI radio DJ chants your word.** 16 baked TTS clips for the GEMINI/OUTRUN letter set + live ElevenLabs TTS for any custom call-sign letters.
- **Personalized in-game word.** Type a 6-10 letter call-sign on the tutorial; the actual letters appear on the runway and get chanted as you collect them.
- **AI-narrated end-of-run recap.** When you die or win, the narrator speaks your stats out loud — *"Pilot ADITYA. You spoke the name across three sectors, gathered 42 gems, traveled 1,247 light years…"* — generated fresh each run.
- **Music ducks under voice automatically.** Web Audio gain buses with ramped ducking (0.18 floor, 0.6s release) so every chant cuts through cleanly.
- **Three per-level synthwave music tracks** from the ElevenLabs Music API — calmer in sector 1, urgent in sector 2, climactic in sector 3.
- **9 AI-generated SFX** from the ElevenLabs Sound Effects API — gem chime, jump whoosh, damage zap, immortality charge, and more.
- **Vocal damage yelp.** *"Ow!"* / *"Argh!"* / *"Oof."* picked at random on each hit, falling back to a synthesized vocal yelp (sawtooth + bandpass formant + vibrato) if files aren't generated.
- **Shimmer shield aura.** Multi-layer effect (wireframe energy bubble + counter-rotated halo rings + four orbiting sparks) that wraps the player during invincibility.
- **First-load tutorial.** A synthwave-styled "HOW TO PLAY" card with numbered steps, control chips, the call-sign input, and a START button that launches the game directly.

For a deeper feature inventory and architectural notes, see **[FEATURES.md](./FEATURES.md)**.

---

## 🛠️ Tech stack

**Frontend**
- **React 19** + **TypeScript**
- **Vite 6** — dev server + build pipeline
- **Tailwind CSS** (via CDN) — styling
- **Zustand 5** — game state
- **lucide-react** — icons

**3D rendering**
- **Three.js** — WebGL scene
- **@react-three/fiber 9** — React renderer for Three
- **@react-three/drei 10** — helpers (Trail, Center, Text3D, Float)
- **@react-three/postprocessing** + **postprocessing** — effects pass

**Audio**
- **ElevenLabs APIs** — three of them:
  - **Text-to-Speech** (`eleven_multilingual_v2`, voice "Adam") — 16 baked clips + live runtime TTS
  - **Sound Effects API** — 9 synthwave SFX
  - **Music API** (`music_v1`) — 3 looping per-sector tracks
- **Web Audio API** — custom `AudioController` with `sfx`/`voice`/`music` gain buses, music auto-ducks under voice, Web-Audio synthesis fallbacks for every SFX.

**Build & deploy**
- **Zed** — primary editor (the Rust-based AI editor required by the ElevenHacks brief)
- **Vercel** — production hosting at https://outrun-remix.vercel.app

**No backend, no database, no auth.** Pure client-side single-page app. The only network egress is to `api.elevenlabs.io` for live TTS.

---

## 🎮 How to play

| Action | Keyboard | Touch |
|---|---|---|
| Move lane | `←` / `→` | Swipe left/right |
| Jump | `↑` or `W` | Swipe up |
| Activate shield (when unlocked) | `Space` / `Enter` | Tap |

### Goal

1. **Spell the word** — collect all letters in any order.
2. **Survive** — start with 3 hearts; obstacles, alien saucers, and missiles each cost a life.
3. **Advance** — completing the word triggers a sector portal: walk through the **Cyber Shop**, spend collected gems on perks, then enter the next sector.
4. **Win** — complete the word in **Sector 3** to trigger victory and the AI-narrated recap.

### What's on the lanes

| Object | Effect |
|---|---|
| **Glowing letter** | Pickup advances your word + DJ chants the letter |
| **Cyan gem** | +50 score |
| **Gold gem on top of obstacle** | +100 score |
| **Spike obstacle** (red glow) | Lose a life |
| **Alien saucer** (sectors 2+) | Fires a missile down its lane |
| **Red missile** | Lose a life on contact |
| **Shop portal** (between sectors) | Enter the Cyber Shop |

### Cyber Shop perks

| Item | Cost | Effect |
|---|---|---|
| **Double Jump** | 1,000 | Mid-air re-jump (one-time unlock) |
| **Max Life Up** | 1,500 | +1 heart slot, heals you |
| **Repair Kit** | 1,000 | Restores 1 heart |
| **Immortality** | 3,000 | Unlocks Space-bar 5-second invincibility |

---

## 🚀 Run locally

**Prerequisites:** Node.js 20+

```bash
# 1. Install dependencies
npm install

# 2. Add your ElevenLabs API key
echo "ELEVENLABS_API_KEY=sk_your_key_here" > .env.local

# 3. (One-time) Generate the 28+ baked audio assets
npm run generate-audio

# 4. Start the dev server
npm run dev
```

The dev server runs on `http://localhost:3000`.

The game is fully playable even if you skip step 3 — voice clips fall back to silence and SFX use Web Audio synthesis. With assets generated and a key set, every milestone is voiced and the AI narrator reads your run back to you.

### Production build

```bash
npm run build         # writes to dist/
npm run preview       # preview the production bundle locally
```

### Asset generation

```bash
npm run generate-audio                 # skip-if-exists — safe to re-run
npm run generate-audio -- --force      # regenerate everything (~2-3 min)
```

The generator script (`scripts/generate-audio.mjs`) hits the ElevenLabs TTS, Sound Effects, and Music APIs and writes 28+ MP3s into `public/audio/{voice,sfx,music}/`.

---

## 🌐 Deployment

The app is deployed on Vercel as a pre-built static site:

```bash
npm run build
cd dist
vercel deploy --prod
```

Because Vite's `define` plugin substitutes `process.env.ELEVENLABS_API_KEY` at build time, the key from `.env.local` ends up baked into the production JS bundle. **Acceptable for a hackathon demo; rotate the key after the contest.** For a long-lived public deploy, proxy live TTS through a serverless function instead.

---

## 📁 Project structure

```
.
├── App.tsx                          # 3D <Canvas> + HUD + MusicPlayer roots
├── store.ts                         # zustand — game state + voice triggers
├── types.ts                         # GameStatus, ObjectType, constants
├── vite.config.ts                   # injects GEMINI_API_KEY + ELEVENLABS_API_KEY
├── components/
│   ├── System/
│   │   ├── Audio.ts                 # AudioController class (buses, ducking, fallbacks)
│   │   └── MusicPlayer.tsx          # per-level crossfading music
│   ├── UI/
│   │   └── HUD.tsx                  # tutorial, menu, in-game HUD, shop, recap
│   └── World/
│       ├── Player.tsx               # Rocky — pentapod animation + shield aura
│       ├── LevelManager.tsx         # spawning, collision, letter targeting
│       ├── Environment.tsx          # runway, sun, stars, grid
│       └── Effects.tsx              # postprocessing
├── services/
│   └── elevenlabs.ts                # live TTS + custom-word prefetch
├── scripts/
│   └── generate-audio.mjs           # one-shot ElevenLabs asset generator
├── public/audio/                    # 28+ generated MP3s
├── FEATURES.md                      # deeper feature + architecture writeup
└── README.md                        # this file
```

---

## 🎙️ ElevenLabs integration walkthrough

### Pre-baked clips (build-time)

`scripts/generate-audio.mjs` hits **three ElevenLabs APIs**:

- **TTS** for 16 voice lines (letter callouts G/E/M/I/N, milestone stingers, damage/last-life/game-over/victory lines, menu intro, shop welcome, immortal callout) plus 3 short ouch yelps.
- **Sound Effects** for 9 game SFX (gem, letter, jump, double-jump, damage, immortality, shop-portal, game-over, victory).
- **Music** for 3 per-sector loops with progressive intensity prompts (110/124/138 BPM).

All written to `public/audio/{voice,sfx,music}/`. Skip-if-exists; `--force` regenerates.

### Live TTS (runtime)

`services/elevenlabs.ts` calls TTS at runtime for the lines that need the player's actual data:

- **Personalized greeting** — *"Welcome, pilot ADITYA. Initializing run. Stay sharp."*
- **Per-letter callouts** for non-baked letters — anything that isn't G/E/M/I/N gets generated on demand. Pre-fetched in parallel at run start.
- **Customized word-complete stinger** — *"A. D. I. T. Y. A. The signal locks in."* matching the player's word.
- **End-of-run recap** — *"Pilot ADITYA. You spoke the name across three sectors, gathered 42 gems, traveled 1,247 light years, and locked in 18,300 points. The cosmos remembers your call sign."*

All cached in-memory by `(voiceId, text)` so they're free on replay within the session.

### Audio routing

The `AudioController` (`components/System/Audio.ts`) sets up four Web Audio gain nodes:

```
         ┌─ sfx ──────► AudioBuffer playback (with synth fallbacks)
master ──┼─ voice ────► HTMLAudioElement playback
         └─ music ────► MediaElementSource (MusicPlayer)
```

When voice plays, `duckMusic(true)` ramps the music gain to 0.18 over 150ms. When voice ends, it ramps back to 0.6 over 600ms. Every chant cuts through cleanly without per-clip timer juggling.

---

## 🎯 What makes this different

The runner mechanic isn't the hook — **the AI narrator chanting your name is**. Type ADITYA, see ADITYA spawn on the lanes letter by letter, hear ADITYA chanted back at you in the same voice that says *"Welcome, pilot Aditya. Initializing run."* and *"Pilot Aditya. The cosmos remembers your call sign."*

All ElevenLabs APIs in one game (TTS, Music, Sound Effects). Music ducking is automatic and audio-bus-level. Every visual moment has a sound and every sound moment has a visual: gold trail on shield matches gold halo on power-up matches *"Shield online"* voice line. One coherent system.

---

## 🙏 Credits

- Built and prototyped in **[Zed](https://zed.dev)** — the Rust-based AI code editor.
- Audio powered by **[ElevenLabs](https://elevenlabs.io)** — TTS, Sound Effects, and Music APIs.
- 3D scene by **[React Three Fiber](https://docs.pmnd.rs/react-three-fiber)** + **[Three.js](https://threejs.org)**.
- Submitted for **#ElevenHacks** — tagged `@elevenlabsio` and `@zeddotdev`.

---

## 📜 License

Apache 2.0 — see source headers.
