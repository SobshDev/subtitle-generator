import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Word } from '@shared/types';
import { getFfmpegPath } from './ffmpeg';

const execFileP = promisify(execFile);

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const WHISPER_MODEL = 'whisper-large-v3';
const DEFAULT_MAX_BYTES = 20_000_000;
const SILENCE_SEARCH_WINDOW_SEC = 30;
const FALLBACK_CHUNK_SEC = 20;
const FALLBACK_OVERLAP_SEC = 0.5;
const DEDUPE_TIME_TOLERANCE_SEC = 0.1;

function log(...args: unknown[]): void {
  console.log('[transcribe]', ...args);
}

export type Silence = { start: number; end: number };
export type Chunk = { path: string; offsetSec: number };
export type TranscribeProgress = { pct: number; currentChunk: number };

async function tempFile(ext: string): Promise<string> {
  const dir = await fs.mkdtemp(join(tmpdir(), 'subgen-'));
  return join(dir, `audio-${randomUUID()}.${ext}`);
}

export async function extractAudio(videoPath: string): Promise<string> {
  const out = await tempFile('wav');
  log('extractAudio: input', videoPath, '→ output', out);
  await execFileP(
    getFfmpegPath(),
    [
      '-y',
      '-i', videoPath,
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-f', 'wav',
      out,
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  const size = statSync(out).size;
  log('extractAudio: wrote', size, 'bytes');
  return out;
}

export function parseSilencesFromStderr(stderr: string): Silence[] {
  const startRe = /silence_start:\s*(-?\d+(?:\.\d+)?)/g;
  const endRe = /silence_end:\s*(-?\d+(?:\.\d+)?)/g;
  const starts: number[] = [];
  const ends: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(stderr)) !== null) starts.push(Number(m[1]));
  while ((m = endRe.exec(stderr)) !== null) ends.push(Number(m[1]));

  const silences: Silence[] = [];
  const n = Math.min(starts.length, ends.length);
  for (let i = 0; i < n; i++) {
    silences.push({ start: starts[i], end: ends[i] });
  }
  return silences;
}

export async function detectSilences(wavPath: string): Promise<Silence[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(getFfmpegPath(), [
      '-hide_banner',
      '-nostats',
      '-i', wavPath,
      '-af', 'silencedetect=noise=-30dB:d=0.5',
      '-f', 'null',
      '-',
    ]);

    let stderr = '';
    proc.stderr.on('data', (b) => { stderr += b.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`silencedetect exited with code ${code}: ${stderr}`));
        return;
      }
      resolve(parseSilencesFromStderr(stderr));
    });
  });
}

async function probeDurationSec(wavPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(getFfmpegPath(), ['-hide_banner', '-nostats', '-i', wavPath]);
    let stderr = '';
    proc.stderr.on('data', (b) => { stderr += b.toString(); });
    proc.on('error', reject);
    proc.on('close', () => {
      const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
      if (!m) return resolve(0);
      const h = Number(m[1]);
      const mn = Number(m[2]);
      const s = Number(m[3]);
      resolve(h * 3600 + mn * 60 + s);
    });
  });
}

type CutPlan = { startSec: number; durationSec: number };

export function planCuts(
  totalSec: number,
  silences: Silence[],
  bytesPerSec: number,
  maxBytes: number,
): CutPlan[] {
  if (totalSec <= 0) return [];
  const maxSecPerChunk = Math.max(1, Math.floor(maxBytes / bytesPerSec));

  const plan: CutPlan[] = [];
  let cursor = 0;

  while (cursor < totalSec) {
    const remaining = totalSec - cursor;
    if (remaining <= maxSecPerChunk) {
      plan.push({ startSec: cursor, durationSec: remaining });
      break;
    }

    const targetEnd = cursor + maxSecPerChunk;
    const candidates = silences.filter(
      (s) => s.start > cursor + 1 && s.end <= targetEnd,
    );
    let cutAt: number;

    if (candidates.length > 0) {
      const last = candidates[candidates.length - 1];
      cutAt = (last.start + last.end) / 2;
    } else {
      const nearbySilence = silences.find(
        (s) =>
          s.start >= cursor &&
          s.start <= cursor + SILENCE_SEARCH_WINDOW_SEC &&
          s.end <= targetEnd,
      );
      if (nearbySilence) {
        cutAt = (nearbySilence.start + nearbySilence.end) / 2;
      } else {
        cutAt = Math.min(cursor + FALLBACK_CHUNK_SEC, targetEnd);
        plan.push({ startSec: cursor, durationSec: cutAt - cursor });
        cursor = Math.max(cursor + 0.001, cutAt - FALLBACK_OVERLAP_SEC);
        continue;
      }
    }

    plan.push({ startSec: cursor, durationSec: cutAt - cursor });
    cursor = cutAt;
  }

  return plan;
}

export async function chunkAudio(
  wavPath: string,
  silences: Silence[],
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<Chunk[]> {
  const totalBytes = statSync(wavPath).size;
  const totalSec = await probeDurationSec(wavPath);
  if (totalSec <= 0) return [];

  const bytesPerSec = totalBytes / totalSec;
  if (totalBytes <= maxBytes) {
    return [{ path: wavPath, offsetSec: 0 }];
  }

  const cuts = planCuts(totalSec, silences, bytesPerSec, maxBytes);
  const chunks: Chunk[] = [];
  const baseDir = await fs.mkdtemp(join(tmpdir(), 'subgen-chunks-'));

  for (let i = 0; i < cuts.length; i++) {
    const { startSec, durationSec } = cuts[i];
    const out = join(baseDir, `chunk-${i.toString().padStart(4, '0')}.wav`);
    await execFileP(getFfmpegPath(), [
      '-y',
      '-ss', startSec.toFixed(3),
      '-t', durationSec.toFixed(3),
      '-i', wavPath,
      '-c', 'copy',
      out,
    ]);
    chunks.push({ path: out, offsetSec: startSec });
  }

  return chunks;
}

type WhisperWord = { word?: string; text?: string; start: number; end: number; confidence?: number };
type WhisperSegment = { start: number; end: number; text: string; words?: WhisperWord[] };
type WhisperResponse = {
  text?: string;
  words?: WhisperWord[];
  segments?: WhisperSegment[];
};

function wordToText(w: WhisperWord): string {
  return (w.word ?? w.text ?? '').trim();
}

export async function transcribeChunk(
  chunkPath: string,
  apiKey: string,
): Promise<Word[]> {
  const form = new FormData();
  const buf = await fs.readFile(chunkPath);
  const blob = new Blob([buf], { type: 'audio/wav' });
  form.append('file', blob, 'audio.wav');
  form.append('model', WHISPER_MODEL);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('timestamp_granularities[]', 'segment');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status} ${res.statusText}: ${body.slice(0, 500)}`);
  }

  const rawText = await res.text();
  log('transcribeChunk: response bytes', rawText.length, 'preview', rawText.slice(0, 500));

  let json: WhisperResponse;
  try {
    json = JSON.parse(rawText) as WhisperResponse;
  } catch (e) {
    log('transcribeChunk: JSON.parse failed:', e);
    throw new Error(`Groq returned non-JSON body: ${rawText.slice(0, 200)}`);
  }

  log(
    'transcribeChunk: parsed keys',
    Object.keys(json),
    'topWords?',
    Array.isArray(json.words) ? json.words.length : 'no',
    'segments?',
    Array.isArray(json.segments) ? json.segments.length : 'no',
    'text?',
    typeof json.text === 'string' ? json.text.length : 'no',
  );
  if (Array.isArray(json.words) && json.words[0]) {
    log('transcribeChunk: first word shape', JSON.stringify(json.words[0]));
  }
  if (Array.isArray(json.segments) && json.segments[0]) {
    log(
      'transcribeChunk: first segment shape',
      JSON.stringify({
        start: json.segments[0].start,
        end: json.segments[0].end,
        text: json.segments[0].text?.slice(0, 40),
        words: Array.isArray(json.segments[0].words) ? json.segments[0].words.length : 'no',
        firstWord: json.segments[0].words?.[0],
      }),
    );
  }

  const flat: WhisperWord[] = Array.isArray(json.words) && json.words.length > 0
    ? json.words
    : (json.segments ?? []).flatMap((s) => s.words ?? []);

  log('transcribeChunk: flattened', flat.length, 'word entries');

  const out = flat
    .map((w) => ({
      id: randomUUID(),
      text: wordToText(w),
      startSec: w.start,
      endSec: w.end,
      confidence: typeof w.confidence === 'number' ? w.confidence : 1,
    }))
    .filter((w) => w.text.length > 0);

  log('transcribeChunk: returning', out.length, 'words after empty-text filter');
  return out;
}

export function mergeChunkResults(
  perChunk: Array<{ offsetSec: number; words: Word[] }>,
): Word[] {
  const all: Word[] = [];
  for (const { offsetSec, words } of perChunk) {
    for (const w of words) {
      all.push({
        ...w,
        startSec: w.startSec + offsetSec,
        endSec: w.endSec + offsetSec,
      });
    }
  }

  all.sort((a, b) => a.startSec - b.startSec);

  const deduped: Word[] = [];
  for (const w of all) {
    const dup = deduped.some(
      (prev) =>
        prev.text === w.text &&
        Math.abs(prev.startSec - w.startSec) < DEDUPE_TIME_TOLERANCE_SEC,
    );
    if (!dup) deduped.push(w);
  }
  return deduped;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await task(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function transcribeFile(
  videoPath: string,
  apiKey: string,
  onProgress?: (p: TranscribeProgress) => void,
): Promise<Word[]> {
  log('transcribeFile: START', videoPath, 'keyLen', apiKey.length, 'keyPrefix', apiKey.slice(0, 7));
  const wav = await extractAudio(videoPath);
  const silences = await detectSilences(wav);
  log('detectSilences: found', silences.length, 'silence windows');
  const chunks = await chunkAudio(wav, silences);
  log('chunkAudio: produced', chunks.length, 'chunks:', chunks.map((c, i) => `[${i}] offset=${c.offsetSec.toFixed(2)}s size=${statSync(c.path).size}b`).join(' '));
  onProgress?.({ pct: 5, currentChunk: 0 });

  let done = 0;
  const perChunk = await runWithConcurrency(chunks, 3, async (chunk, i) => {
    log(`chunk ${i}: starting transcribe`);
    const words = await transcribeChunk(chunk.path, apiKey);
    log(`chunk ${i}: got ${words.length} words`);
    done++;
    onProgress?.({
      pct: Math.min(99, Math.round(5 + (done / chunks.length) * 94)),
      currentChunk: i,
    });
    return { offsetSec: chunk.offsetSec, words };
  });

  const merged = mergeChunkResults(perChunk);
  log('transcribeFile: merged', merged.length, 'total words across', chunks.length, 'chunks');
  onProgress?.({ pct: 100, currentChunk: chunks.length });
  return merged;
}

