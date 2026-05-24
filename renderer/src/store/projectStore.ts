import { create } from 'zustand';
import type {
  AnimationPresetKind,
  CaptionGroup,
  Output,
  Project,
  Source,
  StyleConfig,
  Word,
} from '@shared/types';

const GROUP_GAP_THRESHOLD_SEC = 0.4;
const GROUP_MAX_WORDS = 3;

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function groupWords(words: Word[]): CaptionGroup[] {
  if (words.length === 0) return [];
  const groups: CaptionGroup[] = [];
  let current: Word[] = [];

  const flush = () => {
    if (current.length === 0) return;
    groups.push({
      id: uid('grp'),
      wordIds: current.map((w) => w.id),
      startSec: current[0].startSec,
      endSec: current[current.length - 1].endSec,
    });
    current = [];
  };

  for (const w of words) {
    if (current.length === 0) {
      current.push(w);
      continue;
    }
    const prev = current[current.length - 1];
    const gap = w.startSec - prev.endSec;
    if (gap >= GROUP_GAP_THRESHOLD_SEC || current.length >= GROUP_MAX_WORDS) {
      flush();
    }
    current.push(w);
  }
  flush();
  return groups;
}

const DEFAULT_STYLE: StyleConfig = {
  fontFamily: 'Inter',
  fontSizePx: 64,
  fillColor: '#ffffff',
  outlineColor: '#000000',
  outlinePx: 4,
  position: { x: 0.5, y: 0.85, anchor: 'bottom' },
  maxWidthPx: 1400,
  lineHeight: 1.2,
};

const DEFAULT_OUTPUT: Output = {
  width: 1920,
  height: 1080,
  fps: 30,
  codec: 'prores4444',
};

const PLACEHOLDER_SOURCE: Source = {
  path: '',
  durationSec: 0,
  width: 1920,
  height: 1080,
  fps: 30,
  hasAudio: false,
};

const DEFAULT_PROJECT: Project = {
  source: PLACEHOLDER_SOURCE,
  transcript: { words: [] },
  captions: [],
  style: DEFAULT_STYLE,
  preset: { kind: 'karaoke', params: {} },
  output: DEFAULT_OUTPUT,
};

export type TranscribeStatus = {
  state: 'idle' | 'running' | 'error';
  pct: number;
  message: string | null;
};

export type ProjectState = {
  project: Project;
  hasSource: boolean;
  previewPath: string | null;
  previewPct: number | null;
  transcribe: TranscribeStatus;
  setTranscribeStatus: (patch: Partial<TranscribeStatus>) => void;
  setPreviewPath: (path: string | null) => void;
  setPreviewPct: (pct: number | null) => void;
  loadSource: (source: Source) => void;
  setWords: (words: Word[]) => void;
  regroupCaptions: () => void;
  updateWord: (id: string, patch: Partial<Word>) => void;
  splitWord: (id: string, atIndex: number) => void;
  mergeWords: (id1: string, id2: string) => void;
  nudgeWordTiming: (id: string, deltaStart: number, deltaEnd: number) => void;
  setStyle: (patch: Partial<StyleConfig>) => void;
  setPreset: (
    kind: AnimationPresetKind,
    params?: Record<string, number | string>,
  ) => void;
  setPresetParams: (params: Record<string, number | string>) => void;
  setOutput: (patch: Partial<Output>) => void;
  reset: () => void;
};

const DEFAULT_TRANSCRIBE: TranscribeStatus = {
  state: 'idle',
  pct: 0,
  message: null,
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: DEFAULT_PROJECT,
  hasSource: false,
  previewPath: null,
  previewPct: null,
  transcribe: DEFAULT_TRANSCRIBE,

  setTranscribeStatus: (patch) =>
    set((state) => ({ transcribe: { ...state.transcribe, ...patch } })),

  setPreviewPath: (path) => set({ previewPath: path }),
  setPreviewPct: (pct) => set({ previewPct: pct }),

  loadSource: (source) =>
    set((state) => ({
      hasSource: true,
      project: {
        ...state.project,
        source,
        output: {
          ...state.project.output,
          width: source.width || state.project.output.width,
          height: source.height || state.project.output.height,
          fps: source.fps || state.project.output.fps,
        },
      },
    })),

  setWords: (words) => {
    const captions = groupWords(words);
    set((state) => ({
      project: {
        ...state.project,
        transcript: { words },
        captions,
      },
    }));
  },

  regroupCaptions: () => {
    const { project } = get();
    const captions = groupWords(project.transcript.words);
    set({ project: { ...project, captions } });
  },

  updateWord: (id, patch) => {
    const { project } = get();
    const words = project.transcript.words.map((w) =>
      w.id === id ? { ...w, ...patch } : w,
    );
    const captions = groupWords(words);
    set({ project: { ...project, transcript: { words }, captions } });
  },

  splitWord: (id, atIndex) => {
    const { project } = get();
    const words = project.transcript.words;
    const idx = words.findIndex((w) => w.id === id);
    if (idx === -1) return;
    const w = words[idx];
    const left = w.text.slice(0, atIndex);
    const right = w.text.slice(atIndex);
    if (!left || !right) return;
    const mid = w.startSec + (w.endSec - w.startSec) / 2;
    const a: Word = { ...w, text: left, endSec: mid };
    const b: Word = { ...w, id: uid('w'), text: right, startSec: mid };
    const next = [...words.slice(0, idx), a, b, ...words.slice(idx + 1)];
    set({
      project: {
        ...project,
        transcript: { words: next },
        captions: groupWords(next),
      },
    });
  },

  mergeWords: (id1, id2) => {
    const { project } = get();
    const words = project.transcript.words;
    const i1 = words.findIndex((w) => w.id === id1);
    const i2 = words.findIndex((w) => w.id === id2);
    if (i1 === -1 || i2 === -1 || Math.abs(i1 - i2) !== 1) return;
    const [first, second] = i1 < i2 ? [words[i1], words[i2]] : [words[i2], words[i1]];
    const merged: Word = {
      id: first.id,
      text: `${first.text}${second.text}`,
      startSec: first.startSec,
      endSec: second.endSec,
      confidence: Math.min(first.confidence, second.confidence),
    };
    const lo = Math.min(i1, i2);
    const next = [...words.slice(0, lo), merged, ...words.slice(lo + 2)];
    set({
      project: {
        ...project,
        transcript: { words: next },
        captions: groupWords(next),
      },
    });
  },

  nudgeWordTiming: (id, deltaStart, deltaEnd) => {
    const { project } = get();
    const words = project.transcript.words.map((w) => {
      if (w.id !== id) return w;
      const startSec = Math.max(0, w.startSec + deltaStart);
      const endSec = Math.max(startSec + 0.01, w.endSec + deltaEnd);
      return { ...w, startSec, endSec };
    });
    set({
      project: {
        ...project,
        transcript: { words },
        captions: groupWords(words),
      },
    });
  },

  setStyle: (patch) => {
    const { project } = get();
    set({
      project: {
        ...project,
        style: {
          ...project.style,
          ...patch,
          position: { ...project.style.position, ...(patch.position ?? {}) },
          shadow:
            patch.shadow === undefined
              ? project.style.shadow
              : patch.shadow === null
                ? undefined
                : { ...(project.style.shadow ?? { color: '#000000', blurPx: 8, offsetY: 2 }), ...patch.shadow },
        },
      },
    });
  },

  setPreset: (kind, params) => {
    const { project } = get();
    set({
      project: {
        ...project,
        preset: { kind, params: params ?? defaultPresetParams(kind) },
      },
    });
  },

  setPresetParams: (params) => {
    const { project } = get();
    set({
      project: {
        ...project,
        preset: { ...project.preset, params: { ...project.preset.params, ...params } },
      },
    });
  },

  setOutput: (patch) => {
    const { project } = get();
    set({ project: { ...project, output: { ...project.output, ...patch } } });
  },

  reset: () =>
    set({
      project: DEFAULT_PROJECT,
      hasSource: false,
      previewPath: null,
      previewPct: null,
      transcribe: DEFAULT_TRANSCRIBE,
    }),
}));

export function defaultPresetParams(
  kind: AnimationPresetKind,
): Record<string, number | string> {
  switch (kind) {
    case 'karaoke':
      return { highlightColor: '#ffd60a' };
    case 'popIn':
      return { stiffness: 180, damping: 12 };
    case 'slideUp':
      return { distancePx: 40, durationMs: 220 };
    case 'typewriter':
      return { charPerSec: 24 };
    case 'bouncing':
      return { stiffness: 200, damping: 8 };
  }
}
