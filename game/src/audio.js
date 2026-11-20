// WebAudio synth: every sound is generated, no audio files, no licensed music.
// Engine hum, gunshots, punches, sirens, UI clicks and a soft ambient pad.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let ambientNodes = null;

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

  // Short blip/tone helper.
  function tone(freq, dur, type, vol, slideTo = null, delay = 0) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  // Noise burst helper (gunshots, punches, impacts).
  function noise(dur, vol, filterFreq, delay = 0, type = 'lowpass') {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 0.5;
    if (muted) stopEngine();
  }

  function isMuted() {
    return muted;
  }

  // ---- named sounds -------------------------------------------------
  function gunshot() {
    noise(0.14, 0.5, 1800);
    tone(160, 0.1, 'square', 0.25, 60);
  }

  function punch() {
    noise(0.09, 0.4, 500);
    tone(110, 0.08, 'sine', 0.3, 55);
  }

  function hit() {
    tone(220, 0.12, 'sawtooth', 0.2, 90);
  }

  function sirenBlip() {
    tone(880, 0.16, 'sine', 0.14, 1170);
    tone(1170, 0.16, 'sine', 0.14, 880, 0.16);
  }

  function uiClick() {
    tone(660, 0.06, 'sine', 0.2);
  }

  function missionDone() {
    tone(523, 0.14, 'sine', 0.25);
    tone(659, 0.14, 'sine', 0.25, null, 0.12);
    tone(784, 0.22, 'sine', 0.28, null, 0.24);
  }

  function cashSound() {
    tone(1320, 0.07, 'sine', 0.18);
    tone(1760, 0.1, 'sine', 0.18, null, 0.07);
  }

  function crash() {
    noise(0.35, 0.55, 300);
    tone(90, 0.3, 'sine', 0.35, 40);
  }

  function horn() {
    tone(370, 0.18, 'square', 0.12);
    tone(466, 0.18, 'square', 0.1);
  }

  // ---- engine loop --------------------------------------------------
  function startEngine() {
    if (!ensure() || muted || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function setEngine(speed01, on) {
    if (!engineOsc) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(on && !muted ? 0.05 + 0.09 * speed01 : 0, t, 0.1);
    engineOsc.frequency.setTargetAtTime(50 + 130 * speed01, t, 0.08);
  }

  function stopEngine() {
    if (!engineOsc) return;
    try { engineOsc.stop(); } catch (e) { /* already stopped */ }
    engineOsc = null;
    engineGain = null;
  }

  // ---- ambient pad --------------------------------------------------
  function startAmbient() {
    if (!ensure() || muted || ambientNodes) return;
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = 110;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 164.8;
    const g = ctx.createGain();
    g.gain.value = 0.035;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    o1.connect(g);
    o2.connect(g);
    g.connect(master);
    o1.start();
    o2.start();
    lfo.start();
    ambientNodes = { o1, o2, lfo, g };
  }

  function stopAmbient() {
    if (!ambientNodes) return;
    try {
      ambientNodes.o1.stop();
      ambientNodes.o2.stop();
      ambientNodes.lfo.stop();
    } catch (e) { /* already stopped */ }
    ambientNodes = null;
  }

  return {
    resume, setMuted, isMuted,
    gunshot, punch, hit, sirenBlip, uiClick, missionDone, cashSound, crash, horn,
    startEngine, setEngine, stopEngine, startAmbient, stopAmbient,
  };
}

export default createAudio;
