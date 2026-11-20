// localStorage save/load: progress, cash, best score.
// Keys are fixed by the spec so a save survives a reload.

import { CONFIG } from './config.js';

const SAVE_KEY = CONFIG.saveKey;
const BEST_KEY = CONFIG.bestKey;

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

// Load the save object, or null when there is none / it is corrupt.
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = safeParse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      mission: Number.isFinite(data.mission) ? data.mission : 0,
      cash: Number.isFinite(data.cash) ? data.cash : CONFIG.player.startCash,
      health: Number.isFinite(data.health) ? data.health : CONFIG.player.health,
      best: Number.isFinite(data.best) ? data.best : 0,
      completed: Array.isArray(data.completed) ? data.completed : [],
    };
  } catch (e) {
    return null;
  }
}

// Write the save object. Returns true on success.
export function writeSave(data) {
  try {
    const payload = {
      mission: data.mission | 0,
      cash: Math.max(0, Math.round(data.cash || 0)),
      health: Math.max(0, Math.round(data.health || 0)),
      best: Math.max(0, Math.round(data.best || 0)),
      completed: Array.isArray(data.completed) ? data.completed : [],
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    return false;
  }
}

// Best (highest cash earned in one run) is kept under its own key too.
export function loadBest() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const n = raw === null ? 0 : parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch (e) {
    return 0;
  }
}

export function writeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(Math.max(0, Math.round(value))));
    return true;
  } catch (e) {
    return false;
  }
}

// Remove the save entirely (used by the "new game" path).
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

export default { loadSave, writeSave, loadBest, writeBest, clearSave };
