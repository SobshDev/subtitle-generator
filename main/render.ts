import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { app } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import {
  ensureBrowser,
  renderMedia,
  selectComposition,
} from '@remotion/renderer';
import type { Project } from '@shared/types';
import { getFfprobePath } from './ffmpeg';

const execFileAsync = promisify(execFile);

const COMPOSITION_ID = 'Subtitles';

export type RenderProgress = {
  pct: number;
  frame: number;
  totalFrames: number;
};

export type ChromiumDownloadProgress = {
  downloadedBytes: number;
  totalBytes: number;
  pct: number;
};

let cachedBundle: string | null = null;
let bundlePromise: Promise<string> | null = null;

function unpackAsar(p: string): string {
  return p.replace('app.asar', 'app.asar.unpacked');
}

function resolveRemotionRoot(): string {
  const candidates = [
    path.resolve(__dirname, '../../remotion/Root.tsx'),
    path.resolve(__dirname, '../remotion/Root.tsx'),
    path.resolve(process.cwd(), 'remotion/Root.tsx'),
  ].map(unpackAsar);

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0]!;
}

export async function getBundle(): Promise<string> {
  if (cachedBundle) return cachedBundle;
  if (bundlePromise) return bundlePromise;

  const entryPoint = resolveRemotionRoot();
  bundlePromise = bundle({ entryPoint })
    .then((url) => {
      cachedBundle = url;
      bundlePromise = null;
      return url;
    })
    .catch((err) => {
      bundlePromise = null;
      throw err;
    });

  return bundlePromise;
}

export async function ensureChromium(
  onProgress?: (p: ChromiumDownloadProgress) => void,
): Promise<void> {
  await ensureBrowser({
    onBrowserDownload: () => ({
      version: null,
      onProgress: ({ downloadedBytes, totalSizeInBytes, percent }) => {
        if (!onProgress) return;
        onProgress({
          downloadedBytes,
          totalBytes: totalSizeInBytes,
          pct: percent * 100,
        });
      },
    }),
  });
}

export async function renderProject(
  project: Project,
  outputPath: string,
  onProgress: (p: RenderProgress) => void,
): Promise<void> {
  const serveUrl = await getBundle();

  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps: { project } as unknown as Record<string, unknown>,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: 'prores',
    proResProfile: '4444',
    pixelFormat: 'yuva444p10le',
    imageFormat: 'png',
    outputLocation: outputPath,
    inputProps: { project } as unknown as Record<string, unknown>,
    onProgress: ({ progress, renderedFrames }) => {
      onProgress({
        pct: progress * 100,
        frame: renderedFrames,
        totalFrames: composition.durationInFrames,
      });
    },
  });
}

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

export async function validateAlpha(filePath: string): Promise<boolean> {
  const ffprobe = getFfprobePath();
  try {
    const { stdout } = await execFileAsync(ffprobe, [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_streams',
      '-of',
      'json',
      filePath,
    ]);
    const parsed = JSON.parse(stdout) as {
      streams?: Array<{ pix_fmt?: string }>;
    };
    const pixFmt = parsed.streams?.[0]?.pix_fmt;
    if (!pixFmt) return false;
    return ALPHA_PIXEL_FORMATS.has(pixFmt) || pixFmt.startsWith('yuva') ||
      pixFmt.includes('rgba') || pixFmt.includes('argb') ||
      pixFmt.includes('bgra') || pixFmt.includes('abgr');
  } catch (err) {
    console.error('validateAlpha failed', err);
    return false;
  }
}

export function getDefaultExportFileName(project: Project): string {
  const src = project.source?.path
    ? path.basename(project.source.path, path.extname(project.source.path))
    : 'subtitles';
  return `${src}.subtitles.mov`;
}

export function getDefaultExportDir(): string {
  try {
    return app.getPath('videos');
  } catch {
    return app.getPath('downloads');
  }
}
