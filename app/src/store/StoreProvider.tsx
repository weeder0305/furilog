// 保存層をReactへ注入するContext（設計書 4章）

import { useMemo, type ReactNode } from 'react';
import type { WazaLogStore } from './types';
import { IdbStore } from './idbStore';
import { StoreContext } from './useStore';

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useMemo<WazaLogStore>(() => new IdbStore(), []);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
