import { describe, expect, it } from 'vitest';
import type { Sticky } from '../models';
import { getStickyColor, isStickyVisibleAtTime, sortStickies } from './sticky';

function makeSticky(overrides: Partial<Sticky>): Sticky {
  return {
    id: 's',
    videoId: 'v',
    timeSec: 1,
    x: 0.5,
    y: 0.5,
    text: 'memo',
    createdAt: 0,
    ...overrides,
  };
}

describe('付箋の表示範囲', () => {
  it('瞬間付箋は貼った時刻付近だけ表示する', () => {
    const sticky = makeSticky({ timeSec: 2 });
    expect(isStickyVisibleAtTime(sticky, 2.005)).toBe(true);
    expect(isStickyVisibleAtTime(sticky, 2.04)).toBe(false);
  });

  it('区間付箋は開始から終了まで表示する', () => {
    const sticky = makeSticky({ timeSec: 2, endTimeSec: 4 });
    expect(isStickyVisibleAtTime(sticky, 3)).toBe(true);
    expect(isStickyVisibleAtTime(sticky, 4.1)).toBe(false);
  });
});

describe('付箋の色と並び順', () => {
  it('既存付箋は黄色として扱う', () => {
    expect(getStickyColor(makeSticky({ color: undefined }))).toBe('yellow');
  });

  it('時刻と色で並べ替えられる', () => {
    const stickies = [
      makeSticky({ id: 'blue', timeSec: 1, color: 'blue' }),
      makeSticky({ id: 'red', timeSec: 3, color: 'red' }),
      makeSticky({ id: 'yellow', timeSec: 2, color: 'yellow' }),
    ];
    expect(sortStickies(stickies, 'time-desc').map((s) => s.id)).toEqual(['red', 'yellow', 'blue']);
    expect(sortStickies(stickies, 'color').map((s) => s.id)).toEqual(['yellow', 'red', 'blue']);
  });
});
