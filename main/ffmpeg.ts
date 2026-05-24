import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

function unpack(p: string): string {
  return p.replace('app.asar', 'app.asar.unpacked');
}

export function getFfmpegPath(): string {
  const raw = req('ffmpeg-static') as string | null;
  if (!raw) throw new Error('ffmpeg-static did not return a binary path');
  return unpack(String(raw));
}

export function getFfprobePath(): string {
  const mod = req('ffprobe-static') as { path: string };
  if (!mod?.path) throw new Error('ffprobe-static did not return a binary path');
  return unpack(String(mod.path));
}
