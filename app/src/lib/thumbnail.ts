// サムネ生成・動画長さ取得（設計書 5.2 / 実装上の注意）
// 動画Blobを一時的に video 要素へ読み込み、0.5秒地点（0.5秒未満の動画は先頭）へ
// シークして canvas に描画、JPEG Blob化する。DOM操作を伴うためテストはしていない
// （純粋ロジックのみ vitest 対象。ここは実機/ブラウザでの動作確認で検証する）。

export interface VideoMetaAndThumbnail {
  durationSec: number;
  thumbnailBlob: Blob;
}

function loadVideoElement(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    // 画面外に一時配置（一部ブラウザはDOM未接続だとフレーム描画が不安定なため）
    video.style.position = 'fixed';
    video.style.left = '-9999px';
    video.style.top = '0';
    video.style.width = '1px';
    video.style.height = '1px';
    document.body.appendChild(video);

    const onError = () => {
      cleanupListeners();
      reject(new Error('動画の読み込みに失敗しました'));
    };
    const onLoaded = () => {
      cleanupListeners();
      resolve(video);
    };
    const cleanupListeners = () => {
      video.removeEventListener('error', onError);
      video.removeEventListener('loadedmetadata', onLoaded);
    };
    video.addEventListener('error', onError);
    video.addEventListener('loadedmetadata', onLoaded);
    video.src = url;
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });
}

function removeVideoElement(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute('src');
  video.load();
  video.remove();
}

/**
 * 動画Blobから長さ(秒)とサムネイル(JPEG Blob, 幅 thumbnailWidth 程度)を取得する。
 */
export async function extractVideoMetaAndThumbnail(
  blob: Blob,
  thumbnailWidth = 320
): Promise<VideoMetaAndThumbnail> {
  const url = URL.createObjectURL(blob);
  let video: HTMLVideoElement | undefined;
  try {
    video = await loadVideoElement(url);

    let durationSec = video.duration;
    if (!Number.isFinite(durationSec)) {
      // MediaRecorder由来のwebm等、ヘッダに長さが無く Infinity になることがある。
      // 末尾付近へシークすると duration が確定するブラウザの挙動を利用する。
      await seekTo(video, Number.MAX_SAFE_INTEGER);
      durationSec = Number.isFinite(video.duration) ? video.duration : video.currentTime;
      await seekTo(video, 0);
    }

    const seekTarget = durationSec < 0.5 ? 0 : 0.5;
    await seekTo(video, seekTarget);

    const canvas = document.createElement('canvas');
    const srcWidth = video.videoWidth || thumbnailWidth;
    const srcHeight = video.videoHeight || thumbnailWidth;
    const scale = thumbnailWidth / srcWidth;
    canvas.width = thumbnailWidth;
    canvas.height = Math.max(1, Math.round(srcHeight * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context を取得できませんでした');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const thumbnailBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('サムネイル生成に失敗しました'));
        },
        'image/jpeg',
        0.8
      );
    });

    return { durationSec, thumbnailBlob };
  } finally {
    if (video) removeVideoElement(video);
    URL.revokeObjectURL(url);
  }
}
