export type VideoSwipeDirection = 'previous' | 'next';

export const VIDEO_SWIPE_EDGE_EXCLUSION_PX = 56;
export const VIDEO_SWIPE_MIN_DISTANCE_PX = 72;

export function videoSwipeDirection(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  containerWidth: number
): VideoSwipeDirection | null {
  if (
    containerWidth <= VIDEO_SWIPE_EDGE_EXCLUSION_PX * 2 ||
    startX < VIDEO_SWIPE_EDGE_EXCLUSION_PX ||
    startX > containerWidth - VIDEO_SWIPE_EDGE_EXCLUSION_PX
  ) {
    return null;
  }
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  if (Math.abs(deltaX) < VIDEO_SWIPE_MIN_DISTANCE_PX || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) {
    return null;
  }
  return deltaX > 0 ? 'previous' : 'next';
}
