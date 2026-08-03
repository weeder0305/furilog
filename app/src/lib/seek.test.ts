import { describe, expect, it } from 'vitest';
import {
  PRECISE_SEEK_HOLD_MS,
  PRECISE_SEEK_MOVE_TOLERANCE_PX,
  PRECISE_SEEK_SCALE,
  clampSeekTime,
  preciseSeekTime,
  seekTimeFromPosition,
} from './seek';

describe('seek calculations', () => {
  it('maps a pointer position to the full duration', () => {
    expect(seekTimeFromPosition(60, 10, 100, 20)).toBe(10);
  });

  it('uses one quarter speed during precise seeking', () => {
    expect(preciseSeekTime(100, 50, 10, 100, 20)).toBe(12.5);
  });

  it('requires a stationary long press before precise seeking', () => {
    expect(PRECISE_SEEK_HOLD_MS).toBeGreaterThanOrEqual(1500);
    expect(PRECISE_SEEK_HOLD_MS).toBeLessThanOrEqual(2000);
    expect(PRECISE_SEEK_MOVE_TOLERANCE_PX).toBeLessThanOrEqual(8);
    expect(PRECISE_SEEK_SCALE).toBe(0.25);
  });

  it('clamps seek times at both ends', () => {
    expect(clampSeekTime(-1, 20)).toBe(0);
    expect(clampSeekTime(21, 20)).toBe(20);
  });
});
