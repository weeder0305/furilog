// 再生画面（設計書 5.3）

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useNavigate, useParams } from '../router';
import { useStore } from '../store/useStore';
import { SeekBar } from '../components/SeekBar';
import { FrameStepButtons } from '../components/FrameStepButtons';
import { PlaybackTools } from '../components/PlaybackTools';
import { StickyLayer } from '../components/StickyLayer';
import { StickyList } from '../components/StickyList';
import { TagChips } from '../components/TagChips';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { VideoEntry, Folder, Sticky, StickyColor } from '../models';
import { formatRecordedDateTime } from '../lib/format';
import { sortVideos, type VideoSortMode } from '../lib/search';
import { videoSwipeDirection } from '../lib/videoSwipe';
import './WatchPage.css';

const SORT_MODE_KEY = 'wazalog:sortMode';

function savedSortMode(): VideoSortMode {
  try {
    const value = localStorage.getItem(SORT_MODE_KEY);
    if (
      value === 'recorded-desc' || value === 'recorded-asc' || value === 'created-asc' ||
      value === 'created-desc' || value === 'title-asc'
    ) return value;
  } catch {
    // 保存設定を読めない環境ではホーム画面と同じ既定順を使う。
  }
  return 'created-desc';
}

export function WatchPage() {
  const store = useStore();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const videoRef = useRef<HTMLVideoElement>(null);
  const scrubCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // フルスクリーン対象（動画＋コントロール全体）
  const innerRef = useRef<HTMLDivElement>(null); // 動画実表示領域の基準（付箋の座標計算用）
  const seekInFlightRef = useRef(false);
  const queuedSeekRef = useRef<number | null>(null);
  const seekVideoFrameRequestRef = useRef<number | null>(null);
  const seekFallbackTimerRef = useRef<number | null>(null);
  const scrubbingRef = useRef(false);
  const scrubPreviewVisibleRef = useRef(false);
  const scrubEndPendingRef = useRef(false);
  const swipeRef = useRef<{ pointerId: number; startX: number; startY: number; width: number } | null>(null);
  const suppressVideoClickRef = useRef(false);

  const [entry, setEntry] = useState<VideoEntry | null>(null);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [videoOrder, setVideoOrder] = useState<string[]>([]);
  const [stickies, setStickies] = useState<Sticky[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [videoFrameReady, setVideoFrameReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [paused, setPaused] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(false);

  const [placingSticky, setPlacingSticky] = useState(false);
  const [rangePicking, setRangePicking] = useState(false);
  const [highlightedStickyId, setHighlightedStickyId] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mirrored, setMirrored] = useState(false);
  const [scrubPreviewVisible, setScrubPreviewVisible] = useState(false);

  // データ読み込み（動画メタ・付箋・フォルダ）
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setLoadError(null);
    (async () => {
      try {
        const v = await store.getVideo(id);
        if (cancelled) return;
        if (!v) {
          setNotFound(true);
          return;
        }
        setEntry(v);
        const [s, folders, videos] = await Promise.all([
          store.listStickies(id),
          store.listFolders(),
          store.listVideos(),
        ]);
        if (cancelled) return;
        setStickies(s);
        setFolder(v.folderId ? folders.find((f) => f.id === v.folderId) ?? null : null);
        setVideoOrder(sortVideos(videos, savedSortMode()).map((video) => video.id));
      } catch {
        if (!cancelled) setLoadError('動画を読み込めませんでした。端末の保存設定を確認してください。');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, id]);

  // 動画切替直後の黒画面を避け、デコーダーが最初のフレームを出すまで保存済みサムネイルを表示する。
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setVideoFrameReady(false);
    store.getThumbnail(id)
      .then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setThumbnailUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setThumbnailUrl(null);
      setVideoFrameReady(false);
    };
  }, [store, id]);

  // 動画Blobの読み込みとObject URLの生成・破棄
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    store.getVideoBlob(id)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setLoadError('動画ファイルが見つかりませんでした。');
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setLoadError('動画ファイルを読み込めませんでした。');
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setVideoUrl(null);
    };
  }, [store, id]);

  // Reactのvideoイベントへ直接接続する。Blobとメタ情報の読込順によらず、
  // video要素が生成された時点から再生位置・再生状態を確実に同期できる。
  const handleVideoTimeChange = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (scrubbingRef.current || seekInFlightRef.current) return;
    if (
      loopEnabled &&
      loopStart !== null &&
      loopEnd !== null &&
      video.currentTime >= loopEnd
    ) {
      video.currentTime = loopStart;
      setCurrentTime(loopStart);
      return;
    }
    setCurrentTime(video.currentTime);
  }, [loopEnabled, loopStart, loopEnd]);

  const handleVideoMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDurationSec(Number.isFinite(video.duration) ? video.duration : 0);
    setCurrentTime(video.currentTime);
    setPaused(video.paused);
  }, []);

  const commitQueuedSeek = useCallback(() => {
    const video = videoRef.current;
    const target = queuedSeekRef.current;
    if (!video || target === null || seekInFlightRef.current || video.seeking) return;
    queuedSeekRef.current = null;
    if (Math.abs(video.currentTime - target) < 0.015) {
      setCurrentTime(target);
      return;
    }
    seekInFlightRef.current = true;
    video.currentTime = target;
  }, []);

  const drawScrubPreview = useCallback(() => {
    const video = videoRef.current;
    const canvas = scrubCanvasRef.current;
    if (!video || !canvas || video.videoWidth <= 0 || video.videoHeight <= 0) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);
    const pixelWidth = Math.max(Math.round(bounds.width * pixelRatio), 1);
    const pixelHeight = Math.max(Math.round(bounds.height * pixelRatio), 1);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.fillStyle = '#000';
    context.fillRect(0, 0, bounds.width, bounds.height);
    const scale = Math.min(bounds.width / video.videoWidth, bounds.height / video.videoHeight);
    const drawWidth = video.videoWidth * scale;
    const drawHeight = video.videoHeight * scale;
    context.drawImage(
      video,
      (bounds.width - drawWidth) / 2,
      (bounds.height - drawHeight) / 2,
      drawWidth,
      drawHeight
    );
  }, []);

  const finishScrubPreview = useCallback(() => {
    scrubEndPendingRef.current = false;
    requestAnimationFrame(() => {
      scrubPreviewVisibleRef.current = false;
      setScrubPreviewVisible(false);
    });
  }, []);

  const resetScrubPreview = useCallback(() => {
    const video = videoRef.current;
    if (video && seekVideoFrameRequestRef.current !== null && typeof video.cancelVideoFrameCallback === 'function') {
      video.cancelVideoFrameCallback(seekVideoFrameRequestRef.current);
    }
    if (seekFallbackTimerRef.current !== null) window.clearTimeout(seekFallbackTimerRef.current);
    seekVideoFrameRequestRef.current = null;
    seekFallbackTimerRef.current = null;
    scrubbingRef.current = false;
    scrubEndPendingRef.current = false;
    scrubPreviewVisibleRef.current = false;
    setScrubPreviewVisible(false);
  }, []);

  const handleVideoSeeked = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    seekInFlightRef.current = false;
    // シークバーと時刻表示も、指の先行位置ではなく実際に表示できた映像へ合わせる。
    setCurrentTime(video.currentTime);
    if (scrubPreviewVisibleRef.current) {
      let continued = false;
      const continueAfterPresentedFrame = () => {
        if (continued) return;
        continued = true;
        if (seekFallbackTimerRef.current !== null) window.clearTimeout(seekFallbackTimerRef.current);
        seekFallbackTimerRef.current = null;
        seekVideoFrameRequestRef.current = null;
        // デコーダーが目的位置へ到達した後の1枚だけを表示する。
        // キーフレームからの高速展開中の映像は動画本体の後ろへ隠す。
        drawScrubPreview();
        if (queuedSeekRef.current !== null) commitQueuedSeek();
        else if (scrubEndPendingRef.current) finishScrubPreview();
      };
      // seeked直後に次のcurrentTimeを設定すると、WebViewが新しい絵を表示する前に
      // デコードをやり直して同じフレームを繰り返す。表示完了を待って最新位置へ進む。
      if (typeof video.requestVideoFrameCallback === 'function') {
        seekVideoFrameRequestRef.current = video.requestVideoFrameCallback(continueAfterPresentedFrame);
        seekFallbackTimerRef.current = window.setTimeout(continueAfterPresentedFrame, 160);
      } else {
        seekFallbackTimerRef.current = window.setTimeout(continueAfterPresentedFrame, 60);
      }
    } else if (queuedSeekRef.current !== null) {
      // 通常シークを素早く続けた場合も、デコード完了後に最後の指位置まで追従する。
      commitQueuedSeek();
    }
  }, [commitQueuedSeek, drawScrubPreview, finishScrubPreview]);

  useEffect(() => () => {
    const video = videoRef.current;
    if (video && seekVideoFrameRequestRef.current !== null && typeof video.cancelVideoFrameCallback === 'function') {
      video.cancelVideoFrameCallback(seekVideoFrameRequestRef.current);
    }
    if (seekFallbackTimerRef.current !== null) window.clearTimeout(seekFallbackTimerRef.current);
  }, []);

  const handleVideoPlay = useCallback(() => {
    resetScrubPreview();
    setPaused(false);
    if (!rangePicking) setPlacingSticky(false);
  }, [rangePicking, resetScrubPreview]);

  const handleVideoPause = useCallback(() => setPaused(true), []);

  // フルスクリーン状態の同期（ブラウザのEscや他UIでの解除にも追随）
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  function handleToggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  }

  const effectiveDuration = durationSec || entry?.durationSec || 0;

  // StickyLayerがplacing中はイベントを止めるので、ここに来るのは通常時のみ
  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      // シーク用canvasが残って映像だけ静止して見える状態を、再生前に必ず解除する。
      resetScrubPreview();
      void video.play().catch(() => setActionError('動画を再生できませんでした。'));
    }
    else video.pause();
  }, [resetScrubPreview]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLButtonElement ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        handleTogglePlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePlay]);

  function handlePlaybackRateChange(rate: number) {
    setPlaybackRate(rate);
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
  }

  function handleSetLoopStart() {
    setLoopStart(currentTime);
    setLoopEnd(null);
    setLoopEnabled(false);
  }

  function handleSetLoopEnd() {
    if (loopStart === null || currentTime <= loopStart) return;
    setLoopEnd(currentTime);
    setLoopEnabled(true);
  }

  function handleClearLoop() {
    setLoopStart(null);
    setLoopEnd(null);
    setLoopEnabled(false);
  }

  function handleSeek(time: number) {
    const video = videoRef.current;
    if (!video) return;
    // 通常のタップ／ドラッグは再生状態を維持し、静止長押しで始まる精密操作だけ停止する。
    if (scrubbingRef.current) video.pause();
    queuedSeekRef.current = time;
    commitQueuedSeek();
  }

  function handlePreciseStart() {
    scrubbingRef.current = true;
    scrubEndPendingRef.current = false;
    scrubPreviewVisibleRef.current = true;
    videoRef.current?.pause();
    // 最初のシークを始める前の静止画を同期的に確保する。
    drawScrubPreview();
    setScrubPreviewVisible(true);
  }

  function handlePreciseEnd() {
    scrubbingRef.current = false;
    scrubEndPendingRef.current = true;
    const waitingForPresentedFrame =
      seekVideoFrameRequestRef.current !== null || seekFallbackTimerRef.current !== null;
    if (!seekInFlightRef.current && !waitingForPresentedFrame) {
      if (queuedSeekRef.current !== null) commitQueuedSeek();
      else finishScrubPreview();
    }
  }

  const currentVideoIndex = videoOrder.indexOf(id ?? '');
  const previousVideoId = currentVideoIndex > 0 ? videoOrder[currentVideoIndex - 1] : null;
  const nextVideoId = currentVideoIndex >= 0 && currentVideoIndex < videoOrder.length - 1
    ? videoOrder[currentVideoIndex + 1]
    : null;

  function handleVideoPointerDown(event: PointerEvent<HTMLDivElement>) {
    const bounds = innerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    swipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX - bounds.left,
      startY: event.clientY - bounds.top,
      width: bounds.width,
    };
  }

  function handleVideoPointerEnd(event: PointerEvent<HTMLDivElement>) {
    const gesture = swipeRef.current;
    swipeRef.current = null;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const bounds = innerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const direction = videoSwipeDirection(
      gesture.startX,
      gesture.startY,
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      gesture.width
    );
    if (direction) suppressVideoClickRef.current = true;
    const targetId = direction === 'previous' ? previousVideoId : direction === 'next' ? nextVideoId : null;
    if (!targetId) return;
    videoRef.current?.pause();
    navigate(`/watch/${targetId}`, { replace: true });
  }

  function handleVideoClick() {
    if (suppressVideoClickRef.current) {
      suppressVideoClickRef.current = false;
      return;
    }
    handleTogglePlay();
  }

  function handleSkip(deltaSec: number) {
    const video = videoRef.current;
    if (!video) return;
    const total = effectiveDuration || video.duration || 0;
    const nextTime = Math.min(Math.max(video.currentTime + deltaSec, 0), total);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function handleAddStickyClick() {
    setPlacingSticky(true);
  }

  async function handleCreateSticky(
    x: number,
    y: number,
    text: string,
    color: StickyColor,
    startTimeSec: number,
    endTimeSec?: number
  ) {
    if (!id) return;
    const sticky: Sticky = {
      id: crypto.randomUUID(),
      videoId: id,
      timeSec: startTimeSec,
      endTimeSec,
      x,
      y,
      text,
      color,
      createdAt: Date.now(),
    };
    try {
      await store.saveSticky(sticky);
      setStickies((prev) => [...prev, sticky]);
      setPlacingSticky(false);
      setActionError(null);
    } catch {
      setActionError('付箋を保存できませんでした。空き容量を確認してください。');
    }
  }

  async function handleDeleteSticky(stickyId: string) {
    try {
      await store.deleteSticky(stickyId);
      setStickies((prev) => prev.filter((s) => s.id !== stickyId));
      setHighlightedStickyId((prev) => (prev === stickyId ? null : prev));
      setActionError(null);
    } catch {
      setActionError('付箋を削除できませんでした。もう一度お試しください。');
    }
  }

  async function handleUpdateSticky(updated: Sticky) {
    try {
      await store.saveSticky(updated);
      setStickies((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setActionError(null);
    } catch {
      setActionError('付箋の変更を保存できませんでした。空き容量を確認してください。');
    }
  }

  function handleSelectSticky(sticky: Sticky) {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = sticky.timeSec;
    }
    setCurrentTime(sticky.timeSec);
    setHighlightedStickyId(sticky.id);
  }

  async function handleConfirmDelete() {
    if (!id) return;
    try {
      await store.deleteVideo(id);
      setDeleteConfirmOpen(false);
      navigate('/');
    } catch {
      setDeleteConfirmOpen(false);
      setActionError('動画を削除できませんでした。もう一度お試しください。');
    }
  }

  if (loading) {
    return <p className="watch-loading">読み込み中…</p>;
  }

  if (loadError) {
    return (
      <div className="watch-not-found" role="alert">
        <p>{loadError}</p>
        <button type="button" onClick={() => navigate('/')}>トップへ戻る</button>
      </div>
    );
  }

  if (notFound || !entry) {
    return (
      <div className="watch-not-found">
        <p>動画が見つかりませんでした。</p>
        <button type="button" onClick={() => navigate('/')}>
          トップへ戻る
        </button>
      </div>
    );
  }

  return (
    <div className="watch-page">
      <div
        className={`watch-video-wrap ${isFullscreen ? 'watch-video-wrap-fullscreen' : ''}`}
        ref={containerRef}
      >
        <div
          className="watch-video-inner"
          ref={innerRef}
          onClick={handleVideoClick}
        >
          {videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              className={`watch-video ${mirrored ? 'watch-video-mirrored' : ''}`}
              playsInline
              onTimeUpdate={handleVideoTimeChange}
              onSeeked={handleVideoSeeked}
              onLoadedMetadata={handleVideoMetadata}
              onDurationChange={handleVideoMetadata}
              onLoadedData={() => requestAnimationFrame(() => setVideoFrameReady(true))}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
            />
          )}

          {thumbnailUrl && !videoFrameReady && (
            <img
              src={thumbnailUrl}
              className={`watch-loading-thumbnail ${mirrored ? 'watch-video-mirrored' : ''}`}
              alt=""
              aria-hidden="true"
            />
          )}

          <canvas
            ref={scrubCanvasRef}
            className={`watch-scrub-preview ${scrubPreviewVisible ? 'watch-scrub-preview-visible' : ''} ${mirrored ? 'watch-video-mirrored' : ''}`}
            aria-hidden="true"
          />

          {!placingSticky && !rangePicking && (
            <div
              className="watch-video-swipe-zone"
              aria-label="動画中央を左右にスワイプして前後の動画へ移動"
              onClick={(event) => {
                event.stopPropagation();
                handleVideoClick();
              }}
              onPointerDown={handleVideoPointerDown}
              onPointerUp={handleVideoPointerEnd}
              onPointerCancel={() => { swipeRef.current = null; }}
            />
          )}

          <div className="watch-video-overlay-top-left" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="watch-overlay-btn"
              aria-label="トップへ戻る"
              onClick={() => navigate('/')}
            >
              ←
            </button>
          </div>

          <div className="watch-video-overlay-top" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="watch-overlay-btn"
              aria-label="フルスクリーン切替"
              onClick={handleToggleFullscreen}
            >
              ⛶
            </button>
            <button
              type="button"
              className="watch-overlay-btn"
              aria-label="メモ帳を開く"
              onClick={() => navigate('/notes')}
            >
              📝
            </button>
            <button
              type="button"
              className="watch-overlay-btn"
              aria-label="メタ情報を編集"
              onClick={() => navigate(`/edit/${id}`)}
            >
              ✏️
            </button>
            <button
              type="button"
              className="watch-overlay-btn"
              aria-label="削除"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              🗑️
            </button>
          </div>

          {paused && !placingSticky && (
            <button
              type="button"
              className="watch-add-sticky-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleAddStickyClick();
              }}
            >
              付箋を追加
            </button>
          )}

          <StickyLayer
            containerRef={innerRef}
            videoRef={videoRef}
            stickies={stickies}
            currentTime={currentTime}
            paused={paused}
            placing={placingSticky}
            durationSec={effectiveDuration}
            onCancelPlacing={() => setPlacingSticky(false)}
            onCreateSticky={handleCreateSticky}
            onSeek={handleSeek}
            onRangePickingChange={setRangePicking}
            onDeleteSticky={handleDeleteSticky}
            onUpdateSticky={handleUpdateSticky}
            highlightedStickyId={highlightedStickyId}
            mirrored={mirrored}
          />
        </div>

        <div className="watch-controls-bar">
          <SeekBar
            currentTime={currentTime}
            durationSec={effectiveDuration}
            onSeek={handleSeek}
            onPreciseStart={handlePreciseStart}
            onPreciseEnd={handlePreciseEnd}
          />
          <div className="watch-quick-tools" aria-label="動画の表示とスキップ">
            <button type="button" onClick={() => handleSkip(-2)} aria-label="2秒戻る">−2秒</button>
            <button
              type="button"
              className="watch-play-state-button"
              onClick={handleTogglePlay}
              aria-label={paused ? '停止中。押すと再生' : '再生中。押すと停止'}
              title={paused ? '停止中' : '再生中'}
            >
              <span aria-hidden="true">{paused ? '■' : '▶'}</span>
            </button>
            <button
              type="button"
              className={mirrored ? 'watch-quick-tool-active' : ''}
              onClick={() => setMirrored((value) => !value)}
              aria-pressed={mirrored}
            >
              ⇆ 左右反転
            </button>
            <button type="button" onClick={() => handleSkip(2)} aria-label="2秒進む">＋2秒</button>
          </div>
          <FrameStepButtons
            videoRef={videoRef}
            durationSec={effectiveDuration}
            onTimeChange={setCurrentTime}
          />
          <PlaybackTools
            currentTime={currentTime}
            playbackRate={playbackRate}
            loopStart={loopStart}
            loopEnd={loopEnd}
            loopEnabled={loopEnabled}
            onPlaybackRateChange={handlePlaybackRateChange}
            onSetLoopStart={handleSetLoopStart}
            onSetLoopEnd={handleSetLoopEnd}
            onToggleLoop={() => setLoopEnabled((value) => !value)}
            onClearLoop={handleClearLoop}
          />
        </div>
      </div>

      {actionError && <p className="watch-action-error" role="alert">{actionError}</p>}
      <div className="watch-info">
        <div className="watch-info-left">
          <h1 className="watch-title">{entry.title}</h1>
          {entry.memo && <p className="watch-memo">{entry.memo}</p>}
          <p className="watch-recorded-date">撮影日時: {formatRecordedDateTime(entry.recordedDate, entry.recordedTime)}</p>
          <TagChips tags={entry.tags} />
          <p className="watch-folder">フォルダ: {folder ? folder.name : '未分類'}</p>
        </div>
        <div className="watch-info-right">
          <h2 className="watch-sticky-heading">付箋一覧</h2>
          <StickyList
            stickies={stickies}
            highlightedStickyId={highlightedStickyId}
            onSelect={handleSelectSticky}
          />
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="動画を削除しますか？"
        message="この動画・サムネイル・付箋はすべて削除され、元に戻せません。"
        confirmLabel="削除する"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
