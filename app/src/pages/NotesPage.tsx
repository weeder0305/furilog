import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '../router';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useStore } from '../store/useStore';
import { formatDateTime } from '../lib/format';
import {
  filterNotes,
  getNoteTitleSuggestions,
  groupNotesByTitle,
  type NoteSortMode,
} from '../lib/notes';
import type { GeneralNote } from '../models';
import './NotesPage.css';

export function NotesPage() {
  const store = useStore();
  const navigate = useNavigate();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [notes, setNotes] = useState<GeneralNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<NoteSortMode>('newest');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingBody, setEditingBody] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<GeneralNote | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    store.listNotes()
      .then((items) => {
        if (!cancelled) setNotes(items);
      })
      .catch(() => {
        if (!cancelled) setErrorMessage('メモを読み込めませんでした。端末の保存設定と空き容量を確認してください。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const titleSuggestions = useMemo(() => getNoteTitleSuggestions(notes), [notes]);
  const groups = useMemo(
    () => groupNotesByTitle(filterNotes(notes, searchQuery), sortMode),
    [notes, searchQuery, sortMode]
  );
  const searching = searchQuery.trim() !== '';

  async function handleCreateNote() {
    const normalizedTitle = title.trim();
    const normalizedBody = body.trim();
    if (normalizedTitle === '' || normalizedBody === '' || saving) return;
    setSaving(true);
    setErrorMessage(null);
    const now = Date.now();
    const note: GeneralNote = {
      id: crypto.randomUUID(),
      title: normalizedTitle,
      body: normalizedBody,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await store.saveNote(note);
      setNotes((current) => [...current, note]);
      setTitle(normalizedTitle);
      setBody('');
      bodyRef.current?.focus();
    } catch {
      setErrorMessage('メモを保存できませんでした。端末の空き容量を確認してください。');
    } finally {
      setSaving(false);
    }
  }

  function handleStartEdit(note: GeneralNote) {
    setEditingId(note.id);
    setEditingTitle(note.title);
    setEditingBody(note.body);
  }

  async function handleSaveEdit(note: GeneralNote) {
    const normalizedTitle = editingTitle.trim();
    const normalizedBody = editingBody.trim();
    if (normalizedTitle === '' || normalizedBody === '') return;
    const updated: GeneralNote = {
      ...note,
      title: normalizedTitle,
      body: normalizedBody,
      updatedAt: Date.now(),
    };
    try {
      await store.saveNote(updated);
      setNotes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditingId(null);
    } catch {
      setErrorMessage('編集内容を保存できませんでした。端末の空き容量を確認してください。');
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await store.deleteNote(deleteTarget.id);
      setNotes((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setErrorMessage('メモを削除できませんでした。もう一度お試しください。');
    }
  }

  return (
    <div className="notes-page">
      <header className="notes-header">
        <button type="button" className="notes-back-btn" aria-label="前の画面へ戻る" onClick={() => navigate(-1)}>
          ←
        </button>
        <h1>メモ帳</h1>
      </header>

      <main className="notes-main">
        {errorMessage && <p className="notes-empty" role="alert">{errorMessage}</p>}
        <section className="notes-quick-card" aria-labelledby="quick-note-heading">
          <h2 id="quick-note-heading">クイックメモ</h2>
          <input
            className="notes-input"
            type="text"
            list="note-title-suggestions"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="タイトル（例：身体の使い方）"
            aria-label="メモのタイトル"
          />
          <datalist id="note-title-suggestions">
            {titleSuggestions.map((item) => <option key={item} value={item} />)}
          </datalist>
          <textarea
            ref={bodyRef}
            className="notes-textarea"
            value={body}
            maxLength={10000}
            onChange={(e) => setBody(e.target.value)}
            placeholder="思いついたことをすぐ記録…"
            aria-label="メモの本文"
            rows={3}
          />
          <div className="notes-quick-actions">
            <span>記入日時は自動で保存されます</span>
            <button
              type="button"
              className="notes-primary-btn"
              onClick={handleCreateNote}
              disabled={saving || title.trim() === '' || body.trim() === ''}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </section>

        <div className="notes-list-tools">
          <label className="notes-search-wrap">
            <span>メモを検索</span>
            <input
              className="notes-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="タイトル・本文から検索"
            />
          </label>
          <label className="notes-sort-wrap">
            <span>並び順</span>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as NoteSortMode)}>
              <option value="newest">新しい順</option>
              <option value="oldest">古い順</option>
              <option value="title">タイトル順</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p className="notes-empty">読み込み中…</p>
        ) : groups.length === 0 ? (
          <p className="notes-empty">{searchQuery.trim() ? '一致するメモがありません' : 'メモはまだありません'}</p>
        ) : (
          <div className="notes-groups">
            {groups.map((group) => (
              <details className="notes-group" key={`${searching ? 'search' : 'list'}-${group.title}`} open={searching}>
                <summary>
                  <span>{group.title}</span>
                  <span className="notes-group-count">{group.notes.length}件</span>
                </summary>
                <div className="notes-group-items">
                  {group.notes.map((note) => (
                    <article className="notes-item" key={note.id}>
                      {editingId === note.id ? (
                        <>
                          <input
                            className="notes-input"
                            value={editingTitle}
                            maxLength={120}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            aria-label="編集中のタイトル"
                          />
                          <textarea
                            className="notes-textarea"
                            value={editingBody}
                            maxLength={10000}
                            onChange={(e) => setEditingBody(e.target.value)}
                            aria-label="編集中の本文"
                            rows={4}
                          />
                          <div className="notes-item-actions">
                            <button type="button" onClick={() => setEditingId(null)}>取消</button>
                            <button type="button" className="notes-primary-btn" onClick={() => handleSaveEdit(note)}>保存</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="notes-item-body">{note.body}</p>
                          <div className="notes-item-footer">
                            <time dateTime={new Date(note.createdAt).toISOString()}>{formatDateTime(note.createdAt)}</time>
                            <div className="notes-item-actions">
                              <button type="button" onClick={() => handleStartEdit(note)}>編集</button>
                              <button type="button" className="notes-delete-btn" onClick={() => setDeleteTarget(note)}>削除</button>
                            </div>
                          </div>
                        </>
                      )}
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="メモを削除しますか？"
        message="このメモは元に戻せません。"
        confirmLabel="削除する"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
