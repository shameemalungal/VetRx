import { Capacitor } from '@capacitor/core';

/**
 * Returns the authoritative backend API base URL.
 * - When running in native Android/iOS package, targets production HTTPS endpoint.
 * - When running Vite dev server locally (port 5173), targets local backend (port 4000).
 * - When running in web browser on app.vetrx.brightbase.in, uses relative root (same origin).
 */
export function getApiBaseUrl(): string {
  const envUrl =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
    ((globalThis as any).process?.env?.VITE_API_URL);
  if (envUrl) {
    return envUrl;
  }

  if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
    return 'https://app.vetrx.brightbase.in';
  }

  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return 'http://localhost:4000';
  }

  return '';
}

export const API_BASE = getApiBaseUrl();
