/* eslint-disable no-console */
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { bundle } from '@remotion/bundler';
import {
  ensureBrowser,
  renderMedia,
  selectComposition,
} from '@remotion/renderer';
import ffprobeStatic from 'ffprobe-static';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const sampleWords = [
  { id: 'w0', text: 'Alpha',  startSec: 0.0, endSec: 0.6, confidence: 0.99 },
  { id: 'w1', text: 'channel', startSec: 0.6, endSec: 1.4, confidence: 0.99 },
  { id: 'w2', text: 'works',  startSec: 1.4, endSec: 2.0, confidence: 0.99 },
  { id: 'w3', text: 'end',    startSec: 2.2, endSec: 2.6, confidence: 0.99 },
  { id: 'w4', text: 'to',     startSec: 2.6, endSec: 2.9, confidence: 0.99 },
  { id: 'w5', text: 'end.',   startSec: 2.9, endSec: 3.6, confidence: 0.99 },
  { id: 'w6', text: 'Ship',   startSec: 4.0, endSec: 4.4, confidence: 0.99 },
  { id: 'w7', text: 'it.',    startSec: 4.4, endSec: 4.9, confidence: 0.99 },
];

const project = {
  source: {
    path: '',
    durationSec: 5,
    width: 1280,
    height: 720,
    fps: 30,
    hasAudio: false,
  },
  transcript: { words: sampleWords },
  captions: [
    { id: 'g0', wordIds: ['w0', 'w1', 'w2'], startSec: 0.0, endSec: 2.0 },
    { id: 'g1', wordIds: ['w3', 'w4', 'w5'], startSec: 2.2, endSec: 3.8 },
    { id: 'g2', wordIds: ['w6', 'w7'],       startSec: 4.0, endSec: 5.0 },
  ],
  style: {
    fontFamily: 'Inter',
    fontSizePx: 64,
    fillColor: '#FFFFFF',
    outlineColor: '#000000',
    outlinePx: 4,
    position: { x: 640, y: 600, anchor: 'bottom' },
    maxWidthPx: 1100,
    lineHeight: 1.1,
  },
  preset: { kind: 'popIn', params: {} },
  output: { width: 1280, height: 720, fps: 30, codec: 'prores4444' },
};

const ALPHA_PIXEL_FORMATS = new Set([
  'yuva444p10le',
  'yuva444p',
  'yuva420p',
  'yuva422p',
  'rgba',
  'argb',
  'bgra',
  'abgr',
  'yuva444p12le',
  'yuva444p16le',
]);

async function validateAlpha(filePath) {
  const { stdout } = await execFileAsync(ffprobeStatic.path, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_streams',
    '-of', 'json',
    filePath,
  ]);
  const parsed = JSON.parse(stdout);
  const pixFmt = parsed.streams?.[0]?.pix_fmt;
  return { pixFmt, alpha: pixFmt ? (ALPHA_PIXEL_FORMATS.has(pixFmt) || pixFmt.startsWith('yuva')) : false };
}

async function main() {
  const outDir = await mkdtemp(path.join(tmpdir(), 'subgen-smoke-'));
  const outPath = path.join(outDir, 'smoke.mov');
  console.log('[smoke] output:', outPath);

  console.log('[smoke] ensuring chromium...');
  await ensureBrowser({
    onBrowserDownload: () => ({
      version: null,
      onProgress: ({ percent }) => {
        process.stdout.write(`\r  chromium download ${(percent * 100).toFixed(1)}%   `);
      },
    }),
  });
  process.stdout.write('\n');

  console.log('[smoke] bundling remotion...');
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'remotion', 'Root.tsx'),
  });
  console.log('[smoke] bundle:', serveUrl);

  console.log('[smoke] selecting composition...');
  const composition = await selectComposition({
    serveUrl,
    id: 'Subtitles',
    inputProps: { project },
  });
  console.log(
    `[smoke] composition ${composition.width}x${composition.height} ` +
    `${composition.fps}fps ${composition.durationInFrames} frames`,
  );

  console.log('[smoke] rendering ProRes 4444 + alpha...');
  let lastPct = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'prores',
    proResProfile: '4444',
    pixelFormat: 'yuva444p10le',
    imageFormat: 'png',
    outputLocation: outPath,
    inputProps: { project },
    onProgress: ({ progress, renderedFrames }) => {
      const pct = Math.round(progress * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        process.stdout.write(
          `\r  render ${pct.toString().padStart(3)}%  frame ${renderedFrames}/${composition.durationInFrames}     `,
        );
      }
    },
  });
  process.stdout.write('\n');

  const s = await stat(outPath);
  console.log(`[smoke] wrote ${s.size} bytes`);

  const probe = await validateAlpha(outPath);
  console.log(`[smoke] pix_fmt=${probe.pixFmt} alphaConfirmed=${probe.alpha}`);

  if (!probe.alpha) {
    console.error('[smoke] FAIL: no alpha channel detected');
    process.exit(1);
  }

  console.log(`[smoke] OK — file kept at ${outPath}`);
  if (process.env.KEEP !== '1') {
    console.log('[smoke] (set KEEP=1 to retain output dir)');
  } else {
    console.log('[smoke] keeping output dir per KEEP=1');
  }
  // leave file in place so user can open in QuickTime
  void rm;
}

main().catch((err) => {
  console.error('[smoke] FAIL', err);
  process.exit(1);
});
