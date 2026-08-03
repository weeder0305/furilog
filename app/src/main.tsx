import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from './HashRouter';
import './theme.css';
import App from './App.tsx';
import { StoreProvider } from './store/StoreProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </StoreProvider>
  </StrictMode>
);
