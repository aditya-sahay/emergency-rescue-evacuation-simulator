// All audio is synthesised with the Web Audio API — no sound files are shipped.
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.alarmOn = false;
  }

  // Must be called from a user gesture.
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);

    // noise buffer shared by several voices
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // fire crackle: noise bursts + low rumble
    const crackleBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const c = crackleBuf.getChannelData(0);
    let env = 0;
    for (let i = 0; i < c.length; i++) {
      if (Math.random() < 0.0009) env = 0.6 + Math.random() * 0.4;
      env *= 0.9965;
      c[i] = (Math.random() * 2 - 1) * (0.08 + env);
    }
    this.fireGain = ctx.createGain();
    this.fireGain.gain.value = 0;
    const fireSrc = ctx.createBufferSource();
    fireSrc.buffer = crackleBuf;
    fireSrc.loop = true;
    const fireFilter = ctx.createBiquadFilter();
    fireFilter.type = 'lowpass';
    fireFilter.frequency.value = 2400;
    fireSrc.connect(fireFilter).connect(this.fireGain).connect(this.master);
    fireSrc.start();
    const rumble = ctx.createBufferSource();
    rumble.buffer = this.noise;
    rumble.loop = true;
    const rf = ctx.createBiquadFilter();
    rf.type = 'lowpass';
    rf.frequency.value = 180;
    const rg = ctx.createGain();
    rg.gain.value = 0.9;
    rumble.connect(rf).connect(rg).connect(this.fireGain);
    rumble.start();

    // extinguisher hiss
    this.sprayGain = ctx.createGain();
    this.sprayGain.gain.value = 0;
    const spray = ctx.createBufferSource();
    spray.buffer = this.noise;
    spray.loop = true;
    const sf = ctx.createBiquadFilter();
    sf.type = 'bandpass';
    sf.frequency.value = 3200;
    sf.Q.value = 0.6;
    spray.connect(sf).connect(this.sprayGain).connect(this.master);
    spray.start();

    // alarm sounder: square wave alternating tones
    this.alarmGain = ctx.createGain();
    this.alarmGain.gain.value = 0;
    this.alarmOsc = ctx.createOscillator();
    this.alarmOsc.type = 'square';
    this.alarmOsc.frequency.value = 800;
    const af = ctx.createBiquadFilter();
    af.type = 'lowpass';
    af.frequency.value = 2500;
    this.alarmOsc.connect(af).connect(this.alarmGain).connect(this.master);
    this.alarmOsc.start();

    // ambient office hum (HVAC)
    const hum = ctx.createBufferSource();
    hum.buffer = this.noise;
    hum.loop = true;
    const hf = ctx.createBiquadFilter();
    hf.type = 'lowpass';
    hf.frequency.value = 300;
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0.05;
    hum.connect(hf).connect(this.humGain).connect(this.master);
    hum.start();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  suspend() { this.ctx?.suspend(); }
  resume() { this.ctx?.resume(); }

  setAlarm(on) {
    this.alarmOn = on;
    if (!this.ctx) return;
    this.alarmGain.gain.setTargetAtTime(on ? 0.06 : 0, this.ctx.currentTime, 0.05);
  }

  // Called every frame: animates alarm tone pattern and fire/spray loudness.
  update(time, { fireLevel = 0, spraying = false }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.alarmOn) {
      // two-tone 'fire alarm' sounder pattern (alternating 800/970 Hz every 0.5 s)
      const phase = Math.floor(time * 2) % 2;
      this.alarmOsc.frequency.setTargetAtTime(phase ? 970 : 800, t, 0.005);
    }
    this.fireGain.gain.setTargetAtTime(Math.min(0.9, fireLevel) * 0.55, t, 0.15);
    this.sprayGain.gain.setTargetAtTime(spraying ? 0.35 : 0, t, 0.04);
  }

  _blip(freq, dur, type = 'sine', gain = 0.15, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noiseHit(dur, freq, gain = 0.2, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }

  footstep(sprint) { this._noiseHit(sprint ? 0.09 : 0.07, 900, sprint ? 0.12 : 0.07); }
  door(open) { this._noiseHit(0.25, 300, 0.25); this._blip(open ? 140 : 110, 0.2, 'triangle', 0.12, -40); }
  pickup() { this._blip(520, 0.08, 'triangle', 0.15); setTimeout(() => this._blip(780, 0.12, 'triangle', 0.15), 70); }
  click() { this._blip(660, 0.05, 'square', 0.05); }
  alarmButton() { this._noiseHit(0.15, 4000, 0.2, 'highpass'); this._blip(1200, 0.25, 'square', 0.08); }
  empty() { this._blip(240, 0.25, 'square', 0.08, -120); }
  extinguished() { this._blip(660, 0.12, 'sine', 0.12); setTimeout(() => this._blip(990, 0.2, 'sine', 0.12), 110); }
  warning() { this._blip(330, 0.18, 'sawtooth', 0.06); }
  success() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._blip(f, 0.3, 'triangle', 0.14), i * 130)); }
  failure() { [392, 330, 262].forEach((f, i) => setTimeout(() => this._blip(f, 0.4, 'sawtooth', 0.08), i * 220)); }
}
