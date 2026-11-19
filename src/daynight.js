// Day/night cycle: one directional sun (+ shadow), hemisphere light, and a
// night factor that drives sky/fog colour, neon glow and streetlight lamps.

import * as THREE from 'three';
import { DAY_LENGTH, PALETTE } from './config.js';

const DAY_SKY = new THREE.Color(PALETTE.daySky);
const DUSK_SKY = new THREE.Color(PALETTE.duskSky);
const NIGHT_SKY = new THREE.Color(PALETTE.nightSky);
const DAY_FOG = new THREE.Color(PALETTE.dayFog);
const NIGHT_FOG = new THREE.Color(PALETTE.nightFog);
const DAY_SEA = new THREE.Color(PALETTE.seaDay);
const NIGHT_SEA = new THREE.Color(PALETTE.seaNight);

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function createDayNight(scene, quality) {
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
  sun.castShadow = true;
  const shadowSize = quality.shadows;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  scene.fog = new THREE.Fog(PALETTE.dayFog, 60, quality.fogFar);
  scene.background = new THREE.Color(PALETTE.daySky);

  return {
    sun, hemi,
    /** t in [0,1): 0 midnight, 0.25 dawn, 0.5 noon, 0.75 dusk. Returns night factor 0..1. */
    update(t, focus) {
      const ang = (t - 0.25) * Math.PI * 2; // 0 at dawn, PI at dusk
      const elev = Math.sin(ang); // -1 night .. 1 noon
      const dayFactor = smoothstep(-0.08, 0.25, elev);
      const duskFactor = Math.exp(-Math.pow((Math.abs(elev) - 0.12) * 6, 2));
      const nightFactor = 1 - dayFactor;

      // sun position orbits; at night it becomes a dim moon from the opposite side
      const az = ang;
      const dist = 260;
      if (elev >= 0) {
        sun.position.set(Math.cos(az) * dist, Math.max(20, elev * 220), Math.sin(az) * dist * 0.6);
        sun.color.setHex(0xfff1d6).lerp(new THREE.Color(0xff8a4d), duskFactor * 0.8);
        sun.intensity = 0.6 + 1.8 * dayFactor;
      } else {
        sun.position.set(-Math.cos(az) * dist, Math.max(30, -elev * 160), -Math.sin(az) * dist * 0.6);
        sun.color.setHex(0x8fa8ff);
        sun.intensity = 0.55;
      }
      sun.target.position.copy(focus);
      sun.position.add(focus);
      sun.target.updateMatrixWorld();

      hemi.intensity = 0.4 + 0.6 * dayFactor;
      hemi.color.setHex(0xbfd9ff).lerp(new THREE.Color(0x2a3560), nightFactor * 0.8);
      hemi.groundColor.setHex(0x8a7a5a).lerp(new THREE.Color(0x1a1a2a), nightFactor);

      const sky = new THREE.Color(DAY_SKY).lerp(NIGHT_SKY, nightFactor);
      sky.lerp(DUSK_SKY, duskFactor * 0.7);
      scene.background.copy(sky);
      const fog = new THREE.Color(DAY_FOG).lerp(NIGHT_FOG, nightFactor);
      fog.lerp(DUSK_SKY, duskFactor * 0.4);
      scene.fog.color.copy(fog);
      return { nightFactor, dayFactor, duskFactor };
    },
    setSeaColor(seaMat, nightFactor) {
      seaMat.color.copy(DAY_SEA).lerp(NIGHT_SEA, nightFactor);
    },
  };
}
