// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, siren, gunshots, punches, pickups, mission stings and a quiet
// synthwave pad. Nothing here is licensed music.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let padNodes = null;
  let engineNodes = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return ctx;
  }

  function noiseBuffer(seconds = 0.3) {
    const c = ensure();
    if (!c) return null;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function blip(freq, dur, type = 'sine', vol = 0.2, slideTo = null) {
    const c = ensure();
    if (!c || muted) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, type = 'lowpass') {
    const c = ensure();
    if (!c || muted) return;
    const buf = noiseBuffer(dur);
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  return {
    unlock() {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume();
    },
    isMuted() {
      return muted;
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    shoot() {
      noise(0.12, 0.5, 1800, 'highpass');
      blip(180, 0.08, 'square', 0.18, 60);
    },
    enemyShoot() {
      noise(0.1, 0.2, 1200, 'highpass');
    },
    punch() {
      blip(90, 0.12, 'sine', 0.4, 45);
      noise(0.08, 0.25, 400);
    },
    explosion() {
      noise(0.7, 0.6, 300);
      blip(60, 0.6, 'sine', 0.5, 28);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.22);
      setTimeout(() => blip(990, 0.12, 'sine', 0.22), 90);
    },
    cash() {
      blip(880, 0.08, 'triangle', 0.2);
      setTimeout(() => blip(1174, 0.1, 'triangle', 0.2), 70);
      setTimeout(() => blip(1568, 0.14, 'triangle', 0.2), 140);
    },
    mission() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.22), i * 110));
    },
    fail() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'sawtooth', 0.14), i * 140));
    },
    click() {
      blip(1200, 0.05, 'square', 0.08);
    },
    siren(on) {
      const c = ensure();
      if (!c) return;
      if (on && !this._siren) {
        const o = c.createOscillator();
        const g = c.createGain();
        const lfo = c.createOscillator();
        const lfoGain = c.createGain();
        o.type = 'triangle';
        o.frequency.value = 800;
        lfo.type = 'square';
        lfo.frequency.value = 0.9;
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain);
        lfoGain.connect(o.frequency);
        g.gain.value = muted ? 0 : 0.05;
        o.connect(g);
        g.connect(master);
        o.start();
        lfo.start();
        this._siren = { o, lfo, g };
      } else if (!on && this._siren) {
        try {
          this._siren.o.stop();
          this._siren.lfo.stop();
        } catch { /* already stopped */ }
        this._siren = null;
      }
    },
    engine(speedNorm) {
      const c = ensure();
      if (!c) return;
      if (!engineNodes) {
        const o = c.createOscillator();
        const o2 = c.createOscillator();
        const f = c.createBiquadFilter();
        const g = c.createGain();
        o.type = 'sawtooth';
        o2.type = 'sawtooth';
        o2.detune.value = 8;
        f.type = 'lowpass';
        f.frequency.value = 500;
        g.gain.value = 0;
        o.connect(f);
        o2.connect(f);
        f.connect(g);
        g.connect(master);
        o.start();
        o2.start();
        engineNodes = { o, o2, f, g };
      }
      const t = c.currentTime;
      const freq = 55 + speedNorm * 140;
      engineNodes.o.frequency.setTargetAtTime(freq, t, 0.08);
      engineNodes.o2.frequency.setTargetAtTime(freq * 1.5, t, 0.08);
      engineNodes.f.frequency.setTargetAtTime(350 + speedNorm * 900, t, 0.1);
      engineNodes.g.gain.setTargetAtTime(muted ? 0 : 0.045 + speedNorm * 0.05, t, 0.1);
    },
    engineOff() {
      if (engineNodes) {
        const t = ctx.currentTime;
        engineNodes.g.gain.setTargetAtTime(0, t, 0.05);
      }
    },
    /** Quiet synthwave pad loop: two detuned saws through a slow filter. */
    pad(on) {
      const c = ensure();
      if (!c) return;
      if (on && !padNodes) {
        const g = c.createGain();
        g.gain.value = 0;
        g.connect(master);
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 700;
        f.connect(g);
        const oscs = [];
        for (const freq of [110, 164.8, 220, 277.2]) {
          const o = c.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = freq;
          o.detune.value = (Math.random() - 0.5) * 10;
          const og = c.createGain();
          og.gain.value = 0.16;
          o.connect(og);
          og.connect(f);
          o.start();
          oscs.push(o);
        }
        const lfo = c.createOscillator();
        const lg = c.createGain();
        lfo.frequency.value = 0.07;
        lg.gain.value = 300;
        lfo.connect(lg);
        lg.connect(f.frequency);
        lfo.start();
        g.gain.setTargetAtTime(muted ? 0 : 0.05, c.currentTime, 1);
        padNodes = { oscs, lfo, g };
      } else if (!on && padNodes) {
        padNodes.g.gain.setTargetAtTime(0, c.currentTime, 0.3);
        const nodes = padNodes;
        setTimeout(() => {
          nodes.oscs.forEach((o) => { try { o.stop(); } catch { /* noop */ } });
          try { nodes.lfo.stop(); } catch { /* noop */ }
        }, 1200);
        padNodes = null;
      }
    },
  };
}
