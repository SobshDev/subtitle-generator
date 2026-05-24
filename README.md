# Subtitle Generator

Standalone desktop app that turns a video into an animated subtitle overlay
file (**ProRes 4444 .mov with alpha**) you can drop onto any track in
Premiere, Resolve, or Final Cut.

Pipeline: drop a video → transcribe with Whisper Large v3 (Groq) → edit
the transcript and style → preview live in Remotion → export a
transparent caption layer.

## Prerequisites

- macOS (Apple Silicon or Intel), Windows, or Linux
- Node.js 20+ and npm 10+
- A [Groq](https://console.groq.com) API key (free tier; used for the
  Whisper Large v3 transcription model with word-level timestamps)

Bundled at runtime:
- `ffmpeg-static` and `ffprobe-static` (no system ffmpeg required)
- Remotion's bundled Chromium (downloaded on first launch, ~150 MB)

## Quick start (development)

```bash
git clone <repo>
cd subtitle-generator
npm install
npm run dev
```

The app opens. On first launch you'll be prompted for a Groq API
key — it's stored in your OS keychain via `keytar`. After that, the
first transcription / export will trigger a one-time Chromium download
for Remotion (progress is broadcast over `firstRun:progress`).

Drop a video (`.mp4`, `.mov`, `.mkv`, `.wav`, `.mp3`, `.m4a`) into the
window or use the picker. A 15–30 s talking-head clip is the fastest way
to exercise the full pipeline.

Put any test clips in `samples/` — that directory is gitignored.

## In-app usage

1. **Drop a file** — probed with ffprobe, audio extracted, transcribed.
2. **Edit transcript** — left panel. Click a word to rename, right-click
   to split / merge, hover to nudge start/end timing.
3. **Style** — right panel. Font, size, fill, outline, position anchor,
   shadow.
4. **Preset** — right panel, below style. 5 animations: karaoke, popIn,
   slideUp, typewriter, bouncing. Per-preset params are exposed.
5. **Preview** updates live in the `<Player>` over a checkerboard
   background so you can confirm the alpha visually.
6. **Export…** — pick resolution (1080p / 4K / vertical / custom) and
   FPS, choose an output path, render. The exported `.mov` is ProRes
   4444 with a `yuva444p…` pixel format; ffprobe validates that on
   completion.

## Build a distributable

```bash
npm run build           # bundles main, preload, renderer to out/
npm run dist:mac        # builds .dmg + .zip into dist/
npm run dist:win        # NSIS installer
npm run dist:linux      # AppImage
```

For quick unsigned packaging (skip code-signing / notarization):

```bash
npm run build
npx electron-builder --mac --dir
# launches the .app at: dist/mac-arm64/Subtitle Generator.app
```

### Signing & notarization (macOS, signed release builds)

`electron-builder` will pick up a Developer ID Application certificate
from your keychain automatically. For notarization, set:

```bash
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
export APPLE_TEAM_ID="ABCD1234EF"
npm run dist:mac
```

`build/entitlements.mac.plist` already grants the JIT / unsigned-memory
entitlements Chromium and Remotion need at runtime.

## Architecture

```
shared/        IPC channel + payload types, shared with main + renderer
main/          Electron main process (Node)
  ipc.ts          channel handlers
  preload.ts      contextBridge -> window.api
  media.ts        ffprobe-based probe
  transcribe.ts   audio extract -> silence detect -> chunk -> Whisper
  render.ts       Remotion bundle/render + alpha validation
  firstRun.ts     one-time ensureBrowser (Chromium) download
remotion/      Remotion composition + 5 animation presets
renderer/src/  React UI (zustand store, panels, Player preview)
scripts/       smoke-render.mjs — bundle+render a fixture to verify alpha
```

## Known issues / notes

- **Drag-and-drop file paths**: Electron exposes `File.path` for dragged
  files but not for files picked via `<input type=file>`. The Browse…
  button works in dev (Electron) but won't get a path in a plain
  browser. Use drag-and-drop if Browse silently fails.
- The `npm run build` output is ESM (`out/main/index.js`); the entry is
  declared in `package.json#main`. Native modules (`keytar`,
  `@rspack/*.node`, `esbuild`, `ffmpeg-static`, `ffprobe-static`) are
  pulled out of the asar archive via `electron-builder.yml#asarUnpack`
  so they can be `require()`d / `spawn()`ed at runtime.
- First export after launch is slower because Remotion has to bundle
  the composition once. The bundle is cached for the rest of the
  process lifetime.
- `npm run remotion:preview` opens the Remotion Studio against
  `remotion/Root.tsx` with the fixture project — handy for iterating on
  presets without launching the full app.

## Tests

```bash
npm test            # vitest — covers transcribe chunk merging
npm run typecheck   # tsc --noEmit
node scripts/smoke-render.mjs   # render a fixture .mov and assert alpha
```
