import { BUNDLED_FONTS } from '@shared/types';
import { useProjectStore } from '../store/projectStore';

export function StylePanel(): JSX.Element {
  const style = useProjectStore((s) => s.project.style);
  const setStyle = useProjectStore((s) => s.setStyle);

  const shadowEnabled = !!style.shadow;

  return (
    <div className="space-y-4 p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Style
      </h2>

      <Field label="Font">
        <select
          value={style.fontFamily}
          onChange={(e) => setStyle({ fontFamily: e.target.value })}
          className="w-full rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-sky-500"
        >
          {BUNDLED_FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </Field>

      <SliderField
        label="Size"
        value={style.fontSizePx}
        min={16}
        max={200}
        step={1}
        onChange={(v) => setStyle({ fontSizePx: v })}
        unit="px"
      />

      <Field label="Fill">
        <ColorRow
          color={style.fillColor}
          onChange={(c) => setStyle({ fillColor: c })}
        />
      </Field>

      <Field label="Outline">
        <ColorRow
          color={style.outlineColor}
          onChange={(c) => setStyle({ outlineColor: c })}
        />
      </Field>

      <SliderField
        label="Outline width"
        value={style.outlinePx}
        min={0}
        max={10}
        step={0.5}
        onChange={(v) => setStyle({ outlinePx: v })}
        unit="px"
      />

      <Field label="Anchor">
        <div className="grid grid-cols-4 gap-1">
          {(['top', 'center', 'bottom', 'free'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setStyle({ position: { ...style.position, anchor: a } })}
              className={`rounded px-2 py-1 text-xs capitalize ${
                style.position.anchor === a
                  ? 'bg-sky-600 text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </Field>

      {style.position.anchor === 'free' && (
        <div className="grid grid-cols-2 gap-2">
          <SliderField
            label="X"
            value={style.position.x}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) =>
              setStyle({ position: { ...style.position, x: v } })
            }
          />
          <SliderField
            label="Y"
            value={style.position.y}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) =>
              setStyle({ position: { ...style.position, y: v } })
            }
          />
        </div>
      )}

      <SliderField
        label="Max width"
        value={style.maxWidthPx}
        min={200}
        max={3840}
        step={10}
        onChange={(v) => setStyle({ maxWidthPx: v })}
        unit="px"
      />

      <SliderField
        label="Line height"
        value={style.lineHeight}
        min={0.8}
        max={2.5}
        step={0.05}
        onChange={(v) => setStyle({ lineHeight: v })}
      />

      <div className="border-t border-neutral-800 pt-3">
        <label className="mb-2 flex cursor-pointer items-center justify-between text-xs uppercase tracking-wider text-neutral-400">
          <span>Shadow</span>
          <input
            type="checkbox"
            checked={shadowEnabled}
            onChange={(e) =>
              setStyle({
                shadow: e.target.checked
                  ? { color: '#000000', blurPx: 8, offsetY: 2 }
                  : (null as unknown as undefined),
              })
            }
            className="h-4 w-4 accent-sky-500"
          />
        </label>
        {shadowEnabled && style.shadow && (
          <div className="space-y-3">
            <Field label="Color">
              <ColorRow
                color={style.shadow.color}
                onChange={(c) =>
                  setStyle({ shadow: { ...style.shadow!, color: c } })
                }
              />
            </Field>
            <SliderField
              label="Blur"
              value={style.shadow.blurPx}
              min={0}
              max={40}
              step={1}
              onChange={(v) =>
                setStyle({ shadow: { ...style.shadow!, blurPx: v } })
              }
              unit="px"
            />
            <SliderField
              label="Offset Y"
              value={style.shadow.offsetY}
              min={-20}
              max={20}
              step={1}
              onChange={(v) =>
                setStyle({ shadow: { ...style.shadow!, offsetY: v } })
              }
              unit="px"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-neutral-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-neutral-400">
        <span>{label}</span>
        <span className="text-neutral-300 normal-case tracking-normal">
          {Number.isInteger(step) ? value : value.toFixed(2)}
          {unit ?? ''}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-sky-500"
      />
    </label>
  );
}

function ColorRow({
  color,
  onChange,
}: {
  color: string;
  onChange: (c: string) => void;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded border border-neutral-700 bg-neutral-800"
      />
      <input
        type="text"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-100 outline-none focus:ring-1 focus:ring-sky-500"
      />
    </div>
  );
}
