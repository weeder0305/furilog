import { createContext, useContext } from 'react';

export interface RouterLocation {
  pathname: string;
  state: unknown;
}

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export type Navigate = (target: string | number, options?: NavigateOptions) => void;

export interface RouterValue {
  location: RouterLocation;
  navigate: Navigate;
}

export const RouterContext = createContext<RouterValue | undefined>(undefined);

function useRouter(): RouterValue {
  const router = useContext(RouterContext);
  if (!router) throw new Error('Router hooks must be used inside HashRouter');
  return router;
}

export function useNavigate(): Navigate {
  return useRouter().navigate;
}

export function useLocation(): RouterLocation {
  return useRouter().location;
}

export function useParams<T extends { id?: string }>(): T {
  const { pathname } = useRouter().location;
  const match = pathname.match(/^\/(?:edit|watch)\/([^/]+)$/);
  let id: string | undefined;
  try {
    id = match ? decodeURIComponent(match[1]) : undefined;
  } catch {
    id = undefined;
  }
  return { id } as T;
}
