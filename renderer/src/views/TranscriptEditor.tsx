import { useEffect, useMemo, useRef, useState } from 'react';
import type { Word } from '@shared/types';
import { useProjectStore } from '../store/projectStore';

type ContextMenu = {
  wordId: string;
  x: number;
  y: number;
};

export function TranscriptEditor(): JSX.Element {
  const project = useProjectStore((s) => s.project);
  const updateWord = useProjectStore((s) => s.updateWord);
  const nudgeWordTiming = useProjectStore((s) => s.nudgeWordTiming);
  const splitWord = useProjectStore((s) => s.splitWord);
  const mergeWords = useProjectStore((s) => s.mergeWords);

  const wordsById = useMemo(() => {
    const m = new Map<string, Word>();
    for (const w of project.transcript.words) m.set(w.id, w);
    return m;
  }, [project.transcript.words]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<ContextMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menu]);

  useEffect(() => {
    if (!pinnedId) return;
    const onDown = (e: MouseEvent) => {
      if (!popupRef.current?.contains(e.target as Node)) setPinnedId(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pinnedId]);

  if (project.transcript.words.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-xs text-neutral-500">
        No transcript yet. Load a file to begin.
      </div>
    );
  }

  const nextWordId = (id: string): string | undefined => {
    const all = project.transcript.words;
    const i = all.findIndex((w) => w.id === id);
    return i >= 0 && i < all.length - 1 ? all[i + 1].id : undefined;
  };

  return (
    <div className="h-full overflow-y-auto p-3">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Transcript
      </h2>
      <ol className="space-y-3">
        {project.captions.map((group, gi) => (
          <li
            key={group.id}
            className="rounded-md border border-neutral-800 bg-neutral-900/40 p-2"
          >
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-500">
              <span>Caption {gi + 1}</span>
              <span>
                {group.startSec.toFixed(2)}s – {group.endSec.toFixed(2)}s
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.wordIds.map((wid) => {
                const w = wordsById.get(wid);
                if (!w) return null;
                const isEditing = editingId === wid;
                const isHover = hoverId === wid;
                return (
                  <div
                    key={wid}
                    className="relative"
                    onMouseEnter={() => setHoverId(wid)}
                    onMouseLeave={() => setHoverId((h) => (h === wid ? null : h))}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        defaultValue={w.text}
                        onBlur={(e) => {
                          updateWord(wid, { text: e.target.value });
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateWord(wid, {
                              text: (e.target as HTMLInputElement).value,
                            });
                            setEditingId(null);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                        className="w-24 rounded border border-sky-500 bg-neutral-950 px-1 py-0.5 text-sm text-neutral-100 outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingId(wid)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setMenu({ wordId: wid, x: e.clientX, y: e.clientY });
                        }}
                        className="rounded bg-neutral-800 px-2 py-0.5 text-sm text-neutral-100 hover:bg-neutral-700"
                      >
                        {w.text}
                      </button>
                    )}
                    {(isHover || pinnedId === wid) && !isEditing && (
                      <div
                        ref={pinnedId === wid ? popupRef : undefined}
                        onMouseEnter={() => setHoverId(wid)}
                        className="absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-950 px-2 py-1.5 text-[10px] text-neutral-300 shadow-lg ring-1 ring-neutral-800"
                      >
                        {pinnedId === wid ? (
                          <TimingEditor
                            word={w}
                            onChange={(start, end) =>
                              updateWord(wid, { startSec: start, endSec: end })
                            }
                            onClose={() => setPinnedId(null)}
                          />
                        ) : (
                          <>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setPinnedId(wid);
                              }}
                              className="font-mono hover:text-sky-300"
                              title="Click to edit timing"
                            >
                              {w.startSec.toFixed(2)} → {w.endSec.toFixed(2)}
                            </button>
                            <div className="mt-1 flex items-center gap-1">
                              <span className="text-neutral-500">start</span>
                              <NudgeButton
                                label="−"
                                onClick={() => nudgeWordTiming(wid, -0.05, 0)}
                              />
                              <NudgeButton
                                label="+"
                                onClick={() => nudgeWordTiming(wid, 0.05, 0)}
                              />
                              <span className="ml-2 text-neutral-500">end</span>
                              <NudgeButton
                                label="−"
                                onClick={() => nudgeWordTiming(wid, 0, -0.05)}
                              />
                              <NudgeButton
                                label="+"
                                onClick={() => nudgeWordTiming(wid, 0, 0.05)}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      {menu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[140px] rounded-md border border-neutral-700 bg-neutral-900 py-1 text-sm text-neutral-100 shadow-xl"
          style={{ left: menu.x, top: menu.y }}
        >
          <MenuItem
            onClick={() => {
              const w = wordsById.get(menu.wordId);
              if (w && w.text.length > 1) {
                splitWord(menu.wordId, Math.floor(w.text.length / 2));
              }
              setMenu(null);
            }}
          >
            Split at midpoint
          </MenuItem>
          <MenuItem
            onClick={() => {
              const next = nextWordId(menu.wordId);
              if (next) mergeWords(menu.wordId, next);
              setMenu(null);
            }}
          >
            Merge with next
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function TimingEditor({
  word,
  onChange,
  onClose,
}: {
  word: Word;
  onChange: (startSec: number, endSec: number) => void;
  onClose: () => void;
}): JSX.Element {
  const [start, setStart] = useState(word.startSec.toFixed(3));
  const [end, setEnd] = useState(word.endSec.toFixed(3));

  const commit = () => {
    const s = Number.parseFloat(start);
    const e = Number.parseFloat(end);
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
      onChange(s, e);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <label className="w-10 text-[10px] text-neutral-500">start</label>
        <input
          type="number"
          step="0.01"
          min={0}
          value={start}
          onChange={(e) => setStart(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit();
              onClose();
            }
            if (e.key === 'Escape') onClose();
          }}
          className="w-20 rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 font-mono text-[10px] text-neutral-100 outline-none focus:border-sky-500"
        />
        <span className="text-[10px] text-neutral-500">s</span>
      </div>
      <div className="flex items-center gap-1">
        <label className="w-10 text-[10px] text-neutral-500">end</label>
        <input
          type="number"
          step="0.01"
          min={0}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit();
              onClose();
            }
            if (e.key === 'Escape') onClose();
          }}
          className="w-20 rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 font-mono text-[10px] text-neutral-100 outline-none focus:border-sky-500"
        />
        <span className="text-[10px] text-neutral-500">s</span>
      </div>
      <button
        type="button"
        onClick={() => {
          commit();
          onClose();
        }}
        className="mt-0.5 rounded bg-sky-600 px-2 py-0.5 text-[10px] text-white hover:bg-sky-500"
      >
        Done
      </button>
    </div>
  );
}

function NudgeButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] leading-none text-neutral-100 hover:bg-neutral-700"
    >
      {label}
    </button>
  );
}

function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left hover:bg-neutral-800"
    >
      {children}
    </button>
  );
}
