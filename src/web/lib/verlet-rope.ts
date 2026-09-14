/**
 * A verlet-integration rope: `n` points joined by fixed-length segments. Point 0 is a fixed anchor;
 * the last point carries the charm (heavier, so it drives the swing). Pure math, no DOM — the
 * CampfireDangle component owns rendering and pointer input.
 *
 * Index reads use `!` because every index here is provably in-bounds (0..n-1) and a Float64Array
 * element is always a number; `noUncheckedIndexedAccess` can't see that.
 */
export interface Rope {
	n: number;
	/** Segment rest length. */
	seg: number;
	x: Float64Array;
	y: Float64Array;
	/** Previous positions; verlet velocity is (x - px, y - py) per step. */
	px: Float64Array;
	py: Float64Array;
	anchorX: number;
	anchorY: number;
	/** Index of the pointer-pinned point, or -1 when free. */
	pinned: number;
	pinX: number;
	pinY: number;
}

export interface StepOptions {
	/** px/s² */
	gravity: number;
	/** Per-step velocity multiplier, 0..1. */
	damping: number;
	/** px/s² */
	windX: number;
	/** Distance-constraint passes per step. */
	iterations: number;
	/** Relative mass of the last (charm) point; it moves 1/(1+mass) of each correction. */
	charmMass: number;
}

/** A rope hanging straight down from the anchor, at rest. */
export function createRope(n: number, anchorX: number, anchorY: number, length: number): Rope {
	const rope: Rope = {
		n,
		seg: length / (n - 1),
		x: new Float64Array(n),
		y: new Float64Array(n),
		px: new Float64Array(n),
		py: new Float64Array(n),
		anchorX,
		anchorY,
		pinned: -1,
		pinX: 0,
		pinY: 0,
	};
	restPose(rope);
	return rope;
}

/** Straight vertical hang with zero velocity (used for reduced-motion and resets). */
export function restPose(rope: Rope): void {
	for (let i = 0; i < rope.n; i++) {
		const y = rope.anchorY + i * rope.seg;
		rope.x[i] = rope.anchorX;
		rope.y[i] = y;
		rope.px[i] = rope.anchorX;
		rope.py[i] = y;
	}
}

/** Advance the rope by `dt` seconds: integrate, then relax the segment constraints. */
export function stepRope(rope: Rope, dt: number, opts: StepOptions): void {
	const { n, x, y, px, py } = rope;
	const dt2 = dt * dt;

	for (let i = 1; i < n; i++) {
		if (i === rope.pinned) continue;
		const xi = x[i]!;
		const yi = y[i]!;
		const vx = (xi - px[i]!) * opts.damping;
		const vy = (yi - py[i]!) * opts.damping;
		px[i] = xi;
		py[i] = yi;
		x[i] = xi + vx + opts.windX * dt2;
		y[i] = yi + vy + opts.gravity * dt2;
	}

	const charmW = 1 / (1 + opts.charmMass);
	for (let pass = 0; pass < opts.iterations; pass++) {
		holdFixed(rope);
		for (let i = 0; i < n - 1; i++) {
			const j = i + 1;
			const fixedI = i === 0 || i === rope.pinned;
			const fixedJ = j === rope.pinned;
			if (fixedI && fixedJ) continue;
			const xi = x[i]!;
			const yi = y[i]!;
			const xj = x[j]!;
			const yj = y[j]!;
			const dx = xj - xi;
			const dy = yj - yi;
			const dist = Math.hypot(dx, dy) || 1e-6;
			const diff = (dist - rope.seg) / dist;
			let wi = 0.5;
			let wj = 0.5;
			if (fixedI) {
				wi = 0;
				wj = 1;
			} else if (fixedJ) {
				wi = 1;
				wj = 0;
			} else if (j === n - 1) {
				wj = charmW;
				wi = 1 - charmW;
			}
			x[i] = xi + dx * diff * wi;
			y[i] = yi + dy * diff * wi;
			x[j] = xj - dx * diff * wj;
			y[j] = yj - dy * diff * wj;
		}
	}
	holdFixed(rope);
}

/** Re-apply the anchor and (if any) the pinned point; a pinned point also carries no velocity. */
function holdFixed(rope: Rope): void {
	rope.x[0] = rope.anchorX;
	rope.y[0] = rope.anchorY;
	if (rope.pinned >= 0) {
		rope.x[rope.pinned] = rope.pinX;
		rope.y[rope.pinned] = rope.pinY;
		rope.px[rope.pinned] = rope.pinX;
		rope.py[rope.pinned] = rope.pinY;
	}
}

/** Give the charm point a velocity of (vx, vy) px/s for the next step of length `dt`. */
export function flick(rope: Rope, vx: number, vy: number, dt: number): void {
	const i = rope.n - 1;
	rope.px[i] = rope.x[i]! - vx * dt;
	rope.py[i] = rope.y[i]! - vy * dt;
}

/** Charm point speed in px/s, given the step length the positions were last advanced by. */
export function charmSpeed(rope: Rope, dt: number): number {
	const i = rope.n - 1;
	return Math.hypot(rope.x[i]! - rope.px[i]!, rope.y[i]! - rope.py[i]!) / dt;
}

/**
 * A slow ambient breeze, normalised to roughly [-1, 1]. Every hanging thing (the charm and the theme
 * pull-cord) multiplies this by its own amplitude and evaluates it at a shared wall-clock time, so
 * they all sway in the same direction at the same moment regardless of when each mounted.
 */
export function ambientWind(t: number): number {
	return 0.62 * Math.sin(0.7 * t) + 0.22 * Math.sin(1.7 * t + 0.7) + 0.18 * Math.sin(0.15 * t);
}
