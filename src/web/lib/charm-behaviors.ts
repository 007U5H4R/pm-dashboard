import { type CharmId, SQUIRREL_IMG } from "../assets/charms";

/** Persisted per-charm state (marshmallow char, wishbone wins, …). Numbers/booleans only. */
export type CharmMemory = Record<string, number | boolean>;

/** Everything a behavior sees each frame. The ctx is already translated to the charm's top-centre
 *  (the rope end) and rotated to the rope's tangent, so draw in local space: the sprite's top edge is
 *  y=0 and it hangs down to y=size. */
export interface CharmFrame {
	ctx: CanvasRenderingContext2D;
	image: HTMLImageElement;
	size: number;
	/** Seconds since mount, and since the previous frame (dt is 0 in the reduced-motion still frame). */
	t: number;
	dt: number;
	dragging: boolean;
	/** Charm point speed, px/s. */
	speed: number;
	dark: boolean;
	/** Mutable, persisted by the component. Keys starting with "_" are transient (not saved). */
	mem: CharmMemory;
	/** v2 board-reactive hook: populated later (completion %, due dates, WIP…); behaviors ignore it in v1. */
	board?: unknown;
}

export interface CharmBehavior {
	draw(f: CharmFrame): void;
	onClick?(f: CharmFrame): void;
	onDoubleClick?(f: CharmFrame): void;
	/** Called on release with the flick speed in f.speed. */
	onRelease?(f: CharmFrame): void;
}

// ---- localStorage memory (project + charm scoped) --------------------------------------------------
const memKey = (projectId: string | null, charm: string) => `pm.charm.${projectId ?? "default"}.${charm}`;

export function loadCharmMemory(projectId: string | null, charm: string): CharmMemory {
	try {
		const raw = localStorage.getItem(memKey(projectId, charm));
		if (raw) return JSON.parse(raw) as CharmMemory;
	} catch {}
	return {};
}

export function saveCharmMemory(projectId: string | null, charm: string, mem: CharmMemory): void {
	try {
		// Don't persist transient "_" fx timers.
		const clean: CharmMemory = {};
		for (const [k, v] of Object.entries(mem)) if (!k.startsWith("_")) clean[k] = v;
		localStorage.setItem(memKey(projectId, charm), JSON.stringify(clean));
	} catch {}
}

// ---- shared drawing helpers ------------------------------------------------------------------------
const num = (v: number | boolean | undefined, d = 0) => (typeof v === "number" ? v : d);

/** Click bounce: a short squash-and-settle scale, driven by mem._bounceUntil. */
function bounceScale(f: CharmFrame): number {
	const until = num(f.mem._bounceUntil);
	if (f.t >= until) return 1;
	const left = until - f.t; // seconds remaining of a 0.28s bounce
	return 1 + 0.16 * Math.sin((left / 0.28) * Math.PI);
}
function kickBounce(f: CharmFrame) {
	f.mem._bounceUntil = f.t + 0.28;
}

/** Draw the sprite with the click-bounce applied (scaled about the top-centre anchor). */
function drawSprite(f: CharmFrame) {
	const s = bounceScale(f);
	f.ctx.save();
	f.ctx.scale(s, s);
	f.ctx.imageSmoothingQuality = "high";
	f.ctx.drawImage(f.image, -f.size / 2, 0, f.size, f.size);
	f.ctx.restore();
}

let scratch: HTMLCanvasElement | null = null;
/** Draw the sprite tinted toward `color` at `alpha` (for marshmallow char, coffee cooling, …). */
function drawTinted(f: CharmFrame, color: string, alpha: number) {
	drawSprite(f);
	if (alpha <= 0) return;
	if (!scratch) scratch = document.createElement("canvas");
	const S = 128;
	scratch.width = S;
	scratch.height = S;
	const sc = scratch.getContext("2d");
	if (!sc) return;
	sc.clearRect(0, 0, S, S);
	sc.drawImage(f.image, 0, 0, S, S);
	sc.globalCompositeOperation = "source-atop";
	sc.globalAlpha = alpha;
	sc.fillStyle = color;
	sc.fillRect(0, 0, S, S);
	const s = bounceScale(f);
	f.ctx.save();
	f.ctx.scale(s, s);
	f.ctx.drawImage(scratch, -f.size / 2, 0, f.size, f.size);
	f.ctx.restore();
}

function glow(f: CharmFrame, cx: number, cy: number, r: number, color: string, a: number) {
	const ctx = f.ctx;
	ctx.save();
	ctx.globalCompositeOperation = "lighter";
	const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
	g.addColorStop(0, color);
	g.addColorStop(1, "rgba(0,0,0,0)");
	ctx.globalAlpha = a * (f.dark ? 1 : 0.6);
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function sparkle(f: CharmFrame, seed: number) {
	const ctx = f.ctx;
	const n = 5;
	ctx.save();
	ctx.fillStyle = "#fde68a";
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2 + seed;
		const rr = f.size * 0.5;
		const x = Math.cos(a) * rr;
		const y = f.size * 0.5 + Math.sin(a) * rr;
		ctx.globalAlpha = 0.8;
		ctx.beginPath();
		ctx.arc(x, y, 1.6, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

/** Rising smoke/steam wisps from (0, baseY) upward — hot marshmallow fumes, coffee steam. */
function steam(f: CharmFrame, baseY: number, intensity: number) {
	const ctx = f.ctx;
	ctx.save();
	ctx.strokeStyle = f.dark ? "rgba(226,232,240,0.5)" : "rgba(140,140,140,0.42)";
	ctx.lineWidth = 2;
	ctx.lineCap = "round";
	for (let i = -1; i <= 1; i++) {
		ctx.globalAlpha = Math.max(0, Math.min(1, intensity)) * (0.55 + 0.3 * Math.sin(f.t * 2 + i * 1.7));
		ctx.beginPath();
		for (let s = 0; s <= 11; s++) {
			const yy = baseY - s * 1.5;
			const xx = i * 5 + Math.sin(s * 0.55 + f.t * 3 + i * 2) * 3.5 * (s / 11);
			if (s === 0) ctx.moveTo(xx, yy);
			else ctx.lineTo(xx, yy);
		}
		ctx.stroke();
	}
	ctx.restore();
}

/** A twinkling four-point sparkle star at (x,y), pulsing in and out with the given phase. */
function twinkle(f: CharmFrame, x: number, y: number, max: number, phase: number) {
	const s = Math.max(0, Math.sin(f.t * 2.2 + phase));
	if (s <= 0.03) return;
	const r = max * s;
	const ctx = f.ctx;
	ctx.save();
	ctx.translate(x, y);
	ctx.globalAlpha = 0.95 * s;
	// White reads as a shine on the dark bar; on the light bar it vanishes, so use a golden glint.
	ctx.fillStyle = f.dark ? "#fffdf0" : "#eab308";
	ctx.beginPath();
	ctx.moveTo(0, -r);
	ctx.lineTo(r * 0.16, -r * 0.16);
	ctx.lineTo(r, 0);
	ctx.lineTo(r * 0.16, r * 0.16);
	ctx.lineTo(0, r);
	ctx.lineTo(-r * 0.16, r * 0.16);
	ctx.lineTo(-r, 0);
	ctx.lineTo(-r * 0.16, -r * 0.16);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

/** A flickering rocket flame from (x,y), pointing along `angle` (canvas radians). */
function flame(f: CharmFrame, x: number, y: number, angle: number, len: number, width: number) {
	const ctx = f.ctx;
	const flick = 0.72 + 0.18 * Math.sin(f.t * 34) + 0.1 * Math.sin(f.t * 71 + 1);
	const L = len * flick;
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);
	ctx.fillStyle = "#f97316";
	ctx.beginPath();
	ctx.moveTo(0, -width / 2);
	ctx.quadraticCurveTo(L * 0.6, -width * 0.35, L, 0);
	ctx.quadraticCurveTo(L * 0.6, width * 0.35, 0, width / 2);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = "#fde047";
	ctx.beginPath();
	ctx.moveTo(0, -width * 0.26);
	ctx.quadraticCurveTo(L * 0.5, -width * 0.18, L * 0.72, 0);
	ctx.quadraticCurveTo(L * 0.5, width * 0.18, 0, width * 0.26);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

/** Rising soapy bubbles around the charm (rubber-duck bath). */
function bubbles(f: CharmFrame, count: number) {
	const ctx = f.ctx;
	ctx.save();
	for (let i = 0; i < count; i++) {
		const seed = i * 1.7;
		const cycle = (f.t * 0.45 + i / count) % 1;
		const y = f.size * (0.92 - cycle * 0.95);
		const x = Math.sin(seed + f.t * 1.3) * f.size * 0.26 + (i - count / 2) * 3;
		const r = 2 + (i % 3) + Math.max(0, Math.sin(seed) * 1.5);
		const alpha = Math.sin(cycle * Math.PI) * 0.6;
		if (alpha <= 0.02) continue;
		ctx.globalAlpha = alpha;
		ctx.fillStyle = f.dark ? "rgba(191,219,254,0.18)" : "rgba(186,230,253,0.4)";
		ctx.strokeStyle = f.dark ? "rgba(191,219,254,0.9)" : "rgba(56,189,248,0.75)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		ctx.globalAlpha = alpha * 0.9;
		ctx.fillStyle = "#ffffff";
		ctx.beginPath();
		ctx.arc(x - r * 0.3, y - r * 0.3, Math.max(0.6, r * 0.28), 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

// A running squirrel that orbits the acorn (Ice-Age style). Loaded once; the sprite faces right.
const squirrelImg = typeof Image !== "undefined" ? new Image() : null;
if (squirrelImg) squirrelImg.src = SQUIRREL_IMG;

/** Draw the orbiting squirrel at orbit angle `a`, around the acorn's centre in local space. */
function drawSquirrel(f: CharmFrame, a: number) {
	if (!squirrelImg || !squirrelImg.complete || squirrelImg.naturalWidth === 0) return;
	const cy = f.size * 0.55;
	const x = f.size * 0.46 * Math.cos(a);
	const y = cy + f.size * 0.3 * Math.sin(a);
	const depth = Math.sin(a); // -1 behind the acorn .. +1 in front
	const sc = f.size * 0.5 * (0.8 + 0.28 * depth);
	const ar = squirrelImg.naturalHeight / squirrelImg.naturalWidth;
	const ctx = f.ctx;
	ctx.save();
	ctx.globalAlpha = 0.78 + 0.22 * (depth * 0.5 + 0.5);
	ctx.translate(x, y);
	if (Math.sin(a) > 0) ctx.scale(-1, 1); // face the direction of travel
	ctx.drawImage(squirrelImg, -sc / 2, -(sc * ar) / 2, sc, sc * ar);
	ctx.restore();
}

/** A "blipping" coloured aura behind the charm (normal blend, so it shows on the light bar too).
 *  `rgb` is an "r,g,b" string. */
function blipGlow(f: CharmFrame, rgb: string) {
	const blip = 0.3 + 0.55 * Math.max(0, Math.sin(f.t * 3)) ** 3;
	const cy = f.size * 0.52;
	const r = f.size * 0.72;
	const grad = f.ctx.createRadialGradient(0, cy, r * 0.15, 0, cy, r);
	grad.addColorStop(0, `rgba(${rgb},${0.55 * blip})`);
	grad.addColorStop(1, `rgba(${rgb},0)`);
	f.ctx.save();
	f.ctx.fillStyle = grad;
	f.ctx.beginPath();
	f.ctx.arc(0, cy, r, 0, Math.PI * 2);
	f.ctx.fill();
	f.ctx.restore();
}

// ---- behaviors -------------------------------------------------------------------------------------
const base: CharmBehavior = {
	draw: drawSprite,
	onClick: (f) => kickBounce(f),
};

const BEHAVIORS: Record<CharmId, CharmBehavior> = {
	marshmallow: {
		// Chars up (toasts) the longer it hangs while visible; a flick cools it a little. Hot fumes
		// always rise, and rise thicker the more toasted it gets.
		draw: (f) => {
			if (!f.dragging && f.dt > 0) f.mem.char = Math.min(1, num(f.mem.char) + f.dt * 0.012);
			drawTinted(f, "#7c3a10", num(f.mem.char) * 0.55);
			steam(f, f.size * 0.32, 0.4 + num(f.mem.char) * 0.6);
		},
		onRelease: (f) => {
			if (f.speed > 400) f.mem.char = Math.max(0, num(f.mem.char) - 0.25);
		},
	},
	lantern: {
		draw: (f) => {
			drawSprite(f);
			const flick = 0.55 + 0.2 * Math.sin(f.t * 9) + 0.1 * Math.sin(f.t * 21);
			glow(f, 0, f.size * 0.5, f.size * 0.5, "rgba(251,191,36,0.9)", flick);
		},
		onClick: kickBounce,
	},
	ember: {
		draw: (f) => {
			drawSprite(f);
			glow(f, 0, f.size * 0.5, f.size * 0.42, "rgba(249,115,22,0.9)", 0.5 + 0.3 * Math.sin(f.t * 4));
		},
		onClick: kickBounce,
	},
	smore: {
		draw: (f) => {
			drawSprite(f);
			steam(f, f.size * 0.28, 0.7);
		},
		onClick: kickBounce,
	},
	firefly: {
		draw: (f) => {
			drawSprite(f);
			const blink = Math.max(0, Math.sin(f.t * 2.2));
			glow(f, 0, f.size * 0.62, f.size * 0.3, "rgba(253,224,71,1)", blink * 0.9);
		},
		onClick: kickBounce,
	},
	nimbu: {
		draw: (f) => {
			drawSprite(f);
			twinkle(f, f.size * 0.02, f.size * 0.42, f.size * 0.14, 0.6);
			twinkle(f, -f.size * 0.18, f.size * 0.72, f.size * 0.12, 2.7);
			twinkle(f, f.size * 0.2, f.size * 0.24, f.size * 0.11, 4.8);
		},
		onClick: kickBounce,
	},
	acorn: {
		// A frantic squirrel spirals around the acorn — behind it at the top of the orbit, in front
		// at the bottom — never quite catching it.
		draw: (f) => {
			const a = f.t * 2.4;
			const behind = Math.sin(a) < 0;
			if (behind) drawSquirrel(f, a);
			drawSprite(f);
			if (!behind) drawSquirrel(f, a);
		},
		onClick: kickBounce,
	},
	nazarbattu: {
		// A fierce guardian mask; a golden ward pulses behind it to turn away the evil eye.
		draw: (f) => {
			blipGlow(f, "234,179,8"); // pulsing golden aura
			drawSprite(f);
		},
		onClick: kickBounce,
	},
	maneki: {
		draw: (f) => {
			drawSprite(f);
			twinkle(f, -f.size * 0.24, f.size * 0.4, f.size * 0.14, 1);
			twinkle(f, f.size * 0.26, f.size * 0.52, f.size * 0.13, 3);
			twinkle(f, f.size * 0.06, f.size * 0.24, f.size * 0.12, 5);
		},
		onClick: kickBounce,
	},
	horseshoe: {
		draw: (f) => {
			drawSprite(f);
			// ambient lucky shine on the metal, plus a burst on a perfect swing
			twinkle(f, -f.size * 0.2, f.size * 0.46, f.size * 0.14, 0.5);
			twinkle(f, f.size * 0.22, f.size * 0.46, f.size * 0.13, 2.6);
			twinkle(f, 0, f.size * 0.86, f.size * 0.12, 4.5);
			if (f.t < num(f.mem._sparkUntil)) sparkle(f, f.t * 6);
		},
		onRelease: (f) => {
			if (f.speed > 900) {
				f.mem.perfectSwings = num(f.mem.perfectSwings) + 1;
				f.mem._sparkUntil = f.t + 0.6;
			}
		},
	},
	clover: {
		draw: (f) => {
			drawSprite(f);
			twinkle(f, -f.size * 0.2, f.size * 0.44, f.size * 0.13, 0.8);
			twinkle(f, f.size * 0.22, f.size * 0.44, f.size * 0.13, 2.9);
			twinkle(f, 0, f.size * 0.78, f.size * 0.12, 5.1);
		},
		onClick: kickBounce,
	},
	wishbone: {
		// Double-click "snaps" it (a quick tilt) and banks a win; small pips count wins.
		draw: (f) => {
			const snapping = f.t < num(f.mem._snapUntil);
			f.ctx.save();
			if (snapping) f.ctx.rotate(0.25 * Math.sin((num(f.mem._snapUntil) - f.t) * 40));
			drawSprite(f);
			f.ctx.restore();
			const wins = Math.min(5, num(f.mem.wins));
			f.ctx.save();
			f.ctx.fillStyle = "#f59e0b";
			for (let i = 0; i < wins; i++) {
				f.ctx.beginPath();
				f.ctx.arc(-f.size * 0.32 + i * 5, f.size * 0.95, 1.8, 0, Math.PI * 2);
				f.ctx.fill();
			}
			f.ctx.restore();
			// lucky shine: twinkling sparkle stars drifting across the bone
			twinkle(f, f.size * 0.05, f.size * 0.34, f.size * 0.16, 0);
			twinkle(f, -f.size * 0.22, f.size * 0.7, f.size * 0.13, 2.1);
			twinkle(f, f.size * 0.24, f.size * 0.64, f.size * 0.12, 4.2);
		},
		onDoubleClick: (f) => {
			f.mem.wins = num(f.mem.wins) + 1;
			f.mem._snapUntil = f.t + 0.35;
		},
		onClick: kickBounce,
	},
	nazar: {
		// A slow, smooth blink: the bead briefly squishes shut about its centre and reopens — no hard
		// overlay disc (the old version popped a dark circle on/off, which read as a glitch).
		draw: (f) => {
			const p = f.t % 5;
			const lid = p < 0.3 ? 1 - 0.85 * Math.sin((p / 0.3) * Math.PI) : 1;
			const cy = f.size * 0.5;
			f.ctx.save();
			f.ctx.translate(0, cy);
			f.ctx.scale(1, lid);
			f.ctx.translate(0, -cy);
			drawSprite(f);
			f.ctx.restore();
		},
		onClick: kickBounce,
	},
	duck: {
		draw: (f) => {
			drawSprite(f);
			bubbles(f, 7);
		},
		onClick: kickBounce,
	},
	rocket: {
		draw: (f) => {
			const rumbling = f.t < num(f.mem._rumbleUntil);
			f.ctx.save();
			if (rumbling) f.ctx.translate((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
			// exhaust flame from the lower-left nozzle, pointing down-left; bigger while rumbling.
			flame(f, -f.size * 0.16, f.size * 0.8, 2.4, f.size * (rumbling ? 0.42 : 0.28), f.size * 0.2);
			drawSprite(f);
			f.ctx.restore();
		},
		onClick: (f) => {
			f.mem._rumbleUntil = f.t + 0.4;
			kickBounce(f);
		},
	},
	bug: {
		// Click squashes it (flatten) briefly, then it respawns. A golden aura blips behind it.
		draw: (f) => {
			blipGlow(f, "234,179,8");
			const squashed = f.t < num(f.mem._squashUntil);
			f.ctx.save();
			if (squashed) f.ctx.scale(1.25, 0.55);
			drawSprite(f);
			f.ctx.restore();
		},
		onClick: (f) => {
			f.mem.squashes = num(f.mem.squashes) + 1;
			f.mem._squashUntil = f.t + 0.3;
		},
	},
	coffee: {
		draw: (f) => {
			drawSprite(f);
			steam(f, f.size * 0.18, 0.9);
		},
		onClick: (f) => {
			f.mem.refills = num(f.mem.refills) + 1;
			kickBounce(f);
		},
	},
};

export function behaviorFor(id: CharmId): CharmBehavior {
	return BEHAVIORS[id] ?? base;
}
