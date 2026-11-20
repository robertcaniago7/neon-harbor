// HUD: cash / health / armor / weapon / speed / wanted stars / mission
// objective, a live 2D minimap canvas, and the waypoint beacon. All DOM —
// the 3D world only feeds it numbers.

import { CONFIG } from './config.js';

export function createHUD() {
  const el = (id) => document.getElementById(id);

  const cashEl = el('hud-cash');
  const healthFill = el('hud-health-fill');
  const healthText = el('hud-health-text');
  const armorFill = el('hud-armor-fill');
  const weaponEl = el('hud-weapon');
  const ammoEl = el('hud-ammo');
  const speedEl = el('hud-speed');
  const starsEl = el('hud-stars');
  const missionEl = el('hud-mission');
  const objectiveEl = el('hud-objective');
  const messageEl = el('hud-message');
  const mapCanvas = el('minimap');
  const mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null;

  let messageTimer = null;

  function showMessage(text, ms = 2600) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.style.opacity = '1';
    if (messageTimer) clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
      messageEl.style.opacity = '0';
    }, ms);
  }

  function setCash(n) {
    if (cashEl) cashEl.textContent = '$' + Math.round(n).toLocaleString('en-US');
  }

  function setHealth(h, max = 100) {
    const pct = Math.max(0, Math.min(100, (h / max) * 100));
    if (healthFill) healthFill.style.width = pct + '%';
    if (healthText) healthText.textContent = Math.ceil(h) + '';
    if (healthFill) {
      healthFill.style.background = pct > 50 ? '#37d67a' : pct > 25 ? '#f2c94c' : '#ff3b30';
    }
  }

  function setArmor(a, max = 50) {
    const pct = Math.max(0, Math.min(100, (a / max) * 100));
    if (armorFill) armorFill.style.width = pct + '%';
  }

  function setWeapon(name, ammo) {
    if (weaponEl) weaponEl.textContent = name;
    if (ammoEl) ammoEl.textContent = ammo === Infinity ? '\u221e' : String(ammo);
  }

  function setSpeed(mps, inCar) {
    if (!speedEl) return;
    speedEl.textContent = inCar ? Math.round(mps * 3.6) + ' km/h' : '';
  }

  function setWanted(n) {
    if (!starsEl) return;
    const max = CONFIG.wanted.max;
    let s = '';
    for (let i = 0; i < max; i++) s += i < n ? '\u2605' : '\u2606';
    starsEl.textContent = s;
    starsEl.style.color = n >= 3 ? '#ff3b30' : '#ffb020';
  }

  function setMission(name, desc) {
    if (missionEl) missionEl.textContent = name || 'Free roam';
    if (objectiveEl) objectiveEl.textContent = desc || 'Press Enter to start the next job.';
  }

  // Draw the minimap: roads as lines, player as a triangle, objective as a
  // pulsing diamond, police as red dots, traffic as pale dots.
  function drawMinimap(state) {
    if (!mapCtx || !mapCanvas) return;
    const W = mapCanvas.width;
    const H = mapCanvas.height;
    const world = CONFIG.world;
    const sx = (x) => ((x - world.minX) / (world.maxX - world.minX)) * W;
    const sz = (z) => ((z - world.minZ) / (world.maxZ - world.minZ)) * H;

    mapCtx.clearRect(0, 0, W, H);
    mapCtx.fillStyle = 'rgba(12, 18, 30, 0.82)';
    mapCtx.fillRect(0, 0, W, H);

    // Sea + beach at the bottom.
    mapCtx.fillStyle = '#0e3a5a';
    mapCtx.fillRect(0, sz(CONFIG.seaZ), W, H - sz(CONFIG.seaZ));
    mapCtx.fillStyle = '#e8c47a';
    mapCtx.fillRect(0, sz(CONFIG.beachZ0), W, sz(CONFIG.beachZ1) - sz(CONFIG.beachZ0));

    // Roads.
    mapCtx.strokeStyle = '#454a55';
    mapCtx.lineWidth = 3;
    for (const x of CONFIG.roadX) {
      mapCtx.beginPath();
      mapCtx.moveTo(sx(x), 0);
      mapCtx.lineTo(sx(x), H);
      mapCtx.stroke();
    }
    for (const z of CONFIG.roadZ) {
      mapCtx.beginPath();
      mapCtx.moveTo(0, sz(z));
      mapCtx.lineTo(W, sz(z));
      mapCtx.stroke();
    }

    // Objective beacon (pulsing diamond).
    if (state.objective) {
      const pulse = 5 + Math.sin(performance.now() / 240) * 2;
      const ox = sx(state.objective.x);
      const oy = sz(state.objective.z);
      mapCtx.fillStyle = '#ffb020';
      mapCtx.beginPath();
      mapCtx.moveTo(ox, oy - pulse);
      mapCtx.lineTo(ox + pulse, oy);
      mapCtx.lineTo(ox, oy + pulse);
      mapCtx.lineTo(ox - pulse, oy);
      mapCtx.closePath();
      mapCtx.fill();
    }

    // Police (red dots).
    if (state.police) {
      mapCtx.fillStyle = '#ff3b30';
      for (const p of state.police) {
        mapCtx.beginPath();
        mapCtx.arc(sx(p.x), sz(p.z), 3, 0, Math.PI * 2);
        mapCtx.fill();
      }
    }

    // Traffic (pale dots).
    if (state.traffic) {
      mapCtx.fillStyle = 'rgba(220, 225, 235, 0.75)';
      for (const t of state.traffic) {
        mapCtx.fillRect(sx(t.x) - 1.5, sz(t.z) - 1.5, 3, 3);
      }
    }

    // Player (triangle pointing along heading).
    if (state.player) {
      const px = sx(state.player.x);
      const py = sz(state.player.z);
      const h = state.player.heading || 0;
      const dx = Math.sin(h);
      const dz = Math.cos(h);
      mapCtx.fillStyle = state.player.inCar ? '#00e5ff' : '#ffffff';
      mapCtx.beginPath();
      mapCtx.moveTo(px + dx * 7, py + dz * 7);
      mapCtx.lineTo(px - dz * 5 - dx * 4, py + dx * 5 - dz * 4);
      mapCtx.lineTo(px + dz * 5 - dx * 4, py - dx * 5 - dz * 4);
      mapCtx.closePath();
      mapCtx.fill();
    }
  }

  return {
    showMessage, setCash, setHealth, setArmor, setWeapon, setSpeed,
    setWanted, setMission, drawMinimap,
  };
}

export default createHUD;
