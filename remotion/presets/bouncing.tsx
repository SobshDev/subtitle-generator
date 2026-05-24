import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Word, StyleConfig } from '../../shared/types';
import { textBaseStyle, useGroupLayout, wordLocalFrame } from './shared';

type Props = {
  words: Word[];
  style: StyleConfig;
  params: Record<string, unknown>;
  groupStartFrame: number;
  groupStartSec: number;
};

const Bouncing: React.FC<Props> = ({
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

  const stiffness =
    typeof params.stiffness === 'number' ? params.stiffness : 120;
  const damping =
    typeof params.damping === 'number' ? params.damping : 8;
  const bounceDistance =
    typeof params.bounceDistance === 'number' ? params.bounceDistance : 60;

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
          const progress = spring({
            frame: local,
            fps,
            config: { stiffness, damping, mass: 1 },
            from: 0,
            to: 1,
          });
          const ty = (1 - progress) * -bounceDistance;
          const opacity = spring({
            frame: local,
            fps,
            config: { stiffness: 200, damping: 20 },
            from: 0,
            to: 1,
          });
          return (
            <span
              key={w.id}
              style={{
                ...base,
                transform: `translateY(${ty}px)`,
                opacity: Math.max(0, Math.min(1, opacity)),
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

export default Bouncing;
