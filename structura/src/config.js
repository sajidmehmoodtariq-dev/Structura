// Centralized config for runtime URLs and feature flags
export const RELEASES_URL = import.meta.env.VITE_RELEASES_URL || 'https://github.com/Structura/Structura/releases';

// Detect if running inside a Tauri desktop environment
export function isTauri() {
  try {
    return typeof window !== 'undefined' && !!window.__TAURI__;
  } catch (e) {
    return false;
  }
}
