import { describe, it, expect } from 'vitest';
import {
  estimateFpsFromDeltas,
  getFrameDuration,
  stepTime,
  getStepIntervalMs,
  DEFAULT_FRAME_DURATION,
  ACCEL_SCHEDULE_MS,
} from './frameStep';

describe('estimateFpsFromDeltas', () => {
  it('差分が無ければ null を返す', () => {
    expect(estimateFpsFromDeltas([])).toBeNull();
  });

  it('不正な値しか無ければ null を返す', () => {
    expect(estimateFpsFromDeltas([0, -1, NaN, Infinity])).toBeNull();
  });

  it('30fps相当の等間隔差分から30を推定する', () => {
    const delta = 1 / 30;
    const fps = estimateFpsFromDeltas([delta, delta, delta, delta, delta]);
    expect(fps).not.toBeNull();
    expect(fps!).toBeCloseTo(30, 1);
  });

  it('外れ値があっても中央値で頑健に推定する', () => {
    const delta = 1 / 60;
    // 1個だけ大きく外れた値が混ざっても中央値なら影響されにくい
    const fps = estimateFpsFromDeltas([delta, delta, delta, delta, 1.0]);
    expect(fps!).toBeCloseTo(60, 0);
  });

  it('偶数個の場合は中央2値の平均から推定する', () => {
    const fps = estimateFpsFromDeltas([1 / 24, 1 / 30]);
    const expectedMedian = (1 / 24 + 1 / 30) / 2;
    expect(fps!).toBeCloseTo(1 / expectedMedian, 5);
  });
});

describe('getFrameDuration', () => {
  it('fpsがnullなら既定値(1/30秒)を返す', () => {
    expect(getFrameDuration(null)).toBe(DEFAULT_FRAME_DURATION);
  });

  it('fpsが不正(0以下・NaN)なら既定値を返す', () => {
    expect(getFrameDuration(0)).toBe(DEFAULT_FRAME_DURATION);
    expect(getFrameDuration(-5)).toBe(DEFAULT_FRAME_DURATION);
    expect(getFrameDuration(NaN)).toBe(DEFAULT_FRAME_DURATION);
  });

  it('fpsが正の値ならその逆数を返す', () => {
    expect(getFrameDuration(60)).toBeCloseTo(1 / 60, 6);
    expect(getFrameDuration(24)).toBeCloseTo(1 / 24, 6);
  });
});

describe('stepTime', () => {
  const frameDuration = 1 / 30;
  const duration = 10;

  it('進む方向(1)で1フレーム分進む', () => {
    expect(stepTime(1, 1, frameDuration, duration)).toBeCloseTo(1 + frameDuration, 6);
  });

  it('戻る方向(-1)で1フレーム分戻る', () => {
    expect(stepTime(1, -1, frameDuration, duration)).toBeCloseTo(1 - frameDuration, 6);
  });

  it('末尾を超えないようクランプする', () => {
    expect(stepTime(duration - 0.001, 1, frameDuration, duration)).toBe(duration);
  });

  it('先頭を下回らないようクランプする', () => {
    expect(stepTime(0.001, -1, frameDuration, duration)).toBe(0);
  });

  it('ちょうど先頭・末尾でも正しくクランプする', () => {
    expect(stepTime(0, -1, frameDuration, duration)).toBe(0);
    expect(stepTime(duration, 1, frameDuration, duration)).toBe(duration);
  });
});

describe('getStepIntervalMs', () => {
  it('0ms時点は最初の間隔(150ms)', () => {
    expect(getStepIntervalMs(0)).toBe(ACCEL_SCHEDULE_MS[0]);
  });

  it('999msまでは最初の間隔のまま', () => {
    expect(getStepIntervalMs(999)).toBe(ACCEL_SCHEDULE_MS[0]);
  });

  it('1000ms経過で2段階目(100ms)になる', () => {
    expect(getStepIntervalMs(1000)).toBe(ACCEL_SCHEDULE_MS[1]);
  });

  it('2000ms経過で3段階目(66ms)になる', () => {
    expect(getStepIntervalMs(2000)).toBe(ACCEL_SCHEDULE_MS[2]);
  });

  it('3000ms経過で4段階目(40ms)になる', () => {
    expect(getStepIntervalMs(3000)).toBe(ACCEL_SCHEDULE_MS[3]);
  });

  it('4段階目を超えても下げ止まる(40msのまま)', () => {
    expect(getStepIntervalMs(10000)).toBe(ACCEL_SCHEDULE_MS[3]);
  });

  it('負の経過時間は0扱いにする', () => {
    expect(getStepIntervalMs(-100)).toBe(ACCEL_SCHEDULE_MS[0]);
  });
});
