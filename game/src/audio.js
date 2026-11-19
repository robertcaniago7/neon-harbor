// Neon Harbor 3D — WebAudio synth: engine hum, gunshots, punches, sirens, UI,
// ambient. No audio files, no licensed music. The context is created lazily on
// the first user gesture so the page loads silently.

/** Create the audio engine. All methods are safe to call before any gesture. */
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenTimer: 0,
    sirenOsc: null,
    sirenGain: null,
  };

  audio.ensure = () => {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = audio.muted ? 0 : 0.5;
      audio.master.connect(audio.ctx.destination);
      return true;
    } catch (err) {
      console.warn('audio unavailable', err);
      return false;
    }
  };

  audio.setMuted = (m) => {
    audio.muted = m;
    if (audio.master) audio.master.gain.value = m ? 0 : 0.5;
  };

  const blip = (freq, dur, type, vol, slideTo) => {
    if (!audio.ensure() || !audio.ctx) return;
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  const noise = (dur, vol, lowpass) => {
    if (!audio.ensure() || !audio.ctx) return;
    const t = audio.ctx.currentTime;
    const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = src;
    if (lowpass) {
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      src.connect(filter);
      node = filter;
    }
    node.connect(gain);
    gain.connect(audio.master);
    src.start(t);
  };

  audio.playShot = (distant) => {
    noise(0.12, distant ? 0.12 : 0.4, 3000);
    blip(distant ? 300 : 900, 0.08, 'square', distant ? 0.05 : 0.14, 120);
  };
  audio.playEmpty = () => blip(1400, 0.05, 'square', 0.1);
  audio.playPunch = () => {
    noise(0.09, 0.3, 900);
    blip(160, 0.09, 'sine', 0.25, 70);
  };
  audio.playHit = () => {
    noise(0.15, 0.3, 700);
    blip(110, 0.15, 'sawtooth', 0.15, 60);
  };
  audio.playPickup = () => {
    blip(660, 0.09, 'sine', 0.18);
    setTimeout(() => blip(990, 0.12, 'sine', 0.18), 70);
  };
  audio.playMission = () => {
    blip(523, 0.12, 'triangle', 0.2);
    setTimeout(() => blip(784, 0.16, 'triangle', 0.2), 110);
  };
  audio.playReward = () => {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.14, 'triangle', 0.2), i * 90));
  };
  audio.playUi = () => blip(880, 0.06, 'sine', 0.12);
  audio.playCar = () => {
    noise(0.25, 0.2, 1200);
    blip(220, 0.18, 'sawtooth', 0.1, 440);
  };

  /** Two-tone police siren, called every frame while wanted > 0. */
  audio.siren = (dt) => {
    audio.sirenTimer -= dt;
    if (audio.sirenTimer > 0) return;
    audio.sirenTimer = 0.55;
    if (!audio.ensure() || !audio.ctx) return;
    const high = audio.sirenOsc !== null && audio.sirenOsc;
    blip(high ? 660 : 880, 0.5, 'sine', 0.05);
    audio.sirenOsc = !high;
  };

  /** Engine hum that follows the car's speed (0..1). Call every frame. */
  audio.engine = (speed01, inCar) => {
    if (!inCar) {
      if (audio.engineOsc) {
        try { audio.engineOsc.stop(); } catch (e) { /* already stopped */ }
        audio.engineOsc = null;
        audio.engineGain = null;
      }
      return;
    }
    if (!audio.ensure() || !audio.ctx) return;
    if (!audio.engineOsc) {
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 70;
      gain.gain.value = 0.03;
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start();
      audio.engineOsc = osc;
      audio.engineGain = gain;
    }
    audio.engineOsc.frequency.value = 60 + speed01 * 160;
    audio.engineGain.gain.value = 0.02 + speed01 * 0.05;
  };

  /** Stop the engine hum (leaving a car). */
  audio.engineStop = () => {
    if (audio.engineOsc) {
      try { audio.engineOsc.stop(); } catch (e) { /* already stopped */ }
      audio.engineOsc = null;
      audio.engineGain = null;
    }
  };

  return audio;
}
