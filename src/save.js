// Save and best score in localStorage: cash, mission progress, player position and
// health, plus the best cash ever held. Loading never throws: a bad save is ignored.

import { SAVE_KEY, BEST_KEY } from './config.js';

export function saveGame(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be off (private windows): the game then lasts this visit only.
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(value) {
  try {
    const best = readBest();
    if (value > best) window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Best score is a nicety, not a requirement.
  }
}
