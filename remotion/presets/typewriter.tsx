import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { Word, StyleConfig } from '../../shared/types';
import { textBaseStyle, useGroupLayout } from './shared';

type Props = {
  words: Word[];
  style: StyleConfig;
  params: Record<string, unknown>;
  groupStartFrame: number;
  groupStartSec: number;
};

const joinWithSpaces = (words: Word[]): string =>
  words.map((w) => w.text).join(' ');

const Typewriter: React.FC<Props> = ({
  words,
  style,
  params,
  groupStartFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = useGroupLayout(style);
  const base = textBaseStyle(style);

  const fullText = joinWithSpaces(words);
  const lastWord = words[words.length - 1];
  const firstWord = words[0];
  const groupDurationSec = lastWord
    ? Math.max(0.1, lastWord.endSec - (firstWord?.startSec ?? lastWord.startSec))
    : 1;

  const cpm =
    typeof params.cpm === 'number'
      ? params.cpm
      : Math.max(60, (fullText.length / groupDurationSec) * 60);
  const charsPerFrame = cpm / 60 / fps;

  const localFrame = Math.max(0, frame - groupStartFrame);
  const visibleChars = Math.min(
    fullText.length,
    Math.floor(localFrame * charsPerFrame),
  );

  const showCaret = Math.floor(frame / Math.max(1, Math.round(fps / 2))) % 2 === 0;

  return (
    <div style={layout.container}>
      <div
        style={{
          ...layout.line,
          flexWrap: 'wrap',
          whiteSpace: 'pre-wrap',
        }}
      >
        <span style={{ ...base, whiteSpace: 'pre-wrap' }}>
          {fullText.slice(0, visibleChars)}
          <span
            style={{
              opacity: showCaret ? 1 : 0,
              marginLeft: 2,
            }}
          >
            |
          </span>
        </span>
      </div>
    </div>
  );
};

export default Typewriter;
