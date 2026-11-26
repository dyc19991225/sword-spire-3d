// Zero-Asset Procedural Xianxia WebAudio Synthesizer: Guzheng, Dizi Flute, War Taiko, Sword Ring & Stereo Hall Reverb
import type { SwordElement } from './cards';

const BPM = 96;
const STEP_DUR = 60 / BPM / 4; // 16th note (~0.156s)

// Chinese Yu-Pentatonic Minor (A - C - D - E - G) 32-step Guzheng & Dizi score
const GUZHENG_ARP = [
  57, 60, 62, 64, 67, 64, 62, 60, 55, 57, 60, 62, 64, 62, 60, 57,
  53, 57, 60, 64, 67, 64, 60, 57, 52, 55, 57, 60, 64, 67, 69, 64,
];

const DIZI_MELODY: (number | null)[] = [
  69, null, null, null, 72, null, 74, null, 76, null, null, null, 74, null, 72, null,
  69, null, 67, null, 64, null, null, null, 67, null, 69, null, 69, null, null, null,
];

const BASS_DRONE = [
  45, null, null, null, null, null, 45, null, 43, null, null, null, null, null, 43, null,
  41, null, null, null, null, null, 41, null, 40, null, null, null, 43, null, 40, null,
];

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class XianxiaAudio {
  private ctx: AudioContext | null = null;
  private sfxOut: GainNode | null = null;
  private revSend: GainNode | null = null;
  private musicOut: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private muted = false;
  private nextStepTime = 0;
  private stepIdx = 0;
  private bgmRunning = false;

  public unlock(): void {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.knee.value = 12;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.16;
      comp.connect(this.ctx.destination);

      this.sfxOut = this.ctx.createGain();
      this.sfxOut.gain.value = 0.72;
      this.sfxOut.connect(comp);

      this.musicOut = this.ctx.createGain();
      this.musicOut.gain.value = this.muted ? 0 : 0.34;
      this.musicOut.connect(comp);

      // Stereo Mountain-Temple Hall Convolver Reverb
      const conv = this.ctx.createConvolver();
      conv.buffer = this.buildTempleImpulse(1.65, 2.7);
      this.revSend = this.ctx.createGain();
      this.revSend.gain.value = 0.42;
      const revOut = this.ctx.createGain();
      revOut.gain.value = 0.65;
      this.revSend.connect(conv).connect(revOut).connect(comp);

      const nLen = Math.floor(this.ctx.sampleRate * 0.5);
      this.noiseBuf = this.ctx.createBuffer(1, nLen, this.ctx.sampleRate);
      const ch = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < nLen; i++) ch[i] = Math.random() * 2 - 1;

      this.nextStepTime = this.ctx.currentTime + 0.05;
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private buildTempleImpulse(sec: number, decay: number): AudioBuffer {
    const sr = this.ctx!.sampleRate;
    const len = Math.floor(sr * sec);
    const buf = this.ctx!.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const u = i / len;
        const env = Math.pow(1 - u, decay);
        const w = Math.random() * 2 - 1;
        lp += (0.28 + (1 - u) * 0.4) * (w - lp);
        d[i] = lp * env * 0.6;
      }
    }
    return buf;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.ctx && this.musicOut) {
      this.musicOut.gain.setTargetAtTime(this.muted ? 0 : 0.34, this.ctx.currentTime, 0.04);
    }
    return this.muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public stepBgm(inCombat: boolean, bossFight: boolean): void {
    if (!this.ctx || !this.musicOut || this.ctx.state !== 'running') return;
    if (this.muted) {
      this.bgmRunning = false;
      return;
    }
    const now = this.ctx.currentTime;
    if (!this.bgmRunning || this.nextStepTime < now - 0.3) {
      this.bgmRunning = true;
      this.nextStepTime = now + 0.04;
    }
    while (this.nextStepTime < now + 0.16) {
      this.scheduleXianxiaStep(this.stepIdx, this.nextStepTime, inCombat, bossFight);
      this.stepIdx = (this.stepIdx + 1) % 32;
      this.nextStepTime += STEP_DUR;
    }
  }

  private scheduleXianxiaStep(step: number, t: number, inCombat: boolean, bossFight: boolean): void {
    if (!this.ctx || !this.musicOut) return;

    // 1. Plucked Guzheng Pentatonic Arpeggio
    const gzMidi = GUZHENG_ARP[step] + (bossFight ? 2 : 0);
    this.pluckGuzheng(midiToHz(gzMidi), t, 0.10, (step % 4 === 0 ? 0.55 : 0.32), (step % 5 - 2) * 0.25);

    // 2. Deep Guqin / Bass Drone
    const bassMidi = BASS_DRONE[step];
    if (bassMidi !== null) {
      const b = this.ctx.createOscillator();
      const flt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      b.type = 'sawtooth';
      b.frequency.setValueAtTime(midiToHz(bassMidi + (bossFight ? 2 : 0)), t);
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(420, t);
      flt.frequency.exponentialRampToValueAtTime(120, t + STEP_DUR * 5.5);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + STEP_DUR * 5.8);
      b.connect(flt).connect(g).connect(this.musicOut);
      b.start(t);
      b.stop(t + STEP_DUR * 6);
    }

    // 3. War Taiko Drum in Combat!
    if (inCombat && (step % 8 === 0 || (bossFight && step % 8 === 6) || step % 16 === 12)) {
      const taiko = this.ctx.createOscillator();
      const tg = this.ctx.createGain();
      taiko.type = 'sine';
      taiko.frequency.setValueAtTime(bossFight ? 125 : 105, t);
      taiko.frequency.exponentialRampToValueAtTime(38, t + 0.18);
      tg.gain.setValueAtTime(step % 8 === 0 ? 0.34 : 0.20, t);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.21);
      taiko.connect(tg).connect(this.musicOut);
      if (this.revSend) tg.connect(this.revSend);
      taiko.start(t);
      taiko.stop(t + 0.22);
    }

    // 4. Bamboo Dizi Flute Soaring Melody
    const dzMidi = DIZI_MELODY[step];
    if (dzMidi !== null) {
      const freq = midiToHz(dzMidi + (bossFight ? 2 : 0));
      const fl = this.ctx.createOscillator();
      const vib = this.ctx.createOscillator();
      const vibG = this.ctx.createGain();
      const fg = this.ctx.createGain();

      fl.type = 'triangle';
      fl.frequency.setValueAtTime(freq * 0.985, t);
      fl.frequency.exponentialRampToValueAtTime(freq, t + 0.05);

      vib.frequency.value = 5.6;
      vibG.gain.value = freq * 0.012;
      vib.connect(vibG).connect(fl.frequency);

      fg.gain.setValueAtTime(0.001, t);
      fg.gain.linearRampToValueAtTime(0.075, t + 0.06);
      fg.gain.exponentialRampToValueAtTime(0.001, t + STEP_DUR * 3.6);

      fl.connect(fg).connect(this.musicOut);
      if (this.revSend) fg.connect(this.revSend);
      fl.start(t);
      vib.start(t);
      fl.stop(t + STEP_DUR * 3.8);
      vib.stop(t + STEP_DUR * 3.8);
    }
  }

  private pluckGuzheng(freq: number, t: number, vol: number, dur: number, pan = 0): void {
    if (!this.ctx || !this.musicOut) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const flt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq * 2, t);

    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(freq * 5.5, t);
    flt.frequency.exponentialRampToValueAtTime(freq * 1.2, t + dur);

    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc1.connect(flt);
    osc2.connect(flt);
    if (typeof this.ctx.createStereoPanner === 'function' && Math.abs(pan) > 0.02) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      flt.connect(g).connect(p).connect(this.musicOut);
    } else {
      flt.connect(g).connect(this.musicOut);
    }
    if (this.revSend) g.connect(this.revSend);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur + 0.02);
    osc2.stop(t + dur + 0.02);
  }

  // =========================================================================
  // Tactile Card, Flying Sword, Shield & Formation SFX!
  // =========================================================================
  public playCardHover(): void {
    if (!this.ctx || !this.sfxOut || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(780 + Math.random() * 90, t);
    o.frequency.exponentialRampToValueAtTime(1180, t + 0.035);
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    o.connect(g).connect(this.sfxOut);
    o.start(t);
    o.stop(t + 0.045);
  }

  // Immortal Bronze Sword Dragon-Cry ("龙吟剑鸣")
  public playSwordSlash(heavy = false): void {
    if (!this.ctx || !this.sfxOut || !this.noiseBuf || this.muted) return;
    const t = this.ctx.currentTime;
    const p = 0.94 + Math.random() * 0.12;

    // Wind whoosh
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1100 * p, t);
    bp.frequency.exponentialRampToValueAtTime(3400 * p, t + 0.11);
    bp.Q.value = 2.2;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(heavy ? 0.24 : 0.15, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    n.connect(bp).connect(ng).connect(this.sfxOut);
    n.start(t);
    n.stop(t + 0.15);

    // Metallic Jian ring partials
    const partials = heavy ? [880, 1320, 2110, 2790] : [1046.5, 1568, 2480];
    for (const [idx, pf] of partials.entries()) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = idx === 0 ? 'sawtooth' : 'sine';
      o.frequency.setValueAtTime(pf * p, t);
      o.frequency.exponentialRampToValueAtTime(pf * p * 0.985, t + (heavy ? 0.34 : 0.22));
      g.gain.setValueAtTime((heavy ? 0.10 : 0.07) / (idx + 1), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (heavy ? 0.36 : 0.24));
      o.connect(g).connect(this.sfxOut);
      if (this.revSend) g.connect(this.revSend);
      o.start(t);
      o.stop(t + 0.38);
    }

    // Impact sub thump
    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(heavy ? 185 : 145, t);
    sub.frequency.exponentialRampToValueAtTime(36, t + 0.15);
    sg.gain.setValueAtTime(heavy ? 0.30 : 0.18, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    sub.connect(sg).connect(this.sfxOut);
    sub.start(t);
    sub.stop(t + 0.17);
  }

  public playElementalSword(el: SwordElement, isEvoke: boolean): void {
    if (!this.ctx || !this.sfxOut || this.muted) return;
    const t = this.ctx.currentTime;
    const baseMap: Record<SwordElement, number> = {
      metal: 1174.66,
      fire: 523.25,
      thunder: 783.99,
      ice: 1396.91,
      wood: 659.25,
    };
    const f = baseMap[el] * (isEvoke ? 1.25 : 1.0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = el === 'thunder' || el === 'fire' ? 'sawtooth' : 'triangle';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(isEvoke ? f * 1.5 : f * 0.85, t + (isEvoke ? 0.24 : 0.14));
    g.gain.setValueAtTime(isEvoke ? 0.16 : 0.10, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (isEvoke ? 0.26 : 0.16));
    o.connect(g).connect(this.sfxOut);
    if (this.revSend) g.connect(this.revSend);
    o.start(t);
    o.stop(t + 0.28);
  }

  public playJadeShield(): void {
    if (!this.ctx || !this.sfxOut || this.muted) return;
    const t = this.ctx.currentTime;
    for (const [i, f] of [587.33, 880, 1318.5].entries()) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t + i * 0.025);
      g.gain.setValueAtTime(0.11, t + i * 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      o.connect(g).connect(this.sfxOut);
      if (this.revSend) g.connect(this.revSend);
      o.start(t + i * 0.025);
      o.stop(t + 0.26);
    }
  }

  public playFormationAwaken(): void {
    if (!this.ctx || !this.sfxOut || this.muted) return;
    const t = this.ctx.currentTime;
    // Sweeping Pentatonic Guzheng Glissando + Golden Bell Strike!
    const notes = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1318.5];
    notes.forEach((f, idx) => {
      if (!this.ctx || !this.sfxOut) return;
      const st = t + idx * 0.032;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.10, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.34);
      o.connect(g).connect(this.sfxOut);
      if (this.revSend) g.connect(this.revSend);
      o.start(st);
      o.stop(st + 0.36);
    });
  }

  public playEnemyHitHero(): void {
    if (!this.ctx || !this.sfxOut || !this.noiseBuf || this.muted) return;
    const t = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    const sg = this.ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(160, t);
    sub.frequency.exponentialRampToValueAtTime(32, t + 0.22);
    sg.gain.setValueAtTime(0.28, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    sub.connect(sg).connect(this.sfxOut);
    sub.start(t);
    sub.stop(t + 0.25);
  }

  public playVictoryFanfare(): void {
    if (!this.ctx || !this.sfxOut || this.muted) return;
    const t = this.ctx.currentTime;
    for (const [idx, f] of [440, 587.33, 659.25, 880, 1174.66].entries()) {
      const st = t + idx * 0.065;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.16, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.38);
      o.connect(g).connect(this.sfxOut);
      if (this.revSend) g.connect(this.revSend);
      o.start(st);
      o.stop(st + 0.4);
    }
  }
}
