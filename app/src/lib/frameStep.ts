// フレームステップ（◀▶）の純粋ロジック（設計書 5.5）。
// pointerdown/up/cancel などのイベント処理はコンポーネント側（FrameStepButtons.tsx）が担い、
// ここでは fps推定・時刻計算・長押し加速の間隔計算のみを純粋関数として提供する。

/** requestVideoFrameCallback が使えない場合の既定フレーム長（1/30秒） */
export const DEFAULT_FRAME_DURATION = 1 / 30;

/** 長押し判定の閾値（ms） */
export const LONG_PRESS_THRESHOLD_MS = 500;

/** 長押し中の加速スケジュール（ms）。1秒ごとに次の間隔へ短縮し、最後の値で下げ止まる */
export const ACCEL_SCHEDULE_MS = [150, 100, 66, 40] as const;

/**
 * 連続する mediaTime の差分（秒）の配列から、その中央値を用いてfpsを推定する。
 * 差分が無い場合や不正な値しかない場合は null を返す（呼び出し側は既定値を使う）。
 */
export function estimateFpsFromDeltas(deltasSec: number[]): number | null {
  const valid = deltasSec.filter((d) => Number.isFinite(d) && d > 0);
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  if (median <= 0) return null;
  return 1 / median;
}

/**
 * fps推定値（無ければ null）から1フレームの長さ（秒）を求める。
 */
export function getFrameDuration(fps: number | null): number {
  if (fps === null || !Number.isFinite(fps) || fps <= 0) return DEFAULT_FRAME_DURATION;
  return 1 / fps;
}

/**
 * 現在時刻から1フレーム分進む/戻るを計算する。先頭・末尾でクランプする。
 * @param direction 1: 進む（▶）, -1: 戻る（◀）
 */
export function stepTime(
  currentTime: number,
  direction: 1 | -1,
  frameDuration: number,
  durationSec: number
): number {
  const next = currentTime + direction * frameDuration;
  if (next < 0) return 0;
  if (next > durationSec) return durationSec;
  return next;
}

/**
 * 長押し開始（500ms経過時点）からの経過時間(ms)から、現在使うべきステップ間隔(ms)を求める。
 * 開始直後は150ms、以後1秒ごとに 150→100→66→40ms と短縮し、最後の値で下げ止まる。
 */
export function getStepIntervalMs(elapsedMsSinceAccelStart: number): number {
  const bucket = Math.min(
    Math.floor(Math.max(0, elapsedMsSinceAccelStart) / 1000),
    ACCEL_SCHEDULE_MS.length - 1
  );
  return ACCEL_SCHEDULE_MS[bucket];
}
