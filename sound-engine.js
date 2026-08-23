/**
 * SCRK Sound Engine — FA24 WRX Subaru Boxer Synthesizer
 * Pure Web Audio API synthesis — zero samples, zero copyright issues.
 *
 * Simulates: FA24 flat-4 boxer rumble, FA-series turbo spool,
 * cold-air intake rush, titanium catback exhaust crackle, and BOV pop.
 *
 * @author  SCRK Performance
 * @version 1.0.0
 */

class SCRKSoundEngine {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    this.running = false;
    this.animFrame = null;
  }

  // ─── Public API ──────────────────────────────────────────────────

  /** Toggle the sound experience on/off */
  async toggle(btn) {
    if (this.running) {
      this.stop(btn);
    } else {
      await this.play(btn);
    }
  }

  /** Play the full FA24 sound sequence */
  async play(btn) {
    if (this.running) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      console.warn('Web Audio API not supported');
      return;
    }

    this.ctx = new AudioCtx();
    await this.ctx.resume();
    this.running = true;
    if (btn) this._setButtonState(btn, true);

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // ─── Master output chain ──────────────────────────────────
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(0.55, t + 0.25);
    master.gain.setValueAtTime(0.55, t + 4.8);
    master.gain.linearRampToValueAtTime(0, t + 6.0);
    master.connect(ctx.destination);

    // ─── Compressor to prevent clipping ──────────────────────
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 8;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    comp.connect(master);

    // ─── 1. FA24 Boxer Engine Fundamental ────────────────────
    // 4-cyl 4-stroke: firing_freq = RPM / 60 * cylinders / 2
    // Idle ~900 RPM → ~30 Hz
    // Rev to ~4500 RPM → ~150 Hz
    // Note: FA24 has a smoother (even) firing interval vs EJ, 
    // but still has the characteristic flat-4 bark
    const engineFreqs = [
      { time: 0,   freq: 28  },  // cold idle
      { time: 0.4, freq: 32  },  // warming
      { time: 1.2, freq: 70  },  // building rpm
      { time: 2.0, freq: 130 },  // pulling hard
      { time: 2.8, freq: 155 },  // near peak
      { time: 3.2, freq: 60  },  // lift + coast
      { time: 4.0, freq: 35  },  // back to idle
      { time: 5.5, freq: 30  },  // settled idle
    ];

    // Sawtooth for the raspy exhaust character
    const engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.setValueAtTime(engineFreqs[0].freq, t);
    for (const { time, freq } of engineFreqs.slice(1)) {
      engineOsc.frequency.linearRampToValueAtTime(freq, t + time);
    }

    // Distortion — exhaust bark / titanium catback character
    const dist = ctx.createWaveShaper();
    dist.curve = this._distortionCurve(45);
    dist.oversample = '4x';

    // Exhaust lowpass — rolls off fizz, keeps body
    const exhaustLP = ctx.createBiquadFilter();
    exhaustLP.type = 'lowpass';
    exhaustLP.frequency.setValueAtTime(320, t);
    exhaustLP.frequency.linearRampToValueAtTime(900, t + 2.8);
    exhaustLP.frequency.linearRampToValueAtTime(380, t + 4.2);
    exhaustLP.Q.value = 1.8;

    const engineGain = ctx.createGain();
    engineGain.gain.value = 0.55;

    engineOsc.connect(dist);
    dist.connect(exhaustLP);
    exhaustLP.connect(engineGain);
    engineGain.connect(comp);
    engineOsc.start(t);
    engineOsc.stop(t + 6.0);

    // ─── 1b. Harmonics (richness + boxer texture) ─────────────
    const harmonics = [
      { mult: 2, gain: 0.18 },
      { mult: 3, gain: 0.10 },
      { mult: 4, gain: 0.06 },
      { mult: 5, gain: 0.03 },
    ];

    harmonics.forEach(({ mult, gain }) => {
      const h = ctx.createOscillator();
      h.type = 'sawtooth';
      h.frequency.setValueAtTime(engineFreqs[0].freq * mult, t);
      for (const { time, freq } of engineFreqs.slice(1)) {
        h.frequency.linearRampToValueAtTime(freq * mult, t + time);
      }
      const hGain = ctx.createGain();
      hGain.gain.value = gain;
      h.connect(hGain);
      hGain.connect(exhaustLP);
      h.start(t);
      h.stop(t + 6.0);
    });

    // ─── 2. Turbo Spool (FA20/FA24 IHI turbocharger) ─────────
    // Turbo whine sits between 8–14 kHz, rises with shaft speed
    const turboOsc = ctx.createOscillator();
    turboOsc.type = 'sine';
    turboOsc.frequency.setValueAtTime(6500,  t + 0.8);
    turboOsc.frequency.linearRampToValueAtTime(10500, t + 2.0);
    turboOsc.frequency.linearRampToValueAtTime(13000, t + 2.8);
    turboOsc.frequency.linearRampToValueAtTime(8000,  t + 3.4);
    turboOsc.frequency.linearRampToValueAtTime(5500,  t + 5.0);

    const turboGain = ctx.createGain();
    turboGain.gain.setValueAtTime(0,     t);
    turboGain.gain.setValueAtTime(0,     t + 0.8);
    turboGain.gain.linearRampToValueAtTime(0.025, t + 1.5);
    turboGain.gain.linearRampToValueAtTime(0.055, t + 2.8);
    turboGain.gain.linearRampToValueAtTime(0.01,  t + 3.6);
    turboGain.gain.linearRampToValueAtTime(0,     t + 5.2);

    // Bandpass to isolate turbo whine frequency band
    const turboBP = ctx.createBiquadFilter();
    turboBP.type = 'bandpass';
    turboBP.frequency.value = 10000;
    turboBP.Q.value = 8;

    turboOsc.connect(turboBP);
    turboBP.connect(turboGain);
    turboGain.connect(master);
    turboOsc.start(t + 0.8);
    turboOsc.stop(t + 6.0);

    // ─── 3. Cold-Air Intake Rush (filtered noise) ─────────────
    const intakeNoise = this._noiseSource(ctx, 5.5);
    const intakeBP = ctx.createBiquadFilter();
    intakeBP.type = 'bandpass';
    intakeBP.frequency.setValueAtTime(280,  t + 0.5);
    intakeBP.frequency.linearRampToValueAtTime(650, t + 2.0);
    intakeBP.frequency.linearRampToValueAtTime(420, t + 4.2);
    intakeBP.Q.value = 0.7;

    const intakeGain = ctx.createGain();
    intakeGain.gain.setValueAtTime(0,    t);
    intakeGain.gain.setValueAtTime(0,    t + 0.5);
    intakeGain.gain.linearRampToValueAtTime(0.07, t + 1.2);
    intakeGain.gain.linearRampToValueAtTime(0.11, t + 2.5);
    intakeGain.gain.linearRampToValueAtTime(0.04, t + 3.8);
    intakeGain.gain.linearRampToValueAtTime(0,    t + 5.2);

    intakeNoise.connect(intakeBP);
    intakeBP.connect(intakeGain);
    intakeGain.connect(comp);
    intakeNoise.start(t + 0.5);
    intakeNoise.stop(t + 6.0);

    // ─── 4. Titanium Catback Exhaust Crackle ──────────────────
    // At high-RPM lift-off, the titanium catback pops and crackles
    const crackleCount = 9;
    const crackleStart = t + 2.9;
    for (let i = 0; i < crackleCount; i++) {
      const ct = crackleStart + i * 0.10 + (Math.random() * 0.04);
      const crackNoise = this._noiseSource(ctx, 0.08);
      const crackBP = ctx.createBiquadFilter();
      crackBP.type = 'bandpass';
      crackBP.frequency.value = 1400 + Math.random() * 800;
      crackBP.Q.value = 4;
      const crackGain = ctx.createGain();
      crackGain.gain.setValueAtTime(0.5 - i * 0.04, ct);
      crackGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.07);
      crackNoise.connect(crackBP);
      crackBP.connect(crackGain);
      crackGain.connect(master);
      crackNoise.start(ct);
      crackNoise.stop(ct + 0.1);
    }

    // ─── 5. BOV Pop (decel blow-off) ──────────────────────────
    // When throttle lifts at peak boost, BOV vents charge air
    const bovT = t + 3.15;
    const bovNoise = this._noiseSource(ctx, 0.15);
    const bovBP = ctx.createBiquadFilter();
    bovBP.type = 'bandpass';
    bovBP.frequency.value = 380;
    bovBP.Q.value = 1.2;
    const bovGain = ctx.createGain();
    bovGain.gain.setValueAtTime(0.65, bovT);
    bovGain.gain.exponentialRampToValueAtTime(0.001, bovT + 0.18);
    bovNoise.connect(bovBP);
    bovBP.connect(bovGain);
    bovGain.connect(master);
    bovNoise.start(bovT);
    bovNoise.stop(bovT + 0.2);

    // ─── Cleanup after sequence ends ─────────────────────────
    const duration = 6200; // ms
    setTimeout(() => {
      this.running = false;
      if (btn) this._setButtonState(btn, false);
      if (this.ctx && this.ctx.state !== 'closed') {
        this.ctx.close().catch(() => {});
        this.ctx = null;
      }
    }, duration);
  }

  stop(btn) {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.running = false;
    if (btn) this._setButtonState(btn, false);
  }

  // ─── Private helpers ─────────────────────────────────────────────

  /** Soft-clip distortion curve for exhaust bark */
  _distortionCurve(amount) {
    const n = 512;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  /** Create a finite white-noise buffer source */
  _noiseSource(ctx, durationSecs) {
    const sampleRate = ctx.sampleRate;
    const length = Math.max(1, Math.ceil(sampleRate * durationSecs));
    const buf = ctx.createBuffer(1, length, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  /** Update button visual state */
  _setButtonState(btn, isPlaying) {
    const lbl = btn.querySelector('.sc-label');
    const sub = btn.querySelector('.sc-sub');
    const ico = btn.querySelector('.sc-ico');
    if (isPlaying) {
      btn.classList.add('sc-playing');
      if (lbl) lbl.textContent = 'REVVING';
      if (sub) sub.textContent = 'FA24 · TURBO · CATBACK';
      if (ico) ico.textContent = '🏎️';
    } else {
      btn.classList.remove('sc-playing');
      if (lbl) lbl.textContent = 'SOUND CHECK';
      if (sub) sub.textContent = 'OH YEAH';
      if (ico) ico.textContent = '🔊';
    }
  }
}

// Expose as singleton on window
window.SCRKSound = new SCRKSoundEngine();
