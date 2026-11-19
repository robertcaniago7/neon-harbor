// Neon Harbor 3D — boots world.js, the title screen, pause, game-over and restart.

import { createWorld, run } from './world.js';
import { shotFromUrl, applyShot } from './shots.js';
import { clearSave } from './save.js';

const canvas = document.getElementById('game-canvas');
const game = createWorld({ canvas, seed: 1, quality: 'high' });

// expose for debugging / verification (the test harness reads this)
window.__neonHarbor = game;

const titleEl = document.getElementById('title-screen');
const pauseEl = document.getElementById('pause-screen');
const overEl = document.getElementById('gameover-screen');
const overReason = document.getElementById('gameover-reason');
const hudEl = document.getElementById('hud');
const touchEl = document.getElementById('touch-controls');

function show(el, on) {
  if (el) el.style.display = on ? 'flex' : 'none';
}

/** Start (or continue) the game from the title screen. */
function startGame() {
  game.state = 'playing';
  game.paused = false;
  show(titleEl, false);
  show(hudEl, true);
  if ('ontouchstart' in window) show(touchEl, true);
  game.audio.ensure();
  game.audio.playUi();
  game.hud.showObjective(game.missions.label);
  game.save();
}

// title buttons
const btnStart = document.getElementById('btn-start');
if (btnStart) btnStart.addEventListener('click', startGame);
const btnContinue = document.getElementById('btn-continue');
if (btnContinue) {
  btnContinue.addEventListener('click', startGame);
} else if (btnStart) {
  // no save yet: the start button is the only one
  void 0;
}
const btnFresh = document.getElementById('btn-fresh');
if (btnFresh) {
  btnFresh.addEventListener('click', () => {
    clearSave();
    window.location.reload();
  });
}

// pause
game.onPause = (paused) => {
  show(pauseEl, paused);
  game.audio.playUi();
};
const btnResume = document.getElementById('btn-resume');
if (btnResume) btnResume.addEventListener('click', () => { game.paused = false; show(pauseEl, false); });
const btnQuit = document.getElementById('btn-quit');
if (btnQuit) {
  btnQuit.addEventListener('click', () => {
    game.save();
    show(pauseEl, false);
    game.state = 'title';
    show(titleEl, true);
    show(hudEl, false);
  });
}

// game over
game.onDeath = (reason) => {
  if (overReason) overReason.textContent = reason;
  show(overEl, true);
  show(hudEl, false);
};
const btnRetry = document.getElementById('btn-retry');
if (btnRetry) {
  btnRetry.addEventListener('click', () => {
    show(overEl, false);
    game.player.health = 100;
    game.player.pos.set(-25, 0, 25);
    game.player.mesh.position.copy(game.player.pos);
    game.player.mesh.visible = true;
    if (game.player.inCar) game.exitCar();
    game.police.wanted = 0;
    game.state = 'playing';
    show(hudEl, true);
    game.hud.showObjective(game.missions.label);
  });
}

// screenshot staging: ?shot=cover|city|mission|combat auto-starts the game
const shot = shotFromUrl();
if (shot) {
  applyShot(game, shot);
  show(titleEl, false);
  show(hudEl, true);
} else {
  game.state = 'title';
  show(titleEl, true);
  show(hudEl, false);
}

// best cash on the title screen
const bestEl = document.getElementById('title-best');
if (bestEl) bestEl.textContent = game.bestCash > 0 ? `Best cash: $${game.bestCash}` : '';

// mark ready after the first frame renders (the screenshot harness waits for this)
let readyMarked = false;
const markReady = () => {
  if (readyMarked) return;
  readyMarked = true;
  game.ready = true;
  window.__neonHarborReady = true;
};
const origRender = game.renderer.render.bind(game.renderer);
game.renderer.render = (...args) => {
  origRender(...args);
  markReady();
};

run(game);
