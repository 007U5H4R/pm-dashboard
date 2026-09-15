/**
 * Tiny procedural sound effects for the hanging charm and the theme pull-cord: a soft "pluck" when a
 * cord is grabbed or let go, and a crisp "click" when the pull-cord switch actuates. Web Audio only
 * (no asset files) through a single shared AudioContext created lazily on the first user gesture, so
 * autoplay policies never block it. Every call is a no-op when Web Audio is unavailable or blocked,
 * so callers never need to guard.
 */
let ctx: AudioContext | null = null;
let failed = false;

function audio(): AudioContext | null {
	if (failed) return null;
	try {
		if (!ctx) {
			const Ctor =
				window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!Ctor) {
				failed = true;
				return null;
			}
			ctx = new Ctor();
		}
		if (ctx.state === "suspended") void ctx.resume();
		return ctx;
	} catch {
		failed = true;
		return null;
	}
}

/** A soft, quickly-decaying pluck — a finger catching or releasing a cord. Louder gain = harder tug. */
export function playPluck(freq: number, gain = 0.05, dur = 0.15): void {
	const ac = audio();
	if (!ac) return;
	const t = ac.currentTime;
	const osc = ac.createOscillator();
	const g = ac.createGain();
	osc.type = "triangle";
	osc.frequency.setValueAtTime(freq, t);
	osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + dur);
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.01);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	osc.connect(g).connect(ac.destination);
	osc.start(t);
	osc.stop(t + dur + 0.02);
}

/** A crisp mechanical click — the pull-cord light switch actuating (a short filtered noise burst). */
export function playClick(gain = 0.06): void {
	const ac = audio();
	if (!ac) return;
	const t = ac.currentTime;
	const dur = 0.035;
	const frames = Math.max(1, Math.ceil(ac.sampleRate * dur));
	const buf = ac.createBuffer(1, frames, ac.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
	const src = ac.createBufferSource();
	src.buffer = buf;
	const hp = ac.createBiquadFilter();
	hp.type = "highpass";
	hp.frequency.value = 1800;
	const g = ac.createGain();
	g.gain.value = gain;
	src.connect(hp).connect(g).connect(ac.destination);
	src.start(t);
	src.stop(t + dur);
}
