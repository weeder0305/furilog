import { useEffect, useState } from 'react';
import { useNavigate } from '../router';
import { detectBrowserName, isNativeAndroidApp } from '../lib/platform';
import './DataGuidePage.css';

export function DataGuidePage() {
  const navigate = useNavigate();
  const nativeApp = isNativeAndroidApp();
  const [browserName, setBrowserName] = useState('現在使用中のブラウザ');

  useEffect(() => {
    if (!nativeApp) detectBrowserName().then(setBrowserName).catch(() => undefined);
  }, [nativeApp]);

  return (
    <div className="data-guide-page">
      <header className="data-guide-header">
        <button type="button" aria-label="前の画面へ戻る" onClick={() => navigate(-1)}>←</button>
        <h1>{nativeApp ? '動画と容量のガイド' : 'Web版のデータ管理ガイド'}</h1>
      </header>
      <main className="data-guide-main">
        {nativeApp ? (
          <>
            <section className="data-guide-lead">
              <h2>撮影時にアルバム保存を選べます</h2>
              <p>「アルバム ON」ではアルバムとふりろぐへ別々に保存するため、おおむね動画2本分の容量を使います。「アルバム OFF」ではふりろぐ内だけに保存します。アルバムから選んだ動画は、元動画とは別にふりろぐ用のコピーを保存します。</p>
            </section>

            <section>
              <h2>端末内部音声について</h2>
              <p>Spotifyや動画配信サービスなど、録音が許可されていないアプリの音声は録音できません。「端末内部音声」または「マイク音声＋端末内部音声」で録音できるのは、アプリ側が録音を許可している音声だけです。</p>
            </section>

            <section>
              <h2>アルバムとふりろぐは連動しません</h2>
              <ul>
                <li>アルバムの元動画を削除しても、ふりろぐ内の動画は残ります。</li>
                <li>ふりろぐ内の動画を削除しても、アルバムに別途保存した動画は残ります。</li>
                <li>「アルバム OFF」で撮影した動画は、ふりろぐから削除すると端末内からなくなります。</li>
              </ul>
            </section>

            <section>
              <h2>空き容量を増やしたいとき</h2>
              <ul>
                <li>アルバムの動画を残す場合：ふりろぐで不要な動画を削除します。</li>
                <li>ふりろぐだけで使う場合：撮影時に「アルバム OFF」を選べます。ただし、ふりろぐの削除や故障に備えた予備の動画は残りません。</li>
                <li>両方へ保存した動画が完全に不要な場合：アルバムとふりろぐの両方から削除します。</li>
              </ul>
            </section>

            <section>
              <h2>バックアップについて</h2>
              <p>現在、動画・付箋・メモをまとめて復元する完全バックアップ機能はありません。残しておきたい元動画は、アルバムや別の安全な保管先にも置いてください。</p>
            </section>
          </>
        ) : (
          <>
            <section className="data-guide-lead">
              <h2>記録は現在の利用環境に保存されます</h2>
              <p>動画・付箋・メモは、今開いている<strong>{browserName}</strong>が管理する、このサイト（{typeof window !== 'undefined' ? window.location.hostname : '現在のサイト'}）のサイトデータに保存されます。</p>
            </section>

            <section>
              <h2>記録を開くとき</h2>
              <p>同じ端末でも、ブラウザ、利用者プロファイル、プライベート閲覧、ホーム画面へ追加したアプリが異なると、別の保存領域になる場合があります。記録を追加したときと同じブラウザ・プロファイル・起動方法で開いてください。</p>
            </section>

            <section>
              <h2>記録が削除される操作</h2>
              <ul>
                <li>ブラウザ設定でこのサイトの「サイトデータ」を削除すると、この利用環境の記録も削除されます。</li>
                <li>閲覧履歴だけの削除では通常残りますが、「Cookieとサイトデータ」「サイトのストレージ」などを削除対象に含めると失われます。</li>
                <li>ブラウザのアンインストール、端末の初期化、OSによるストレージ整理でも失われる可能性があります。</li>
              </ul>
            </section>

            <section>
              <h2>自動削除対策の限界</h2>
              <p>「自動削除されにくくできるか確認」は、ブラウザへ保存領域の維持を申請する機能です。許可はブラウザが自動判定します。バックアップではなく、手動のサイトデータ削除や端末故障から記録を守るものではありません。</p>
            </section>

            <section>
              <h2>大切な動画について</h2>
              <p>現在、動画・付箋・メモをまとめて復元する完全バックアップ機能はありません。大切な元動画は、写真アプリや別の安全な保管先にも残してください。</p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
