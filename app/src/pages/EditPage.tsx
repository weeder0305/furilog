// メタ情報入力・編集画面（設計書 5.2）
// 新規: /edit/new （navigate時の location.state.file を使用）
// 編集: /edit/:id

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from '../router';
import { useStore } from '../store/useStore';
import { extractVideoMetaAndThumbnail } from '../lib/thumbnail';
import { defaultTitle, formatClockTime, formatDate } from '../lib/format';
import { deleteTemporaryVideo } from '../lib/nativeCamera';
import type { Folder, VideoEntry } from '../models';
import './EditPage.css';

const NEW_FOLDER_VALUE = '__new__';
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    )
  );
}

export function EditPage() {
  const store = useStore();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const location = useLocation();

  const isNew = params.id === undefined || params.id === 'new';
  const navigationState = location.state as { file?: File; temporaryPath?: string; recordedAt?: number; savedToAlbum?: boolean } | null;
  const stateFile = navigationState?.file;
  const temporaryPath = navigationState?.temporaryPath;
  const nativeRecordedAt = navigationState?.recordedAt;
  const savedToAlbum = navigationState?.savedToAlbum;

  const [folders, setFolders] = useState<Folder[]>([]);
  const [original, setOriginal] = useState<VideoEntry | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [loadFailed, setLoadFailed] = useState(false);

  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [recordedDate, setRecordedDate] = useState(() => (
    isNew ? formatDate(nativeRecordedAt ?? Date.now()) : ''
  ));
  const [recordedTime, setRecordedTime] = useState(() => (
    isNew && nativeRecordedAt ? formatClockTime(nativeRecordedAt) : ''
  ));

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    store.listFolders()
      .then((fs) => {
        if (!cancelled) setFolders(fs);
      })
      .catch(() => {
        if (!cancelled) setErrorMessage('フォルダを読み込めませんでした。端末の保存設定を確認してください。');
      });
    return () => {
      cancelled = true;
    };
  }, [store]);

  useEffect(() => {
    if (isNew) return;
    if (!params.id) return;
    let cancelled = false;
    store.getVideo(params.id)
      .then((v) => {
        if (cancelled) return;
        if (!v) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setOriginal(v);
        setTitle(v.title);
        setMemo(v.memo);
        setTagsInput(v.tags.join(', '));
        setFolderId(v.folderId);
        setRecordedDate(v.recordedDate ?? '');
        setRecordedTime(v.recordedTime ?? '');
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('動画情報を読み込めませんでした。端末の保存設定を確認してください。');
          setLoadFailed(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [store, isNew, params.id]);

  const missingFile = isNew && !stateFile;

  const pageTitle = isNew ? '動画を追加' : '動画を編集';

  const titlePlaceholder = useMemo(() => defaultTitle(), []);

  function handleFolderSelectChange(value: string) {
    if (value === NEW_FOLDER_VALUE) {
      setCreatingFolder(true);
      return;
    }
    setFolderId(value === '' ? null : value);
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (name === '') return;
    const folder: Folder = { id: crypto.randomUUID(), name, createdAt: Date.now() };
    setErrorMessage(null);
    try {
      await store.saveFolder(folder);
      setFolders((prev) => [...prev, folder]);
      setFolderId(folder.id);
      setNewFolderName('');
      setCreatingFolder(false);
    } catch {
      setErrorMessage('フォルダを作成できませんでした。空き容量を確認してください。');
    }
  }

  async function handleSave() {
    setErrorMessage(null);
    if (isNew) {
      if (!stateFile) return;
      setSaving(true);
      try {
        if (stateFile.size === 0) throw new Error('空の動画ファイルは追加できません。');
        if (stateFile.size > MAX_VIDEO_BYTES) throw new Error('2GBを超える動画は追加できません。');
        if (stateFile.type && !stateFile.type.startsWith('video/')) {
          throw new Error('動画ファイルを選択してください。');
        }
        const estimate = await navigator.storage?.estimate?.();
        const available = estimate?.quota !== undefined
          ? estimate.quota - (estimate.usage ?? 0)
          : undefined;
        if (available !== undefined && available > 0 && stateFile.size * 1.1 > available) {
          throw new Error('端末内の保存容量が不足しています。空き容量を増やしてから再度お試しください。');
        }
        const { durationSec, thumbnailBlob } = await extractVideoMetaAndThumbnail(stateFile);
        const now = Date.now();
        const entry: VideoEntry = {
          id: crypto.randomUUID(),
          title: title.trim() || defaultTitle(nativeRecordedAt ?? now),
          memo,
          tags: parseTags(tagsInput),
          folderId,
          createdAt: now,
          updatedAt: now,
          durationSec,
          recordedDate: recordedDate || undefined,
          recordedTime: recordedDate && recordedTime ? recordedTime : undefined,
        };
        await store.saveVideo(entry, stateFile, thumbnailBlob);
        if (temporaryPath) await deleteTemporaryVideo(temporaryPath).catch(() => {});
        navigate(`/watch/${entry.id}`, { replace: true });
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : '動画の読み込みに失敗しました'
        );
        setSaving(false);
      }
    } else {
      if (!original) return;
      setSaving(true);
      try {
        const updated: VideoEntry = {
          ...original,
          title: title.trim() || defaultTitle(original.createdAt),
          memo,
          tags: parseTags(tagsInput),
          folderId,
          recordedDate: recordedDate || undefined,
          recordedTime: recordedDate && recordedTime ? recordedTime : undefined,
          updatedAt: Date.now(),
        };
        await store.updateVideoMeta(updated);
        navigate(`/watch/${updated.id}`);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : '保存に失敗しました'
        );
        setSaving(false);
      }
    }
  }

  async function handleCancel() {
    if (temporaryPath) await deleteTemporaryVideo(temporaryPath).catch(() => {});
    navigate(-1);
  }

  if (missingFile) {
    return (
      <div className="edit-page">
        <p className="edit-error">動画ファイルが指定されていません。トップページからやり直してください。</p>
        <button type="button" className="edit-btn edit-btn-primary" onClick={() => navigate('/')}>
          トップへ戻る
        </button>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="edit-page">
        <p className="edit-error">動画が見つかりませんでした。</p>
        <button type="button" className="edit-btn edit-btn-primary" onClick={() => navigate('/')}>
          トップへ戻る
        </button>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="edit-page">
        <p className="edit-error" role="alert">{errorMessage}</p>
        <button type="button" className="edit-btn edit-btn-primary" onClick={() => navigate('/')}>
          トップへ戻る
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="edit-page">
        <p className="edit-loading">読み込み中…</p>
      </div>
    );
  }

  return (
    <div className="edit-page">
      <h1 className="edit-heading">{pageTitle}</h1>

      {isNew && stateFile && <p className="edit-file-name">選択したファイル: {stateFile.name}</p>}
      {isNew && temporaryPath && (
        <p className="edit-file-name">
          {savedToAlbum
            ? '撮影動画は端末のアルバムにも保存されています。この画面でキャンセルしてもアルバムの動画は残ります。'
            : '撮影動画はアプリ内だけに保存します。この画面でキャンセルすると撮影動画は残りません。'}
        </p>
      )}

      <label className="edit-label">
        タイトル（任意）
        <input
          type="text"
          className="edit-input"
          value={title}
          maxLength={120}
          placeholder={titlePlaceholder}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="edit-label">
        撮影日（任意）
        <input
          type="date"
          className="edit-input"
          value={recordedDate}
          onChange={(e) => setRecordedDate(e.target.value)}
        />
      </label>

      <label className="edit-label">
        撮影時刻（任意）
        <input
          type="time"
          className="edit-input"
          value={recordedTime}
          disabled={!recordedDate}
          onChange={(e) => setRecordedTime(e.target.value)}
        />
        <span className="edit-help">
          アプリ内で撮影した動画は自動入力します。ファイルから選んだ動画は、分かる場合だけ入力してください。
        </span>
      </label>

      <label className="edit-label">
        メモ（任意）
        <textarea
          className="edit-textarea"
          value={memo}
          maxLength={5000}
          rows={4}
          onChange={(e) => setMemo(e.target.value)}
        />
      </label>

      <label className="edit-label">
        タグ（任意・カンマ区切り）
        <input
          type="text"
          className="edit-input"
          value={tagsInput}
          maxLength={500}
          placeholder="例: 基礎, ソウル, グルーヴ"
          onChange={(e) => setTagsInput(e.target.value)}
        />
      </label>

      <label className="edit-label">
        フォルダ（任意）
        <select
          className="edit-input"
          value={folderId ?? ''}
          onChange={(e) => handleFolderSelectChange(e.target.value)}
        >
          <option value="">未分類</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
          <option value={NEW_FOLDER_VALUE}>+ 新規フォルダ作成</option>
        </select>
      </label>

      {creatingFolder && (
        <div className="edit-new-folder">
          <input
            type="text"
            className="edit-input"
            placeholder="新しいフォルダ名"
            value={newFolderName}
            maxLength={80}
            onChange={(e) => setNewFolderName(e.target.value)}
            autoFocus
          />
          <div className="edit-new-folder-actions">
            <button type="button" className="edit-btn edit-btn-primary" onClick={handleCreateFolder}>
              作成
            </button>
            <button
              type="button"
              className="edit-btn"
              onClick={() => {
                setCreatingFolder(false);
                setNewFolderName('');
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {errorMessage && <p className="edit-error" role="alert">{errorMessage}</p>}

      <div className="edit-actions">
        <button type="button" className="edit-btn" onClick={handleCancel} disabled={saving}>
          キャンセル
        </button>
        <button
          type="button"
          className="edit-btn edit-btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <span className="edit-spinner" aria-label="保存中" /> : '保存'}
        </button>
      </div>
    </div>
  );
}
