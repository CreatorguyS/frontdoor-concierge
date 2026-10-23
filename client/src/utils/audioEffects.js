/**
 * Web Audio API Sound Synthesizer — FrontDoor Concierge
 * Zero external MP3 assets, 100% offline, synthesized harmonics.
 */

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Realistic two-tone doorbell chime (Ding-Dong: E5 -> C5) */
export function playDoorbellChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Tone 1: "Ding" (659.25 Hz - E5)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(659.25, now);
  gain1.gain.setValueAtTime(0.4, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 1.2);

  // Tone 2: "Dong" (523.25 Hz - C5) after 0.35s delay
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(523.25, now + 0.35);
  gain2.gain.setValueAtTime(0.45, now + 0.35);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.35);
  osc2.stop(now + 2.0);
}

/** Emergency warning siren (alternating warble) */
let sirenInterval = null;
export function playSirenAlarm(durationSeconds = 6) {
  const ctx = getAudioContext();
  if (!ctx) return;

  stopSirenAlarm(); // clear any running

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  gain.gain.setValueAtTime(0.25, ctx.currentTime);

  let high = true;
  const now = ctx.currentTime;
  osc.frequency.setValueAtTime(800, now);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);

  sirenInterval = setInterval(() => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    osc.frequency.setValueAtTime(high ? 960 : 780, t);
    high = !high;
  }, 250);

  setTimeout(() => {
    stopSirenAlarm();
    try {
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, durationSeconds * 1000);
}

export function stopSirenAlarm() {
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
}

/** Smart lock mechanism motor hum + high confirmation beep */
export function playUnlockSuccess() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Mechanical motor whir
  const motor = ctx.createOscillator();
  const motorGain = ctx.createGain();
  motor.type = 'triangle';
  motor.frequency.setValueAtTime(140, now);
  motorGain.gain.setValueAtTime(0.15, now);
  motorGain.gain.linearRampToValueAtTime(0.01, now + 0.35);
  motor.connect(motorGain);
  motorGain.connect(ctx.destination);
  motor.start(now);
  motor.stop(now + 0.35);

  // Success chime (880Hz -> 1320Hz)
  const beep1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  beep1.type = 'sine';
  beep1.frequency.setValueAtTime(880, now + 0.3);
  gain1.gain.setValueAtTime(0.3, now + 0.3);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  beep1.connect(gain1);
  gain1.connect(ctx.destination);
  beep1.start(now + 0.3);
  beep1.stop(now + 0.6);

  const beep2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  beep2.type = 'sine';
  beep2.frequency.setValueAtTime(1320, now + 0.45);
  gain2.gain.setValueAtTime(0.35, now + 0.45);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
  beep2.connect(gain2);
  gain2.connect(ctx.destination);
  beep2.start(now + 0.45);
  beep2.stop(now + 0.85);
}

/** Access denied error double buzz */
export function playAccessDenied() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [now, now + 0.18].forEach(t => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  });
}

/** Alexa wake chime */
export function playAlexaChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(440, now);
  gain1.gain.setValueAtTime(0.2, now);
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.2);

  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(880, now + 0.12);
  gain2.gain.setValueAtTime(0.25, now + 0.12);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.12);
  osc2.stop(now + 0.4);
}
