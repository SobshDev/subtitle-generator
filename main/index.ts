import { app, BrowserWindow, net, protocol } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerIpcHandlers } from './ipc';
import { ensureFirstRunSetup } from './firstRun';

const isDev = !app.isPackaged;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'subgen-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: false,
    },
  },
]);

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0b0b0d',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  win.webContents.on('console-message', (_event, level, message, line, source) => {
    const tag = ['VERB', 'INFO', 'WARN', 'ERR '][level] ?? '?';
    const src = source ? ` (${source.split('/').pop()}:${line})` : '';
    console.log(`[renderer ${tag}] ${message}${src}`);
  });

  return win;
}

app.whenReady().then(() => {
  protocol.handle('subgen-media', async (request) => {
    try {
      const url = new URL(request.url);
      const filePath = decodeURIComponent(url.pathname);
      return await net.fetch(pathToFileURL(filePath).toString());
    } catch (err) {
      console.error('[subgen-media] failed to serve', request.url, err);
      return new Response('Not found', { status: 404 });
    }
  });

  registerIpcHandlers();
  createWindow();

  void ensureFirstRunSetup().catch((err) => {
    console.error('first-run setup failed', err);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
