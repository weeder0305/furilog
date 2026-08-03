// トップページ（設計書 5.1）

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '../router';
import { Header, type ViewMode } from '../components/Header';
import { Drawer } from '../components/Drawer';
import { VideoGrid } from '../components/VideoGrid';
import { VideoListView } from '../components/VideoListView';
import { Fab } from '../components/Fab';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useStore } from '../store/useStore';
import { buildFolderNameMap, filterVideos, sortVideos, type VideoSortMode } from '../lib/search';
import type { VideoEntry, Folder } from '../models';
import './HomePage.css';

const VIEW_MODE_KEY = 'wazalog:viewMode';
const SORT_MODE_KEY = 'wazalog:sortMode';

function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences are optional; the app remains usable when storage is restricted.
  }
}

export function HomePage() {
  const store = useStore();
  const navigate = useNavigate();

  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<Folder | null>(null);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(() => new Set());
  const [deleteVideosDialogOpen, setDeleteVideosDialogOpen] = useState(false);

  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<VideoSortMode>(() => {
    const saved = readPreference(SORT_MODE_KEY);
    return saved === 'recorded-desc' ||
      saved === 'recorded-asc' ||
      saved === 'created-asc' ||
      saved === 'title-asc'
      ? saved
      : 'created-desc';
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = readPreference(VIEW_MODE_KEY);
    return saved === 'list' ? 'list' : 'grid';
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([store.listVideos(), store.listFolders()])
      .then(([vs, fs]) => {
        if (cancelled) return;
        setVideos(vs);
        setFolders(fs);
      })
      .catch(() => {
        if (!cancelled) setErrorMessage('端末内の保存データを読み込めませんでした。端末の保存設定と空き容量を確認してください。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [store]);

  useEffect(() => {
    savePreference(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    savePreference(SORT_MODE_KEY, sortMode);
  }, [sortMode]);

  const folderNameMap = useMemo(() => buildFolderNameMap(folders), [folders]);

  const folderFiltered = useMemo(
    () =>
      selectedFolderId === null
        ? videos
        : videos.filter((v) => v.folderId === selectedFolderId),
    [videos, selectedFolderId]
  );

  const displayedVideos = useMemo(
    () => sortVideos(filterVideos(folderFiltered, folderNameMap, searchQuery), sortMode),
    [folderFiltered, folderNameMap, searchQuery, sortMode]
  );

  const selectionMode = selectedVideoIds.size > 0;

  function startVideoSelection(id: string) {
    setSelectedVideoIds((previous) => new Set(previous).add(id));
  }

  function toggleVideoSelection(id: string) {
    setSelectedVideoIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirmDeleteVideos() {
    const ids = Array.from(selectedVideoIds);
    if (ids.length === 0) return;
    setDeleteVideosDialogOpen(false);
    try {
      await store.deleteVideos(ids);
      const deletedIds = new Set(ids);
      setVideos((previous) => previous.filter((video) => !deletedIds.has(video.id)));
      setSelectedVideoIds(new Set());
      setErrorMessage(null);
    } catch {
      setErrorMessage('選択した動画を削除できませんでした。もう一度お試しください。');
    }
  }

  function handleFileSelected(file: File, temporaryPath?: string, recordedAt?: number, savedToAlbum?: boolean) {
    navigate('/edit/new', { state: { file, temporaryPath, recordedAt, savedToAlbum } });
  }

  async function handleCreateFolder(name: string) {
    const folder: Folder = { id: crypto.randomUUID(), name, createdAt: Date.now() };
    try {
      await store.saveFolder(folder);
      setFolders((prev) => [...prev, folder]);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage('フォルダを作成できませんでした。端末の空き容量を確認してください。');
      throw error;
    }
  }

  async function handleConfirmDeleteFolder() {
    if (!pendingDeleteFolder) return;
    const folderId = pendingDeleteFolder.id;
    try {
      await store.deleteFolder(folderId);
      setFolders((prev) => prev.filter((folder) => folder.id !== folderId));
      setVideos((prev) =>
        prev.map((video) => (video.folderId === folderId ? { ...video, folderId: null } : video))
      );
      if (selectedFolderId === folderId) setSelectedFolderId(null);
      setPendingDeleteFolder(null);
      setErrorMessage(null);
    } catch {
      setErrorMessage('フォルダを削除できませんでした。もう一度お試しください。');
    }
  }

  const pendingFolderVideoCount = pendingDeleteFolder
    ? videos.filter((video) => video.folderId === pendingDeleteFolder.id).length
    : 0;

  return (
    <div className="home-page">
      <Header
        searchActive={searchActive}
        searchQuery={searchQuery}
        viewMode={viewMode}
        onMenuClick={() => setDrawerOpen(true)}
        onSearchToggle={() => {
          setSearchActive((v) => !v);
          setSearchQuery('');
          setSelectedVideoIds(new Set());
        }}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setSelectedVideoIds(new Set());
        }}
        onViewModeToggle={() => setViewMode((v) => (v === 'grid' ? 'list' : 'grid'))}
        onNotesClick={() => navigate('/notes')}
      />

      <Drawer
        open={drawerOpen}
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={(folderId) => {
          setSelectedFolderId(folderId);
          setSelectedVideoIds(new Set());
        }}
        onCreateFolder={handleCreateFolder}
        onRequestDeleteFolder={setPendingDeleteFolder}
        onPrivacyClick={() => navigate('/privacy')}
        onClose={() => setDrawerOpen(false)}
      />

      <main className="home-content">
        {errorMessage && <p className="home-loading" role="alert">{errorMessage}</p>}
        {selectionMode && (
          <div className="home-selection-tools" role="toolbar" aria-label="選択した動画の操作">
            <strong>{selectedVideoIds.size}件選択</strong>
            <div className="home-selection-actions">
              <button
                type="button"
                onClick={() => setSelectedVideoIds(new Set(displayedVideos.map((video) => video.id)))}
              >
                すべて選択
              </button>
              <button type="button" onClick={() => setSelectedVideoIds(new Set())}>解除</button>
              <button type="button" className="home-selection-delete" onClick={() => setDeleteVideosDialogOpen(true)}>
                削除
              </button>
            </div>
          </div>
        )}
        {!loading && (
          <div className="home-list-tools">
            <span className="home-result-count">{displayedVideos.length}件</span>
            <label className="home-sort-label">
              並び順
              <select
                className="home-sort-select"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as VideoSortMode)}
              >
                <option value="recorded-desc">撮影日：新しい順</option>
                <option value="recorded-asc">撮影日：古い順</option>
                <option value="created-desc">追加日：新しい順</option>
                <option value="created-asc">追加日：古い順</option>
                <option value="title-asc">タイトル順</option>
              </select>
            </label>
          </div>
        )}
        {loading ? (
          <p className="home-loading">読み込み中…</p>
        ) : viewMode === 'grid' ? (
          <VideoGrid
            videos={displayedVideos}
            selectionMode={selectionMode}
            selectedIds={selectedVideoIds}
            onStartSelection={startVideoSelection}
            onToggleSelection={toggleVideoSelection}
          />
        ) : (
          <VideoListView
            videos={displayedVideos}
            selectionMode={selectionMode}
            selectedIds={selectedVideoIds}
            onStartSelection={startVideoSelection}
            onToggleSelection={toggleVideoSelection}
          />
        )}
      </main>

      {!selectionMode && <Fab onFileSelected={handleFileSelected} />}

      <ConfirmDialog
        open={deleteVideosDialogOpen}
        title="選択した動画を削除しますか？"
        message={`選択した ${String(selectedVideoIds.size)} 件をアプリ内から削除します。動画、サムネイル、付箋は元に戻せません。端末のアルバムに別途保存されている動画は削除されません。`}
        confirmLabel="まとめて削除"
        danger
        onConfirm={handleConfirmDeleteVideos}
        onCancel={() => setDeleteVideosDialogOpen(false)}
      />

      <ConfirmDialog
        open={pendingDeleteFolder !== null}
        title="フォルダを削除しますか？"
        message={
          pendingFolderVideoCount > 0
            ? `「${pendingDeleteFolder?.name ?? ''}」を削除します。中の動画 ${String(pendingFolderVideoCount)} 件は削除せず「未分類」へ移します。`
            : `空のフォルダ「${pendingDeleteFolder?.name ?? ''}」を削除します。`
        }
        confirmLabel="削除する"
        danger
        onConfirm={handleConfirmDeleteFolder}
        onCancel={() => setPendingDeleteFolder(null)}
      />
    </div>
  );
}
