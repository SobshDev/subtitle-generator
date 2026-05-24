import { describe, it, expect } from 'vitest';
import { mergeChunkResults } from '../transcribe';
import type { Word } from '@shared/types';

function makeWords(prefix: string): Word[] {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `${prefix}-${i}`,
    text: `w${i}`,
    startSec: i,
    endSec: i + 0.4,
    confidence: 1,
  }));
}

describe('mergeChunkResults', () => {
  it('offsets word times by chunkOffsetSec and sorts globally', () => {
    const merged = mergeChunkResults([
      { offsetSec: 0, words: makeWords('a') },
      { offsetSec: 60, words: makeWords('b') },
      { offsetSec: 120, words: makeWords('c') },
    ]);

    expect(merged).toHaveLength(15);

    const starts = merged.map((w) => w.startSec);
    const sorted = [...starts].sort((a, b) => a - b);
    expect(starts).toEqual(sorted);

    expect(merged[0]).toMatchObject({ text: 'w0', startSec: 0, endSec: 0.4 });
    expect(merged[5]).toMatchObject({ text: 'w0', startSec: 60, endSec: 60.4 });
    expect(merged[10]).toMatchObject({ text: 'w0', startSec: 120, endSec: 120.4 });
    expect(merged[14]).toMatchObject({ text: 'w4', startSec: 124, endSec: 124.4 });
  });

  it('dedupes overlapping words at chunk seams', () => {
    const chunkA: Word[] = [
      { id: 'a0', text: 'hello', startSec: 0, endSec: 0.5, confidence: 1 },
      { id: 'a1', text: 'world', startSec: 1, endSec: 1.5, confidence: 1 },
      { id: 'a2', text: 'foo', startSec: 19.5, endSec: 19.9, confidence: 1 },
    ];
    const chunkB: Word[] = [
      // chunkB starts at offset 19.5; the first word is the same "foo" that
      // appeared at the end of chunkA — at global time 19.5 in both cases.
      { id: 'b0', text: 'foo', startSec: 0, endSec: 0.4, confidence: 1 },
      { id: 'b1', text: 'bar', startSec: 0.5, endSec: 1.0, confidence: 1 },
    ];

    const merged = mergeChunkResults([
      { offsetSec: 0, words: chunkA },
      { offsetSec: 19.5, words: chunkB },
    ]);

    expect(merged.map((w) => w.text)).toEqual(['hello', 'world', 'foo', 'bar']);
    const foo = merged.filter((w) => w.text === 'foo');
    expect(foo).toHaveLength(1);
    expect(foo[0].startSec).toBeCloseTo(19.5, 5);
  });

  it('keeps distinct same-text words that are far apart', () => {
    const merged = mergeChunkResults([
      {
        offsetSec: 0,
        words: [
          { id: 'a', text: 'the', startSec: 0, endSec: 0.3, confidence: 1 },
        ],
      },
      {
        offsetSec: 5,
        words: [
          { id: 'b', text: 'the', startSec: 0, endSec: 0.3, confidence: 1 },
        ],
      },
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[0].startSec).toBe(0);
    expect(merged[1].startSec).toBe(5);
  });
});
