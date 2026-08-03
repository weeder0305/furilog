import { describe, it, expect } from 'vitest';
import { buildFolderNameMap, filterVideos, sortVideos } from './search';
import type { VideoEntry, Folder } from '../models';

function makeVideo(overrides: Partial<VideoEntry>): VideoEntry {
  return {
    id: 'v1',
    title: '',
    memo: '',
    tags: [],
    folderId: null,
    createdAt: 0,
    updatedAt: 0,
    durationSec: 10,
    ...overrides,
  };
}

describe('filterVideos', () => {
  const folders: Folder[] = [
    { id: 'f1', name: 'コンボ練習', createdAt: 0 },
    { id: 'f2', name: 'ロック基礎', createdAt: 0 },
  ];
  const folderNameMap = buildFolderNameMap(folders);

  const videos: VideoEntry[] = [
    makeVideo({ id: 'a', title: 'ポイント練習', memo: '肘の角度に注意', tags: ['基礎'], folderId: 'f2' }),
    makeVideo({ id: 'b', title: 'スクーバー', memo: '', tags: ['ソウル', 'グルーヴ'], folderId: 'f1' }),
    makeVideo({ id: 'c', title: '無題 2026-07-01', memo: 'メモなし', tags: [], folderId: null }),
  ];

  it('空クエリなら全件をそのまま返す', () => {
    expect(filterVideos(videos, folderNameMap, '')).toEqual(videos);
    expect(filterVideos(videos, folderNameMap, '   ')).toEqual(videos);
  });

  it('タイトルの部分一致で絞り込む', () => {
    const result = filterVideos(videos, folderNameMap, 'ポイント');
    expect(result.map((v) => v.id)).toEqual(['a']);
  });

  it('大文字小文字を無視して一致する', () => {
    const withEnglish = [
      makeVideo({ id: 'x', title: 'Scoobot Drill', memo: '', tags: [], folderId: null }),
    ];
    expect(filterVideos(withEnglish, folderNameMap, 'scoobot').map((v) => v.id)).toEqual(['x']);
    expect(filterVideos(withEnglish, folderNameMap, 'SCOOBOT').map((v) => v.id)).toEqual(['x']);
  });

  it('メモの部分一致で絞り込む', () => {
    const result = filterVideos(videos, folderNameMap, '肘の角度');
    expect(result.map((v) => v.id)).toEqual(['a']);
  });

  it('タグの部分一致で絞り込む', () => {
    const result = filterVideos(videos, folderNameMap, 'グルーヴ');
    expect(result.map((v) => v.id)).toEqual(['b']);
  });

  it('フォルダ名の部分一致で絞り込む', () => {
    const result = filterVideos(videos, folderNameMap, 'ロック基礎');
    expect(result.map((v) => v.id)).toEqual(['a']);
  });

  it('フォルダ未所属の動画はフォルダ名検索にヒットしない', () => {
    const result = filterVideos(videos, folderNameMap, 'ロック基礎');
    expect(result.map((v) => v.id)).not.toContain('c');
  });

  it('どれにも一致しなければ空配列', () => {
    expect(filterVideos(videos, folderNameMap, '該当なしワード')).toEqual([]);
  });
});

describe('sortVideos', () => {
  const videos = [
    makeVideo({ id: 'old', title: 'い', recordedDate: '2026-01-10', createdAt: 300 }),
    makeVideo({ id: 'new', title: 'あ', recordedDate: '2026-07-20', createdAt: 100 }),
    makeVideo({ id: 'none', title: 'う', createdAt: 500 }),
  ];

  it('撮影日の新しい順で未設定を末尾にする', () => {
    expect(sortVideos(videos, 'recorded-desc').map((v) => v.id)).toEqual(['new', 'old', 'none']);
  });

  it('撮影日の古い順でも未設定を末尾にする', () => {
    expect(sortVideos(videos, 'recorded-asc').map((v) => v.id)).toEqual(['old', 'new', 'none']);
  });

  it('追加日とタイトルでも並べ替えられる', () => {
    expect(sortVideos(videos, 'created-desc').map((v) => v.id)).toEqual(['none', 'old', 'new']);
    expect(sortVideos(videos, 'title-asc').map((v) => v.id)).toEqual(['new', 'old', 'none']);
  });

  it('同じ撮影日では任意の撮影時刻も並び順へ反映する', () => {
    const sameDay = [
      makeVideo({ id: 'morning', recordedDate: '2026-08-02', recordedTime: '09:15' }),
      makeVideo({ id: 'evening', recordedDate: '2026-08-02', recordedTime: '18:30' }),
    ];
    expect(sortVideos(sameDay, 'recorded-desc').map((v) => v.id)).toEqual(['evening', 'morning']);
    expect(sortVideos(sameDay, 'recorded-asc').map((v) => v.id)).toEqual(['morning', 'evening']);
  });
});
