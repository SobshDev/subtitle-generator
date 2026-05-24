import { contextBridge, ipcRenderer, webUtils } from 'electron';
import {
  IpcChannel,
  type DialogChooseOpenPath,
  type ExportChooseSavePath,
  type ExportDone,
  type ExportProgress,
  type ExportStart,
  type FirstRunProgress,
  type MediaEnsurePreview,
  type MediaEnsurePreviewProgress,
  type MediaProbe,
  type RendererApi,
  type SecretsHasGroqKey,
  type SecretsSetGroqKey,
  type TranscribeDone,
  type TranscribeProgress,
  type TranscribeStart,
} from '@shared/ipc';

function subscribe<T>(channel: IpcChannel, cb: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: RendererApi = {
  mediaProbe: (req: MediaProbe['Request']) =>
    ipcRenderer.invoke(IpcChannel.MediaProbe, req),
  mediaEnsurePreview: (req: MediaEnsurePreview['Request']) =>
    ipcRenderer.invoke(IpcChannel.MediaEnsurePreview, req),
  onMediaEnsurePreviewProgress: (cb) =>
    subscribe<MediaEnsurePreviewProgress['Response']>(
      IpcChannel.MediaEnsurePreviewProgress,
      cb,
    ),
  transcribeStart: (req: TranscribeStart['Request']) =>
    ipcRenderer.invoke(IpcChannel.TranscribeStart, req),
  onTranscribeProgress: (cb) =>
    subscribe<TranscribeProgress['Response']>(IpcChannel.TranscribeProgress, cb),
  onTranscribeDone: (cb) =>
    subscribe<TranscribeDone['Response']>(IpcChannel.TranscribeDone, cb),
  exportStart: (req: ExportStart['Request']) =>
    ipcRenderer.invoke(IpcChannel.ExportStart, req),
  onExportProgress: (cb) =>
    subscribe<ExportProgress['Response']>(IpcChannel.ExportProgress, cb),
  onExportDone: (cb) =>
    subscribe<ExportDone['Response']>(IpcChannel.ExportDone, cb),
  exportChooseSavePath: (req: ExportChooseSavePath['Request']) =>
    ipcRenderer.invoke(IpcChannel.ExportChooseSavePath, req),
  dialogChooseOpenPath: (req: DialogChooseOpenPath['Request']) =>
    ipcRenderer.invoke(IpcChannel.DialogChooseOpenPath, req),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  onFirstRunProgress: (cb) =>
    subscribe<FirstRunProgress['Response']>(IpcChannel.FirstRunProgress, cb),
  secretsSetGroqKey: (req: SecretsSetGroqKey['Request']) =>
    ipcRenderer.invoke(IpcChannel.SecretsSetGroqKey, req),
  secretsHasGroqKey: () =>
    ipcRenderer.invoke(IpcChannel.SecretsHasGroqKey),
  fontsListSystem: () => ipcRenderer.invoke(IpcChannel.FontsListSystem),
};

contextBridge.exposeInMainWorld('api', api);
