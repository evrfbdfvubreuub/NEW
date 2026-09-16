// Restrained sound/vibration cues (Blueprint §K4). No reward effects. All calls
// are best-effort and never throw.
export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    /* nonfatal */
  }
}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

let sharedContext: AudioContext | null = null;

/** A single short, calm tone. `kind` distinguishes reminder vs completion pitch. */
export function playCue(kind: "reminder" | "completion"): void {
  try {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    sharedContext = sharedContext ?? new Ctor();
    const ctx = sharedContext;
    if (ctx.state === "suspended") void ctx.resume();

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = kind === "completion" ? 660 : 520;

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.34);
  } catch {
    /* nonfatal */
  }
}
