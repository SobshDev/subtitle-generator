import type { AnimationPresetKind } from '@shared/types';
import { defaultPresetParams, useProjectStore } from '../store/projectStore';

const PRESETS: {
  kind: AnimationPresetKind;
  label: string;
  description: string;
}[] = [
  { kind: 'karaoke', label: 'Karaoke', description: 'Word-by-word highlight' },
  { kind: 'popIn', label: 'Pop In', description: 'Springy entrance' },
  { kind: 'slideUp', label: 'Slide Up', description: 'Translate from below' },
  { kind: 'typewriter', label: 'Typewriter', description: 'Char by char' },
  { kind: 'bouncing', label: 'Bouncing', description: 'Elastic bounce' },
];

const PARAM_SPECS: Record<
  AnimationPresetKind,
  { key: string; label: string; min: number; max: number; step: number }[]
> = {
  karaoke: [],
  popIn: [
    { key: 'stiffness', label: 'Stiffness', min: 40, max: 400, step: 5 },
    { key: 'damping', label: 'Damping', min: 1, max: 40, step: 1 },
  ],
  slideUp: [
    { key: 'distancePx', label: 'Distance', min: 0, max: 200, step: 1 },
    { key: 'durationMs', label: 'Duration ms', min: 60, max: 800, step: 10 },
  ],
  typewriter: [
    { key: 'charPerSec', label: 'Chars/sec', min: 4, max: 80, step: 1 },
  ],
  bouncing: [
    { key: 'stiffness', label: 'Stiffness', min: 40, max: 400, step: 5 },
    { key: 'damping', label: 'Damping', min: 1, max: 40, step: 1 },
  ],
};

export function PresetPicker(): JSX.Element {
  const preset = useProjectStore((s) => s.project.preset);
  const style = useProjectStore((s) => s.project.style);
  const setPreset = useProjectStore((s) => s.setPreset);
  const setPresetParams = useProjectStore((s) => s.setPresetParams);

  const specs = PARAM_SPECS[preset.kind];
  const colorKey = Object.entries(preset.params).find(
    ([k]) => k.toLowerCase().includes('color'),
  );

  return (
    <div className="space-y-3 p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Animation
      </h2>

      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => {
          const active = preset.kind === p.kind;
          return (
            <button
              key={p.kind}
              type="button"
              onClick={() => setPreset(p.kind, defaultPresetParams(p.kind))}
              title={p.description}
              className={`group flex flex-col items-stretch gap-1 rounded-md border p-2 text-left transition ${
                active
                  ? 'border-sky-500 bg-sky-500/10'
                  : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-600'
              }`}
            >
              <PresetThumb kind={p.kind} fill={style.fillColor} />
              <span className="text-[11px] font-medium text-neutral-100">
                {p.label}
              </span>
            </button>
          );
        })}
      </div>

      {(specs.length > 0 || colorKey) && (
        <div className="space-y-2 rounded-md border border-neutral-800 bg-neutral-900/40 p-2">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            {preset.kind} params
          </p>
          {specs.map((s) => {
            const v = Number(preset.params[s.key] ?? 0);
            return (
              <label key={s.key} className="block">
                <span className="mb-0.5 flex items-center justify-between text-[11px] text-neutral-400">
                  <span>{s.label}</span>
                  <span className="text-neutral-300">{v}</span>
                </span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={v}
                  onChange={(e) =>
                    setPresetParams({ [s.key]: parseFloat(e.target.value) })
                  }
                  className="w-full accent-sky-500"
                />
              </label>
            );
          })}
          {colorKey && (
            <label className="block">
              <span className="mb-0.5 block text-[11px] text-neutral-400">
                {colorKey[0]}
              </span>
              <input
                type="color"
                value={String(colorKey[1])}
                onChange={(e) =>
                  setPresetParams({ [colorKey[0]]: e.target.value })
                }
                className="h-7 w-full cursor-pointer rounded border border-neutral-700 bg-neutral-800"
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function PresetThumb({
  kind,
  fill,
}: {
  kind: AnimationPresetKind;
  fill: string;
}): JSX.Element {
  const motion: Record<AnimationPresetKind, string> = {
    karaoke: 'tracking-wide',
    popIn: 'animate-pulse',
    slideUp: 'translate-y-0',
    typewriter: 'font-mono',
    bouncing: 'animate-bounce',
  };
  return (
    <div className="flex h-10 items-center justify-center rounded bg-black/40 text-base font-bold">
      <span className={motion[kind]} style={{ color: fill }}>
        Aa
      </span>
    </div>
  );
}
