import { describe, expect, it } from 'vitest';
import type { GeneralNote } from '../models';
import { filterNotes, getNoteTitleSuggestions, groupNotesByTitle } from './notes';

function note(id: string, title: string, body: string, createdAt: number): GeneralNote {
  return { id, title, body, createdAt, updatedAt: createdAt };
}

const notes = [
  note('a', '身体の使い方', '重心を低くする', 10),
  note('b', '音取り', '裏拍を意識する', 30),
  note('c', '身体の使い方', '肩の力を抜く', 20),
];

describe('汎用メモの検索とグループ化', () => {
  it('タイトルと本文を検索できる', () => {
    expect(filterNotes(notes, '身体').map((item) => item.id)).toEqual(['a', 'c']);
    expect(filterNotes(notes, '裏拍').map((item) => item.id)).toEqual(['b']);
  });

  it('同じタイトルをまとめ、最新グループ・最新メモ順にする', () => {
    const groups = groupNotesByTitle(notes);
    expect(groups.map((group) => group.title)).toEqual(['音取り', '身体の使い方']);
    expect(groups[1]?.notes.map((item) => item.id)).toEqual(['c', 'a']);
  });

  it('古い順では古いグループ・古いメモを先にする', () => {
    const groups = groupNotesByTitle(notes, 'oldest');
    expect(groups.map((group) => group.title)).toEqual(['身体の使い方', '音取り']);
    expect(groups[0]?.notes.map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('既存タイトルを最新順の候補として返す', () => {
    expect(getNoteTitleSuggestions(notes)).toEqual(['音取り', '身体の使い方']);
  });
});
