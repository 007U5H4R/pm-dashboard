import { describe, expect, test } from "bun:test";
import { charmSpeed, createRope, flick, restPose, stepRope } from "./verlet-rope";

const OPTS = { gravity: 1800, damping: 0.985, windX: 0, iterations: 8, charmMass: 4 };
const DT = 1 / 120;
// A longer rope than the 16px UI one, so the physics has room to move within reach of the anchor.
const LEN = 100;

const segmentLengths = (r: ReturnType<typeof createRope>) =>
	Array.from({ length: r.n - 1 }, (_, i) => Math.hypot(r.x[i + 1]! - r.x[i]!, r.y[i + 1]! - r.y[i]!));

describe("verlet rope", () => {
	test("restPose hangs straight down at full length", () => {
		const r = createRope(12, 80, 1, LEN);
		for (let i = 0; i < r.n; i++) expect(r.x[i]).toBe(80);
		expect(r.y[0]).toBe(1);
		expect(r.y[r.n - 1]).toBeCloseTo(1 + LEN, 6);
	});

	test("segments hold their rest length while swinging under gravity", () => {
		const r = createRope(12, 80, 1, LEN);
		r.x[r.n - 1]! += 40; // knock the charm sideways (within the rope's reach)
		for (let i = 0; i < 200; i++) stepRope(r, DT, OPTS);
		for (const len of segmentLengths(r)) expect(Math.abs(len - r.seg) / r.seg).toBeLessThan(0.02);
	});

	test("the anchor never moves", () => {
		const r = createRope(12, 80, 1, LEN);
		flick(r, 1500, -400, DT);
		for (let i = 0; i < 300; i++) stepRope(r, DT, { ...OPTS, windX: 40 });
		expect(r.x[0]).toBe(80);
		expect(r.y[0]).toBe(1);
	});

	test("a pinned charm sits exactly on the pin", () => {
		const r = createRope(12, 80, 1, LEN);
		r.pinned = r.n - 1;
		r.pinX = 120;
		r.pinY = 40; // ~49px from the anchor, within the 100px rope
		for (let i = 0; i < 50; i++) stepRope(r, DT, OPTS);
		expect(r.x[r.n - 1]).toBe(120);
		expect(r.y[r.n - 1]).toBe(40);
		for (const len of segmentLengths(r)) expect(Math.abs(len - r.seg) / r.seg).toBeLessThan(0.05);
	});

	test("a flick swings, then damping settles it", () => {
		const r = createRope(12, 80, 1, LEN);
		flick(r, 900, 0, DT);
		const peak = (from: number, to: number) => {
			let max = 0;
			for (let i = from; i < to; i++) {
				stepRope(r, DT, OPTS);
				max = Math.max(max, charmSpeed(r, DT));
			}
			return max;
		};
		const early = peak(0, 120);
		const later = peak(120, 480);
		expect(early).toBeGreaterThan(later);
		peak(480, 2000);
		expect(charmSpeed(r, DT)).toBeLessThan(5);
		restPose(r);
		expect(charmSpeed(r, DT)).toBe(0);
	});
});
