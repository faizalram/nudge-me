// In-app "Nudge Me!" chime, synthesized with Web Audio (no audio file).
// Web Audio follows the iPhone silent switch, so the chime stays quiet when the phone is muted.
// iOS only lets a web app make sound after a tap, so unlockAudio() runs on every tap.

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;

  // Ask for the "ambient" audio session where supported: respects the silent switch
  // and mixes with other audio instead of pausing it.
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) {
    try {
      nav.audioSession.type = "ambient";
    } catch {
      // older iOS: Web Audio is ambient by default
    }
  }

  ctx = new AC();
  return ctx;
}

/** Call from a tap. Wakes the audio engine so a later chime can play. */
export function unlockAudio() {
  const c = getContext();
  if (!c || c.state === "running") return;
  c.resume().catch(() => {});
  // A silent one-sample buffer completes the unlock on older iOS
  const buf = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
}

function note(c: AudioContext, out: AudioNode, freq: number, start: number, length: number, level: number) {
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(level, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  gain.connect(out);

  // Main tone with a tiny upward scoop, which reads as "cute" rather than "alarm"
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq * 0.94, start);
  osc.frequency.exponentialRampToValueAtTime(freq, start + 0.035);
  osc.connect(gain);
  osc.start(start);
  osc.stop(start + length + 0.02);

  // Soft octave partial for a little bell shimmer
  const bellGain = c.createGain();
  bellGain.gain.value = 0.18;
  bellGain.connect(gain);
  const bell = c.createOscillator();
  bell.type = "triangle";
  bell.frequency.setValueAtTime(freq * 2, start);
  bell.connect(bellGain);
  bell.start(start);
  bell.stop(start + length + 0.02);
}

/** Plays the chime: a quick "boop-boop-BING" rising G5, C6, E6, with a sparkle on top. */
export function playChime() {
  const c = getContext();
  if (!c || c.state !== "running") return;

  const out = c.createGain();
  out.gain.value = 0.5;
  out.connect(c.destination);

  const t = c.currentTime + 0.02;
  note(c, out, 783.99, t, 0.16, 0.35); // G5
  note(c, out, 1046.5, t + 0.1, 0.16, 0.35); // C6
  note(c, out, 1318.51, t + 0.2, 0.6, 0.45); // E6, held
  note(c, out, 2093.0, t + 0.3, 0.35, 0.12); // C7 sparkle
}
