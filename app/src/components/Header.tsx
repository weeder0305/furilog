// トップページのヘッダー（設計書 5.1）
// 通常時: ハンバーガー / アプリ名 / 検索アイコン + 表示切替アイコン
// 検索モード時: ヘッダーが検索バーに変わる

import './Header.css';

export type ViewMode = 'grid' | 'list';

interface HeaderProps {
  searchActive: boolean;
  searchQuery: string;
  viewMode: ViewMode;
  onMenuClick: () => void;
  onSearchToggle: () => void;
  onSearchChange: (query: string) => void;
  onViewModeToggle: () => void;
  onNotesClick: () => void;
}

export function Header({
  searchActive,
  searchQuery,
  viewMode,
  onMenuClick,
  onSearchToggle,
  onSearchChange,
  onViewModeToggle,
  onNotesClick,
}: HeaderProps) {
  return (
    <header className="app-header">
      {searchActive ? (
        <>
          <input
            type="text"
            className="search-input"
            placeholder="タイトル・メモ・タグ・フォルダ名で検索"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            className="header-icon-btn"
            aria-label="検索を閉じる"
            onClick={onSearchToggle}
          >
            ✕
          </button>
        </>
      ) : (
        <>
          <button type="button" className="header-icon-btn" aria-label="メニュー" onClick={onMenuClick}>
            ☰
          </button>
          <h1 className="app-title">ふりろぐ</h1>
          <div className="header-actions">
            <button
              type="button"
              className="header-icon-btn"
              aria-label="メモ帳を開く"
              onClick={onNotesClick}
            >
              📝
            </button>
            <button
              type="button"
              className="header-icon-btn"
              aria-label="検索"
              onClick={onSearchToggle}
            >
              🔍
            </button>
            <button
              type="button"
              className="header-icon-btn"
              aria-label="表示切替"
              onClick={onViewModeToggle}
            >
              {viewMode === 'grid' ? '▦' : '≡'}
            </button>
          </div>
        </>
      )}
    </header>
  );
}
