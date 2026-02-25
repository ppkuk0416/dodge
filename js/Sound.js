export class SoundManager {
  constructor() {
    this.enabled = false;
    this.ctx = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this._bgmTimer = null;

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.22;
      this.bgmGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.45;
      this.sfxGain.connect(this.ctx.destination);

      this.enabled = true;
    } catch {
      console.warn('Web Audio API not available');
    }
  }

  // Must be called on a user gesture before sound works
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ── SFX helpers ──────────────────────────────

  _tone(freq, dur, type = 'sine', vol = 0.3, dest = null) {
    if (!this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(dest ?? this.sfxGain);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + dur);
  }

  _delay(fn, ms) { setTimeout(fn, ms); }

  // ── Public SFX ───────────────────────────────

  playHit() {
    this._tone(180, 0.12, 'sawtooth', 0.3);
    this._delay(() => this._tone(130, 0.15, 'sine', 0.2), 60);
  }

  playShieldBlock() {
    this._tone(660, 0.08, 'sine', 0.3);
    this._delay(() => this._tone(880, 0.12, 'sine', 0.2), 80);
  }

  playDeath() {
    this._tone(330, 0.1, 'sawtooth', 0.5);
    this._delay(() => this._tone(220, 0.1, 'sawtooth', 0.4), 110);
    this._delay(() => this._tone(110, 0.35, 'sine',    0.5), 220);
  }

  playGameOver() {
    this._tone(440, 0.18, 'sine', 0.45);
    this._delay(() => this._tone(349, 0.18, 'sine', 0.45), 200);
    this._delay(() => this._tone(294, 0.18, 'sine', 0.45), 400);
    this._delay(() => this._tone(220, 0.55, 'sine', 0.45), 600);
  }

  playItemPickup(type) {
    switch (type) {
      case 'shield':
        this._tone(523, 0.09, 'sine', 0.3);
        this._delay(() => this._tone(659, 0.09, 'sine', 0.3), 90);
        this._delay(() => this._tone(784, 0.18, 'sine', 0.3), 180);
        break;
      case 'slow':
        this._tone(440, 0.18, 'sine', 0.3);
        this._delay(() => this._tone(330, 0.28, 'sine', 0.3), 160);
        break;
      case 'bomb':
        this._tone(90,  0.06, 'sawtooth', 0.5);
        this._delay(() => this._tone(50, 0.3, 'sine', 0.5), 60);
        break;
      case 'life':
        [0, 90, 180, 270].forEach((ms, i) => {
          const freqs = [523, 659, 784, 1047];
          this._delay(() => this._tone(freqs[i], 0.1, 'sine', 0.3), ms);
        });
        break;
    }
  }

  // ── BGM (simple procedural melody) ───────────

  startBGM() {
    if (!this.enabled) return;
    this.stopBGM();
    this._loopBGM();
  }

  stopBGM() {
    if (this._bgmTimer) { clearTimeout(this._bgmTimer); this._bgmTimer = null; }
  }

  _loopBGM() {
    if (!this.enabled || !this.bgmGain) return;
    const notes = [261, 294, 330, 349, 392, 440, 494, 523];
    const pattern = [0, 2, 4, 2, 5, 4, 2, 0, 3, 2, 0, 4, 5, 4, 2, 4];
    const tempo = 0.18; // seconds per note
    const now = this.ctx.currentTime;

    pattern.forEach((ni, i) => {
      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.type = 'triangle';
      osc.frequency.value = notes[ni];
      const t = now + i * tempo;
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + tempo * 0.85);
      osc.start(t);
      osc.stop(t + tempo);
    });

    const loopMs = pattern.length * tempo * 1000;
    this._bgmTimer = setTimeout(() => this._loopBGM(), loopMs);
  }
}
