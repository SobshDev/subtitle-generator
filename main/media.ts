import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Source } from '@shared/types';
import { getFfmpegPath, getFfprobePath } from './ffmpeg';

const execFileP = promisify(execFile);

type FfprobeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  duration?: string;
};

const WEB_FRIENDLY_VIDEO = new Set(['h264', 'hevc', 'vp8', 'vp9', 'av1']);
const WEB_FRIENDLY_AUDIO = new Set(['aac', 'mp3', 'opus', 'flac']);

function isWebFriendly(videoCodec?: string, audioCodec?: string): boolean {
  if (videoCodec && !WEB_FRIENDLY_VIDEO.has(videoCodec)) return false;
  if (audioCodec && !WEB_FRIENDLY_AUDIO.has(audioCodec)) return false;
  return true;
}

type FfprobeFormat = {
  duration?: string;
};

type FfprobeJson = {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
};

function parseFps(rate: string | undefined): number {
  if (!rate) return 0;
  const [num, den] = rate.split('/').map(Number);
  if (!num || !den) return 0;
  return num / den;
}

export async function probeMedia(filePath: string): Promise<Source> {
  const { stdout } = await execFileP(
    getFfprobePath(),
    ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', filePath],
    { maxBuffer: 16 * 1024 * 1024 },
  );

  const data = JSON.parse(stdout) as FfprobeJson;
  const streams = data.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');

  const durationSec = Number(
    data.format?.duration ?? video?.duration ?? audio?.duration ?? 0,
  );

  const fps = video ? parseFps(video.avg_frame_rate ?? video.r_frame_rate) : 0;

  return {
    path: filePath,
    durationSec: Number.isFinite(durationSec) ? durationSec : 0,
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    fps: Number.isFinite(fps) ? fps : 0,
    hasAudio: Boolean(audio),
    videoCodec: video?.codec_name,
    audioCodec: audio?.codec_name,
  };
}

export async function ensurePreviewMp4(
  srcPath: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const probed = await probeMedia(srcPath);
  if (isWebFriendly(probed.videoCodec, probed.audioCodec)) {
    console.log(
      '[preview] passthrough',
      srcPath,
      `(v=${probed.videoCodec ?? 'none'}, a=${probed.audioCodec ?? 'none'})`,
    );
    onProgress?.(100);
    return srcPath;
  }

  const st = await stat(srcPath);
  const hash = createHash('sha1')
    .update(srcPath)
    .update(String(Math.floor(st.mtimeMs)))
    .update(String(st.size))
    .digest('hex')
    .slice(0, 16);
  const out = join(tmpdir(), 'subgen-preview', `${hash}.mp4`);
  await mkdir(dirname(out), { recursive: true });
  if (existsSync(out)) {
    console.log('[preview] cache hit', out);
    onProgress?.(100);
    return out;
  }

  console.log('[preview] transcoding', srcPath, '→', out);
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(getFfmpegPath(), [
      '-y',
      '-i', srcPath,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '28',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '48000',
      '-movflags', '+faststart',
      '-progress', 'pipe:1',
      out,
    ]);

    let totalSec = 0;
    proc.stderr.on('data', (b) => {
      const s = b.toString();
      const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s);
      if (m) totalSec = +m[1] * 3600 + +m[2] * 60 + +m[3];
    });
    proc.stdout.on('data', (b) => {
      const s = b.toString();
      const m = /out_time_ms=(\d+)/.exec(s);
      if (m && totalSec > 0 && onProgress) {
        const sec = Number(m[1]) / 1_000_000;
        onProgress(Math.min(99, (sec / totalSec) * 100));
      }
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg preview exit ${code}`));
    });
  });
  console.log('[preview] done', out);
  return out;
}
