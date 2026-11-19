// Neon Harbor 3D — localStorage save / load (progress, cash, best).

import { CONFIG } from './config.js';

/** The save payload shape. */
function emptySave() {
  return {
    version: 1,
    cash: CONFIG.player.startCash,
    health: CONFIG.player.health,
    missionIndex: 0,
    bestCash: 0,
    savedAt: Date.now(),
  };
}

/** Save the current progress. */
export function saveGame(game) {
  try {
    const data = {
      version: 1,
      cash: game.player.cash,
      health: game.player.health,
      missionIndex: game.missions.index,
      bestCash: Math.max(game.bestCash || 0, game.player.cash),
      savedAt: Date.now(),
    };
    localStorage.setItem(CONFIG.saveKey, JSON.stringify(data));
    game.bestCash = data.bestCash;
    return true;
  } catch (err) {
    console.warn('save failed', err);
    return false;
  }
}

/** Load saved progress, or null when there is none / it is unreadable. */
export function loadGame() {
  try {
    const raw = localStorage.getItem(CONFIG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (err) {
    console.warn('load failed', err);
    return null;
  }
}

/** Record the best cash total (for the title screen). */
export function saveBest(game) {
  try {
    const best = Math.max(loadBest(), game.player.cash);
    localStorage.setItem(CONFIG.bestKey, String(best));
    game.bestCash = best;
    return best;
  } catch (err) {
    console.warn('best save failed', err);
    return game.player.cash;
  }
}

/** Read the best cash total, or 0. */
export function loadBest() {
  try {
    return Number(localStorage.getItem(CONFIG.bestKey) ?? 0) || 0;
  } catch (err) {
    return 0;
  }
}

/** Clear the save (fresh start). */
export function clearSave() {
  try {
    localStorage.removeItem(CONFIG.saveKey);
    localStorage.removeItem(CONFIG.bestKey);
  } catch (err) {
    console.warn('clear save failed', err);
  }
}

export { emptySave };
