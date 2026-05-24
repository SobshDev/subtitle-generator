import { useState } from 'react';
import { ipc } from '../ipc/client';
import { useProjectStore } from '../store/projectStore';

const ACCEPTED = ['.mov', '.mkv', '.mp3', '.mp4', '.wav', '.m4a'];

export function DropZone(): JSX.Element {
  const loadSource = useProjectStore((s) => s.loadSource);
  const setTranscribeStatus = useProjectStore((s) => s.setTranscribeStatus);
  const transcribe = useProjectStore((s) => s.transcribe);
  const [drag, setDrag] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleFile(path: string): Promise<void> {
    console.log('[renderer] handleFile', path);
    setLocalError(null);
    setTranscribeStatus({ state: 'running', pct: 0, message: 'Probing media…' });
    try {
      const source = await ipc.probeMedia({ path });
      console.log('[renderer] probeMedia →', source);
      loadSource(source);

      void ipc
        .ensurePreview({ srcPath: path })
        .then(({ previewPath }) => {
          console.log('[renderer] previewPath ready', previewPath);
          useProjectStore.getState().setPreviewPath(previewPath);
          useProjectStore.getState().setPreviewPct(null);
        })
        .catch((err) => {
          console.error('[renderer] ensurePreview failed', err);
        });

      setTranscribeStatus({ state: 'running', pct: 1, message: 'Starting transcription…' });
      const job = await ipc.startTranscription({ audioPath: path });
      console.log('[renderer] startTranscription jobId =', job.jobId);
    } catch (err) {
      console.error('[renderer] handleFile error', err);
      const message = (err as Error).message;
      setLocalError(message);
      setTranscribeStatus({ state: 'error', pct: 0, message });
    }
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const filePath = ipc.getPathForFile(file);
    if (!filePath) {
      setLocalError('Could not read file path from drop.');
      return;
    }
    void handleFile(filePath);
  };

  const onPickClick = async () => {
    const { path } = await ipc.chooseOpenPath({
      filters: [
        { name: 'Video/Audio', extensions: ACCEPTED.map((a) => a.replace('.', '')) },
      ],
    });
    if (!path) return;
    void handleFile(path);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={`flex h-full w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
        drag
          ? 'border-sky-400 bg-sky-400/10'
          : 'border-neutral-700 bg-neutral-900/50 hover:border-neutral-500'
      }`}
    >
      <div className="mb-4 text-5xl text-neutral-500">↓</div>
      <p className="mb-1 text-base font-medium text-neutral-200">
        Drop a video or audio file
      </p>
      <p className="mb-4 text-xs text-neutral-500">
        {ACCEPTED.join(' · ')}
      </p>
      <button
        type="button"
        onClick={onPickClick}
        className="rounded bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700"
      >
        Browse…
      </button>
      {(transcribe.message || localError) && (
        <div className="mt-6 w-full max-w-sm">
          <p className={`mb-2 text-center text-xs ${transcribe.state === 'error' || localError ? 'text-rose-300' : 'text-neutral-400'}`}>
            {localError ?? transcribe.message}
          </p>
          {transcribe.state === 'running' && (
            <div className="h-1.5 w-full overflow-hidden rounded bg-neutral-800">
              <div
                className="h-full bg-sky-500 transition-[width] duration-200"
                style={{ width: `${Math.round(transcribe.pct)}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
