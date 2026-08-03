// フレームステップ（◀▶）ボタン（設計書 5.5）
// 純粋ロジック（fps推定・時刻計算・長押し加速の間隔）は lib/frameStep.ts に分離し、
// ここでは requestVideoFrameCallback の購読と pointerdown/up/cancel/leave の配線のみ行う。

import { useCallback, useEffect, useRef, type PointerEvent, type RefObject } from 'react';
import {
  LONG_PRESS_THRESHOLD_MS,
  estimateFpsFromDeltas,
  getFrameDuration,
  getStepIntervalMs,
  stepTime,
} from '../lib/frameStep';
import './FrameStepButtons.css';

interface FrameStepButtonsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  durationSec: number;
  onTimeChange: (time: number) => void;
}

const MAX_SAMPLES = 8;

export function FrameStepButtons({ videoRef, durationSec, onTimeChange }: FrameStepButtonsProps) {
  const fpsRef = useRef<number | null>(null);
  const lastMediaTimeRef = useRef<number | null>(null);
  const deltasRef = useRef<number[]>([]);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const continuousTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accelStartRef = useRef<number>(0);

  // fps推定: 再生中のフレームごとに mediaTime の差分を収集し、中央値からfpsを推定する。
  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof video.requestVideoFrameCallback !== 'function') return;

    let handle: number | null = null;
    let cancelled = false;

    function onFrame(_now: number, metadata: VideoFrameCallbackMetadata) {
      if (cancelled) return;
      const last = lastMediaTimeRef.current;
      if (last !== null) {
        const delta = metadata.mediaTime - last;
        if (delta > 0) {
          const list = deltasRef.current;
          list.push(delta);
          if (list.length > MAX_SAMPLES) list.shift();
          const estimated = estimateFpsFromDeltas(list);
          if (estimated !== null) fpsRef.current = estimated;
        }
      }
      lastMediaTimeRef.current = metadata.mediaTime;
      if (video && typeof video.requestVideoFrameCallback === 'function') {
        handle = video.requestVideoFrameCallback(onFrame);
      }
    }

    handle = video.requestVideoFrameCallback(onFrame);
    return () => {
      cancelled = true;
      if (handle !== null && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(handle);
      }
    };
  }, [videoRef]);

  const doStep = useCallback(
    (direction: 1 | -1) => {
      const video = videoRef.current;
      if (!video) return;
      if (!video.paused) video.pause();
      const frameDuration = getFrameDuration(fpsRef.current);
      const total = durationSec || video.duration || 0;
      const nextTime = stepTime(video.currentTime, direction, frameDuration, total);
      video.currentTime = nextTime;
      // seekedを待たず、シークバーと付箋の表示を同じ操作内で追従させる。
      onTimeChange(nextTime);
    },
    [videoRef, durationSec, onTimeChange]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLButtonElement ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        doStep(event.key === 'ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [doStep]);

  const clearTimers = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (continuousTimerRef.current !== null) {
      clearTimeout(continuousTimerRef.current);
      continuousTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const continuousStep = useCallback(
    (direction: 1 | -1) => {
      doStep(direction);
      const elapsed = performance.now() - accelStartRef.current;
      const interval = getStepIntervalMs(elapsed);
      continuousTimerRef.current = setTimeout(() => continuousStep(direction), interval);
    },
    [doStep]
  );

  const handlePointerDown = useCallback(
    (direction: 1 | -1) => (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      doStep(direction);
      longPressTimerRef.current = setTimeout(() => {
        accelStartRef.current = performance.now();
        continuousStep(direction);
      }, LONG_PRESS_THRESHOLD_MS);
    },
    [doStep, continuousStep]
  );

  return (
    <div className="frame-step-buttons">
      <button
        type="button"
        className="frame-step-btn"
        aria-label="1フレーム戻る"
        onPointerDown={handlePointerDown(-1)}
        onPointerUp={clearTimers}
        onPointerCancel={clearTimers}
        onPointerLeave={clearTimers}
      >
        ◀
      </button>
      <button
        type="button"
        className="frame-step-btn"
        aria-label="1フレーム進む"
        onPointerDown={handlePointerDown(1)}
        onPointerUp={clearTimers}
        onPointerCancel={clearTimers}
        onPointerLeave={clearTimers}
      >
        ▶
      </button>
    </div>
  );
}
