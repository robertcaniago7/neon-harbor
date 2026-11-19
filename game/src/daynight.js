// Neon Harbor 3D — sun/moon, sky colour, fog, streetlight/neon intensity by time.
// Time t in [0,1): 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk.
// Day length 480 s; start time 0.72 (golden hour).

import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';

const P = CONFIG.palette;

/** Create the sun (directional, with shadows), moon/ambient and sky. */
export function createSky(scene) {
  const sun = new THREE.DirectionalLight(P.sunDay, 2.2);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x5a4a3a, 0.9);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0x8fa8ff, 0.0);
  moon.position.set(-120, 160, -80);
  scene.add(moon);

  scene.background = new THREE.Color(P.skyDay);
  scene.fog = new THREE.Fog(P.fogDay, 60, 420);
  return { sun, hemi, moon };
}

/** Blend of day/dusk/night for a time t: returns { day, dusk, night } weights. */
export function lightWeights(t) {
  // day peaks at noon (0.5), dusk peaks at 0.75, night peaks at 0 / 1.
  const dayW = Math.max(0, 1 - Math.abs(t - 0.5) / 0.28);
  const duskW = Math.max(0, 1 - Math.abs(t - 0.75) / 0.14) + Math.max(0, 1 - Math.abs(t - 0.25) / 0.1);
  const nightW = Math.max(0, 1 - Math.min(Math.abs(t), Math.abs(t - 1)) / 0.18);
  const sum = dayW + duskW + nightW || 1;
  return { day: dayW / sum, dusk: duskW / sum, night: nightW / sum };
}

function lerpColor(a, b, f) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return ca.lerp(cb, f);
}

/** Update sun/moon/sky/fog/window colours for the game's current time. */
export function updateDayNight(game, dt) {
  const t = game.time;
  const w = lightWeights(t);
  const { sun, hemi, moon } = game.sky;
  // sun angle: rises in the east, sets in the west across the day
  const ang = (t - 0.25) * Math.PI * 2;
  const sunH = Math.sin(ang);
  sun.position.set(Math.cos(ang) * 220, Math.max(20, sunH * 200), 90);
  sun.intensity = 0.25 + w.day * 2.0 + w.dusk * 1.1;
  sun.color.copy(lerpColor(P.sunNight, P.sunDay, w.day)).lerp(lerpColor(P.sunDay, P.sunDusk, 1), w.dusk * 0.7);
  moon.intensity = w.night * 0.7;
  hemi.intensity = 0.25 + w.day * 0.65 + w.dusk * 0.35;
  // sky + fog
  const sky = lerpColor(P.skyNight, P.skyDay, w.day);
  sky.lerp(new THREE.Color(P.skyDusk), w.dusk * 0.85);
  game.scene.background.copy(sky);
  const fog = lerpColor(P.fogNight, P.fogDay, w.day);
  fog.lerp(new THREE.Color(P.skyDusk), w.dusk * 0.5);
  game.scene.fog.color.copy(fog);
  // windows: dark by day, warm by night
  if (game.city.windowMat) {
    game.city.windowMat.color.copy(lerpColor(P.windowDay, P.windowNight, w.night + w.dusk * 0.4));
  }
  // sea colour
  if (game.city.seaMat) {
    game.city.seaMat.color.copy(lerpColor(P.seaNight, P.seaDay, w.day + w.dusk * 0.35));
  }
  // advance the clock (paused on the title screen)
  if (!game.paused && game.state === 'playing') {
    game.time = (game.time + dt / CONFIG.day.lengthSec) % 1;
  }
}

/** Human-readable time of day (for the HUD). */
export function clockLabel(t) {
  const hours = Math.floor(t * 24);
  const mins = Math.floor((t * 24 - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
