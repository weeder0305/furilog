import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '../router';
import { detectBrowserName, isNativeAndroidApp } from '../lib/platform';
import './PrivacyPage.css';

interface OfflineStatus {
  externalNetworkBlocked?: boolean;
  cachedResourceCount?: number;
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return '確認できません';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function requestOfflineStatus(): Promise<OfflineStatus | null> {
  const registration = await navigator.serviceWorker?.ready;
  const worker = registration?.active;
  if (!worker) return null;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeoutId = window.setTimeout(() => resolve(null), 1500);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeoutId);
      resolve(event.data as OfflineStatus);
    };
    worker.postMessage({ type: 'FURILOG_OFFLINE_STATUS' }, [channel.port2]);
  });
}

export function PrivacyPage() {
  const navigate = useNavigate();
  const nativeApp = isNativeAndroidApp();
  const [browserName, setBrowserName] = useState('現在使用中のブラウザ');
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<number>();
  const [quota, setQuota] = useState<number>();
  const [requestMessage, setRequestMessage] = useState('');

  const refreshStorageStatus = useCallback(async () => {
    const storage = navigator.storage;
    if (!storage) return;
    if (!nativeApp && storage.persisted) setPersisted(await storage.persisted());
    if (storage.estimate) {
      const estimate = await storage.estimate();
      setUsage(estimate.usage);
      setQuota(estimate.quota);
    }
  }, [nativeApp]);

  useEffect(() => {
    if (!nativeApp) {
      detectBrowserName().then(setBrowserName).catch(() => undefined);
      requestOfflineStatus().then(setOfflineStatus).catch(() => setOfflineStatus(null));
    }
    refreshStorageStatus().catch(() => undefined);
  }, [nativeApp, refreshStorageStatus]);

  async function handlePersistRequest() {
    if (!navigator.storage?.persist) {
      setRequestMessage('このブラウザは自動削除を避ける申請に対応していません。元動画は写真アプリなどにも残してください。');
      return;
    }
    try {
      const granted = await navigator.storage.persist();
      setPersisted(granted);
      setRequestMessage(granted
        ? `${browserName}が、ふりろぐのサイトデータを自動削除の対象にしにくい状態へ変更しました。手動のサイトデータ削除や端末故障から守る機能ではありません。`
        : `${browserName}が今回は許可しませんでした。故障ではなく、ブラウザが利用状況などから自動判定した結果です。記録を別の場所へ移す機能ではないため、元動画は写真アプリなどにも残してください。`);
      await refreshStorageStatus();
    } catch {
      setRequestMessage('状態を確認できませんでした。通常の保存は引き続き使えますが、元動画は別の場所にも残してください。');
    }
  }

  return (
    <div className="privacy-page">
      <header className="privacy-header">
        <button type="button" aria-label="前の画面へ戻る" onClick={() => navigate(-1)}>←</button>
        <h1>{nativeApp ? '容量と動画の管理' : 'Web版のデータ管理'}</h1>
      </header>

      <main className="privacy-main">
        {nativeApp ? (
          <>
            <section className="privacy-status-card">
              <span className="privacy-status-icon">i</span>
              <div>
                <h2>アルバムにも残すと、動画2本分の容量を使います</h2>
                <p>アルバムから選んだ動画と、撮影時に「アルバム ON」にした動画は、ふりろぐ用のコピーとアルバム側の動画が別々に残ります。「アルバム OFF」で撮影すると、ふりろぐ内だけに保存します。</p>
              </div>
            </section>

            <section className="privacy-card">
              <h2>アルバムとふりろぐの動画は別々です</h2>
              <ul>
                <li>アルバムから削除しても、ふりろぐ内の動画は残ります。</li>
                <li>ふりろぐから削除しても、アルバムに別途保存した動画は残ります。</li>
                <li>「アルバム OFF」で撮影した動画は、ふりろぐから削除すると端末内からなくなります。</li>
              </ul>
            </section>
          </>
        ) : (
          <>
            <section className="privacy-status-card">
              <span className="privacy-status-icon">✓</span>
              <div>
                <h2>記録の保存先</h2>
                <p>今この画面を開いている<strong>{browserName}</strong>のサイトデータです。同じ端末でも、別のブラウザ、別の利用者プロファイル、ホーム画面へ追加したアプリでは保存領域が分かれる場合があります。</p>
              </div>
            </section>

            <section className="privacy-card">
              <h2>記録が削除される操作</h2>
              <ul>
                <li>ふりろぐ内で動画を削除すると、その動画と付箋が削除されます。</li>
                <li>{browserName}の設定で、このサイトの「サイトデータ」を削除すると、この環境に保存したすべての記録が削除されます。</li>
                <li>{browserName}のアンインストールや端末の初期化でも、記録を失う可能性があります。</li>
              </ul>
            </section>

            <section className="privacy-card">
              <h2>オフライン利用</h2>
              <p>{offlineStatus?.externalNetworkBlocked
                ? `アプリ画面など${offlineStatus.cachedResourceCount ?? 0}件の準備が完了し、通信なしでも起動できます。`
                : 'アプリ画面の保存状態を確認しています。動画・付箋・メモとは別の設定です。'}</p>
            </section>
          </>
        )}

        <section className="privacy-card">
          <h2>{nativeApp ? 'ふりろぐの使用容量' : `${browserName}内の使用容量`}</h2>
          <dl className="privacy-storage-grid">
            <div><dt>使用量</dt><dd>{formatBytes(usage)}</dd></div>
            <div><dt>推定空き容量</dt><dd>{formatBytes(quota === undefined ? undefined : Math.max(0, quota - (usage ?? 0)))}</dd></div>
            {!nativeApp && <div><dt>自動削除対策</dt><dd>{persisted === true ? '許可済み' : persisted === false ? '未許可' : '確認できません'}</dd></div>}
          </dl>
          {!nativeApp && (
            <>
              <p>この申請は、ブラウザによる自動整理の対象になりにくくするものです。別の場所への保存やバックアップではなく、許可するかは{browserName}が自動判定します。</p>
              <button type="button" className="privacy-primary-btn" onClick={handlePersistRequest}>自動削除されにくくできるか確認</button>
              {requestMessage && <p className="privacy-message" role="status">{requestMessage}</p>}
            </>
          )}
        </section>

        <button type="button" className="privacy-guide-btn" onClick={() => navigate('/data-guide')}>
          {nativeApp ? '動画と容量について詳しく読む' : 'Web版のデータ管理ガイドを読む'}
          <span>{nativeApp
            ? 'アルバム保存のON/OFF、容量を空ける方法、バックアップの注意点'
            : '保存される環境、記録が削除される操作、自動削除対策の限界'}</span>
        </button>
      </main>
    </div>
  );
}
