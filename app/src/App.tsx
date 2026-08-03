import { HomePage } from './pages/HomePage';
import { EditPage } from './pages/EditPage';
import { WatchPage } from './pages/WatchPage';
import { NotesPage } from './pages/NotesPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { DataGuidePage } from './pages/DataGuidePage';
import { useLocation, useNavigate } from './router';

function App() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (pathname === '/') return <HomePage />;
  if (pathname === '/edit/new' || /^\/edit\/[^/]+$/.test(pathname)) return <EditPage />;
  if (/^\/watch\/[^/]+$/.test(pathname)) return <WatchPage />;
  if (pathname === '/notes') return <NotesPage />;
  if (pathname === '/privacy') return <PrivacyPage />;
  if (pathname === '/data-guide') return <DataGuidePage />;
  return (
    <main className="home-loading">
      <p>ページが見つかりませんでした。</p>
      <button type="button" onClick={() => navigate('/', { replace: true })}>トップへ戻る</button>
    </main>
  );
}

export default App;
