import type { GeneralNote } from '../models';

export interface NoteGroup {
  title: string;
  notes: GeneralNote[];
  latestAt: number;
  oldestAt: number;
}

export type NoteSortMode = 'newest' | 'oldest' | 'title';

export function filterNotes(notes: GeneralNote[], query: string): GeneralNote[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return notes;
  return notes.filter((note) => `${note.title} ${note.body}`.toLowerCase().includes(needle));
}

export function groupNotesByTitle(
  notes: GeneralNote[],
  mode: NoteSortMode = 'newest'
): NoteGroup[] {
  const groups = new Map<string, GeneralNote[]>();
  for (const note of notes) {
    const current = groups.get(note.title) ?? [];
    current.push(note);
    groups.set(note.title, current);
  }

  return [...groups.entries()]
    .map(([title, entries]) => {
      const sorted = [...entries].sort((a, b) =>
        mode === 'oldest' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt
      );
      const latestAt = Math.max(...entries.map((note) => note.createdAt));
      const oldestAt = Math.min(...entries.map((note) => note.createdAt));
      return { title, notes: sorted, latestAt, oldestAt };
    })
    .sort((a, b) => {
      if (mode === 'title') return a.title.localeCompare(b.title, 'ja');
      if (mode === 'oldest') return a.oldestAt - b.oldestAt || a.title.localeCompare(b.title, 'ja');
      return b.latestAt - a.latestAt || a.title.localeCompare(b.title, 'ja');
    });
}

export function getNoteTitleSuggestions(notes: GeneralNote[]): string[] {
  return groupNotesByTitle(notes).map((group) => group.title);
}
