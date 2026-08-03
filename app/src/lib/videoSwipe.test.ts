import { describe, expect, it } from 'vitest';
import { videoSwipeDirection } from './videoSwipe';

describe('videoSwipeDirection', () => {
  it('maps central horizontal swipes to adjacent videos', () => {
    expect(videoSwipeDirection(150, 100, 240, 105, 400)).toBe('previous');
    expect(videoSwipeDirection(250, 100, 160, 105, 400)).toBe('next');
  });

  it('ignores swipes started in browser navigation edge zones', () => {
    expect(videoSwipeDirection(30, 100, 130, 100, 400)).toBeNull();
    expect(videoSwipeDirection(380, 100, 280, 100, 400)).toBeNull();
  });

  it('ignores short or mostly vertical gestures', () => {
    expect(videoSwipeDirection(150, 100, 190, 100, 400)).toBeNull();
    expect(videoSwipeDirection(150, 100, 230, 190, 400)).toBeNull();
  });
});
