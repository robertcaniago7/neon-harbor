// Neon Harbor 3D — hud.js
// HUD DOM (cash, health, armor, weapon, speed, wanted stars, objective) plus
// a live 2D minimap canvas and a waypoint beacon drawn in the world.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD, ROADS_X, ROADS_Z } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const cashEl = el('hud-cash');
  const healthEl = el('hud-health');
  const armorEl = el('hud-armor');
  const weaponEl = el('hud-weapon');
  const speedEl = el('hud-speed');
  const starsEl = el('hud-stars');
  const objectiveEl = el('hud-objective');
  const timeEl = el('hud-time');
  const mapCanvas = el('minimap');
  const mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null;

  function setStars(n) {
    if (!starsEl) return;
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '\u2605' : '\u2606';
    starsEl.textContent = s;
    starsEl.style.color = n >= 3 ? '#ff2d3a' : '#ffd94c';
  }

  function update(h) {
    if (cashEl) cashEl.textContent = `$${Math.floor(h.cash)}`;
    if (healthEl) {
      healthEl.textContent = `HP ${Math.max(0, Math.ceil(h.health))}`;
      healthEl.style.color = h.health < 30 ? '#ff2d3a' : '#ffffff';
    }
    if (armorEl) armorEl.textContent = `ARMOR ${Math.max(0, Math.ceil(h.armor))}`;
    if (weaponEl) weaponEl.textContent = h.weapon || 'FISTS';
    if (speedEl) speedEl.textContent = h.inCar ? `${Math.round(h.speedKmh)} km/h` : '';
    if (timeEl) {
      const hh = Math.floor(h.time * 24);
      const mm = Math.floor((h.time * 24 - hh) * 60);
      timeEl.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
    setStars(h.stars || 0);
    if (objectiveEl) objectiveEl.textContent = h.objective || '';
    drawMap(h);
  }

  function drawMap(h) {
    if (!mapCtx || !mapCanvas) return;
    const W = mapCanvas.width;
    const H = mapCanvas.height;
    const sx = (x) => ((x - WORLD.xMin) / (WORLD.xMax - WORLD.xMin)) * W;
    const sz = (z) => ((z - WORLD.zMin) / (WORLD.zMax - WORLD.zMin)) * H;
    mapCtx.clearRect(0, 0, W, H);
    mapCtx.fillStyle = '#1c2733';
    mapCtx.fillRect(0, 0, W, H);
    // sea strip at the bottom
    mapCtx.fillStyle = '#0e3a5a';
    mapCtx.fillRect(0, sz(180), W, H - sz(180));
    // roads
    mapCtx.strokeStyle = '#454a55';
    mapCtx.lineWidth = 2;
    for (const x of ROADS_X) {
      mapCtx.beginPath();
      mapCtx.moveTo(sx(x), 0);
      mapCtx.lineTo(sx(x), H);
      mapCtx.stroke();
    }
    for (const z of ROADS_Z) {
      mapCtx.beginPath();
      mapCtx.moveTo(0, sz(z));
      mapCtx.lineTo(W, sz(z));
      mapCtx.stroke();
    }
    // waypoint
    if (h.waypoint) {
      mapCtx.fillStyle = '#ff2d95';
      mapCtx.beginPath();
      mapCtx.arc(sx(h.waypoint.x), sz(h.waypoint.z), 5, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.strokeStyle = '#ff2d95';
      mapCtx.beginPath();
      mapCtx.arc(sx(h.waypoint.x), sz(h.waypoint.z), 9, 0, Math.PI * 2);
      mapCtx.stroke();
    }
    // police dots
    if (h.police) {
      mapCtx.fillStyle = '#2244ff';
      for (const p of h.police) {
        mapCtx.beginPath();
        mapCtx.arc(sx(p.x), sz(p.z), 2.5, 0, Math.PI * 2);
        mapCtx.fill();
      }
    }
    // player arrow
    if (h.player) {
      mapCtx.save();
      mapCtx.translate(sx(h.player.x), sz(h.player.z));
      mapCtx.rotate(h.player.yaw || 0);
      mapCtx.fillStyle = '#ffffff';
      mapCtx.beginPath();
      mapCtx.moveTo(0, -6);
      mapCtx.lineTo(4, 5);
      mapCtx.lineTo(-4, 5);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.restore();
    }
  }

  // A tall glowing beacon column at the waypoint, visible across the city.
  function createBeacon(scene) {
    const geo = new THREE.CylinderGeometry(1.2, 1.2, 90, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff2d95, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 45;
    mesh.visible = false;
    scene.add(mesh);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2, 3.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xff2d95, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    ring.visible = false;
    scene.add(ring);
    function set(x, z, visible) {
      mesh.position.x = x;
      mesh.position.z = z;
      mesh.visible = visible;
      ring.position.x = x;
      ring.position.z = z;
      ring.visible = visible;
    }
    return { mesh, ring, set };
  }

  return { update, setStars, createBeacon };
}
