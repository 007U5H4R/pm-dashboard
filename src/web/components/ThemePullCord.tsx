import React, { useEffect, useRef } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { playClick, playPluck } from "../lib/charm-audio";
import { ambientWind, createRope, flick, restPose, type Rope, stepRope } from "../lib/verlet-rope";

// A light-switch pull-cord that toggles the theme (replaces the theme button). Pull the knob down and
// release — it snaps back on the verlet rope and flips light/dark; a click or Enter/Space works too.
const W = 44;
const H = 156;
const POINTS = 10;
const LEN = 62;
const KNOB = 9;
const SUB = 1 / 120;
const MAX_SUB = 4;
const PHYS = { gravity: 2200, damping: 0.965, iterations: 8, charmMass: 3 };
const MAX_PULL = 58; // px the knob can be pulled below rest
const PULL_TOGGLE = 22; // px below rest a drag must reach to toggle
const TUG = 900; // downward flick on a click/keyboard toggle
// Ambient sway amplitude. Large only because a taut cord's endpoint deflects little per unit of
// lateral push (deflection ~ windX/gravity x length); shares ambientWind + the rAF clock with the
// hanging charm so both swing the same direction at the same moment. Nets a few px of gentle sway.
const WIND_AMP = 210;

interface Sample {
	y: number;
	t: number;
}

const ThemePullCord: React.FC = () => {
	const { theme, toggleTheme } = useTheme();
	const themeRef = useRef(theme);
	themeRef.current = theme;
	const toggleRef = useRef(toggleTheme);
	toggleRef.current = toggleTheme;

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const hitRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const hit = hitRef.current;
		if (!canvas || !hit) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const rope: Rope = createRope(POINTS, W / 2, 1, LEN);
		const restY = 1 + LEN;
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

		let dpr = 0;
		const fit = () => {
			const d = window.devicePixelRatio || 1;
			if (d === dpr) return;
			dpr = d;
			canvas.width = Math.round(W * d);
			canvas.height = Math.round(H * d);
			ctx.setTransform(d, 0, 0, d, 0, 0);
		};
		fit();

		let last = 0;
		let acc = 0;
		let raf = 0;
		let running = false;

		const drawKnob = (x: number, y: number) => {
			const dark = themeRef.current === "dark";
			ctx.save();
			ctx.translate(x, y);
			ctx.beginPath();
			ctx.arc(0, 0, KNOB, 0, Math.PI * 2);
			ctx.fillStyle = dark ? "#fbbf24" : "#475569";
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.strokeStyle = dark ? "#e5e7eb" : "#1f2937";
			ctx.stroke();
			ctx.fillStyle = "#ffffff";
			if (dark) {
				// sun (pull → light): dot + rays
				ctx.beginPath();
				ctx.arc(0, 0, 3.1, 0, Math.PI * 2);
				ctx.fill();
				for (let i = 0; i < 8; i++) {
					ctx.save();
					ctx.rotate((i * Math.PI) / 4);
					ctx.fillRect(4.5, -0.7, 2.3, 1.4);
					ctx.restore();
				}
			} else {
				// moon (pull → dark): crescent
				ctx.beginPath();
				ctx.arc(0, 0, 4.6, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#475569";
				ctx.beginPath();
				ctx.arc(2.4, -1.4, 4.4, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.restore();
		};

		const draw = () => {
			const n = rope.n;
			ctx.clearRect(0, 0, W, H);
			ctx.lineWidth = 2;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
			ctx.strokeStyle = themeRef.current === "dark" ? "#9ca3af" : "#6b7280";
			ctx.beginPath();
			for (let i = 0; i < n - 1; i++) ctx.lineTo(rope.x[i]!, rope.y[i]!);
			ctx.stroke();
			const kx = rope.x[n - 1]!;
			const ky = rope.y[n - 1]!;
			drawKnob(kx, ky);
			hit.style.transform = `translate(${kx - KNOB - 3}px, ${ky - KNOB - 3}px)`;
		};

		const step = (now: number) => {
			if (!running) return;
			acc += Math.min((now - last) / 1000, 0.1);
			last = now;
			const windX = WIND_AMP * ambientWind(now / 1000);
			let s = 0;
			while (acc >= SUB && s < MAX_SUB) {
				stepRope(rope, SUB, { ...PHYS, windX });
				acc -= SUB;
				s++;
			}
			if (s === MAX_SUB) acc = 0;
			draw();
			raf = requestAnimationFrame(step);
		};
		const start = () => {
			if (running || reduce.matches) return;
			running = true;
			last = performance.now();
			acc = 0;
			raf = requestAnimationFrame(step);
		};
		const stop = () => {
			running = false;
			cancelAnimationFrame(raf);
		};
		const onVisibility = () => {
			if (document.hidden) stop();
			else if (!reduce.matches) start();
		};
		const onReduce = () => {
			if (reduce.matches) {
				stop();
				restPose(rope);
				draw();
			} else {
				start();
			}
		};

		// Pointer: pull the knob down; release toggles if a click or pulled past the threshold.
		const samples: Sample[] = [];
		let downT = 0;
		let moved = 0;
		const localY = (e: PointerEvent) => e.clientY - canvas.getBoundingClientRect().top;
		const onDown = (e: PointerEvent) => {
			e.preventDefault();
			hit.setPointerCapture(e.pointerId);
			playPluck(280, 0.045); // soft catch as the cord is grabbed
			downT = performance.now();
			moved = 0;
			samples.length = 0;
			rope.pinned = rope.n - 1;
			rope.pinX = W / 2;
			rope.pinY = Math.max(restY, Math.min(restY + MAX_PULL, localY(e)));
			samples.push({ y: rope.pinY, t: downT });
		};
		const onMove = (e: PointerEvent) => {
			if (rope.pinned < 0) return;
			const y = Math.max(restY, Math.min(restY + MAX_PULL, localY(e)));
			moved = Math.max(moved, Math.abs(y - restY));
			rope.pinX = W / 2;
			rope.pinY = y;
			samples.push({ y, t: performance.now() });
			if (samples.length > 5) samples.shift();
		};
		const doToggle = (tug: boolean) => {
			playClick(0.06); // the switch actuates
			toggleRef.current();
			if (tug) flick(rope, 0, TUG, SUB);
			if (reduce.matches) draw();
		};
		const onUp = () => {
			if (rope.pinned < 0) return;
			const pulled = rope.pinY - restY;
			rope.pinned = -1;
			const now = performance.now();
			const latest = samples[samples.length - 1];
			const old = samples.find((s) => now - s.t <= 80);
			if (latest && old && latest.t > old.t) {
				flick(rope, 0, (latest.y - old.y) / ((latest.t - old.t) / 1000), SUB);
			}
			const isClick = moved < 4 && now - downT < 300;
			if (isClick || pulled > PULL_TOGGLE) doToggle(isClick);
			else playPluck(230, 0.04); // released without tripping the switch — a soft snap-back
			if (reduce.matches) {
				restPose(rope);
				draw();
			}
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				doToggle(true);
			}
		};

		hit.addEventListener("pointerdown", onDown);
		hit.addEventListener("pointermove", onMove);
		hit.addEventListener("pointerup", onUp);
		hit.addEventListener("pointercancel", onUp);
		hit.addEventListener("keydown", onKey);
		document.addEventListener("visibilitychange", onVisibility);
		window.addEventListener("resize", fit);
		reduce.addEventListener("change", onReduce);
		if (reduce.matches) {
			restPose(rope);
			draw();
		} else {
			start();
		}

		return () => {
			stop();
			hit.removeEventListener("pointerdown", onDown);
			hit.removeEventListener("pointermove", onMove);
			hit.removeEventListener("pointerup", onUp);
			hit.removeEventListener("pointercancel", onUp);
			hit.removeEventListener("keydown", onKey);
			document.removeEventListener("visibilitychange", onVisibility);
			window.removeEventListener("resize", fit);
			reduce.removeEventListener("change", onReduce);
		};
	}, []);

	const next = theme === "light" ? "dark" : "light";
	// The drawing box is anchored to the bar's top edge (like the hanging charm) so the cord hangs from
	// the top; it is click-through except for the knob's hit box.
	return (
		<div className="relative w-11 h-10">
			<div
				className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
				style={{ top: "calc(50% - 36px)", width: W, height: H }}
			>
				<canvas ref={canvasRef} className="absolute inset-0" style={{ width: W, height: H }} />
				<div
					ref={hitRef}
					role="button"
					tabIndex={0}
					aria-label={`Switch to ${next} mode`}
					title={`Pull to switch to ${next} mode`}
					className="absolute top-0 left-0 rounded-full pointer-events-auto cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
					style={{ width: (KNOB + 3) * 2, height: (KNOB + 3) * 2, touchAction: "none" }}
				/>
			</div>
		</div>
	);
};

export default ThemePullCord;
