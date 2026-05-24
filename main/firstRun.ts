import { app, BrowserWindow } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { IpcChannel, type FirstRunProgress } from '@shared/ipc';
import { ensureChromium } from './render';

function getFlagPath(): string {
  return path.join(app.getPath('userData'), '.first-run-complete');
}

async function hasCompletedFirstRun(): Promise<boolean> {
  try {
    await fs.access(getFlagPath());
    return true;
  } catch {
    return false;
  }
}

async function markFirstRunComplete(): Promise<void> {
  const flagPath = getFlagPath();
  await fs.mkdir(path.dirname(flagPath), { recursive: true });
  await fs.writeFile(flagPath, new Date().toISOString(), 'utf8');
}

function broadcast(payload: FirstRunProgress['Response']): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IpcChannel.FirstRunProgress, payload);
    }
  }
}

let firstRunPromise: Promise<void> | null = null;

export function ensureFirstRunSetup(): Promise<void> {
  if (firstRunPromise) return firstRunPromise;

  firstRunPromise = (async () => {
    if (await hasCompletedFirstRun()) {
      broadcast({ phase: 'done' });
      return;
    }

    try {
      await ensureChromium((p) => {
        broadcast({
          phase: 'chromium',
          pct: p.pct,
          downloadedBytes: p.downloadedBytes,
          totalBytes: p.totalBytes,
        });
      });
      await markFirstRunComplete();
      broadcast({ phase: 'done' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      broadcast({ phase: 'error', message });
      firstRunPromise = null;
      throw err;
    }
  })();

  return firstRunPromise;
}
