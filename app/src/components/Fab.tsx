// 右下FAB（＋ボタン）：動画追加（設計書 5.1）

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { canUseNativeCamera, recordVideoWithNativeCamera } from '../lib/nativeCamera';
import './Fab.css';

interface FabProps {
  onFileSelected: (file: File, temporaryPath?: string, recordedAt?: number, savedToAlbum?: boolean) => void;
}

export function Fab({ onFileSelected }: FabProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const firstMenuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fabButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) return;
    const fabButton = fabButtonRef.current;
    firstMenuButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !cameraBusy) setMenuOpen(false);
      if (event.key === 'Tab') {
        const focusable = menuRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
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
      if (cameraBusy) return;
      event.preventDefault();
      setMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('furilog:nativeBack', handleNativeBack);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('furilog:nativeBack', handleNativeBack);
      fabButton?.focus();
    };
  }, [menuOpen, cameraBusy]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    e.target.value = '';
    setMenuOpen(false);
  }

  async function handleCameraClick() {
    if (!canUseNativeCamera()) {
      cameraInputRef.current?.click();
      return;
    }
    setCameraBusy(true);
    setCameraError(null);
    try {
      const result = await recordVideoWithNativeCamera();
      setMenuOpen(false);
      onFileSelected(result.file, result.temporaryPath, result.recordedAt, result.savedToAlbum);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'カメラを起動できませんでした。';
      if (!message.includes('cancel')) setCameraError(message);
    } finally {
      setCameraBusy(false);
    }
  }

  return (
    <div className="fab-container">
      {menuOpen && (
        <div className="fab-backdrop" onClick={() => setMenuOpen(false)}>
          <div ref={menuRef} className="fab-menu" id={menuId} role="dialog" aria-modal="true" aria-label="動画を追加" onClick={(e) => e.stopPropagation()}>
            <button
              ref={firstMenuButtonRef}
              type="button"
              className="fab-menu-item"
              onClick={() => fileInputRef.current?.click()}
            >
              ファイルから選ぶ
            </button>
            <button
              type="button"
              className="fab-menu-item"
              onClick={handleCameraClick}
              disabled={cameraBusy}
            >
              {cameraBusy ? 'カメラを起動中…' : '撮影する'}
            </button>
            {cameraError && <p className="fab-error" role="alert">{cameraError}</p>}
          </div>
        </div>
      )}
      <button
        ref={fabButtonRef}
        type="button"
        className="fab-btn"
        aria-label="動画を追加"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        onClick={() => setMenuOpen((v) => !v)}
      >
        ＋
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="fab-hidden-input"
        onChange={handleChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="fab-hidden-input"
        onChange={handleChange}
      />
    </div>
  );
}
