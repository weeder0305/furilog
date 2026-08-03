import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { formatTime } from '../lib/format';
import {
  PRECISE_SEEK_HOLD_MS,
  PRECISE_SEEK_MOVE_TOLERANCE_PX,
  clampSeekTime,
  preciseSeekTime,
  seekTimeFromPosition,
} from '../lib/seek';
import './SeekBar.css';

interface SeekBarProps {
  currentTime: number;
  durationSec: number;
  onSeek: (time: number) => void;
  onPreciseStart?: () => void;
  onPreciseEnd?: () => void;
}

export function SeekBar({ currentTime, durationSec, onSeek, onPreciseStart, onPreciseEnd }: SeekBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureRef = useRef<{ pointerId: number; anchorX: number; anchorTime: number } | null>(null);
  const preciseRef = useRef(false);
  const [precise, setPrecise] = useState(false);
  const value = clampSeekTime(currentTime, durationSec);
  const percent = durationSec > 0 ? (value / durationSec) * 100 : 0;

  const cancelHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }, []);

  const clearGesture = useCallback(() => {
    cancelHoldTimer();
    gestureRef.current = null;
    preciseRef.current = false;
    setPrecise(false);
  }, [cancelHoldTimer]);

  useEffect(() => clearGesture, [clearGesture]);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (durationSec <= 0) return;
    const track = trackRef.current;
    if (!track) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = track.getBoundingClientRect();
    const anchorTime = seekTimeFromPosition(event.clientX, bounds.left, bounds.width, durationSec);
    gestureRef.current = { pointerId: event.pointerId, anchorX: event.clientX, anchorTime };
    onSeek(anchorTime);
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      preciseRef.current = true;
      setPrecise(true);
      onPreciseStart?.();
      if ('vibrate' in navigator) navigator.vibrate?.(20);
    }, PRECISE_SEEK_HOLD_MS);
  }

  function handlePointerEnd() {
    if (preciseRef.current) onPreciseEnd?.();
    clearGesture();
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    const track = trackRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !track) return;
    if (!preciseRef.current && Math.abs(event.clientX - gesture.anchorX) > PRECISE_SEEK_MOVE_TOLERANCE_PX) {
      // 通常のドラッグを途中から精密シークへ変えない。精密操作は静止長押しだけで開始する。
      cancelHoldTimer();
    }
    const bounds = track.getBoundingClientRect();
    const next = preciseRef.current
      ? preciseSeekTime(event.clientX, gesture.anchorX, gesture.anchorTime, bounds.width, durationSec)
      : seekTimeFromPosition(event.clientX, bounds.left, bounds.width, durationSec);
    onSeek(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.stopPropagation();
    onSeek(clampSeekTime(value + (event.key === 'ArrowRight' ? 0.1 : -0.1), durationSec));
  }

  return (
    <div className="seek-bar-wrap">
      <div
        ref={trackRef}
        className={`seek-bar ${precise ? 'seek-bar-precise' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label="再生位置。長押しすると精密に操作できます"
        aria-valuemin={0}
        aria-valuemax={durationSec}
        aria-valuenow={value}
        aria-valuetext={`${formatTime(value)} / ${formatTime(durationSec)}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleKeyDown}
      >
        <div className="seek-bar-track">
          <div className="seek-bar-progress" style={{ width: `${String(percent)}%` }} />
          <span className="seek-bar-thumb" style={{ left: `${String(percent)}%` }} />
        </div>
        {precise && <span className="seek-bar-precision-label">精密シーク 1/4</span>}
      </div>
      <div className="seek-bar-time">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(durationSec)}</span>
      </div>
    </div>
  );
}
