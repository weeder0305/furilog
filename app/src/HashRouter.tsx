import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RouterContext, type Navigate, type RouterLocation } from './router';

const STATE_KEY = '__furilogTransientState';
const DEPTH_KEY = '__furilogRouteDepth';
const transientStates = new Map<string, unknown>();

declare global {
  interface Window {
    __furilogHandleNativeBack?: () => boolean;
  }
}

function readPathname(): string {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const pathname = raw.split('?')[0] || '/';
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function stateId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const id = (value as Record<string, unknown>)[STATE_KEY];
  return typeof id === 'string' ? id : null;
}

function routeDepth(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const depth = (value as Record<string, unknown>)[DEPTH_KEY];
  return typeof depth === 'number' && Number.isInteger(depth) && depth >= 0 ? depth : 0;
}

function readLocation(): RouterLocation {
  const id = stateId(history.state);
  return { pathname: readPathname(), state: id ? transientStates.get(id) ?? null : null };
}

export function HashRouter({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<RouterLocation>(readLocation);
  const activeStateId = useRef(stateId(history.state));

  useEffect(() => {
    if (!(DEPTH_KEY in (history.state ?? {}))) {
      history.replaceState({ ...(history.state ?? {}), [DEPTH_KEY]: 0 }, '', window.location.href);
    }
    const sync = () => {
      const nextId = stateId(history.state);
      if (activeStateId.current && activeStateId.current !== nextId) {
        transientStates.delete(activeStateId.current);
      }
      activeStateId.current = nextId;
      setLocation(readLocation());
    };
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const navigate = useCallback<Navigate>((target, options) => {
    if (typeof target === 'number') {
      history.go(target);
      return;
    }

    const pathname = target.startsWith('/') ? target : `/${target}`;
    const url = `${window.location.pathname}${window.location.search}#${pathname}`;
    const currentDepth = routeDepth(history.state);
    const nextDepth = options?.replace ? currentDepth : currentDepth + 1;
    const storedState: Record<string, string | number> = { [DEPTH_KEY]: nextDepth };
    let nextId: string | null = null;
    if (options?.state !== undefined && options.state !== null) {
      nextId = crypto.randomUUID();
      transientStates.set(nextId, options.state);
      storedState[STATE_KEY] = nextId;
    }

    if (activeStateId.current && activeStateId.current !== nextId) {
      transientStates.delete(activeStateId.current);
    }
    activeStateId.current = nextId;
    history[options?.replace ? 'replaceState' : 'pushState'](storedState, '', url);
    setLocation({ pathname, state: options?.state ?? null });
  }, []);

  useEffect(() => {
    window.__furilogHandleNativeBack = () => {
      const overlayBackEvent = new Event('furilog:nativeBack', { cancelable: true });
      if (!window.dispatchEvent(overlayBackEvent)) return true;
      if (readPathname() === '/') return false;
      if (routeDepth(history.state) > 0) history.back();
      else navigate('/', { replace: true });
      return true;
    };
    return () => {
      delete window.__furilogHandleNativeBack;
    };
  }, [navigate]);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}
