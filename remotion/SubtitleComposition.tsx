import React from 'react';
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadBebasNeue } from '@remotion/google-fonts/BebasNeue';
import { loadFont as loadRoboto } from '@remotion/google-fonts/Roboto';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import type { CaptionGroup, Project, Word } from '../shared/types';
import { PRESET_MAP } from './presets';

loadInter('normal', { weights: ['700', '800'], subsets: ['latin'], ignoreTooManyRequestsWarning: true });
loadAnton('normal', { weights: ['400'], subsets: ['latin'], ignoreTooManyRequestsWarning: true });
loadBebasNeue('normal', { weights: ['400'], subsets: ['latin'], ignoreTooManyRequestsWarning: true });
loadRoboto('normal', { weights: ['700', '900'], subsets: ['latin'], ignoreTooManyRequestsWarning: true });
loadMontserrat('normal', { weights: ['700', '800'], subsets: ['latin'], ignoreTooManyRequestsWarning: true });

type Props = {
  project: Project;
  showSourceUnderlay?: boolean;
  sourceMediaUrl?: string;
};

const wordsByGroup = (
  group: CaptionGroup,
  allWords: Word[],
): Word[] => {
  const map = new Map(allWords.map((w) => [w.id, w]));
  const out: Word[] = [];
  for (const id of group.wordIds) {
    const w = map.get(id);
    if (w) out.push(w);
  }
  return out;
};

const findActiveGroup = (
  groups: CaptionGroup[],
  currentSec: number,
): CaptionGroup | null => {
  for (const g of groups) {
    if (currentSec >= g.startSec && currentSec < g.endSec) return g;
  }
  return null;
};

export const SubtitleComposition: React.FC<Props> = ({
  project,
  showSourceUnderlay,
  sourceMediaUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentSec = frame / fps;

  const active = findActiveGroup(project.captions, currentSec);
  const groupWords = active ? wordsByGroup(active, project.transcript.words) : [];
  const Preset = active ? PRESET_MAP[project.preset.kind] : null;
  const groupStartFrame = active ? Math.round(active.startSec * fps) : 0;

  return (
    <AbsoluteFill>
      {showSourceUnderlay && sourceMediaUrl && (
        <AbsoluteFill>
          <OffthreadVideo src={sourceMediaUrl} />
        </AbsoluteFill>
      )}
      {active && Preset && groupWords.length > 0 && (
        <AbsoluteFill>
          <Preset
            words={groupWords}
            style={project.style}
            params={project.preset.params}
            groupStartFrame={groupStartFrame}
            groupStartSec={active.startSec}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
