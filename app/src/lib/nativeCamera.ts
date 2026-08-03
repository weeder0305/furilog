import { Capacitor, registerPlugin } from '@capacitor/core';

interface RecordedVideoResult {
  path: string;
  name: string;
  mimeType: string;
  recordedAt?: number;
  savedToAlbum: boolean;
}

interface NativeCameraPlugin {
  recordVideo(): Promise<RecordedVideoResult>;
  deleteTemporaryVideo(options: { path: string }): Promise<void>;
}

const NativeCamera = registerPlugin<NativeCameraPlugin>('NativeCamera');

export function canUseNativeCamera(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function recordVideoWithNativeCamera(): Promise<{ file: File; temporaryPath: string; recordedAt?: number; savedToAlbum: boolean }> {
  const result = await NativeCamera.recordVideo();
  if (!result.path || !result.name || result.mimeType !== 'video/mp4') {
    throw new Error('撮影結果を安全に読み込めませんでした。');
  }
  const response = await fetch(Capacitor.convertFileSrc(result.path));
  if (!response.ok) throw new Error('撮影した動画を読み込めませんでした。');
  const blob = await response.blob();
  if (blob.size === 0 || !blob.type.startsWith('video/')) {
    throw new Error('撮影した動画ファイルが空か、形式が正しくありません。');
  }
  return {
    file: new File([blob], result.name, { type: result.mimeType, lastModified: result.recordedAt ?? Date.now() }),
    temporaryPath: result.path,
    recordedAt: typeof result.recordedAt === 'number' && Number.isFinite(result.recordedAt)
      ? result.recordedAt
      : undefined,
    savedToAlbum: result.savedToAlbum === true,
  };
}

export async function deleteTemporaryVideo(path: string): Promise<void> {
  if (!canUseNativeCamera() || !path) return;
  await NativeCamera.deleteTemporaryVideo({ path });
}
