// タイトルのみのリスト表示（設計書 5.1 表示切替 ②）

import { useNavigate } from '../router';
import type { VideoEntry } from '../models';
import { formatRecordedDateTime } from '../lib/format';
import { useLongPress } from '../lib/longPress';
import './VideoListView.css';

interface VideoListViewProps {
  videos: VideoEntry[];
  selectionMode: boolean;
  selectedIds: ReadonlySet<string>;
  onStartSelection: (id: string) => void;
  onToggleSelection: (id: string) => void;
}

function VideoListItem({
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
    <li>
      <button
        type="button"
        className={`video-list-item ${selected ? 'video-list-item-selected' : ''}`}
        aria-pressed={selectionMode ? selected : undefined}
        {...longPress.eventHandlers}
        onClick={() => {
          if (longPress.consumeClick()) return;
          if (selectionMode) onToggleSelection(video.id);
          else navigate(`/watch/${video.id}`);
        }}
      >
        {selectionMode && <span className="video-list-selection" aria-hidden="true">{selected ? '✓' : ''}</span>}
        <span className="video-list-title">{video.title}</span>
        <span className="video-list-date">{formatRecordedDateTime(video.recordedDate, video.recordedTime)}</span>
      </button>
    </li>
  );
}

export function VideoListView({ videos, selectionMode, selectedIds, onStartSelection, onToggleSelection }: VideoListViewProps) {

  if (videos.length === 0) {
    return <p className="video-empty">動画がありません</p>;
  }

  return (
    <ul className="video-list">
      {videos.map((video) => (
        <VideoListItem
          key={video.id}
          video={video}
          selectionMode={selectionMode}
          selected={selectedIds.has(video.id)}
          onStartSelection={onStartSelection}
          onToggleSelection={onToggleSelection}
        />
      ))}
    </ul>
  );
}
