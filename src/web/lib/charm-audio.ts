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

// ---- per-charm click sounds --------------------------------------------------------------------
// Small synthesis primitives the charm recipes below compose. All times are relative to now + delay.

interface BlipOpts {
	type?: OscillatorType;
	gain?: number;
	dur?: number;
	attack?: number;
	hp?: number;
	lp?: number;
}

/** One enveloped oscillator tone, optionally gliding f0 -> f1 and band-filtered. */
function blip(ac: AudioContext, f0: number, f1: number, o: BlipOpts = {}, delay = 0): void {
	const { type = "sine", gain = 0.05, dur = 0.15, attack = 0.006, hp, lp } = o;
	const t = ac.currentTime + delay;
	const osc = ac.createOscillator();
	osc.type = type;
	osc.frequency.setValueAtTime(f0, t);
	if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
	let node: AudioNode = osc;
	if (hp) {
		const f = ac.createBiquadFilter();
		f.type = "highpass";
		f.frequency.value = hp;
		node.connect(f);
		node = f;
	}
	if (lp) {
		const f = ac.createBiquadFilter();
		f.type = "lowpass";
		f.frequency.value = lp;
		node.connect(f);
		node = f;
	}
	const g = ac.createGain();
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	node.connect(g).connect(ac.destination);
	osc.start(t);
	osc.stop(t + dur + 0.03);
}

/** One filtered noise burst (crackles, sizzles, whooshes). `curve` shapes the decay steepness. */
function noiseHit(
	ac: AudioContext,
	o: { gain?: number; dur?: number; hp?: number; lp?: number; curve?: number } = {},
	delay = 0,
): void {
	const { gain = 0.05, dur = 0.12, hp, lp, curve = 1 } = o;
	const t = ac.currentTime + delay;
	const frames = Math.max(1, Math.ceil(ac.sampleRate * dur));
	const buf = ac.createBuffer(1, frames, ac.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** curve;
	const src = ac.createBufferSource();
	src.buffer = buf;
	let node: AudioNode = src;
	if (hp) {
		const f = ac.createBiquadFilter();
		f.type = "highpass";
		f.frequency.value = hp;
		node.connect(f);
		node = f;
	}
	if (lp) {
		const f = ac.createBiquadFilter();
		f.type = "lowpass";
		f.frequency.value = lp;
		node.connect(f);
		node = f;
	}
	const g = ac.createGain();
	g.gain.value = gain;
	node.connect(g).connect(ac.destination);
	src.start(t);
	src.stop(t + dur);
}

/**
 * A guttural demon laugh — "heh-heh-heh-HAAA": a sawtooth voice with a sub-octave for chest, a 28 Hz
 * growl (amplitude modulation), and an open-"ah" formant so it reads as a voice, laughing in falling
 * steps and ending on a long descending roar. Every syllable gets a breathy "h" onset.
 */
function demonLaugh(ac: AudioContext): void {
	const t0 = ac.currentTime;
	// One voice chain shared by every syllable: growl -> "ah" formant -> lowpass -> master.
	const master = ac.createGain();
	master.gain.value = 0.25;
	const lp = ac.createBiquadFilter();
	lp.type = "lowpass";
	lp.frequency.value = 1400;
	const formant = ac.createBiquadFilter();
	formant.type = "bandpass";
	formant.frequency.value = 780;
	formant.Q.value = 2.2;
	const growl = ac.createGain();
	growl.gain.value = 0.6;
	const lfo = ac.createOscillator();
	lfo.type = "sine";
	lfo.frequency.value = 28;
	const lfoAmt = ac.createGain();
	lfoAmt.gain.value = 0.4;
	lfo.connect(lfoAmt).connect(growl.gain);
	growl.connect(formant).connect(lp).connect(master).connect(ac.destination);
	lfo.start(t0);

	const syllables = [
		{ at: 0, f0: 150, f1: 120, dur: 0.14, gain: 0.5 },
		{ at: 0.19, f0: 140, f1: 112, dur: 0.14, gain: 0.55 },
		{ at: 0.38, f0: 132, f1: 104, dur: 0.14, gain: 0.6 },
		{ at: 0.57, f0: 124, f1: 96, dur: 0.15, gain: 0.62 },
		{ at: 0.78, f0: 118, f1: 70, dur: 0.55, gain: 0.7 }, // the long final "HAAA"
	];
	let end = t0;
	for (const s of syllables) {
		const t = t0 + s.at;
		end = Math.max(end, t + s.dur + 0.1);
		const env = ac.createGain();
		env.gain.setValueAtTime(0.0001, t);
		env.gain.exponentialRampToValueAtTime(s.gain, t + 0.02);
		env.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
		env.connect(growl);
		// The voice: fundamental, a sub-octave for chest, and a slightly detuned octave for rasp.
		for (const [mul, g] of [
			[1, 1],
			[0.5, 0.55],
			[2.01, 0.25],
		] as const) {
			const osc = ac.createOscillator();
			osc.type = "sawtooth";
			osc.frequency.setValueAtTime(s.f0 * mul, t);
			osc.frequency.exponentialRampToValueAtTime(Math.max(20, s.f1 * mul), t + s.dur);
			const og = ac.createGain();
			og.gain.value = g;
			osc.connect(og).connect(env);
			osc.start(t);
			osc.stop(t + s.dur + 0.05);
		}
		noiseHit(ac, { gain: 0.02, dur: 0.05, hp: 500, lp: 2500, curve: 1.5 }, s.at); // aspirated "h"
	}
	lfo.stop(end);
}

/** A short sound evoking the clicked charm — a sizzle for the marshmallow, a squeak for the duck, etc. */
export function playCharmSound(id: string): void {
	const ac = audio();
	if (!ac) return;
	switch (id) {
		case "marshmallow": // a warm toasty sizzle
			noiseHit(ac, { gain: 0.05, dur: 0.28, hp: 300, lp: 2000, curve: 0.6 });
			blip(ac, 320, 220, { gain: 0.02, dur: 0.2 });
			break;
		case "lantern": // a glassy cling
			blip(ac, 880, 880, { gain: 0.05, dur: 0.35 });
			blip(ac, 1320, 1320, { gain: 0.02, dur: 0.3 });
			break;
		case "ember": // fire crackle
			noiseHit(ac, { gain: 0.05, dur: 0.03, hp: 2000, curve: 2 });
			noiseHit(ac, { gain: 0.04, dur: 0.03, hp: 2500, curve: 2 }, 0.05);
			noiseHit(ac, { gain: 0.045, dur: 0.04, hp: 1800, curve: 2 }, 0.11);
			break;
		case "smore": // a crunchy bite
			noiseHit(ac, { gain: 0.06, dur: 0.12, hp: 200, lp: 1400, curve: 1.5 });
			break;
		case "firefly": // high glimmering twinkle
			blip(ac, 1900, 1900, { gain: 0.03, dur: 0.09 });
			blip(ac, 2500, 2500, { gain: 0.03, dur: 0.09 }, 0.07);
			blip(ac, 3100, 3100, { gain: 0.025, dur: 0.1 }, 0.14);
			break;
		case "nimbu": // a zesty spring
			blip(ac, 760, 180, { type: "square", gain: 0.04, dur: 0.2, lp: 2500 });
			break;
		case "acorn": // a wooden knock
			blip(ac, 200, 120, { type: "triangle", gain: 0.06, dur: 0.09 });
			noiseHit(ac, { gain: 0.02, dur: 0.03, hp: 1000, curve: 2 });
			break;
		case "nazarbattu": // a guttural demon laugh
			demonLaugh(ac);
			break;
		case "maneki": // a lucky-cat bell jingle
			blip(ac, 1200, 1200, { gain: 0.045, dur: 0.18 });
			blip(ac, 1600, 1600, { gain: 0.035, dur: 0.2 }, 0.08);
			break;
		case "horseshoe": // a metallic ting
			blip(ac, 2100, 2100, { gain: 0.045, dur: 0.3 });
			blip(ac, 3010, 3010, { gain: 0.03, dur: 0.28 });
			blip(ac, 4300, 4300, { gain: 0.015, dur: 0.22 });
			break;
		case "clover": // a gentle ascending major-triad chime
			blip(ac, 523, 523, { gain: 0.04, dur: 0.25 });
			blip(ac, 659, 659, { gain: 0.04, dur: 0.25 }, 0.09);
			blip(ac, 784, 784, { gain: 0.04, dur: 0.3 }, 0.18);
			break;
		case "wishbone": // a rising sparkle
			blip(ac, 700, 1600, { gain: 0.035, dur: 0.28 });
			blip(ac, 1400, 2600, { gain: 0.02, dur: 0.24 }, 0.05);
			break;
		case "nazar": // an eerie beating wobble (evil-eye ward)
			blip(ac, 430, 450, { gain: 0.04, dur: 0.4 });
			blip(ac, 445, 430, { gain: 0.035, dur: 0.4 });
			break;
		case "duck": // a rubber-duck squeak (up, then down)
			blip(ac, 620, 1500, { type: "sawtooth", gain: 0.04, dur: 0.09, lp: 3000 });
			blip(ac, 1500, 700, { type: "sawtooth", gain: 0.04, dur: 0.11, lp: 3000 }, 0.09);
			break;
		case "rocket": // a whooshing launch
			blip(ac, 180, 1200, { type: "sawtooth", gain: 0.03, dur: 0.4, lp: 2500 });
			noiseHit(ac, { gain: 0.05, dur: 0.4, hp: 400, lp: 5000, curve: 0.4 });
			break;
		case "bug": // a buzzy beetle
			blip(ac, 150, 130, { type: "sawtooth", gain: 0.045, dur: 0.22, lp: 1200 });
			blip(ac, 155, 140, { type: "sawtooth", gain: 0.03, dur: 0.22, lp: 1200 });
			break;
		case "coffee": // a bubbly sip / bloop
			blip(ac, 480, 130, { gain: 0.05, dur: 0.12 });
			blip(ac, 300, 90, { gain: 0.03, dur: 0.14 }, 0.06);
			break;
		default:
			playPluck(440, 0.05);
	}
}
