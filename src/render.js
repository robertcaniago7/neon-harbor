// The renderer: a camera that follows the player, the city painted in sunset neon,
// and the HUD — health, cash, wanted stars, weapon, speed, minimap and mission text.
// Everything is canvas 2D, drawn fresh every frame from the world state.

import { WORLD, ROAD, HARBOR, PALETTE, FONT, WANTED } from './config.js';
import { districtAt } from './city.js';
import { missionTitle, missionObjective, playerPos } from './world.js';
import { currentStep } from './missions.js';

/** World position the current mission step points at, or null. */
export function missionTarget(state) {
  const ms = state.mission;
  if (!ms.active) return null;
  const step = currentStep(ms);
  if (!step || step.x === undefined) return null;
  return { x: step.x, y: step.y };
}

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, car, t) {
  const m = car.model;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, -m.w / 2 + 3, -m.h / 2 + 4, m.w, m.h, 7);
  ctx.fill();
  ctx.fillStyle = car.driver === 'police' ? PALETTE.policeDark : m.color;
  roundRect(ctx, -m.w / 2, -m.h / 2, m.w, m.h, 7);
  ctx.fill();
  ctx.fillStyle = '#101826';
  roundRect(ctx, -m.w * 0.18, -m.h / 2 + 3, m.w * 0.3, m.h - 6, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(m.w / 2 - 4, -m.h / 2 + 3, 3, 5);
  ctx.fillRect(m.w / 2 - 4, m.h / 2 - 8, 3, 5);
  if (car.driver === 'police') {
    const blink = Math.floor(t * 4) % 2 === 0;
    ctx.fillStyle = blink ? '#ff3b30' : '#4fc3f7';
    ctx.fillRect(-6, -m.h / 2 - 3, 12, 5);
    ctx.fillStyle = blink ? '#4fc3f7' : '#ff3b30';
    ctx.fillRect(-6, m.h / 2 - 2, 12, 5);
  }
  if (car.smoke) {
    ctx.fillStyle = 'rgba(140,140,140,0.5)';
    ctx.beginPath();
    ctx.arc(-m.w / 2 - 6 + Math.sin(t * 7) * 3, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 1280;
  let viewH = 720;
  let camX = 0;
  let camY = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    viewW = canvas.clientWidth || window.innerWidth;
    viewH = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawCity(state, t) {
    const city = state.city;
    const x0 = camX;
    const y0 = camY;
    const x1 = camX + viewW;
    const y1 = camY + viewH;
    // Ground.
    ctx.fillStyle = '#20242e';
    ctx.fillRect(x0, y0, viewW, viewH);
    // Water and docks.
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, Math.max(y0, HARBOR.y), viewW, Math.max(0, y1 - Math.max(y0, HARBOR.y)));
    ctx.fillStyle = '#2c2118';
    ctx.fillRect(x0, Math.max(y0, HARBOR.dockY - 14), viewW, 14);
    // Parks.
    for (const park of city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillStyle = PALETTE.grass;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = '#2f7a4d';
      for (let i = 0; i < park.trees; i += 1) {
        const tx = park.x + 20 + ((i * 67) % Math.max(20, park.w - 40));
        const ty = park.y + 20 + ((i * 41) % Math.max(20, park.h - 40));
        ctx.beginPath();
        ctx.arc(tx, ty, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const rx of city.roadsX) ctx.fillRect(rx - ROAD.width / 2, y0, ROAD.width, viewH);
    for (const ry of city.roadsY) ctx.fillRect(x0, ry - ROAD.width / 2, viewW, ROAD.width);
    // Sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of city.roadsX) {
      ctx.fillRect(rx - ROAD.width / 2 - ROAD.sidewalk, y0, ROAD.sidewalk, viewH);
      ctx.fillRect(rx + ROAD.width / 2, y0, ROAD.sidewalk, viewH);
    }
    for (const ry of city.roadsY) {
      ctx.fillRect(x0, ry - ROAD.width / 2 - ROAD.sidewalk, viewW, ROAD.sidewalk);
      ctx.fillRect(x0, ry + ROAD.width / 2, viewW, ROAD.sidewalk);
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of city.roadsX) {
      for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) ctx.fillRect(rx - 2, y, 4, 22);
    }
    for (const ry of city.roadsY) {
      for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) ctx.fillRect(x, ry - 2, 22, 4);
    }
    // Buildings with neon signs.
    for (const b of city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (let wy = b.y + 10; wy < b.y + b.h - 8; wy += 18) {
        for (let wx = b.x + 8; wx < b.x + b.w - 10; wx += 16) {
          if (((wx * 7 + wy * 13) % 5) < 2) ctx.fillRect(wx, wy, 8, 10);
        }
      }
      if (b.sign) {
        ctx.fillStyle = b.accent;
        ctx.font = `bold ${Math.max(11, Math.min(16, b.w / 5))}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(b.signText, b.x + b.w / 2, b.y + 16);
      }
    }
  }

  function drawPickups(state) {
    for (const pk of state.combat.pickups) {
      const bob = Math.sin(state.time * 3 + pk.bob) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      if (pk.kind === 'health') {
        ctx.fillStyle = '#e8f5e9';
        ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = PALETTE.health;
        ctx.fillRect(-2, -7, 4, 14);
        ctx.fillRect(-7, -2, 14, 4);
      } else if (pk.kind === 'armor') {
        ctx.fillStyle = PALETTE.armor;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(9, -5);
        ctx.lineTo(9, 3);
        ctx.lineTo(0, 10);
        ctx.lineTo(-9, 3);
        ctx.lineTo(-9, -5);
        ctx.closePath();
        ctx.fill();
      } else if (pk.kind === 'pistol' || pk.kind === 'ammo') {
        ctx.fillStyle = '#2b2b2b';
        ctx.fillRect(-10, -4, 20, 9);
        ctx.fillStyle = PALETTE.cash;
        ctx.fillRect(-10, -4, 20, 3);
      } else {
        ctx.fillStyle = PALETTE.cash;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a1a1a';
        ctx.font = `bold 11px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 1);
      }
      ctx.restore();
    }
  }

  function drawEntities(state, t) {
    for (const ped of state.peds) {
      if (ped.dead) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(ped.x + 2, ped.y + 3, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const e of state.enemies) {
      if (e.dead) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(e.x + 2, e.y + 3, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.enemy;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(e.x + Math.cos(e.angle) * 8 - 2, e.y + Math.sin(e.angle) * 8 - 2, 10, 4);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(e.x - 12, e.y - 20, 24, 4);
      ctx.fillStyle = PALETTE.enemy;
      ctx.fillRect(e.x - 12, e.y - 20, 24 * Math.max(0, e.health / 60), 4);
    }
    for (const o of state.officers) {
      ctx.fillStyle = PALETTE.police;
      ctx.beginPath();
      ctx.arc(o.x, o.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#101826';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) {
      if (car.dead) {
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);
        ctx.fillStyle = '#1c1c1c';
        roundRect(ctx, -car.model.w / 2, -car.model.h / 2, car.model.w, car.model.h, 7);
        ctx.fill();
        ctx.restore();
        continue;
      }
      drawCarShape(ctx, car, t);
    }
    const p = state.player;
    if (!p.dead) {
      if (p.inCar) {
        // The player's car is drawn with the rest; add a marker ring.
        ctx.strokeStyle = PALETTE.neonCyan;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.inCar.x, p.inCar.y, 34 + Math.sin(t * 4) * 3, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(p.x + 2, p.y + 3, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#37e0d8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#12333a';
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(p.angle) * 6, p.y + Math.sin(p.angle) * 6, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Tracers and bullets.
    for (const tr of state.combat.tracers) {
      ctx.strokeStyle = 'rgba(255, 215, 106, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tr.x, tr.y);
      ctx.lineTo(tr.x + Math.cos(tr.angle) * tr.len, tr.y + Math.sin(tr.angle) * tr.len);
      ctx.stroke();
    }
    for (const boom of state.combat.booms) {
      const k = boom.life / boom.max;
      ctx.fillStyle = `rgba(255, ${Math.floor(120 + 120 * k)}, 60, ${0.7 * k})`;
      ctx.beginPath();
      ctx.arc(boom.x, boom.y, boom.radius * (1.2 - k * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawObjectiveArrow(state) {
    const target = missionTarget(state);
    if (!target) return;
    const pos = playerPos(state);
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 200) {
      // On screen already: a pulsing diamond over the spot.
      ctx.save();
      ctx.translate(target.x - camX, target.y - camY);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.neonYellow;
      const s = 10 + Math.sin(state.time * 5) * 2;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      return;
    }
    // Off screen: an arrow pinned to the viewport edge, pointing the way.
    const angle = Math.atan2(dy, dx);
    const ax = viewW / 2 + Math.cos(angle) * (Math.min(viewW, viewH) / 2 - 60);
    const ay = viewH / 2 + Math.sin(angle) * (Math.min(viewW, viewH) / 2 - 60);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    ctx.fillStyle = PALETTE.neonYellow;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.neonYellow;
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(dist)}m`, ax, ay + 26);
  }

  function drawMinimap(state) {
    const mw = 220;
    const mh = 165;
    const mx = viewW - mw - 16;
    const my = 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = '#20242e';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(mx, my + HARBOR.y * sy, mw, mh - HARBOR.y * sy);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    for (const rx of state.city.roadsX) {
      ctx.beginPath();
      ctx.moveTo(mx + rx * sx, my);
      ctx.lineTo(mx + rx * sx, my + mh);
      ctx.stroke();
    }
    for (const ry of state.city.roadsY) {
      ctx.beginPath();
      ctx.moveTo(mx, my + ry * sy);
      ctx.lineTo(mx + mw, my + ry * sy);
      ctx.stroke();
    }
    // Mission marker.
    const target = missionTarget(state);
    if (target) {
      ctx.fillStyle = PALETTE.neonYellow;
      ctx.beginPath();
      ctx.arc(mx + target.x * sx, my + target.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const pos = playerPos(state);
    ctx.fillStyle = '#37e0d8';
    ctx.beginPath();
    ctx.arc(mx + pos.x * sx, my + pos.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    for (const car of state.cars) {
      if (car.driver === 'police') {
        ctx.fillStyle = PALETTE.police;
        ctx.beginPath();
        ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const d = districtAt(pos.x, pos.y);
    ctx.fillText(d.name.toUpperCase(), mx, my + mh + 18);
  }

  function drawHUD(state) {
    const p = state.player;
    ctx.textBaseline = 'alphabetic';
    // Top-left: cash, health, armor, weapon.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 12, 12, 250, 96, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.cash;
    ctx.font = `bold 26px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`$${p.cash}`, 26, 44);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText('CASH', 26, 62);
    ctx.fillStyle = '#222';
    ctx.fillRect(26, 70, 110, 8);
    ctx.fillStyle = PALETTE.health;
    ctx.fillRect(26, 70, 110 * Math.max(0, p.health / 100), 8);
    ctx.fillStyle = '#222';
    ctx.fillRect(26, 84, 110, 8);
    ctx.fillStyle = PALETTE.armor;
    ctx.fillRect(26, 84, 110 * Math.max(0, p.armor / 50), 8);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 14px ${FONT}`;
    const wname = p.weapon === 'pistol' ? `HK-9 PISTOL · ${p.ammo}` : 'FISTS';
    ctx.fillText(wname, 150, 76);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(p.inCar ? `${p.inCar.model.name}` : 'ON FOOT', 150, 94);
    if (p.inCar) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.36)} km/h`, 26, 128);
    }
    // Wanted stars, top centre.
    ctx.textAlign = 'center';
    for (let i = 0; i < WANTED.max; i += 1) {
      ctx.fillStyle = i < state.wanted ? '#ffd76a' : 'rgba(255,255,255,0.18)';
      ctx.font = '28px sans-serif';
      ctx.fillText('★', viewW / 2 - 60 + i * 30, 44);
    }
    // Mission objective, under the stars.
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(missionTitle(state), viewW / 2, 72);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(missionObjective(state), viewW / 2, 92);
    // Mission banner.
    if (state.mission.bannerTime > 0 && state.mission.banner) {
      ctx.fillStyle = PALETTE.panel;
      const bw = Math.min(viewW - 80, 720);
      roundRect(ctx, (viewW - bw) / 2, viewH - 150, bw, 64, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.neonYellow;
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillText('MADAME KESTREL', viewW / 2, viewH - 124);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `14px ${FONT}`;
      ctx.fillText(state.mission.banner, viewW / 2, viewH - 102);
    }
    // Controls hint, bottom left.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(244,241,234,0.55)';
    ctx.font = `12px ${FONT}`;
    ctx.fillText('WASD move/drive · F enter car · Click shoot · E punch · Enter mission · P pause · M mute', 16, viewH - 14);
    drawMinimap(state);
  }

  function drawScreen(state, screen, best, t) {
    resize();
    const pos = playerPos(state);
    camX = Math.max(0, Math.min(WORLD.width - viewW, pos.x - viewW / 2));
    camY = Math.max(0, Math.min(WORLD.height - viewH, pos.y - viewH / 2));
    ctx.save();
    ctx.translate(-camX, -camY);
    drawCity(state, t);
    drawPickups(state);
    drawEntities(state, t);
    ctx.restore();
    drawObjectiveArrow(state);
    // Sunset vignette.
    const grad = ctx.createLinearGradient(0, 0, 0, viewH);
    grad.addColorStop(0, 'rgba(255, 94, 120, 0.06)');
    grad.addColorStop(1, 'rgba(20, 10, 50, 0.16)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
    if (state.player.hurtFlash > 0) {
      ctx.fillStyle = `rgba(229, 83, 75, ${state.player.hurtFlash * 0.5})`;
      ctx.fillRect(0, 0, viewW, viewH);
    }
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHUD(state);
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(10, 8, 24, 0.72)';
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.neonPink;
      ctx.font = `bold ${Math.min(84, viewW / 12)}px ${FONT}`;
      ctx.fillText('NEON HARBOR', viewW / 2, viewH / 2 - 90);
      ctx.fillStyle = PALETTE.neonCyan;
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillText('AN OPEN-WORLD CRIME STORY', viewW / 2, viewH / 2 - 54);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `16px ${FONT}`;
      ctx.fillText('Juno Voss drives for Madame Kestrel. The Rust Vultures want the harbour.', viewW / 2, viewH / 2 - 16);
      ctx.fillText('Six missions. One city. Steal cars, lose the cops, get paid.', viewW / 2, viewH / 2 + 10);
      ctx.fillStyle = PALETTE.neonYellow;
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillText('PRESS SPACE OR CLICK TO START', viewW / 2, viewH / 2 + 64);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `14px ${FONT}`;
      ctx.fillText('WASD move / drive · F enter car · Mouse aim, click shoot · E punch · Enter start mission · P pause', viewW / 2, viewH / 2 + 96);
      if (best > 0) {
        ctx.fillText(`Best cash held: $${best}`, viewW / 2, viewH / 2 + 122);
      }
      ctx.fillText('A fully original game — no Rockstar content, no GTA assets.', viewW / 2, viewH / 2 + 150);
    }
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(10, 8, 24, 0.66)';
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 48px ${FONT}`;
      ctx.fillText('PAUSED', viewW / 2, viewH / 2 - 10);
      ctx.font = `16px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('Press P or Space to keep playing', viewW / 2, viewH / 2 + 24);
    }
    if (screen === SCREEN_OVER) {
      ctx.fillStyle = 'rgba(10, 8, 24, 0.78)';
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.textAlign = 'center';
      ctx.fillStyle = state.over === 'busted' ? PALETTE.police : PALETTE.enemy;
      ctx.font = `bold 64px ${FONT}`;
      ctx.fillText(state.over === 'busted' ? 'BUSTED' : 'WASTED', viewW / 2, viewH / 2 - 20);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `18px ${FONT}`;
      ctx.fillText(
        state.over === 'busted'
          ? 'Harbor PD caught up with you. The bail ate your cash.'
          : 'Juno went down in Neon Harbor. The city keeps moving.',
        viewW / 2, viewH / 2 + 16,
      );
      ctx.fillStyle = PALETTE.cash;
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillText(`Cash earned: $${state.cashEarned} · Missions done: ${state.mission.index} / 6`, viewW / 2, viewH / 2 + 52);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `16px ${FONT}`;
      ctx.fillText('Press Space to try again', viewW / 2, viewH / 2 + 88);
    }
  }

  return { draw: drawScreen, resize, getCamera: () => ({ x: camX, y: camY }) };
}
