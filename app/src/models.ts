// WazaLog データモデル（設計書 3章）

export interface VideoEntry {
  id: string; // crypto.randomUUID()
  title: string;
  memo: string;
  tags: string[]; // 自由入力タグ
  folderId: string | null;
  createdAt: number; // epoch ms
  updatedAt: number;
  durationSec: number; // 読み込み時に取得
  recordedDate?: string; // 撮影日 YYYY-MM-DD（既存データは未設定を許容）
  recordedTime?: string; // 撮影時刻 HH:mm（不明なファイル選択・既存データは未設定を許容）
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Sticky {
  id: string;
  videoId: string;
  timeSec: number; // 貼った時刻（秒、小数）
  endTimeSec?: number; // 区間付箋の終了時刻。瞬間付箋は未設定
  x: number; // 動画表示領域内の正規化座標 0〜1
  y: number; // 同上
  text: string;
  color?: StickyColor; // 既存データは yellow として扱う
  createdAt: number;
}

export type StickyColor = 'yellow' | 'red' | 'green' | 'blue';

export interface GeneralNote {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}
