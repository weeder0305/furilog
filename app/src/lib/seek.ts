export const PRECISE_SEEK_HOLD_MS = 1700;
export const PRECISE_SEEK_SCALE = 0.25;
export const PRECISE_SEEK_MOVE_TOLERANCE_PX = 8;

export function clampSeekTime(time: number, durationSec: number): number {
  if (!Number.isFinite(time) || !Number.isFinite(durationSec) || durationSec <= 0) return 0;
  return Math.min(Math.max(time, 0), durationSec);
}

export function seekTimeFromPosition(clientX: number, left: number, width: number, durationSec: number): number {
  if (width <= 0) return 0;
  return clampSeekTime(((clientX - left) / width) * durationSec, durationSec);
}

export function preciseSeekTime(
  clientX: number,
  anchorX: number,
  anchorTime: number,
  width: number,
  durationSec: number
): number {
  if (width <= 0) return clampSeekTime(anchorTime, durationSec);
  const delta = ((clientX - anchorX) / width) * durationSec * PRECISE_SEEK_SCALE;
  return clampSeekTime(anchorTime + delta, durationSec);
}
