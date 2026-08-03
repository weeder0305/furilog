// 付箋一覧（設計書 5.3 情報欄・右側）
// タップするとその時刻へシークして一時停止し、該当付箋をハイライトする。

import { useMemo, useState } from 'react';
import type { Sticky, StickyColor } from '../models';
import { formatTime } from '../lib/format';
import {
  STICKY_COLORS,
  STICKY_COLOR_LABELS,
  getStickyColor,
  sortStickies,
  type StickySortMode,
} from '../lib/sticky';
import './StickyList.css';

interface StickyListProps {
  stickies: Sticky[];
  highlightedStickyId: string | null;
  onSelect: (sticky: Sticky) => void;
}

export function StickyList({ stickies, highlightedStickyId, onSelect }: StickyListProps) {
  const [colorFilter, setColorFilter] = useState<'all' | StickyColor>('all');
  const [sortMode, setSortMode] = useState<StickySortMode>('time-asc');

  const sorted = useMemo(() => {
    const filtered =
      colorFilter === 'all'
        ? stickies
        : stickies.filter((sticky) => getStickyColor(sticky) === colorFilter);
    return sortStickies(filtered, sortMode);
  }, [stickies, colorFilter, sortMode]);

  if (sorted.length === 0) {
    return <p className="sticky-list-empty">付箋はまだありません</p>;
  }

  return (
    <>
      <div className="sticky-list-tools">
        <label>
          色
          <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value as 'all' | StickyColor)}>
            <option value="all">すべて</option>
            {STICKY_COLORS.map((color) => (
              <option key={color} value={color}>{STICKY_COLOR_LABELS[color]}</option>
            ))}
          </select>
        </label>
        <label>
          並び
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as StickySortMode)}>
            <option value="time-asc">時刻：早い順</option>
            <option value="time-desc">時刻：遅い順</option>
            <option value="color">色別</option>
          </select>
        </label>
      </div>
      {sorted.length === 0 ? (
        <p className="sticky-list-empty">この色の付箋はありません</p>
      ) : (
      <ul className="sticky-list">
        {sorted.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            className={`sticky-list-item ${highlightedStickyId === s.id ? 'sticky-list-item-active' : ''}`}
            onClick={() => onSelect(s)}
          >
            <span className={`sticky-list-color sticky-list-color-${getStickyColor(s)}`} aria-label={`${STICKY_COLOR_LABELS[getStickyColor(s)]}色`} />
            <span className="sticky-list-time">
              {formatTime(s.timeSec)}
              {s.endTimeSec !== undefined && s.endTimeSec > s.timeSec
                ? `–${formatTime(s.endTimeSec)}`
                : ''}
            </span>
            <span className="sticky-list-text">{s.text}</span>
          </button>
        </li>
        ))}
      </ul>
      )}
    </>
  );
}
