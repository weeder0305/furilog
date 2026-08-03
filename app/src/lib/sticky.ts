import type { Sticky, StickyColor } from '../models';

export const STICKY_COLORS: StickyColor[] = ['yellow', 'red', 'green', 'blue'];

export const STICKY_COLOR_LABELS: Record<StickyColor, string> = {
  yellow: '黄',
  red: '赤',
  green: '緑',
  blue: '青',
};

export type StickySortMode = 'time-asc' | 'time-desc' | 'color';

export function getStickyColor(sticky: Sticky): StickyColor {
  return sticky.color ?? 'yellow';
}

export function isStickyVisibleAtTime(sticky: Sticky, currentTime: number): boolean {
  if (sticky.endTimeSec !== undefined && sticky.endTimeSec > sticky.timeSec) {
    return currentTime >= sticky.timeSec - 0.01 && currentTime <= sticky.endTimeSec + 0.01;
  }
  return Math.abs(sticky.timeSec - currentTime) <= 0.01;
}

export function sortStickies(stickies: Sticky[], mode: StickySortMode): Sticky[] {
  return [...stickies].sort((a, b) => {
    if (mode === 'time-desc') return b.timeSec - a.timeSec;
    if (mode === 'color') {
      const byColor = STICKY_COLORS.indexOf(getStickyColor(a)) - STICKY_COLORS.indexOf(getStickyColor(b));
      return byColor !== 0 ? byColor : a.timeSec - b.timeSec;
    }
    return a.timeSec - b.timeSec;
  });
}
