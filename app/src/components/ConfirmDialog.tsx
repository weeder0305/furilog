// 自前の確認モーダル（window.confirm は使わない）

import { useEffect, useId, useRef } from 'react';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancelRef.current();
      if (event.key === 'Tab') {
        const first = cancelButtonRef.current;
        const last = confirmButtonRef.current;
        if (!first || !last) return;
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
      onCancelRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('furilog:nativeBack', handleNativeBack);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('furilog:nativeBack', handleNativeBack);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div
        className="confirm-box"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <h2 className="confirm-title" id={titleId}>{title}</h2>
        <p className="confirm-message" id={messageId}>{message}</p>
        <div className="confirm-actions">
          <button ref={cancelButtonRef} type="button" className="confirm-btn confirm-btn-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className={danger ? 'confirm-btn confirm-btn-danger' : 'confirm-btn confirm-btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
