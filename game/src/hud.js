// Neon Harbor 3D — HUD DOM + 2D minimap canvas + waypoint beacon.

import { CONFIG } from './config.js';
import { districtAt } from './config.js';
import { waypointInfo } from './missions.js';
import { clockLabel } from './daynight.js';

/** Wire up the HUD elements. Returns the hud state. */
export function createHud(game) {
  const el = (id) => document.getElementById(id);
  const hud = {
    cash: el('hud-cash'),
    health: el('hud-health'),
    armor: el('hud-armor'),
    weapon: el('hud-weapon'),
    speed: el('hud-speed'),
    stars: el('hud-stars'),
    objective: el('hud-objective'),
    clock: el('hud-clock-time'),
    district: el('hud-district'),
    damage: el('damage-flash'),
    minimap: el('minimap'),
    toast: el('hud-toast'),
    toastTimer: 0,
  };
  if (hud.minimap) {
    hud.mapCtx = hud.minimap.getContext('2d');
  }
  return hud;
}

/** Flash the red damage vignette. */
export function flashDamage(game) {
  const h = game.hud;
  if (!h.damage) return;
  h.damage.style.opacity = '0.55';
  setTimeout(() => { h.damage.style.opacity = '0'; }, 180);
}

/** Flash the wanted stars (when the level changes). */
export function flashWanted(game) {
  const h = game.hud;
  if (!h.stars) return;
  h.stars.style.transform = 'scale(1.25)';
  setTimeout(() => { h.stars.style.transform = 'scale(1)'; }, 160);
}

/** Show a one-line objective / toast message. */
export function showObjective(game, text) {
  const h = game.hud;
  if (h.objective) h.objective.textContent = text;
  if (h.toast) {
    h.toast.textContent = text;
    h.toast.style.opacity = '1';
    h.toastTimer = 4;
  }
}

/** District name for the player's current block. */
function currentDistrict(game) {
  const x = game.player.pos.x;
  const z = game.player.pos.z;
  const col = Math.max(0, Math.min(8, Math.round((x + 200) / 50)));
  const row = Math.max(0, Math.min(6, Math.round((z + 150) / 50)));
  if (z >= 180) return 'Palma Beach';
  return districtAt(col, row);
}

/** Draw the 2D minimap: roads, sea, player, cars, waypoint. */
function drawMinimap(game) {
  const h = game.hud;
  if (!h.mapCtx || !h.minimap) return;
  const ctx = h.mapCtx;
  const S = h.minimap.width;
  const W = CONFIG.world;
  const toMap = (x, z) => [
    ((x - W.xMin) / (W.xMax - W.xMin)) * S,
    ((z - W.zMin) / (W.zMax - W.zMin)) * S,
  ];
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(20, 28, 40, 0.85)';
  ctx.fillRect(0, 0, S, S);
  // sea (south)
  const [, seaY] = toMap(0, W.beachZ0);
  ctx.fillStyle = '#0e3a5a';
  ctx.fillRect(0, seaY, S, S - seaY);
  // roads
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 2;
  for (const x of W.roadX) {
    const [mx] = toMap(x, 0);
    ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, S); ctx.stroke();
  }
  for (const z of W.roadZ) {
    const [, mz] = toMap(0, z);
    ctx.beginPath(); ctx.moveTo(0, mz); ctx.lineTo(S, mz); ctx.stroke();
  }
  // waypoint beacon
  const wp = waypointInfo(game);
  if (wp) {
    const [wx, wz] = toMap(wp.x, wp.z);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(wx, wz, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(wx, wz, 9 + Math.sin(game.elapsed * 4) * 3, 0, Math.PI * 2); ctx.stroke();
  }
  // traffic cars
  ctx.fillStyle = '#9aa0a8';
  for (const car of game.traffic.moving) {
    const [mx, mz] = toMap(car.mesh.position.x, car.mesh.position.z);
    ctx.fillRect(mx - 1.5, mz - 1.5, 3, 3);
  }
  // police cars
  ctx.fillStyle = '#3fa7d6';
  for (const car of game.police.cars) {
    const [mx, mz] = toMap(car.mesh.position.x, car.mesh.position.z);
    ctx.beginPath(); ctx.arc(mx, mz, 3, 0, Math.PI * 2); ctx.fill();
  }
  // player (centre arrow)
  const [px, pz] = toMap(game.player.pos.x, game.player.pos.z);
  ctx.fillStyle = '#ff2d95';
  ctx.beginPath(); ctx.arc(px, pz, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(px, pz, 6, 0, Math.PI * 2); ctx.stroke();
  // north indicator
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('N', 4, 12);
}

/** Update every HUD field from the game state. Call once per frame. */
export function updateHud(game, dt) {
  const h = game.hud;
  const p = game.player;
  if (h.cash) h.cash.textContent = `$${p.cash}`;
  if (h.health) {
    h.health.textContent = `${Math.max(0, Math.round(p.health))}`;
    h.health.style.color = p.health < 30 ? '#ff5a5a' : '#ffffff';
  }
  if (h.armor) h.armor.textContent = `${Math.max(0, Math.round(p.armor))}`;
  if (h.weapon) {
    h.weapon.textContent = p.inCar ? 'Driving' : p.weapon === 'pistol' ? `HK-9 · ${p.ammo}` : 'Fists';
  }
  if (h.speed) {
    const v = game.playerCar ? game.playerCar.vehicle.chassisBody.velocity.length() : 0;
    h.speed.textContent = p.inCar ? `${Math.round(v * 3.6)} km/h` : '';
  }
  if (h.stars) {
    const n = game.police.wanted;
    h.stars.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    h.stars.style.color = n > 0 ? '#ffcf3f' : 'rgba(255,255,255,0.35)';
  }
  if (h.clock) h.clock.textContent = clockLabel(game.time);
  if (h.district) h.district.textContent = currentDistrict(game);
  if (h.toast && h.toastTimer > 0) {
    h.toastTimer -= dt;
    if (h.toastTimer <= 0) h.toast.style.opacity = '0';
  }
  drawMinimap(game);
}

// Re-export the helpers under the hud object for game code that calls game.hud.*.
export function bindHudHelpers(game) {
  game.hud.flashDamage = () => flashDamage(game);
  game.hud.flashWanted = () => flashWanted(game);
  game.hud.showObjective = (text) => showObjective(game, text);
}
