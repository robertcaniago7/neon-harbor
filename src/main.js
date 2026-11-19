// Neon Harbor 3D: entry point. Screens (title / play / pause / game over), the
// chase camera, the render loop, and the ?shot= staging mode for screenshots.

import * as THREE from 'three';
import { createGame, stepGame, loadGame, clearSave } from './world.js';
import { stageShot, SHOT_NAMES } from './shots.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_CONTINUE, ACTION_MUTE } from './input.js';
import { stepTraffic, stepPeds } from './traffic.js';
import { currentMission } from './missions.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const isMobile = window.matchMedia('(pointer: coarse)').matches;
const quality = params.get('quality') || (isMobile ? 'low' : 'high');
const seed = Number.parseInt(params.get('seed') ?? '20261119', 10) || 20261119;

let ctx = createGame(canvas, { seed, quality });

const $ = (id) => document.getElementById(id);
const overlays = {
  title: $('screen-title'),
  pause: $('screen-pause'),
  over: $('screen-over'),
};

let screen = 'title';
let titleYaw = 0.6;

function showOverlay(name) {
  for (const [k, el] of Object.entries(overlays)) {
    if (el) el.classList.toggle('hidden', k !== name);
  }
}

function startPlay() {
  screen = 'play';
  showOverlay(null);
  // a clicked button keeps keyboard focus; Enter/Space would re-click it
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  ctx.audio.unlock();
  ctx.audio.pad(true);
}

function pauseGame() {
  if (screen !== 'play') return;
  screen = 'pause';
  showOverlay('pause');
  ctx.saveNow();
  ctx.audio.pad(false);
  ctx.audio.engineOff();
}

function resumeGame() {
  screen = 'play';
  showOverlay(null);
  ctx.audio.unlock();
  ctx.audio.pad(true);
}

function quitToTitle() {
  ctx.saveNow();
  screen = 'title';
  showOverlay('title');
  ctx.audio.pad(false);
  ctx.audio.engineOff();
  ctx.audio.siren(false);
  refreshTitleButtons();
}

function showOver() {
  screen = 'over';
  const title = $('over-title');
  const stats = $('over-stats');
  if (title) title.textContent = ctx.over === 'busted' ? 'BUSTED' : 'WASTED';
  if (stats) {
    stats.textContent = `Cash $${Math.floor(ctx.player.cash)} · ${ctx.stats.kills} Vultures down · ${ctx.missions.index} jobs done · Best $${ctx.best}`;
  }
  showOverlay('over');
}

function refreshTitleButtons() {
  const save = loadGame();
  const cont = $('btn-continue');
  if (cont) cont.classList.toggle('hidden', !save);
  const best = $('title-best');
  if (best) best.textContent = save ? `Best cash: $${ctx.best}` : '';
}

$('btn-start')?.addEventListener('click', () => {
  clearSave();
  ctx.resetGame();
  startPlay();
});
$('btn-continue')?.addEventListener('click', () => startPlay());
$('btn-resume')?.addEventListener('click', resumeGame);
$('btn-restart')?.addEventListener('click', () => {
  ctx.resetGame();
  startPlay();
});
$('btn-quit')?.addEventListener('click', quitToTitle);
$('btn-again')?.addEventListener('click', () => {
  ctx.resetGame();
  startPlay();
});
$('btn-mute')?.addEventListener('click', () => {
  ctx.audio.setMuted(!ctx.audio.isMuted());
  $('btn-mute').textContent = ctx.audio.isMuted() ? 'Sound: OFF' : 'Sound: ON';
});
refreshTitleButtons();
showOverlay('title');

// --- camera ---
function updateCamera(dt) {
  const target = new THREE.Vector3();
  if (ctx.playerCar) {
    const p = ctx.playerCar.state.position();
    target.set(p.x, p.y + 2, p.z);
  } else {
    target.copy(ctx.player.pos).add(new THREE.Vector3(0, 1.6, 0));
  }
  const dist = ctx.camDist;
  const cp = ctx.camPitch;
  const cy = ctx.camYaw;
  const off = new THREE.Vector3(
    Math.sin(cy) * Math.cos(cp),
    Math.sin(cp),
    Math.cos(cy) * Math.cos(cp),
  ).multiplyScalar(dist);
  ctx.camera.position.copy(target).add(off);
  if (ctx.camera.position.y < 0.8) ctx.camera.position.y = 0.8;
  ctx.camera.lookAt(target);
  if (ctx.shake > 0) {
    ctx.camera.position.x += (Math.random() - 0.5) * ctx.shake * 0.5;
    ctx.camera.position.y += (Math.random() - 0.5) * ctx.shake * 0.5;
    ctx.shake = Math.max(0, ctx.shake - dt * 1.4);
  }
  const speedNorm = ctx.playerCar ? Math.min(1, Math.abs(ctx.playerCar.state.speed) / 30) : 0;
  const targetFov = 70 + speedNorm * 12;
  ctx.camera.fov += (targetFov - ctx.camera.fov) * Math.min(1, dt * 3);
  ctx.camera.updateProjectionMatrix();
}

function updateTitleCamera(dt) {
  titleYaw += dt * 0.04;
  const target = new THREE.Vector3(25, 16, 0);
  ctx.camera.position.set(
    target.x + Math.sin(titleYaw) * 130,
    48,
    target.z + Math.cos(titleYaw) * 130,
  );
  ctx.camera.lookAt(target);
  if (ctx.camera.fov !== 60) {
    ctx.camera.fov = 60;
    ctx.camera.updateProjectionMatrix();
  }
}

function attractStep(dt) {
  ctx.daynight.update(ctx.dayT, new THREE.Vector3(0, 0, 0));
  ctx.city.update(dt);
  stepTraffic(ctx.traffic, ctx.city, dt, null);
  stepPeds(ctx.peds, ctx.city, dt, null);
}

// --- shot mode: stage, settle, freeze, signal readiness ---
const shotName = params.get('shot');
if (shotName && SHOT_NAMES.includes(shotName)) {
  stageShot(ctx, shotName);
  if (ctx.shotDrive) ctx.input.held.up = true;
  for (let i = 0; i < 150; i++) stepGame(ctx, 1 / 60, { actions: 0 });
  ctx.input.held.up = false;
  updateCamera(0.016);
  ctx.renderer.render(ctx.scene, ctx.camera);
  screen = 'shot';
  showOverlay(null);
  // a clean frame: no toast text over the shot
  const toast = document.getElementById('toast');
  if (toast) toast.style.opacity = '0';
  window.__shotReady = true;
}

// --- main loop ---
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const acts = ctx.input.takeActions();
  if (acts.actions & ACTION_MUTE) {
    ctx.audio.setMuted(!ctx.audio.isMuted());
    const b = $('btn-mute');
    if (b) b.textContent = ctx.audio.isMuted() ? 'Sound: OFF' : 'Sound: ON';
  }
  if (screen === 'play') {
    if (acts.actions & ACTION_PAUSE) {
      pauseGame();
    } else {
      stepGame(ctx, dt, acts);
      updateCamera(dt);
      if (ctx.over) showOver();
    }
  } else if (screen === 'title') {
    attractStep(dt);
    updateTitleCamera(dt);
    if (acts.actions & ACTION_CONFIRM) {
      clearSave();
      ctx.resetGame();
      startPlay();
    } else if (acts.actions & ACTION_CONTINUE) {
      startPlay();
    }
  } else if (screen === 'pause') {
    if (acts.actions & ACTION_PAUSE) resumeGame();
  }
  ctx.renderer.render(ctx.scene, ctx.camera);
}

window.addEventListener('resize', () => {
  ctx.camera.aspect = window.innerWidth / window.innerHeight;
  ctx.camera.updateProjectionMatrix();
  ctx.renderer.setSize(window.innerWidth, window.innerHeight);
});

// Dev probe for automated playtests (read-only state + the live context).
// Harmless in the shipped game: single-player, no leaderboard.
window.__nh = {
  get ctx() { return ctx; },
  /** Advance the simulation by dt seconds without rendering (deterministic QA). */
  step(dt, actions = 0) {
    if (screen === 'play') stepGame(ctx, dt, { actions });
  },
  ACTIONS: { CONFIRM: 1, PAUSE: 2, INTERACT: 4, ENTER: 8, MUTE: 16, CONTINUE: 32 },
  state() {
    const p = ctx.player;
    const car = ctx.playerCar;
    return {
      pos: { x: +p.pos.x.toFixed(1), z: +p.pos.z.toFixed(1) },
      heading: +p.heading.toFixed(3),
      health: p.health, armor: p.armor, cash: Math.floor(p.cash),
      weapon: p.weapon, ammo: p.ammo, inCar: !!car,
      speed: car ? +car.state.speed.toFixed(2) : 0,
      wanted: ctx.police.wanted,
      mission: ctx.missions.index, missionActive: ctx.missions.active,
      missionStep: ctx.missions.step, kills: ctx.missions.kills,
      enemies: ctx.combat.enemies.length,
      parked: ctx.parkedCars.length,
      traffic: ctx.traffic.cars.length, peds: ctx.peds.peds.length,
      policeCars: ctx.police.cars.length, foot: ctx.police.foot.length,
      over: ctx.over, dayT: +ctx.dayT.toFixed(3),
      drawCalls: ctx.renderer.info.render.calls,
      triangles: ctx.renderer.info.render.triangles,
    };
  },
};

requestAnimationFrame(frame);
