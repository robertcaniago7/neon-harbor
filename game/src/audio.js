// Neon Harbor 3D — audio.js
// All sound is synthesized with WebAudio. No audio files, no licensed music.
// Engine hum, gunshots, punches, sirens, UI clicks and a soft city ambient.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let ambientNodes = null;

  function ensure() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
    }
  }

  function resume() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.5;
  }

  function blip(freq, dur, type = 'sine', vol = 0.3, slideTo = null) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.4, filterFreq = 1200) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(t);
  }

  function gunshot() {
    noise(0.14, 0.5, 2500);
    blip(160, 0.08, 'square', 0.25, 60);
  }

  function punch() {
    noise(0.08, 0.35, 700);
  }

  function siren() {
    blip(700, 0.5, 'sine', 0.12, 1100);
    setTimeout(() => blip(1100, 0.5, 'sine', 0.12, 700), 500);
  }

  function uiClick() {
    blip(880, 0.06, 'sine', 0.2);
  }

  function cashSound() {
    blip(1320, 0.08, 'sine', 0.2);
    setTimeout(() => blip(1760, 0.12, 'sine', 0.2), 90);
  }

  function engineStart() {
    ensure();
    if (!ctx || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 400;
    engineOsc.connect(filt);
    filt.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function engineSet(rpm, on) {
    if (!engineOsc || !engineGain) return;
    const target = on ? 0.05 + rpm * 0.1 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(50 + rpm * 90, ctx.currentTime, 0.1);
  }

  function engineStop() {
    if (engineOsc) {
      try { engineOsc.stop(); } catch (e) { /* already stopped */ }
      engineOsc = null;
      engineGain = null;
    }
  }

  function startAmbient() {
    ensure();
    if (!ctx || ambientNodes) return;
    // soft filtered noise = city wind + distant traffic
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start();
    ambientNodes = { src, g };
  }

  return {
    resume, setMuted, gunshot, punch, siren, uiClick, cashSound,
    engineStart, engineSet, engineStop, startAmbient,
    get muted() { return muted; },
  };
}
