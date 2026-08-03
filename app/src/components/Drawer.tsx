// フォルダ一覧ドロワー（設計書 5.1）

import { useEffect, useId, useRef, useState } from 'react';
import type { Folder } from '../models';
import { isNativeAndroidApp } from '../lib/platform';
import './Drawer.css';

interface DrawerProps {
  open: boolean;
  folders: Folder[];
  selectedFolderId: string | null; // null = すべて
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onRequestDeleteFolder: (folder: Folder) => void;
  onPrivacyClick: () => void;
  onClose: () => void;
}

export function Drawer({
  open,
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRequestDeleteFolder,
  onPrivacyClick,
  onClose,
}: DrawerProps) {
  const nativeApp = isNativeAndroidApp();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key === 'Tab') {
        const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const handleNativeBack = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('furilog:nativeBack', handleNativeBack);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('furilog:nativeBack', handleNativeBack);
      previouslyFocused?.focus();
    };
  }, [open]);

  async function handleCreate() {
    const name = newName.trim();
    if (name === '') return;
    setCreateError(null);
    try {
      await onCreateFolder(name);
      setNewName('');
      setCreating(false);
    } catch {
      setCreateError('フォルダを作成できませんでした。空き容量を確認してください。');
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <nav ref={drawerRef} className="drawer drawer-open" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="drawer-heading-row">
          <h2 className="drawer-title" id={titleId}>フォルダ</h2>
          <button ref={closeButtonRef} type="button" className="drawer-close" onClick={onClose} aria-label="メニューを閉じる">×</button>
        </div>
        <ul className="drawer-list">
          <li>
            <button
              type="button"
              className={`drawer-item ${selectedFolderId === null ? 'drawer-item-active' : ''}`}
              onClick={() => {
                onSelectFolder(null);
                onClose();
              }}
            >
              すべて
            </button>
          </li>
          {folders.map((f) => (
            <li key={f.id} className="drawer-folder-row">
              <button
                type="button"
                className={`drawer-item drawer-folder-select ${selectedFolderId === f.id ? 'drawer-item-active' : ''}`}
                onClick={() => {
                  onSelectFolder(f.id);
                  onClose();
                }}
              >
                {f.name}
              </button>
              <button
                type="button"
                className="drawer-folder-delete"
                aria-label={`フォルダ「${f.name}」を削除`}
                onClick={() => onRequestDeleteFolder(f)}
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>

        {creating ? (
          <div className="drawer-new-folder">
            <input
              type="text"
              className="drawer-new-folder-input"
              placeholder="フォルダ名"
              value={newName}
              maxLength={80}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate();
              }}
            />
            <button type="button" className="drawer-new-folder-save" onClick={() => void handleCreate()}>
              作成
            </button>
            <button
              type="button"
              className="drawer-new-folder-cancel"
              onClick={() => {
                setCreating(false);
                setNewName('');
              }}
            >
              取消
            </button>
          </div>
        ) : (
          <button type="button" className="drawer-add-btn" onClick={() => setCreating(true)}>
            + 新規フォルダ作成
          </button>
        )}

        {createError && <p className="drawer-error" role="alert">{createError}</p>}

        <button
          type="button"
          className="drawer-privacy-btn"
          onClick={() => {
            onPrivacyClick();
            onClose();
          }}
        >
          <strong>{nativeApp ? '💾 容量と動画の管理' : '🛡️ Web版のデータ管理'}</strong>
          <span>{nativeApp
            ? '動画の二重保存と空き容量について'
            : '記録の保存先と削除・保護について'}</span>
        </button>
      </nav>
    </>
  );
}
