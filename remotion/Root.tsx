import React from 'react';
import { Composition, registerRoot } from 'remotion';
import type { CalculateMetadataFunction } from 'remotion';
import type { Project } from '../shared/types';
import { SubtitleComposition } from './SubtitleComposition';

const sampleWords = [
  { id: 'w0', text: 'Drop',     startSec: 0.0, endSec: 0.5, confidence: 0.99 },
  { id: 'w1', text: 'a',        startSec: 0.5, endSec: 0.7, confidence: 0.99 },
  { id: 'w2', text: 'video',    startSec: 0.7, endSec: 1.2, confidence: 0.99 },
  { id: 'w3', text: 'to',       startSec: 1.4, endSec: 1.6, confidence: 0.99 },
  { id: 'w4', text: 'caption',  startSec: 1.6, endSec: 2.2, confidence: 0.99 },
  { id: 'w5', text: 'it',       startSec: 2.2, endSec: 2.9, confidence: 0.99 },
] as const;

const sampleProject: Project = {
  source: {
    path: '',
    durationSec: 3,
    width: 1920,
    height: 1080,
    fps: 30,
    hasAudio: false,
  },
  transcript: { words: [...sampleWords] },
  captions: [
    {
      id: 'g0',
      wordIds: ['w0', 'w1', 'w2'],
      startSec: 0.0,
      endSec: 1.35,
    },
    {
      id: 'g1',
      wordIds: ['w3', 'w4', 'w5'],
      startSec: 1.35,
      endSec: 3.0,
    },
  ],
  style: {
    fontFamily: 'Inter',
    fontSizePx: 80,
    fillColor: '#FFFFFF',
    outlineColor: '#000000',
    outlinePx: 4,
    position: { x: 0.5, y: 0.92, anchor: 'bottom' },
    maxWidthPx: 1600,
    lineHeight: 1.1,
    shadow: { color: 'rgba(0,0,0,0.6)', blurPx: 12, offsetY: 4 },
  },
  preset: {
    kind: 'karaoke',
    params: {},
  },
  output: {
    width: 1920,
    height: 1080,
    fps: 30,
    codec: 'prores4444',
  },
};

const calculateMetadata: CalculateMetadataFunction<{ project: Project }> = ({
  props,
}) => {
  const { source, output } = props.project;
  const fps = output.fps || source.fps || 30;
  const durationInFrames = Math.max(1, Math.ceil(source.durationSec * fps));
  return {
    durationInFrames,
    fps,
    width: output.width || source.width || 1920,
    height: output.height || source.height || 1080,
  };
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Subtitles"
    component={SubtitleComposition}
    durationInFrames={90}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ project: sampleProject }}
    calculateMetadata={calculateMetadata}
  />
);

registerRoot(RemotionRoot);
