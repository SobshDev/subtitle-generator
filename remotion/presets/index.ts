import type React from 'react';
import type { AnimationPresetKind, StyleConfig, Word } from '../../shared/types';
import Karaoke from './karaoke';
import PopIn from './popIn';
import SlideUp from './slideUp';
import Typewriter from './typewriter';
import Bouncing from './bouncing';

export type PresetProps = {
  words: Word[];
  style: StyleConfig;
  params: Record<string, unknown>;
  groupStartFrame: number;
  groupStartSec: number;
};

export type PresetComponent = React.ComponentType<PresetProps>;

export const PRESET_MAP: Record<AnimationPresetKind, PresetComponent> = {
  karaoke: Karaoke,
  popIn: PopIn,
  slideUp: SlideUp,
  typewriter: Typewriter,
  bouncing: Bouncing,
};
