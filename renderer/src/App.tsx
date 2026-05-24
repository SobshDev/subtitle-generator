import { useEffect, useState } from 'react';
import { ipc } from './ipc/client';
import { useProjectStore } from './store/projectStore';
import { ApiKeySetup } from './views/ApiKeySetup';
import { DropZone } from './views/DropZone';
import { ExportDialog } from './views/ExportDialog';
import { PresetPicker } from './views/PresetPicker';
import { PreviewPane } from './views/PreviewPane';
import { StylePanel } from './views/StylePanel';
import { TranscriptEditor } from './views/TranscriptEditor';

type KeyStatus = 'checking' | 'present' | 'missing';

export function App(): JSX.Element {
  const hasSource = useProjectStore((s) => s.hasSource);
  const project = useProjectStore((s) => s.project);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>('checking');
  const [exportOpen, setExportOpen] = useState(false);

  const transcribe = useProjectStore((s) => s.transcribe);

  const checkKey = async () => {
    try {
      const { hasKey } = await ipc.hasGroqKey();
      setKeyStatus(hasKey ? 'present' : 'missing');
    } catch {
      setKeyStatus('missing');
    }
  };

  useEffect(() => {
    void checkKey();
  }, []);

  useEffect(() => {
    const offPrev = ipc.onEnsurePreviewProgress((payload) => {
      useProjectStore.getState().setPreviewPct(payload.pct);
    });
    return () => offPrev();
  }, []);

  useEffect(() => {
    const store = useProjectStore;
    const offP = ipc.onTranscribeProgress((payload) => {
      console.log('[renderer] transcribe:progress', payload);
      store.getState().setTranscribeStatus({
        state: 'running',
        pct: payload.pct,
        message: `Transcribing… ${Math.round(payload.pct)}%`,
      });
    });
    const offD = ipc.onTranscribeDone((payload) => {
      console.log(
        '[renderer] transcribe:done payload — wordCount=',
        payload.words?.length,
        'error=',
        (payload as { error?: string }).error,
        'firstWord=',
        payload.words?.[0],
      );
      const err = (payload as { error?: string }).error;
      if (err) {
        store.getState().setTranscribeStatus({
          state: 'error',
          pct: 0,
          message: `Transcription failed: ${err}`,
        });
        return;
      }
      store.getState().setWords(payload.words);
      store.getState().setTranscribeStatus({
        state: 'idle',
        pct: 100,
        message: `Transcribed ${payload.words.length} words`,
      });
    });
    return () => {
      offP();
      offD();
    };
  }, []);

  if (keyStatus === 'checking') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-neutral-950 text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  if (keyStatus === 'missing') {
    return <ApiKeySetup onSaved={() => setKeyStatus('present')} />;
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-neutral-800 px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-tight">
            Subtitle Generator
          </h1>
          {hasSource && (
            <span className="font-mono text-[11px] text-neutral-500">
              {project.source.path.split('/').pop()} · {project.output.width}×
              {project.output.height} @ {project.output.fps}fps
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          disabled={!hasSource}
          className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Export…
        </button>
      </header>

      <main className="flex min-h-0 flex-1">
        <aside className="flex w-[280px] shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
          <TranscriptEditor />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 p-3">
            <PreviewPane />
          </div>
          <div className="h-[180px] shrink-0 border-t border-neutral-800 p-3">
            {hasSource ? (
              <div className="flex h-full items-center justify-between rounded-md border border-neutral-800 bg-neutral-900/40 px-4 text-xs text-neutral-400">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-neutral-300">{project.source.path.split('/').pop()}</p>
                  <p className="mt-1">
                    Duration {project.source.durationSec.toFixed(2)}s · {project.transcript.words.length} words · {project.captions.length} captions
                  </p>
                  {transcribe.message && (
                    <div className="mt-2 max-w-sm">
                      <p className={`text-[11px] ${transcribe.state === 'error' ? 'text-rose-300' : 'text-neutral-400'}`}>
                        {transcribe.message}
                      </p>
                      {transcribe.state === 'running' && (
                        <div className="mt-1 h-1 w-full overflow-hidden rounded bg-neutral-800">
                          <div
                            className="h-full bg-sky-500 transition-[width] duration-200"
                            style={{ width: `${Math.round(transcribe.pct)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => useProjectStore.getState().reset()}
                  className="ml-3 rounded bg-neutral-800 px-3 py-1.5 text-xs hover:bg-neutral-700"
                >
                  Load different file
                </button>
              </div>
            ) : (
              <DropZone />
            )}
          </div>
        </section>

        <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-neutral-800 bg-neutral-950">
          <StylePanel />
          <div className="border-t border-neutral-800" />
          <PresetPicker />
        </aside>
      </main>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
