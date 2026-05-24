# Bundled fonts

Fonts are loaded at composition mount time via `@remotion/google-fonts`
so they are available identically to the live `<Player>` (Electron
renderer Chromium) and the headless export Chromium. This avoids
system-font drift between preview and export.

Bundled font families (must match `BUNDLED_FONTS` in `shared/types.ts`):

- Inter
- Anton
- Bebas Neue
- Roboto
- Montserrat

To add a font: import the matching module from `@remotion/google-fonts/<Family>`
inside `SubtitleComposition.tsx`, call `loadFont('normal', { weights: [...] })`
at module top-level, and append the family name to `BUNDLED_FONTS`.

This directory is intentionally otherwise empty — no font files are
bundled on disk; the loader fetches WOFF2 at runtime/bundle time.
