// 時刻表示などのフォーマット用純粋関数

/** 秒数を m:ss.f 形式（分:秒.小数1桁）にフォーマットする */
export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  // 先に0.1秒単位へ丸めてから分・秒へ分解する（59.96秒が「60.0」に丸まって
  // 桁上がりし忘れる、といった境界での誤表示を防ぐ）
  const roundedTenths = Math.round(sec * 10);
  const minutes = Math.floor(roundedTenths / 600);
  const remainTenths = roundedTenths - minutes * 600;
  const secondsStr = (remainTenths / 10).toFixed(1).padStart(4, '0'); // "ss.f"
  return `${minutes}:${secondsStr}`;
}

/** epoch ms を YYYY-MM-DD 形式にフォーマットする */
export function formatDate(epochMs: number): string {
  const d = new Date(epochMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** タイトル未入力時の既定タイトル「無題 YYYY-MM-DD」を生成する */
export function defaultTitle(epochMs: number = Date.now()): string {
  return `無題 ${formatDate(epochMs)}`;
}

/** epoch ms を YYYY-MM-DD HH:mm 形式にフォーマットする */
export function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${formatDate(epochMs)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** epoch ms を端末のローカル時刻 HH:mm 形式にフォーマットする */
export function formatClockTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 撮影日と任意の撮影時刻を表示用文字列へまとめる */
export function formatRecordedDateTime(recordedDate?: string, recordedTime?: string): string {
  if (!recordedDate) return '未設定';
  return recordedTime ? `${recordedDate} ${recordedTime}` : recordedDate;
}
