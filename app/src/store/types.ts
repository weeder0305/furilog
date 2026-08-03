// 保存層の抽象化インターフェース（設計書 4章）
// UIコンポーネントはこのインターフェース経由でのみデータへアクセスする。
// 実装は IdbStore（第1段階）。将来 ApiStore を追加してもUI側は無変更。

import type { VideoEntry, Folder, Sticky, GeneralNote } from '../models';

export interface WazaLogStore {
  listVideos(): Promise<VideoEntry[]>;
  getVideo(id: string): Promise<VideoEntry | undefined>;
  saveVideo(entry: VideoEntry, blob?: Blob, thumbnail?: Blob): Promise<void>;
  updateVideoMeta(entry: VideoEntry): Promise<void>;
  deleteVideo(id: string): Promise<void>; // blob・サムネ・付箋も連鎖削除
  deleteVideos(ids: string[]): Promise<void>; // 複数動画と関連データを一括削除
  getVideoBlob(id: string): Promise<Blob | undefined>;
  getThumbnail(id: string): Promise<Blob | undefined>;
  listFolders(): Promise<Folder[]>;
  saveFolder(f: Folder): Promise<void>;
  deleteFolder(id: string): Promise<void>; // 所属動画は folderId=null に戻す
  listStickies(videoId: string): Promise<Sticky[]>;
  saveSticky(s: Sticky): Promise<void>;
  deleteSticky(id: string): Promise<void>;
  listNotes(): Promise<GeneralNote[]>;
  saveNote(note: GeneralNote): Promise<void>;
  deleteNote(id: string): Promise<void>;
}
