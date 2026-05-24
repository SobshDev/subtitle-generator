import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Word, StyleConfig } from '../../shared/types';
import { textBaseStyle, useGroupLayout } from './shared';

type Props = {
  words: Word[];
  style: StyleConfig;
  params: Record<string, unknown>;
  groupStartFrame: number;
  groupStartSec: number;
};

const Karaoke: React.FC<Props> = ({ words, style, params }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const activeColor =
    typeof params.activeColor === 'string' ? params.activeColor : '#FFD400';
  const inactiveColor =
    typeof params.inactiveColor === 'string'
      ? params.inactiveColor
      : style.fillColor;
  const activeScale =
    typeof params.activeScale === 'number' ? params.activeScale : 1.08;

  const currentSec = frame / fps;
  const layout = useGroupLayout(style);
  const base = textBaseStyle(style);

  return (
    <div style={layout.container}>
      <div style={layout.line}>
        {words.map((w, idx) => {
          const isActive = currentSec >= w.startSec && currentSec < w.endSec;
          const localFrame = Math.max(0, (currentSec - w.startSec) * fps);
          const scale = isActive
            ? interpolate(Math.min(localFrame, 6), [0, 6], [1, activeScale], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
            : 1;
          return (
            <span
              key={w.id}
              style={{
                ...base,
                color: isActive ? activeColor : inactiveColor,
                transform: `scale(${scale})`,
                transformOrigin: 'center bottom',
                marginRight:
                  idx === words.length - 1 ? 0 : style.fontSizePx * 0.28,
                display: 'inline-block',
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default Karaoke;
