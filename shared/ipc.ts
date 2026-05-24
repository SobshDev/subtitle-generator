import type { Project, Source, Word } from './types';

export enum IpcChannel {
  MediaProbe = 'media:probe',
  MediaEnsurePreview = 'media:ensurePreview',
  MediaEnsurePreviewProgress = 'media:ensurePreviewProgress',
  TranscribeStart = 'transcribe:start',
  TranscribeProgress = 'transcribe:progress',
  TranscribeDone = 'transcribe:done',
  ExportStart = 'export:start',
  ExportProgress = 'export:progress',
  ExportDone = 'export:done',
  ExportChooseSavePath = 'export:chooseSavePath',
  DialogChooseOpenPath = 'dialog:chooseOpenPath',
  FirstRunProgress = 'firstRun:progress',
  SecretsSetGroqKey = 'secrets:setGroqKey',
  SecretsHasGroqKey = 'secrets:hasGroqKey',
}

export type MediaProbe = {
  Request: { path: string };
  Response: Source;
};

export type MediaEnsurePreview = {
  Request: { srcPath: string };
  Response: { previewPath: string };
};

export type MediaEnsurePreviewProgress = {
  Request: never;
  Response: { srcPath: string; pct: number };
};

export type TranscribeStart = {
  Request: { audioPath: string; language?: string };
  Response: { jobId: string };
};

export type TranscribeProgress = {
  Request: never;
  Response: { jobId: string; pct: number; currentChunk: number };
};

export type TranscribeDone = {
  Request: never;
  Response: { jobId: string; words: Word[] };
};

export type ExportStart = {
  Request: { project: Project; outputPath: string };
  Response: { jobId: string };
};

export type ExportProgress = {
  Request: never;
  Response: { jobId: string; pct: number; frame: number; totalFrames: number };
};

export type ExportDone = {
  Request: never;
  Response: {
    jobId: string;
    outputPath: string;
    alphaConfirmed: boolean;
    error?: string;
  };
};

export type ExportChooseSavePath = {
  Request: { defaultFileName?: string };
  Response: { path: string | null };
};

export type DialogChooseOpenPath = {
  Request: {
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  };
  Response: { path: string | null };
};

export type FirstRunProgress = {
  Request: never;
  Response:
    | { phase: 'chromium'; pct: number; downloadedBytes?: number; totalBytes?: number }
    | { phase: 'done' }
    | { phase: 'error'; message: string };
};

export type SecretsSetGroqKey = {
  Request: { key: string };
  Response: { ok: true };
};

export type SecretsHasGroqKey = {
  Request: never;
  Response: { hasKey: boolean };
};

export type IpcChannelMap = {
  [IpcChannel.MediaProbe]: MediaProbe;
  [IpcChannel.MediaEnsurePreview]: MediaEnsurePreview;
  [IpcChannel.MediaEnsurePreviewProgress]: MediaEnsurePreviewProgress;
  [IpcChannel.TranscribeStart]: TranscribeStart;
  [IpcChannel.TranscribeProgress]: TranscribeProgress;
  [IpcChannel.TranscribeDone]: TranscribeDone;
  [IpcChannel.ExportStart]: ExportStart;
  [IpcChannel.ExportProgress]: ExportProgress;
  [IpcChannel.ExportDone]: ExportDone;
  [IpcChannel.ExportChooseSavePath]: ExportChooseSavePath;
  [IpcChannel.DialogChooseOpenPath]: DialogChooseOpenPath;
  [IpcChannel.FirstRunProgress]: FirstRunProgress;
  [IpcChannel.SecretsSetGroqKey]: SecretsSetGroqKey;
  [IpcChannel.SecretsHasGroqKey]: SecretsHasGroqKey;
};

export type RendererApi = {
  mediaProbe: (req: MediaProbe['Request']) => Promise<MediaProbe['Response']>;
  mediaEnsurePreview: (
    req: MediaEnsurePreview['Request'],
  ) => Promise<MediaEnsurePreview['Response']>;
  onMediaEnsurePreviewProgress: (
    cb: (payload: MediaEnsurePreviewProgress['Response']) => void,
  ) => () => void;
  transcribeStart: (
    req: TranscribeStart['Request'],
  ) => Promise<TranscribeStart['Response']>;
  onTranscribeProgress: (
    cb: (payload: TranscribeProgress['Response']) => void,
  ) => () => void;
  onTranscribeDone: (
    cb: (payload: TranscribeDone['Response']) => void,
  ) => () => void;
  exportStart: (
    req: ExportStart['Request'],
  ) => Promise<ExportStart['Response']>;
  onExportProgress: (
    cb: (payload: ExportProgress['Response']) => void,
  ) => () => void;
  onExportDone: (
    cb: (payload: ExportDone['Response']) => void,
  ) => () => void;
  exportChooseSavePath: (
    req: ExportChooseSavePath['Request'],
  ) => Promise<ExportChooseSavePath['Response']>;
  dialogChooseOpenPath: (
    req: DialogChooseOpenPath['Request'],
  ) => Promise<DialogChooseOpenPath['Response']>;
  getPathForFile: (file: File) => string;
  onFirstRunProgress: (
    cb: (payload: FirstRunProgress['Response']) => void,
  ) => () => void;
  secretsSetGroqKey: (
    req: SecretsSetGroqKey['Request'],
  ) => Promise<SecretsSetGroqKey['Response']>;
  secretsHasGroqKey: () => Promise<SecretsHasGroqKey['Response']>;
};

declare global {
  interface Window {
    api: RendererApi;
  }
}
