// 付箋レイヤー（設計書 5.4）
// 一時停止中のみ、動画の実表示領域（レターボックス除外）を基準にした正規化座標で
// 付箋ピンを重ねて表示する。付箋追加の「貼りたい場所をタップ」モードもここで扱う。

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import type { Sticky, StickyColor } from '../models';
import { formatTime } from '../lib/format';
import {
  STICKY_COLORS,
  STICKY_COLOR_LABELS,
  getStickyColor,
  isStickyVisibleAtTime,
} from '../lib/sticky';
import './StickyLayer.css';

interface DisplayRect {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

/** コンテナ内で object-fit: contain 相当の動画実表示領域を計算する（レターボックス除外） */
function computeVideoDisplayRect(
  containerW: number,
  containerH: number,
  videoW: number,
  videoH: number
): DisplayRect {
  if (containerW <= 0 || containerH <= 0 || videoW <= 0 || videoH <= 0) {
    return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
  }
  const containerRatio = containerW / containerH;
  const videoRatio = videoW / videoH;
  let width: number;
  let height: number;
  if (containerRatio > videoRatio) {
    height = containerH;
    width = height * videoRatio;
  } else {
    width = containerW;
    height = width / videoRatio;
  }
  return {
    width,
    height,
    offsetX: (containerW - width) / 2,
    offsetY: (containerH - height) / 2,
  };
}

interface StickyLayerProps {
  containerRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  stickies: Sticky[];
  currentTime: number;
  paused: boolean;
  placing: boolean;
  durationSec: number;
  onCancelPlacing: () => void;
  onCreateSticky: (
    x: number,
    y: number,
    text: string,
    color: StickyColor,
    startTimeSec: number,
    endTimeSec?: number
  ) => void;
  onSeek: (time: number) => void;
  onRangePickingChange: (picking: boolean) => void;
  onDeleteSticky: (id: string) => void;
  onUpdateSticky: (sticky: Sticky) => void;
  highlightedStickyId: string | null;
  mirrored: boolean;
}

export function StickyLayer({
  containerRef,
  videoRef,
  stickies,
  currentTime,
  paused,
  placing,
  durationSec,
  onCancelPlacing,
  onCreateSticky,
  onSeek,
  onRangePickingChange,
  onDeleteSticky,
  onUpdateSticky,
  highlightedStickyId,
  mirrored,
}: StickyLayerProps) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingText, setPendingText] = useState('');
  const [pendingColor, setPendingColor] = useState<StickyColor>('yellow');
  const [pendingStartTime, setPendingStartTime] = useState(0);
  const [pendingIsRange, setPendingIsRange] = useState(false);
  const [pendingEndTime, setPendingEndTime] = useState(0);
  const [openStickyId, setOpenStickyId] = useState<string | null>(null);
  const [editingStickyId, setEditingStickyId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingColor, setEditingColor] = useState<StickyColor>('yellow');
  const [editingIsRange, setEditingIsRange] = useState(false);
  const [editingEndTime, setEditingEndTime] = useState(0);
  const [rangePicking, setRangePicking] = useState<{
    kind: 'pending' | 'editing';
    startTime: number;
  } | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    return () => observer.disconnect();
  }, [containerRef]);

  useEffect(() => {
    if (highlightedStickyId) setOpenStickyId(highlightedStickyId);
  }, [highlightedStickyId]);

  useEffect(() => {
    if (!placing) {
      setPendingPos(null);
      setPendingText('');
      setPendingColor('yellow');
      setPendingIsRange(false);
      setRangePicking(null);
    }
  }, [placing]);

  useEffect(() => {
    onRangePickingChange(rangePicking !== null);
    return () => onRangePickingChange(false);
  }, [rangePicking, onRangePickingChange]);

  // 再生が始まったら編集中・開いている付箋は閉じる（一時停止中専用のUIのため）
  useEffect(() => {
    if (!paused && !rangePicking) {
      setEditingStickyId(null);
      setOpenStickyId(null);
    }
  }, [paused, rangePicking]);

  const video = videoRef.current;
  const videoW = video?.videoWidth || containerSize.width;
  const videoH = video?.videoHeight || containerSize.height;
  const rect = computeVideoDisplayRect(containerSize.width, containerSize.height, videoW, videoH);

  function toContainerPercent(normX: number, normY: number) {
    if (containerSize.width === 0 || containerSize.height === 0) return { left: '0%', top: '0%' };
    const displayX = mirrored ? 1 - normX : normX;
    const left = ((rect.offsetX + displayX * rect.width) / containerSize.width) * 100;
    const top = ((rect.offsetY + normY * rect.height) / containerSize.height) * 100;
    return { left: `${left}%`, top: `${top}%` };
  }

  function handleContainerClick(e: MouseEvent<HTMLDivElement>) {
    if (!placing) return;
    // placing中はこのレイヤーがクリックを占有し、下の動画の再生/一時停止トグルへ伝播させない
    e.stopPropagation();
    if (pendingPos) return;
    const el = containerRef.current;
    if (!el || rect.width === 0 || rect.height === 0) return;
    const bounds = el.getBoundingClientRect();
    const clickX = e.clientX - bounds.left;
    const clickY = e.clientY - bounds.top;
    if (
      clickX < rect.offsetX ||
      clickX > rect.offsetX + rect.width ||
      clickY < rect.offsetY ||
      clickY > rect.offsetY + rect.height
    ) {
      return; // レターボックス部分のタップは無視
    }
    const displayX = (clickX - rect.offsetX) / rect.width;
    const normX = mirrored ? 1 - displayX : displayX;
    const normY = (clickY - rect.offsetY) / rect.height;
    setPendingPos({ x: normX, y: normY });
    setPendingText('');
    setPendingColor('yellow');
    setPendingStartTime(currentTime);
    setPendingIsRange(false);
    setPendingEndTime(Math.min(currentTime + 1, durationSec || currentTime + 1));
  }

  function handleSavePending() {
    if (!pendingPos) return;
    const text = pendingText.trim();
    if (text === '') return;
    if (pendingIsRange && pendingEndTime <= pendingStartTime) return;
    onCreateSticky(
      pendingPos.x,
      pendingPos.y,
      text,
      pendingColor,
      pendingStartTime,
      pendingIsRange ? pendingEndTime : undefined
    );
    setPendingPos(null);
    setPendingText('');
    setPendingColor('yellow');
    setPendingIsRange(false);
    setRangePicking(null);
  }

  function handleCancelPending() {
    setPendingPos(null);
    setPendingText('');
    setRangePicking(null);
    onCancelPlacing();
  }

  function handleStartEdit(sticky: Sticky) {
    setEditingStickyId(sticky.id);
    setEditingText(sticky.text);
    setEditingColor(getStickyColor(sticky));
    setEditingIsRange(sticky.endTimeSec !== undefined && sticky.endTimeSec > sticky.timeSec);
    setEditingEndTime(sticky.endTimeSec ?? Math.min(sticky.timeSec + 1, durationSec || sticky.timeSec + 1));
  }

  function handleSaveEdit(sticky: Sticky) {
    const text = editingText.trim();
    if (text === '') return;
    if (editingIsRange && editingEndTime <= sticky.timeSec) return;
    onUpdateSticky({
      ...sticky,
      text,
      color: editingColor,
      endTimeSec: editingIsRange ? Math.max(editingEndTime, sticky.timeSec + 0.1) : undefined,
    });
    setEditingStickyId(null);
  }

  function handleCancelEdit() {
    setEditingStickyId(null);
    setEditingText('');
    setRangePicking(null);
  }

  function startRangePicking(kind: 'pending' | 'editing', startTime: number, endTime: number) {
    const video = videoRef.current;
    video?.pause();
    onSeek(Math.max(endTime, startTime));
    setRangePicking({ kind, startTime });
  }

  function confirmRangeEnd() {
    if (!rangePicking || currentTime <= rangePicking.startTime) return;
    if (rangePicking.kind === 'pending') setPendingEndTime(currentTime);
    else {
      setEditingEndTime(currentTime);
      onSeek(rangePicking.startTime);
    }
    setRangePicking(null);
  }

  function cancelRangePicking() {
    if (rangePicking?.kind === 'editing') onSeek(rangePicking.startTime);
    setRangePicking(null);
  }

  function formatPreciseTime(time: number) {
    const safeTime = Number.isFinite(time) && time > 0 ? time : 0;
    const minutes = Math.floor(safeTime / 60);
    const seconds = (safeTime - minutes * 60).toFixed(3).padStart(6, '0');
    return `${String(minutes)}:${seconds}`;
  }

  function renderColorPicker(selected: StickyColor, onSelect: (color: StickyColor) => void) {
    return (
      <div className="sticky-color-picker" aria-label="付箋の色">
        {STICKY_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`sticky-color-choice sticky-color-choice-${color} ${selected === color ? 'sticky-color-choice-selected' : ''}`}
            aria-label={`${STICKY_COLOR_LABELS[color]}色`}
            onClick={() => onSelect(color)}
          />
        ))}
      </div>
    );
  }

  function handleDotPointerDown(sticky: Sticky, e: PointerEvent<HTMLSpanElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingIdRef.current = sticky.id;
    setDraggingId(sticky.id);
    setDragPos({ x: sticky.x, y: sticky.y });
  }

  function handleDotPointerMove(sticky: Sticky, e: PointerEvent<HTMLSpanElement>) {
    if (draggingIdRef.current !== sticky.id) return;
    const el = containerRef.current;
    if (!el || rect.width === 0 || rect.height === 0) return;
    const bounds = el.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
    const displayX = Math.min(Math.max((x - rect.offsetX) / rect.width, 0), 1);
    const normX = mirrored ? 1 - displayX : displayX;
    const normY = Math.min(Math.max((y - rect.offsetY) / rect.height, 0), 1);
    setDragPos({ x: normX, y: normY });
  }

  function handleDotPointerUp(sticky: Sticky, e: PointerEvent<HTMLSpanElement>) {
    e.stopPropagation();
    draggingIdRef.current = null;
    setDraggingId(null);
    if (dragPos) {
      onUpdateSticky({ ...sticky, x: dragPos.x, y: dragPos.y });
    }
    setDragPos(null);
  }

  const visibleStickies = !rangePicking && paused
    ? stickies.filter((s) => isStickyVisibleAtTime(s, currentTime) || s.id === draggingId)
    : [];

  return (
    <div
      className={`sticky-layer ${placing ? 'sticky-layer-placing' : ''} ${rangePicking ? 'sticky-layer-range-picking' : ''}`}
      onClick={handleContainerClick}
    >
      {placing && !pendingPos && <div className="sticky-hint">貼りたい場所をタップ</div>}

      {visibleStickies.map((s) => {
        const displayXY = s.id === draggingId && dragPos ? dragPos : { x: s.x, y: s.y };
        const pos = toContainerPercent(displayXY.x, displayXY.y);
        const isOpen = openStickyId === s.id;
        const isEditing = editingStickyId === s.id;
        return (
          <div
            key={s.id}
            className={`sticky-pin sticky-pin-color-${getStickyColor(s)} ${isOpen ? 'sticky-pin-open' : ''} ${s.id === draggingId ? 'sticky-pin-dragging' : ''}`}
            style={pos}
          >
            <span
              className="sticky-dot"
              onPointerDown={(e) => handleDotPointerDown(s, e)}
              onPointerMove={(e) => handleDotPointerMove(s, e)}
              onPointerUp={(e) => handleDotPointerUp(s, e)}
              onClick={(e) => e.stopPropagation()}
            />
            <div
              className="sticky-bubble"
              onClick={(e) => {
                e.stopPropagation();
                setOpenStickyId(isOpen ? null : s.id);
              }}
            >
              {isEditing ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <textarea
                    className="sticky-input-textarea"
                    value={editingText}
                    maxLength={1000}
                    onChange={(e) => setEditingText(e.target.value)}
                    autoFocus
                    rows={2}
                  />
                  {renderColorPicker(editingColor, setEditingColor)}
                  <label className="sticky-range-mode">
                    種類
                    <select
                      value={editingIsRange ? 'range' : 'instant'}
                      onChange={(e) => {
                        const isRange = e.target.value === 'range';
                        setEditingIsRange(isRange);
                        if (isRange && editingEndTime <= s.timeSec) {
                          setEditingEndTime(Math.min(s.timeSec + 1, durationSec || s.timeSec + 1));
                        }
                      }}
                    >
                      <option value="instant">この瞬間</option>
                      <option value="range">時間区間</option>
                    </select>
                  </label>
                  {editingIsRange && (
                    <div className="sticky-range-control">
                      <span>開始 {formatTime(s.timeSec)} ／ 終了 {formatPreciseTime(editingEndTime)}</span>
                      <button
                        type="button"
                        className="sticky-range-pick-btn"
                        onClick={() => startRangePicking('editing', s.timeSec, editingEndTime)}
                      >
                        動画を見ながら終了位置を決める
                      </button>
                    </div>
                  )}
                  <div className="sticky-input-actions">
                    <button type="button" className="sticky-input-cancel" onClick={handleCancelEdit}>
                      取消
                    </button>
                    <button type="button" className="sticky-input-save" onClick={() => handleSaveEdit(s)}>
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="sticky-text">{s.text}</p>
                  {isOpen && (
                    <div className="sticky-bubble-actions">
                      <button
                        type="button"
                        className="sticky-edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(s);
                        }}
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        className="sticky-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSticky(s.id);
                          setOpenStickyId(null);
                        }}
                      >
                        削除
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}

      {rangePicking && (
        <div className="sticky-range-picker" onClick={(e) => e.stopPropagation()}>
          <div className="sticky-range-picker-times">
            <span>開始 {formatPreciseTime(rangePicking.startTime)}</span>
            <strong>現在 {formatPreciseTime(currentTime)}</strong>
          </div>
          <p>動画・シークバー・◀▶で終了フレームを合わせてください</p>
          <div className="sticky-range-picker-actions">
            <button type="button" className="sticky-input-cancel" onClick={cancelRangePicking}>
              入力に戻る
            </button>
            <button
              type="button"
              className="sticky-input-save"
              disabled={currentTime <= rangePicking.startTime}
              onClick={confirmRangeEnd}
            >
              この位置で確定
            </button>
          </div>
        </div>
      )}

      {pendingPos && !rangePicking && (
        <div
          className="sticky-input-box"
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            className="sticky-input-textarea"
            value={pendingText}
            maxLength={1000}
            onChange={(e) => setPendingText(e.target.value)}
            placeholder="メモを入力"
            autoFocus
            rows={2}
          />
          {renderColorPicker(pendingColor, setPendingColor)}
          <label className="sticky-range-mode">
            種類
            <select
              value={pendingIsRange ? 'range' : 'instant'}
              onChange={(e) => {
                const isRange = e.target.value === 'range';
                setPendingIsRange(isRange);
                if (isRange && pendingEndTime <= pendingStartTime) {
                  setPendingEndTime(Math.min(pendingStartTime + 1, durationSec || pendingStartTime + 1));
                }
              }}
            >
              <option value="instant">この瞬間</option>
              <option value="range">時間区間</option>
            </select>
          </label>
          {pendingIsRange && (
            <div className="sticky-range-control">
              <span>開始 {formatTime(pendingStartTime)} ／ 終了 {formatPreciseTime(pendingEndTime)}</span>
              <button
                type="button"
                className="sticky-range-pick-btn"
                onClick={() => startRangePicking('pending', pendingStartTime, pendingEndTime)}
              >
                動画を見ながら終了位置を決める
              </button>
            </div>
          )}
          <div className="sticky-input-actions">
            <button type="button" className="sticky-input-cancel" onClick={handleCancelPending}>
              取消
            </button>
            <button type="button" className="sticky-input-save" onClick={handleSavePending}>
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
