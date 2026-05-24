import type { CSSProperties } from 'react';
import { useVideoConfig } from 'remotion';
import type { StyleConfig } from '../../shared/types';

export const textBaseStyle = (style: StyleConfig): CSSProperties => {
  const stroke =
    style.outlinePx > 0
      ? `${style.outlinePx}px ${style.outlineColor}`
      : undefined;
  return {
    fontFamily: `"${style.fontFamily}", sans-serif`,
    fontSize: style.fontSizePx,
    lineHeight: style.lineHeight,
    color: style.fillColor,
    WebkitTextStroke: stroke,
    textShadow: style.shadow
      ? `0 ${style.shadow.offsetY}px ${style.shadow.blurPx}px ${style.shadow.color}`
      : undefined,
    fontWeight: 800,
    whiteSpace: 'pre',
  };
};

type Layout = {
  container: CSSProperties;
  line: CSSProperties;
};

export const useGroupLayout = (style: StyleConfig): Layout => {
  const { width, height } = useVideoConfig();
  const { x, y, anchor } = style.position;
  const leftPx = x * width;
  const topPx = y * height;

  const container: CSSProperties = {
    position: 'absolute',
    left: leftPx,
    top: topPx,
    maxWidth: style.maxWidthPx,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (anchor === 'center') {
    container.transform = 'translate(-50%, -50%)';
  } else if (anchor === 'bottom') {
    container.transform = 'translate(-50%, -100%)';
  } else if (anchor === 'top') {
    container.transform = 'translate(-50%, 0)';
  } else {
    container.transform = 'translate(-50%, -100%)';
  }

  const line: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'baseline',
    maxWidth: style.maxWidthPx,
  };

  return { container, line };
};

export const wordLocalFrame = (
  currentFrame: number,
  groupStartFrame: number,
  groupStartSec: number,
  wordStartSec: number,
  fps: number,
): number => {
  return currentFrame - groupStartFrame - (wordStartSec - groupStartSec) * fps;
};
