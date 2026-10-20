import type { AppData } from "../core/types";

export const CACHE_KEY = "tkifa-g-data-v2";
export const INSTALL_HIDE_KEY = "tg-install-hide";

export function readCache(): AppData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as AppData;
    return d && Array.isArray(d.soldiers) ? d : null;
  } catch {
    return null;
  }
}

export function writeCache(d: AppData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(d));
  } catch {
    /* storage full / blocked */
  }
}

export function clearLocalData() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
  try {
    navigator.serviceWorker?.controller?.postMessage("clear");
  } catch {
    /* ignore */
  }
}

export function getFlag(k: string): boolean {
  try {
    return localStorage.getItem(k) === "1";
  } catch {
    return false;
  }
}

export function setFlag(k: string) {
  try {
    localStorage.setItem(k, "1");
  } catch {
    /* ignore */
  }
}
