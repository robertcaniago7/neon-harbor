// Neon Harbor 3D — save.js
// localStorage save/load: progress, cash, best run. Versioned keys so an old
// save never crashes a new build.

import { SAVE_KEYS } from './config.js';

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEYS.save);
    if (!raw) return null;
    const data = safeParse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      mission: Number.isFinite(data.mission) ? data.mission : 0,
      cash: Number.isFinite(data.cash) ? data.cash : 150,
      health: Number.isFinite(data.health) ? data.health : 100,
      armor: Number.isFinite(data.armor) ? data.armor : 50,
      time: Number.isFinite(data.time) ? data.time : 0.72,
      playedAt: data.playedAt || 0,
    };
  } catch (e) {
    return null;
  }
}

export function writeSave(data) {
  try {
    const payload = {
      mission: data.mission || 0,
      cash: data.cash || 0,
      health: data.health || 100,
      armor: data.armor || 0,
      time: data.time || 0.72,
      playedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEYS.save, JSON.stringify(payload));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEYS.save);
  } catch (e) { /* storage unavailable */ }
}

export function loadBest() {
  try {
    const raw = localStorage.getItem(SAVE_KEYS.best);
    const n = raw === null ? 0 : parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch (e) {
    return 0;
  }
}

export function writeBest(cash) {
  try {
    const prev = loadBest();
    if (cash > prev) localStorage.setItem(SAVE_KEYS.best, String(Math.floor(cash)));
    return Math.max(prev, Math.floor(cash));
  } catch (e) {
    return cash;
  }
}
