// Settings and best scores persisted in localStorage (guarded — storage can be unavailable).
const KEY = 'ers.settings.v1';
const BEST = 'ers.best.v1';

export const DEFAULT_SETTINGS = { quality: 'medium', sensitivity: 1, volume: 0.7, showDangerRings: true };

export const QUALITY = {
  low: { pixelRatio: 0.8, shadows: false, shadowMap: 1024, particles: 0.5, antialias: false },
  medium: { pixelRatio: 1.25, shadows: true, shadowMap: 2048, particles: 1, antialias: true },
  high: { pixelRatio: 2, shadows: true, shadowMap: 4096, particles: 1.3, antialias: true },
};

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function loadBest() {
  try { return JSON.parse(localStorage.getItem(BEST) || 'null'); } catch { return null; }
}

export function saveBestIfHigher(result) {
  const best = loadBest();
  if (result.score > 0 && (!best || result.score > best.score)) {
    const rec = { score: result.score, rating: result.rating, date: new Date().toISOString() };
    try { localStorage.setItem(BEST, JSON.stringify(rec)); } catch { /* ignore */ }
    return { best: rec, isNew: true };
  }
  return { best, isNew: false };
}
