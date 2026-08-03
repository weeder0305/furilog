// 検索フィルタ（純粋関数）。タイトル・メモ・タグ・フォルダ名を対象に
// 部分一致（大文字小文字無視）で絞り込む（設計書 5.1）。

import type { VideoEntry, Folder } from '../models';

export type VideoSortMode =
  | 'recorded-desc'
  | 'recorded-asc'
  | 'created-desc'
  | 'created-asc'
  | 'title-asc';

/**
 * folders から id -> name の対応表を作る。
 */
export function buildFolderNameMap(folders: Folder[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of folders) {
    map.set(f.id, f.name);
  }
  return map;
}

/**
 * query で videos を絞り込む。
 * query が空（または空白のみ）の場合は videos をそのまま返す。
 * 対象フィールド: title, memo, tags, フォルダ名（folderNameMap 経由）。
 */
export function filterVideos(
  videos: VideoEntry[],
  folderNameMap: Map<string, string>,
  query: string
): VideoEntry[] {
  const trimmed = query.trim();
  if (trimmed === '') return videos;
  const needle = trimmed.toLowerCase();

  return videos.filter((v) => {
    const folderName = v.folderId ? folderNameMap.get(v.folderId) ?? '' : '';
    const haystack = [v.title, v.memo, v.tags.join(' '), folderName]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

/** 絞り込み後の動画を指定順に並べる。撮影日未設定は昇順・降順とも末尾に置く。 */
export function sortVideos(videos: VideoEntry[], mode: VideoSortMode): VideoEntry[] {
  return [...videos].sort((a, b) => {
    if (mode === 'title-asc') {
      return a.title.localeCompare(b.title, 'ja');
    }
    if (mode === 'created-asc') return a.createdAt - b.createdAt;
    if (mode === 'created-desc') return b.createdAt - a.createdAt;

    const aDate = a.recordedDate ? `${a.recordedDate}T${a.recordedTime ?? '00:00'}` : null;
    const bDate = b.recordedDate ? `${b.recordedDate}T${b.recordedTime ?? '00:00'}` : null;
    if (aDate === null && bDate === null) return b.createdAt - a.createdAt;
    if (aDate === null) return 1;
    if (bDate === null) return -1;
    const byDate = aDate.localeCompare(bDate);
    if (byDate !== 0) return mode === 'recorded-asc' ? byDate : -byDate;
    return b.createdAt - a.createdAt;
  });
}
