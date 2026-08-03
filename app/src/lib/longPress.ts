import { useRef, type MouseEventHandler, type PointerEventHandler } from 'react';

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 12;

export function useLongPress(onLongPress: () => void) {
  const timerRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  function clearTimer() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    originRef.current = null;
  }

  const onPointerDown: PointerEventHandler<HTMLElement> = (event) => {
    if (event.button !== 0) return;
    clearTimer();
    suppressClickRef.current = false;
    originRef.current = { x: event.clientX, y: event.clientY };
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      suppressClickRef.current = true;
      navigator.vibrate?.(25);
      onLongPress();
    }, LONG_PRESS_MS);
  };

  const onPointerMove: PointerEventHandler<HTMLElement> = (event) => {
    const origin = originRef.current;
    if (!origin) return;
    if (
      Math.abs(event.clientX - origin.x) > MOVE_TOLERANCE_PX ||
      Math.abs(event.clientY - origin.y) > MOVE_TOLERANCE_PX
    ) {
      clearTimer();
    }
  };

  const onContextMenu: MouseEventHandler<HTMLElement> = (event) => {
    event.preventDefault();
    clearTimer();
    if (!suppressClickRef.current) onLongPress();
    suppressClickRef.current = true;
  };

  function consumeClick(): boolean {
    const shouldSuppress = suppressClickRef.current;
    suppressClickRef.current = false;
    return shouldSuppress;
  }

  return {
    eventHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: clearTimer,
      onPointerCancel: clearTimer,
      onContextMenu,
    },
    consumeClick,
  };
}
