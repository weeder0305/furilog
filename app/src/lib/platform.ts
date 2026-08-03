import { Capacitor } from '@capacitor/core';

interface NavigatorWithBrave extends Navigator {
  brave?: { isBrave?: () => Promise<boolean> };
}

export function isNativeAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function detectBrowserName(): Promise<string> {
  if (isNativeAndroidApp()) return 'ふりろぐAndroidアプリ';
  const candidate = navigator as NavigatorWithBrave;
  try {
    if (await candidate.brave?.isBrave?.()) return 'Brave';
  } catch {
    // Browser identification is only explanatory; continue with the user agent fallback.
  }
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Microsoft Edge';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/CriOS\//.test(ua) || (/Chrome\//.test(ua) && !/Edg\//.test(ua))) return 'Chrome';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  return '現在使用中のブラウザ';
}
