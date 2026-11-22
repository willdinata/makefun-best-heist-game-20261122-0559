let context = null;
let master = null;
let muted = false;

export function ensureAudio() {
  if (typeof window === 'undefined') return;
  try {
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      context = new Audio();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.2;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
  } catch {
    // Sound is optional on browsers with WebAudio disabled.
  }
}

function tone(frequency, duration, delay = 0, type = 'sine', endFrequency = frequency) {
  if (!context || !master || muted) return;
  const at = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, at);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), at + duration);
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(0.48, at + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(envelope);
  envelope.connect(master);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
}

export const sfx = {
  pickup() {
    tone(659.25, 0.16, 0, 'triangle');
    tone(987.77, 0.23, 0.09, 'sine');
    tone(1318.51, 0.25, 0.19, 'sine');
  },
  tick(urgent = false) {
    tone(urgent ? 740 : 440, 0.08, 0, 'triangle', urgent ? 960 : 380);
  },
  blip() {
    tone(220, 0.12, 0, 'triangle', 880);
    tone(660, 0.1, 0.07, 'sine');
  },
  sting() {
    tone(196, 0.55, 0, 'sawtooth', 55);
    tone(233, 0.45, 0.06, 'triangle', 65);
    tone(98, 0.65, 0.1, 'sine', 32);
  },
  jingle() {
    [392, 493.88, 587.33, 783.99, 987.77].forEach((note, i) => {
      tone(note, i === 4 ? 0.5 : 0.24, i * 0.115, 'triangle');
    });
  },
  toggleMute() {
    muted = !muted;
    if (master && context) master.gain.setTargetAtTime(muted ? 0 : 0.2, context.currentTime, 0.015);
    return muted;
  },
};
