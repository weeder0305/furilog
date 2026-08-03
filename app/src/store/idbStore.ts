// IndexedDB 実装（設計書 4章 / 7章）
// ストア: videos / videoBlobs / thumbnails / folders / stickies

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { VideoEntry, Folder, Sticky, GeneralNote } from '../models';
import type { WazaLogStore } from './types';

const DB_NAME = 'wazalog';
const DB_VERSION = 2;

interface WazaLogDB extends DBSchema {
  videos: {
    key: string;
    value: VideoEntry;
  };
  videoBlobs: {
    key: string;
    value: Blob;
  };
  thumbnails: {
    key: string;
    value: Blob;
  };
  folders: {
    key: string;
    value: Folder;
  };
  stickies: {
    key: string;
    value: Sticky;
    indexes: { videoId: string };
  };
  notes: {
    key: string;
    value: GeneralNote;
  };
}

let dbPromise: Promise<IDBPDatabase<WazaLogDB>> | undefined;

function getDb(): Promise<IDBPDatabase<WazaLogDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WazaLogDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('videos')) {
          db.createObjectStore('videos', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('videoBlobs')) {
          db.createObjectStore('videoBlobs');
        }
        if (!db.objectStoreNames.contains('thumbnails')) {
          db.createObjectStore('thumbnails');
        }
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('stickies')) {
          const stickyStore = db.createObjectStore('stickies', { keyPath: 'id' });
          stickyStore.createIndex('videoId', 'videoId');
        }
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export class IdbStore implements WazaLogStore {
  async listVideos(): Promise<VideoEntry[]> {
    const db = await getDb();
    return db.getAll('videos');
  }

  async getVideo(id: string): Promise<VideoEntry | undefined> {
    const db = await getDb();
    return db.get('videos', id);
  }

  async saveVideo(entry: VideoEntry, blob?: Blob, thumbnail?: Blob): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['videos', 'videoBlobs', 'thumbnails'], 'readwrite');
    await tx.objectStore('videos').put(entry);
    if (blob) {
      await tx.objectStore('videoBlobs').put(blob, entry.id);
    }
    if (thumbnail) {
      await tx.objectStore('thumbnails').put(thumbnail, entry.id);
    }
    await tx.done;
  }

  async updateVideoMeta(entry: VideoEntry): Promise<void> {
    const db = await getDb();
    await db.put('videos', entry);
  }

  async deleteVideo(id: string): Promise<void> {
    await this.deleteVideos([id]);
  }

  async deleteVideos(ids: string[]): Promise<void> {
    const targetIds = new Set(ids);
    if (targetIds.size === 0) return;
    const db = await getDb();
    const tx = db.transaction(['videos', 'videoBlobs', 'thumbnails', 'stickies'], 'readwrite');
    const stickies = await tx.objectStore('stickies').getAll();
    const videoStore = tx.objectStore('videos');
    const blobStore = tx.objectStore('videoBlobs');
    const thumbnailStore = tx.objectStore('thumbnails');
    const stickyStore = tx.objectStore('stickies');
    await Promise.all([
      ...Array.from(targetIds).flatMap((id) => [
        videoStore.delete(id),
        blobStore.delete(id),
        thumbnailStore.delete(id),
      ]),
      ...stickies.filter((sticky) => targetIds.has(sticky.videoId)).map((sticky) => stickyStore.delete(sticky.id)),
    ]);
    await tx.done;
  }

  async getVideoBlob(id: string): Promise<Blob | undefined> {
    const db = await getDb();
    return db.get('videoBlobs', id);
  }

  async getThumbnail(id: string): Promise<Blob | undefined> {
    const db = await getDb();
    return db.get('thumbnails', id);
  }

  async listFolders(): Promise<Folder[]> {
    const db = await getDb();
    return db.getAll('folders');
  }

  async saveFolder(f: Folder): Promise<void> {
    const db = await getDb();
    await db.put('folders', f);
  }

  async deleteFolder(id: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['folders', 'videos'], 'readwrite');
    await tx.objectStore('folders').delete(id);
    const videoStore = tx.objectStore('videos');
    const allVideos = await videoStore.getAll();
    const affected = allVideos.filter((v) => v.folderId === id);
    await Promise.all(
      affected.map((v) => videoStore.put({ ...v, folderId: null }))
    );
    await tx.done;
  }

  async listStickies(videoId: string): Promise<Sticky[]> {
    const db = await getDb();
    return db.getAllFromIndex('stickies', 'videoId', videoId);
  }

  async saveSticky(s: Sticky): Promise<void> {
    const db = await getDb();
    await db.put('stickies', s);
  }

  async deleteSticky(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('stickies', id);
  }

  async listNotes(): Promise<GeneralNote[]> {
    const db = await getDb();
    return db.getAll('notes');
  }

  async saveNote(note: GeneralNote): Promise<void> {
    const db = await getDb();
    await db.put('notes', note);
  }

  async deleteNote(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('notes', id);
  }
}
