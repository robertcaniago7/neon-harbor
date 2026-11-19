// HUD: DOM overlay (stars, cash, health, objective, prompt, speed) + a 2D-canvas
// minimap drawn from the road graph. Updated every frame; minimap at 10 Hz.

import { WANTED } from './config.js';

export function createHud(city) {
  const el = (id) => document.getElementById(id);
  const starsEl = el('stars');
  const objectiveEl = el('objective');
  const cashEl = el('cash');
  const healthFill = el('health-fill');
  const armorFill = el('armor-fill');
  const weaponEl = el('weapon');
  const speedEl = el('speed');
  const promptEl = el('prompt');
  const toastEl = el('toast');
  const crosshairEl = el('crosshair');
  const minimap = el('minimap');
  const mctx = minimap ? minimap.getContext('2d') : null;

  let toastTimer = 0;
  let mapTimer = 0;

  function drawMinimap(ctx) {
    if (!mctx) return;
    const S = minimap.width;
    const scale = S / 500;
    const ox = S / 2;
    const oz = S / 2;
    const X = (x) => ox + x * scale;
    const Z = (z) => oz + z * scale;
    mctx.clearRect(0, 0, S, S);
    // sea (south)
    mctx.fillStyle = '#0e5a6e';
    mctx.fillRect(0, Z(205), S, S - Z(205));
    // land
    mctx.fillStyle = '#20242c';
    mctx.fillRect(0, 0, S, Z(205));
    // roads
    mctx.strokeStyle = '#5a6068';
    mctx.lineWidth = 3;
    for (const e of city.roadGraph.edges) {
      mctx.beginPath();
      mctx.moveTo(X(e.ax), Z(e.az));
      mctx.lineTo(X(e.bx), Z(e.bz));
      mctx.stroke();
    }
    // search circle while wanted
    if (ctx.police.wanted > 0) {
      mctx.strokeStyle = 'rgba(255,60,60,0.7)';
      mctx.lineWidth = 1.5;
      mctx.beginPath();
      mctx.arc(X(ctx.player.pos.x), Z(ctx.player.pos.z), 70 * scale, 0, Math.PI * 2);
      mctx.stroke();
    }
    // waypoint
    const wp = ctx.missions.waypoint;
    if (wp) {
      mctx.fillStyle = '#ffd23f';
      const x = X(wp.x);
      const z = Z(wp.z);
      mctx.beginPath();
      mctx.moveTo(x, z - 6);
      mctx.lineTo(x + 6, z);
      mctx.lineTo(x, z + 6);
      mctx.lineTo(x - 6, z);
      mctx.closePath();
      mctx.fill();
    }
    // police dots
    for (const car of ctx.police.cars) {
      mctx.fillStyle = Math.floor(performance.now() / 300) % 2 ? '#ff4444' : '#4488ff';
      mctx.beginPath();
      mctx.arc(X(car.mesh.position.x), Z(car.mesh.position.z), 3.5, 0, Math.PI * 2);
      mctx.fill();
    }
    // player triangle (rotated to heading)
    const px = X(ctx.player.pos.x);
    const pz = Z(ctx.player.pos.z);
    const h = ctx.player.heading;
    mctx.save();
    mctx.translate(px, pz);
    mctx.rotate(Math.atan2(Math.sin(h), Math.cos(h)) + Math.PI);
    mctx.fillStyle = '#ffffff';
    mctx.strokeStyle = '#000000';
    mctx.lineWidth = 1;
    mctx.beginPath();
    mctx.moveTo(0, -6);
    mctx.lineTo(4.5, 5);
    mctx.lineTo(-4.5, 5);
    mctx.closePath();
    mctx.fill();
    mctx.stroke();
    mctx.restore();
  }

  return {
    toast(text) {
      if (!toastEl) return;
      toastEl.textContent = text;
      toastEl.style.opacity = '1';
      toastTimer = 3;
    },
    update(ctx, dt) {
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0 && toastEl) toastEl.style.opacity = '0';
      }
      // stars
      if (starsEl) {
        let s = '';
        for (let i = 1; i <= WANTED.max; i++) s += i <= ctx.police.wanted ? '★' : '☆';
        starsEl.textContent = s;
        starsEl.classList.toggle('cooling', ctx.police.losTimer > 0 && ctx.police.wanted > 0);
        const known = [];
        if (ctx.police.knownCar) known.push('CAR KNOWN');
        if (ctx.police.knownOutfit) known.push('OUTFIT KNOWN');
        starsEl.title = known.join(' · ') || 'Clean';
      }
      if (objectiveEl) objectiveEl.textContent = ctx.objectiveText();
      if (cashEl) cashEl.textContent = '$' + Math.floor(ctx.player.cash);
      if (healthFill) healthFill.style.width = Math.max(0, ctx.player.health) + '%';
      if (armorFill) armorFill.style.width = Math.max(0, ctx.player.armor) + '%';
      if (weaponEl) {
        const w = ctx.player.weapon === 'pistol' ? `HK-9 · ${ctx.player.ammo}` : 'Fists';
        weaponEl.textContent = w;
      }
      if (speedEl) {
        speedEl.textContent = ctx.playerCar
          ? Math.round(Math.abs(ctx.playerCar.state.speed) * 3.6) + ' km/h'
          : '';
      }
      if (promptEl) promptEl.textContent = ctx.promptText || '';
      if (crosshairEl) {
        crosshairEl.style.display = ctx.player.weapon === 'pistol' && !ctx.playerCar ? 'block' : 'none';
      }
      mapTimer -= dt;
      if (mapTimer <= 0) {
        mapTimer = 0.1;
        drawMinimap(ctx);
      }
    },
  };
}
