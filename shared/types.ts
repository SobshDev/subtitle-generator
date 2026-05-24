export type Word = {
  id: string;
  text: string;
  startSec: number;
  endSec: number;
  confidence: number;
};

export type CaptionGroup = {
  id: string;
  wordIds: string[];
  startSec: number;
  endSec: number;
};

export type StyleConfig = {
  fontFamily: string;
  fontSizePx: number;
  fillColor: string;
  outlineColor: string;
  outlinePx: number;
  position: {
    x: number;
    y: number;
    anchor: 'center' | 'bottom' | 'top' | 'free';
  };
  maxWidthPx: number;
  lineHeight: number;
  shadow?: {
    color: string;
    blurPx: number;
    offsetY: number;
  };
};

export type AnimationPresetKind =
  | 'karaoke'
  | 'popIn'
  | 'slideUp'
  | 'typewriter'
  | 'bouncing';

export type AnimationPreset = {
  kind: AnimationPresetKind;
  params: Record<string, number | string>;
};

export type Source = {
  path: string;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  videoCodec?: string;
  audioCodec?: string;
};

export type Output = {
  width: number;
  height: number;
  fps: number;
  codec: 'prores4444';
};

export type Project = {
  source: Source;
  transcript: { words: Word[] };
  captions: CaptionGroup[];
  style: StyleConfig;
  preset: AnimationPreset;
  output: Output;
};

export const BUNDLED_FONTS = [
  'Inter',
  'Anton',
  'Bebas Neue',
  'Roboto',
  'Montserrat',
] as const;

export type BundledFont = (typeof BUNDLED_FONTS)[number];
