import { useEffect, useState } from 'react';
import { ipc } from '../ipc/client';
import { useProjectStore } from '../store/projectStore';

const RESOLUTION_PRESETS = [
  { label: '1080p (1920×1080)', w: 1920, h: 1080 },
  { label: '4K (3840×2160)', w: 3840, h: 2160 },
  { label: 'Vertical (1080×1920)', w: 1080, h: 1920 },
  { label: 'Custom', w: 0, h: 0 },
] as const;

const FPS_OPTIONS = [24, 30, 60];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ExportDialog({ open, onClose }: Props): JSX.Element | null {
  const project = useProjectStore((s) => s.project);
  const setOutput = useProjectStore((s) => s.setOutput);

  const [presetIdx, setPresetIdx] = useState(0);
  const [customW, setCustomW] = useState(project.output.width);
  const [customH, setCustomH] = useState(project.output.height);
  const [outputPath, setOutputPath] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [pct, setPct] = useState(0);
  const [frame, setFrame] = useState({ done: 0, total: 0 });
  const [donePath, setDonePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const offP = ipc.onExportProgress(({ pct, frame, totalFrames }) => {
      setPct(pct);
      setFrame({ done: frame, total: totalFrames });
    });
    const offD = ipc.onExportDone(({ outputPath, alphaConfirmed, error }) => {
      setExporting(false);
      if (error) {
        setError(error);
        return;
      }
      setDonePath(outputPath);
      if (!alphaConfirmed) {
        setError('Export finished but alpha channel was not detected.');
      }
    });
    return () => {
      offP();
      offD();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPct(0);
      setFrame({ done: 0, total: 0 });
      setDonePath(null);
      setError(null);
      setExporting(false);
    }
  }, [open]);

  if (!open) return null;

  const isCustom = presetIdx === RESOLUTION_PRESETS.length - 1;
  const width = isCustom ? customW : RESOLUTION_PRESETS[presetIdx].w;
  const height = isCustom ? customH : RESOLUTION_PRESETS[presetIdx].h;

  const onChoosePath = async () => {
    const base = project.source.path
      ? project.source.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'subtitles'
      : 'subtitles';
    const res = await ipc.chooseSavePath({ defaultFileName: `${base}.subtitles.mov` });
    if (res.path) setOutputPath(res.path);
  };

  const onExport = async () => {
    setError(null);
    if (!outputPath) {
      setError('Choose an output path first.');
      return;
    }
    setOutput({ width, height, fps: project.output.fps });
    const updated = {
      ...project,
      output: { ...project.output, width, height },
    };
    setExporting(true);
    setDonePath(null);
    try {
      await ipc.startExport({ project: updated, outputPath });
    } catch (err) {
      setError((err as Error).message);
      setExporting(false);
    }
  };

  const onReveal = () => {
    if (!donePath) return;
    const a = document.createElement('a');
    a.href = `file://${donePath}`;
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">Export</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-neutral-400">
              Resolution
            </span>
            <select
              value={presetIdx}
              onChange={(e) => setPresetIdx(Number(e.target.value))}
              className="w-full rounded bg-neutral-800 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-sky-500"
            >
              {RESOLUTION_PRESETS.map((p, i) => (
                <option key={p.label} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {isCustom && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wider text-neutral-400">
                  Width
                </span>
                <input
                  type="number"
                  value={customW}
                  onChange={(e) => setCustomW(Number(e.target.value))}
                  className="w-full rounded bg-neutral-800 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wider text-neutral-400">
                  Height
                </span>
                <input
                  type="number"
                  value={customH}
                  onChange={(e) => setCustomH(Number(e.target.value))}
                  className="w-full rounded bg-neutral-800 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-neutral-400">
              FPS
            </span>
            <select
              value={project.output.fps}
              onChange={(e) => setOutput({ fps: Number(e.target.value) })}
              className="w-full rounded bg-neutral-800 px-2 py-1.5 text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-sky-500"
            >
              {FPS_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1 block text-xs uppercase tracking-wider text-neutral-400">
              Output file
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={outputPath}
                readOnly
                placeholder="No file chosen"
                className="flex-1 rounded bg-neutral-800 px-2 py-1.5 font-mono text-xs text-neutral-200 outline-none"
              />
              <button
                type="button"
                onClick={onChoosePath}
                className="rounded bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 hover:bg-neutral-700"
              >
                Choose…
              </button>
            </div>
            <p className="mt-1 text-[10px] text-neutral-500">
              ProRes 4444 with alpha (.mov)
            </p>
          </div>

          {exporting && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-neutral-400">
                <span>Rendering frame {frame.done} / {frame.total}</span>
                <span>{Math.round(pct)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded bg-neutral-800">
                <div
                  className="h-full bg-sky-500 transition-[width] duration-200"
                  style={{ width: `${Math.round(pct)}%` }}
                />
              </div>
            </div>
          )}

          {donePath && (
            <div className="rounded border border-emerald-600/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              <p className="font-medium">Export complete</p>
              <p className="mt-1 break-all font-mono text-xs text-emerald-300/80">
                {donePath}
              </p>
              <button
                type="button"
                onClick={onReveal}
                className="mt-2 rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
              >
                Reveal in Finder
              </button>
            </div>
          )}

          {error && (
            <p className="rounded border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-200">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onExport}
              disabled={exporting}
              className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
