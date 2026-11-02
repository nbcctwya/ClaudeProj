// =============================================================
//  audio.js —— WebAudio 合成音效与小曲（无外部音频文件）
// =============================================================
'use strict';

const AU = {
  c: null, master: null, musicGain: null, noiseBuf: null,
  muted: false, nextT: 0, step: 0, timer: null, bpm: 150, playing: false,

  init() {
    if (this.c) { if (this.c.state === 'suspended') this.c.resume(); return; }
    try {
      this.c = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.c.destination);
      this.musicGain = this.c.createGain();
      this.musicGain.gain.value = 0.2;
      this.musicGain.connect(this.master);
      const len = this.c.sampleRate;
      this.noiseBuf = this.c.createBuffer(1, len, this.c.sampleRate);
      const ch = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    } catch (e) { this.c = null; }
  },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.c.currentTime, 0.05);
  },

  tone(f, d, type = 'square', v = 0.1, f2 = null, delay = 0, dest = null) {
    if (!this.c) return;
    const t = this.c.currentTime + delay;
    const o = this.c.createOscillator(), g = this.c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + d + 0.03);
  },

  noise(d, v = 0.3, freq = 1200, delay = 0) {
    if (!this.c) return;
    const t = this.c.currentTime + delay;
    const s = this.c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.15), t + d);
    const g = this.c.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + d + 0.03);
  },

  // ---------- 背景小曲：欢快的五声音阶 ----------
  MEL: [72, 0, 76, 79, 81, 0, 79, 76, 74, 0, 76, 0, 72, 0, 69, 0,
        72, 0, 76, 79, 84, 0, 81, 79, 76, 0, 74, 76, 72, 0, 0, 0],
  BOSS_MEL: [69, 0, 72, 69, 76, 0, 74, 72, 71, 0, 69, 0, 68, 0, 71, 0,
             69, 0, 72, 76, 81, 0, 79, 76, 77, 0, 76, 74, 76, 0, 0, 0],
  BASS: [48, 45, 41, 43],
  BOSS_BASS: [45, 41, 43, 40],
  boss: false,

  mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  startMusic() {
    if (!this.c || this.playing) return;
    this.playing = true;
    this.nextT = this.c.currentTime + 0.1;
    this.step = 0;
    this.timer = setInterval(() => this.schedule(), 40);
  },
  stopMusic() {
    this.playing = false;
    clearInterval(this.timer); this.timer = null;
  },
  schedule() {
    if (!this.c) return;
    const stepDur = 60 / (this.boss ? 172 : this.bpm) / 2;
    while (this.nextT < this.c.currentTime + 0.15) {
      const i = this.step % 32;
      const mel = this.boss ? this.BOSS_MEL : this.MEL;
      const bass = this.boss ? this.BOSS_BASS : this.BASS;
      const delay = Math.max(0, this.nextT - this.c.currentTime);
      const n = mel[i];
      if (n) this.tone(this.mtof(n), stepDur * 1.6, 'square', 0.09, null, delay, this.musicGain);
      const root = bass[Math.floor(i / 8) % 4];
      if (i % 2 === 0) this.tone(this.mtof(root + (i % 4 === 2 ? 12 : 0)), stepDur * 1.8, 'triangle', 0.3, null, delay, this.musicGain);
      if (i % 4 === 0) this.noiseKick(delay);
      if (i % 4 === 2) this.hat(delay);
      this.nextT += stepDur;
      this.step++;
    }
  },
  noiseKick(delay) { this.tone(140, 0.12, 'sine', 0.5, 45, delay, this.musicGain); },
  hat(delay) {
    if (!this.c) return;
    const t = this.c.currentTime + delay;
    const s = this.c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = this.c.createGain();
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(this.musicGain);
    s.start(t, Math.random() * 0.5); s.stop(t + 0.06);
  },
};

const _sfxLast = {};
function sfx(name) {
  if (!AU.c || AU.muted) return;
  const now = performance.now();
  const gap = { shoot: 120, hit: 45, boom: 70, bubble: 120, pop: 50, eshot: 90 }[name] || 0;
  if (_sfxLast[name] && now - _sfxLast[name] < gap) return;
  _sfxLast[name] = now;
  switch (name) {
    case 'shoot': AU.tone(1100, 0.05, 'square', 0.025, 700); break;
    case 'hit': AU.tone(320 + Math.random() * 80, 0.03, 'square', 0.04, 200); break;
    case 'boom': AU.noise(0.35, 0.35, 1500); AU.tone(160, 0.25, 'sine', 0.25, 50); break;
    case 'bigboom': AU.noise(1.2, 0.6, 900); AU.tone(110, 0.9, 'sine', 0.5, 30); break;
    case 'power': [523, 659, 784, 1047].forEach((f, i) => AU.tone(f, 0.12, 'triangle', 0.18, null, i * 0.06)); break;
    case 'pickup': AU.tone(880, 0.08, 'triangle', 0.15, 1320); break;
    case 'rescue': AU.tone(500, 0.18, 'sine', 0.2, 900); AU.tone(900, 0.12, 'sine', 0.15, 1300, 0.12); break;
    case 'hurt': AU.tone(500, 0.45, 'sawtooth', 0.2, 90); AU.noise(0.4, 0.3, 2000); break;
    case 'bomb':
      AU.noise(1.4, 0.5, 2500);
      AU.tone(90, 1.2, 'sawtooth', 0.3, 40);
      [392, 523, 659, 784].forEach((f, i) => AU.tone(f, 0.25, 'square', 0.12, null, i * 0.05));
      break;
    case 'warning':
      for (let i = 0; i < 6; i++) AU.tone(i % 2 ? 440 : 620, 0.24, 'square', 0.12, null, i * 0.26);
      break;
    case 'bubble': AU.tone(300, 0.1, 'sine', 0.12, 700); break;
    case 'eshot': AU.tone(420, 0.06, 'triangle', 0.06, 260); break;
    case 'pop': AU.tone(700, 0.05, 'sine', 0.1, 1200); break;
    case 'clear': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => AU.tone(f, 0.18, 'square', 0.12, null, i * 0.11)); break;
    case 'over': [392, 330, 262, 196].forEach((f, i) => AU.tone(f, 0.35, 'triangle', 0.2, null, i * 0.25)); break;
    case 'whoosh': AU.noise(0.3, 0.15, 3000); break;
  }
}
