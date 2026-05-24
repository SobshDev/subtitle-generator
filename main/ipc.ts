import { BrowserWindow, dialog, ipcMain, webContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import keytar from 'keytar';
import { getFonts } from 'font-list';
import {
  IpcChannel,
  type DialogChooseOpenPath,
  type ExportChooseSavePath,
  type ExportDone,
  type ExportProgress,
  type ExportStart,
  type FontsListSystem,
  type MediaEnsurePreview,
  type MediaEnsurePreviewProgress,
  type MediaProbe,
  type SecretsHasGroqKey,
  type SecretsSetGroqKey,
  type TranscribeDone,
  type TranscribeProgress,
  type TranscribeStart,
} from '@shared/ipc';
import { ensurePreviewMp4, probeMedia } from './media';
import { transcribeFile } from './transcribe';
import {
  getDefaultExportDir,
  renderProject,
  validateAlpha,
} from './render';

const KEYTAR_SERVICE = 'subtitle-generator';
const KEYTAR_ACCOUNT_GROQ = 'groq';

function broadcast<T>(channel: IpcChannel, payload: T): void {
  for (const wc of webContents.getAllWebContents()) {
    if (!wc.isDestroyed()) wc.send(channel, payload);
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle(
    IpcChannel.MediaProbe,
    async (_e, req: MediaProbe['Request']): Promise<MediaProbe['Response']> => {
      return probeMedia(req.path);
    },
  );

  ipcMain.handle(
    IpcChannel.MediaEnsurePreview,
    async (
      _e,
      req: MediaEnsurePreview['Request'],
    ): Promise<MediaEnsurePreview['Response']> => {
      const previewPath = await ensurePreviewMp4(req.srcPath, (pct) => {
        const payload: MediaEnsurePreviewProgress['Response'] = {
          srcPath: req.srcPath,
          pct,
        };
        broadcast(IpcChannel.MediaEnsurePreviewProgress, payload);
      });
      return { previewPath };
    },
  );

  ipcMain.handle(
    IpcChannel.TranscribeStart,
    async (
      _e,
      req: TranscribeStart['Request'],
    ): Promise<TranscribeStart['Response']> => {
      const apiKey = await keytar.getPassword(
        KEYTAR_SERVICE,
        KEYTAR_ACCOUNT_GROQ,
      );
      if (!apiKey) {
        throw new Error('Groq API key not set');
      }

      const jobId = randomUUID();
      console.log(`[ipc transcribe:start] jobId=${jobId} path=${req.audioPath} keyLen=${apiKey.length}`);

      void (async () => {
        try {
          const words = await transcribeFile(req.audioPath, apiKey, (p) => {
            const payload: TranscribeProgress['Response'] = {
              jobId,
              pct: p.pct,
              currentChunk: p.currentChunk,
            };
            broadcast(IpcChannel.TranscribeProgress, payload);
          });
          const donePayload: TranscribeDone['Response'] = { jobId, words };
          console.log(`[ipc transcribe:done] jobId=${jobId} broadcasting ${words.length} words`);
          broadcast(IpcChannel.TranscribeDone, donePayload);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[ipc transcribe:done] jobId=${jobId} ERROR ${message}`);
          for (const win of BrowserWindow.getAllWindows()) {
            win.webContents.send(IpcChannel.TranscribeDone, {
              jobId,
              words: [],
              error: message,
            });
          }
          console.error(`[transcribe ${jobId}]`, err);
        }
      })();

      return { jobId };
    },
  );

  ipcMain.handle(
    IpcChannel.SecretsSetGroqKey,
    async (
      _e,
      req: SecretsSetGroqKey['Request'],
    ): Promise<SecretsSetGroqKey['Response']> => {
      await keytar.setPassword(
        KEYTAR_SERVICE,
        KEYTAR_ACCOUNT_GROQ,
        req.key,
      );
      return { ok: true };
    },
  );

  ipcMain.handle(
    IpcChannel.SecretsHasGroqKey,
    async (): Promise<SecretsHasGroqKey['Response']> => {
      const v = await keytar.getPassword(
        KEYTAR_SERVICE,
        KEYTAR_ACCOUNT_GROQ,
      );
      return { hasKey: Boolean(v) };
    },
  );

  ipcMain.handle(
    IpcChannel.FontsListSystem,
    async (): Promise<FontsListSystem['Response']> => {
      const raw = await getFonts({ disableQuoting: true });
      const cleaned = Array.from(
        new Set(raw.map((f) => f.replace(/^"(.*)"$/, '$1').trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b));
      return { fonts: cleaned };
    },
  );

  ipcMain.handle(
    IpcChannel.DialogChooseOpenPath,
    async (
      _e,
      req: DialogChooseOpenPath['Request'],
    ): Promise<DialogChooseOpenPath['Response']> => {
      const result = await dialog.showOpenDialog({
        title: req.title ?? 'Choose a video or audio file',
        properties: ['openFile'],
        filters: req.filters ?? [
          {
            name: 'Video/Audio',
            extensions: ['mov', 'mkv', 'mp4', 'mp3', 'wav', 'm4a'],
          },
        ],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { path: null };
      }
      return { path: result.filePaths[0] };
    },
  );

  ipcMain.handle(
    IpcChannel.ExportChooseSavePath,
    async (
      _e,
      req: ExportChooseSavePath['Request'],
    ): Promise<ExportChooseSavePath['Response']> => {
      const defaultFileName = req.defaultFileName ?? 'subtitles.mov';
      const defaultPath = join(getDefaultExportDir(), defaultFileName);
      const result = await dialog.showSaveDialog({
        title: 'Export subtitle overlay',
        defaultPath,
        filters: [{ name: 'ProRes 4444 (.mov)', extensions: ['mov'] }],
      });
      if (result.canceled || !result.filePath) return { path: null };
      return { path: result.filePath };
    },
  );

  ipcMain.handle(
    IpcChannel.ExportStart,
    async (
      e,
      req: ExportStart['Request'],
    ): Promise<ExportStart['Response']> => {
      const jobId = randomUUID();
      const senderWc = e.sender;

      void (async () => {
        const send = <T>(channel: IpcChannel, payload: T) => {
          if (!senderWc.isDestroyed()) senderWc.send(channel, payload);
        };

        try {
          await renderProject(req.project, req.outputPath, (p) => {
            const payload: ExportProgress['Response'] = {
              jobId,
              pct: p.pct,
              frame: p.frame,
              totalFrames: p.totalFrames,
            };
            send(IpcChannel.ExportProgress, payload);
          });

          const alphaConfirmed = await validateAlpha(req.outputPath);
          const donePayload: ExportDone['Response'] = {
            jobId,
            outputPath: req.outputPath,
            alphaConfirmed,
          };
          send(IpcChannel.ExportDone, donePayload);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[export ${jobId}]`, err);
          const donePayload: ExportDone['Response'] = {
            jobId,
            outputPath: req.outputPath,
            alphaConfirmed: false,
            error: message,
          };
          send(IpcChannel.ExportDone, donePayload);
        }
      })();

      return { jobId };
    },
  );
}
