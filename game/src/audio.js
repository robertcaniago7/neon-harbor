// Synthesized sound: every effect and the music loop are built with WebAudio oscillators
// and filtered noise, so the game ships no audio files at all.

const MUSIC_NOTES = [110, 130.81, 164.81, 196, 164.81, 130.81, 98, 123.47];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicTimer = 0;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.12;
      musicGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      noise(0.12, 0.5, 2400);
      tone(180, 0.09, 'square', 0.25, 60);
    },
    punch() {
      noise(0.08, 0.35, 900);
    },
    crash() {
      noise(0.35, 0.6, 500);
      tone(90, 0.3, 'sine', 0.4, 40);
    },
    explosion() {
      noise(0.8, 0.8, 300);
      tone(60, 0.7, 'sine', 0.6, 25);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.3);
      tone(990, 0.12, 'sine', 0.3);
    },
    cash() {
      tone(880, 0.08, 'triangle', 0.3);
      tone(1174, 0.08, 'triangle', 0.3);
      tone(1568, 0.16, 'triangle', 0.3);
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => {
        setTimeout(() => tone(f, 0.22, 'triangle', 0.32), i * 110);
      });
    },
    missionStart() {
      tone(392, 0.15, 'triangle', 0.3);
      tone(523, 0.25, 'triangle', 0.3);
    },
    wantedUp() {
      tone(220, 0.18, 'sawtooth', 0.25, 440);
    },
    busted() {
      tone(440, 0.5, 'sawtooth', 0.3, 110);
    },
    engine(speed01, on) {
      if (!ensure()) return;
      const target = on && !muted ? 0.05 + speed01 * 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(45 + speed01 * 130, ctx.currentTime, 0.1);
    },
    siren(on) {
      if (!ensure()) return;
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.045 : 0, ctx.currentTime, 0.2);
      if (on) {
        const now = ctx.currentTime;
        sirenOsc.frequency.cancelScheduledValues(now);
        sirenOsc.frequency.setValueAtTime(700, now);
        sirenOsc.frequency.linearRampToValueAtTime(950, now + 0.4);
        sirenOsc.frequency.linearRampToValueAtTime(700, now + 0.8);
      }
    },
    /** A slow synthwave pad: one bass note per bar, stepped by the caller each frame. */
    music(dt) {
      if (!ensure() || muted) return;
      musicTimer += dt;
      if (musicTimer < 0.55) return;
      musicTimer = 0;
      const f = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
      musicStep += 1;
      tone(f, 0.5, 'sawtooth', 0.05);
      tone(f * 2, 0.4, 'triangle', 0.04);
    },
  };
}
