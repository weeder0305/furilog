// サムネイルのグリッド表示（設計書 5.1 表示切替 ①）

import { useEffect, useState } from 'react';
import { useNavigate } from '../router';
import type { VideoEntry } from '../models';
import { useStore } from '../store/useStore';
import { formatRecordedDateTime, formatTime } from '../lib/format';
import { useLongPress } from '../lib/longPress';
import './VideoGrid.css';

function VideoThumbnail({ videoId }: { videoId: string }) {
  const store = useStore();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    store.getThumbnail(videoId).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [store, videoId]);

  if (!url) return <div className="video-thumb-placeholder" />;
  return <img src={url} alt="" className="video-thumb-img" />;
}

interface VideoGridProps {
  videos: VideoEntry[];
  selectionMode: boolean;
  selectedIds: ReadonlySet<string>;
  onStartSelection: (id: string) => void;
  onToggleSelection: (id: string) => void;
}

function VideoGridItem({
  video,
  selectionMode,
  selected,
  onStartSelection,
  onToggleSelection,
}: {
  video: VideoEntry;
  selectionMode: boolean;
  selected: boolean;
  onStartSelection: (id: string) => void;
  onToggleSelection: (id: string) => void;
}) {
  const navigate = useNavigate();
  const longPress = useLongPress(() => onStartSelection(video.id));

  return (
    <button
      type="button"
      className={`video-grid-item ${selected ? 'video-grid-item-selected' : ''}`}
      aria-pressed={selectionMode ? selected : undefined}
      {...longPress.eventHandlers}
      onClick={() => {
        if (longPress.consumeClick()) return;
        if (selectionMode) onToggleSelection(video.id);
        else navigate(`/watch/${video.id}`);
      }}
    >
      <div className="video-thumb-wrap">
        <VideoThumbnail videoId={video.id} />
        {selectionMode && <span className="video-grid-selection" aria-hidden="true">{selected ? '✓' : ''}</span>}
        <span className="video-grid-duration">{formatTime(video.durationSec)}</span>
      </div>
      <div className="video-grid-meta">
        <span className="video-grid-title">{video.title}</span>
        <span className="video-grid-date">{formatRecordedDateTime(video.recordedDate, video.recordedTime)}</span>
      </div>
    </button>
  );
}

export function VideoGrid({ videos, selectionMode, selectedIds, onStartSelection, onToggleSelection }: VideoGridProps) {

  if (videos.length === 0) {
    return <p className="video-empty">動画がありません</p>;
  }

  return (
    <div className="video-grid">
      {videos.map((video) => (
        <VideoGridItem
          key={video.id}
          video={video}
          selectionMode={selectionMode}
          selected={selectedIds.has(video.id)}
          onStartSelection={onStartSelection}
          onToggleSelection={onToggleSelection}
        />
      ))}
    </div>
  );
}
