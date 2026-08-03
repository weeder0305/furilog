import { formatTime } from '../lib/format';
import './PlaybackTools.css';

interface PlaybackToolsProps {
  currentTime: number;
  playbackRate: number;
  loopStart: number | null;
  loopEnd: number | null;
  loopEnabled: boolean;
  onPlaybackRateChange: (rate: number) => void;
  onSetLoopStart: () => void;
  onSetLoopEnd: () => void;
  onToggleLoop: () => void;
  onClearLoop: () => void;
}

export function PlaybackTools({
  currentTime,
  playbackRate,
  loopStart,
  loopEnd,
  loopEnabled,
  onPlaybackRateChange,
  onSetLoopStart,
  onSetLoopEnd,
  onToggleLoop,
  onClearLoop,
}: PlaybackToolsProps) {
  const loopReady = loopStart !== null && loopEnd !== null && loopEnd > loopStart;

  return (
    <div className="playback-tools">
      <label className="playback-rate-label">
        速度
        <select
          className="playback-rate-select"
          value={playbackRate}
          onChange={(e) => onPlaybackRateChange(Number(e.target.value))}
        >
          <option value={0.25}>0.25×</option>
          <option value={0.5}>0.5×</option>
          <option value={0.75}>0.75×</option>
          <option value={1}>1×</option>
          <option value={1.5}>1.5×</option>
          <option value={2}>2×</option>
        </select>
      </label>

      <div className="loop-tools" aria-label="区間リピート設定">
        <button type="button" className="playback-tool-btn" onClick={onSetLoopStart}>
          A {loopStart === null ? '点' : formatTime(loopStart)}
        </button>
        <button
          type="button"
          className="playback-tool-btn"
          onClick={onSetLoopEnd}
          disabled={loopStart === null || currentTime <= loopStart}
        >
          B {loopEnd === null ? '点' : formatTime(loopEnd)}
        </button>
        <button
          type="button"
          className={`playback-tool-btn ${loopEnabled ? 'playback-tool-btn-active' : ''}`}
          onClick={onToggleLoop}
          disabled={!loopReady}
        >
          ↻ {loopEnabled ? 'ON' : 'OFF'}
        </button>
        {(loopStart !== null || loopEnd !== null) && (
          <button type="button" className="playback-tool-clear" onClick={onClearLoop}>
            解除
          </button>
        )}
      </div>
    </div>
  );
}
