import type {
  DialogChooseOpenPath,
  ExportChooseSavePath,
  ExportDone,
  ExportProgress,
  ExportStart,
  MediaEnsurePreview,
  MediaEnsurePreviewProgress,
  MediaProbe,
  SecretsHasGroqKey,
  SecretsSetGroqKey,
  TranscribeDone,
  TranscribeProgress,
  TranscribeStart,
} from '@shared/ipc';

const api = () => window.api;

export const ipc = {
  probeMedia: (req: MediaProbe['Request']) => api().mediaProbe(req),

  ensurePreview: (req: MediaEnsurePreview['Request']) =>
    api().mediaEnsurePreview(req),

  onEnsurePreviewProgress: (
    cb: (p: MediaEnsurePreviewProgress['Response']) => void,
  ) => api().onMediaEnsurePreviewProgress(cb),

  startTranscription: (req: TranscribeStart['Request']) =>
    api().transcribeStart(req),

  onTranscribeProgress: (cb: (p: TranscribeProgress['Response']) => void) =>
    api().onTranscribeProgress(cb),

  onTranscribeDone: (cb: (p: TranscribeDone['Response']) => void) =>
    api().onTranscribeDone(cb),

  startExport: (req: ExportStart['Request']) => api().exportStart(req),

  onExportProgress: (cb: (p: ExportProgress['Response']) => void) =>
    api().onExportProgress(cb),

  onExportDone: (cb: (p: ExportDone['Response']) => void) =>
    api().onExportDone(cb),

  setGroqKey: (req: SecretsSetGroqKey['Request']) =>
    api().secretsSetGroqKey(req),

  hasGroqKey: () => api().secretsHasGroqKey(),

  chooseSavePath: (req: ExportChooseSavePath['Request'] = {}) =>
    api().exportChooseSavePath(req),

  chooseOpenPath: (req: DialogChooseOpenPath['Request'] = {}) =>
    api().dialogChooseOpenPath(req),

  getPathForFile: (file: File) => api().getPathForFile(file),
};
