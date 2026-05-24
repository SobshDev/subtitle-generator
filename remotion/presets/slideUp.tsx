import React from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Word, StyleConfig } from '../../shared/types';
import { textBaseStyle, useGroupLayout, wordLocalFrame } from './shared';

type Props = {
  words: Word[];
  style: StyleConfig;
  params: Record<string, unknown>;
  groupStartFrame: number;
  groupStartSec: number;
};

const SlideUp: React.FC<Props> = ({
  words,
  style,
  params,
  groupStartFrame,
  groupStartSec,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = useGroupLayout(style);
  const base = textBaseStyle(style);

  const distancePx =
    typeof params.distancePx === 'number' ? params.distancePx : 30;
  const durationFrames =
    typeof params.durationFrames === 'number' ? params.durationFrames : 10;

  return (
    <div style={{ ...layout.container, overflow: 'visible' }}>
      <div style={layout.line}>
        {words.map((w, idx) => {
          const local = wordLocalFrame(
            frame,
            groupStartFrame,
            groupStartSec,
            w.startSec,
            fps,
          );
          const progress = interpolate(
            local,
            [0, durationFrames],
            [0, 1],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            },
          );
          const ty = (1 - progress) * distancePx;
          const opacity = progress;
          return (
            <span
              key={w.id}
              style={{
                ...base,
                transform: `translateY(${ty}px)`,
                opacity,
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

export default SlideUp;
