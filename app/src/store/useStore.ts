import { createContext, useContext } from 'react';
import type { WazaLogStore } from './types';

export const StoreContext = createContext<WazaLogStore | undefined>(undefined);

export function useStore(): WazaLogStore {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useStore は StoreProvider の内側で使用してください');
  }
  return store;
}
