import { useEffect, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { useProjectStore } from '../store/projectStore';
import { SubtitleComposition } from '../../../remotion/SubtitleComposition';

function toMediaUrl(absPath: string): string {
  const encoded = absPath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `subgen-media://local${encoded.startsWith('/') ? '' : '/'}${encoded}`;
}

export function PreviewPane(): JSX.Element {
  const project = useProjectStore((s) => s.project);
  const hasSource = useProjectStore((s) => s.hasSource);
  const previewPath = useProjectStore((s) => s.previewPath);
  const previewPct = useProjectStore((s) => s.previewPct);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setBox({ w: el.clientWidth, h: el.clientHeight });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { width: outW, height: outH, fps } = project.output;
  const durationFrames = Math.max(
    30,
    Math.ceil((project.source.durationSec || 5) * fps),
  );

  const sourceMediaUrl = useMemo(() => {
    const path = previewPath ?? (project.source.path || null);
    return path ? toMediaUrl(path) : undefined;
  }, [previewPath, project.source.path]);

  let playerW = box.w;
  let playerH = box.h;
  if (box.w > 0 && box.h > 0) {
    const srcRatio = outW / outH;
    const boxRatio = box.w / box.h;
    if (boxRatio > srcRatio) {
      playerH = box.h;
      playerW = box.h * srcRatio;
    } else {
      playerW = box.w;
      playerH = box.w / srcRatio;
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-md"
      style={{
        backgroundColor: '#1a1a1a',
        backgroundImage:
          'linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)',
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
      }}
    >
      {hasSource && playerW > 0 ? (
        <div style={{ width: playerW, height: playerH }}>
          <Player
            component={SubtitleComposition as never}
            inputProps={
              {
                project,
                showSourceUnderlay: true,
                sourceMediaUrl,
              } as never
            }
            durationInFrames={durationFrames}
            fps={fps}
            compositionWidth={outW}
            compositionHeight={outH}
            style={{ width: '100%', height: '100%' }}
            controls
            loop
            acknowledgeRemotionLicense
          />
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          Preview will appear after a file is loaded.
        </p>
      )}
      {hasSource && previewPath === null && previewPct !== null && (
        <div className="pointer-events-none absolute left-3 top-3 rounded bg-neutral-900/80 px-2 py-1 text-[11px] text-neutral-300 ring-1 ring-neutral-800">
          Preparing playable preview… {Math.round(previewPct)}%
        </div>
      )}
    </div>
  );
}
