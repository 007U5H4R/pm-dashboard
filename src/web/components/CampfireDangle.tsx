import React, { useEffect, useRef, useState } from "react";
import { CHARM_IDS, CHARMS, type CharmId, SURPRISE } from "../assets/charms";
import { useAppearance } from "../contexts/AppearanceContext";
import { useProject } from "../contexts/ProjectContext";
import { useTheme } from "../contexts/ThemeContext";
import { behaviorFor, type CharmFrame, type CharmMemory, loadCharmMemory, saveCharmMemory } from "../lib/charm-behaviors";
import { surpriseCharmFor } from "../lib/surprise-charm";
import { playPluck } from "../lib/charm-audio";
import { ambientWind, charmSpeed, createRope, flick, restPose, stepRope, type Rope } from "../lib/verlet-rope";

// The canvas is larger than the resting charm so swings and flicks can overshoot without clipping.
const CANVAS_W = 160;
const CANVAS_H = 120;
const ROPE_POINTS = 12;
// Rope + sprite rest within the 72px top bar, so the charm never sits over page controls below it.
const ROPE_LENGTH = 16;
const SPRITE = 56;
const SUBSTEP = 1 / 120;
const MAX_SUBSTEPS = 4;
const PHYSICS = { gravity: 1800, damping: 0.985, iterations: 8, charmMass: 4 };
const MAX_FLICK = 2400;
const CLICK_MAX_MOVE = 4;
const CLICK_MAX_MS = 300;
const DOUBLE_MS = 350;
// Sway amplitude. Shares ambientWind + the rAF clock with the theme pull-cord so both swing the
// same direction at the same moment; the charm reads its sway mostly as sprite rotation.
const WIND_AMP = 26;

const resolveCharm = (raw: string | undefined): CharmId => {
	if (raw === SURPRISE) return surpriseCharmFor(new Date(), CHARM_IDS);
	return (CHARM_IDS as readonly string[]).includes(raw ?? "") ? (raw as CharmId) : "marshmallow";
};

interface Sample {
	x: number;
	y: number;
	t: number;
}

/** The hanging charm in the top bar: a verlet rope with a charm on the end that sways, can be grabbed and
 *  flicked, and plays a per-charm micro-animation on click. Off unless enabled in Settings → Appearance. */
const CampfireDangle: React.FC = () => {
	const { appearance } = useAppearance();
	const { activeProjectId } = useProject();
	// When "Surprise" is picked, re-resolve once a minute so a day rollover swaps the charm without reload.
	const [, setTick] = useState(0);
	useEffect(() => {
		if (appearance.charm !== SURPRISE) return;
		const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
		return () => window.clearInterval(id);
	}, [appearance.charm]);

	if (appearance.charmEnabled !== true) return null;
	const charmId = resolveCharm(appearance.charm);
	// Key by project + charm so the rope, image and memory reset cleanly on any switch.
	return (
		<DangleCanvas key={`${activeProjectId ?? "default"}:${charmId}`} charmId={charmId} projectId={activeProjectId ?? null} />
	);
};

const DangleCanvas: React.FC<{ charmId: CharmId; projectId: string | null }> = ({ charmId, projectId }) => {
	const { theme } = useTheme();
	const darkRef = useRef(theme === "dark");
	darkRef.current = theme === "dark";

	const boxRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const hitRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const box = boxRef.current;
		const canvas = canvasRef.current;
		const hit = hitRef.current;
		if (!box || !canvas || !hit) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const rope: Rope = createRope(ROPE_POINTS, CANVAS_W / 2, 1, ROPE_LENGTH);
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
		const behavior = behaviorFor(charmId);
		const mem: CharmMemory = loadCharmMemory(projectId, charmId);
		const image = new Image();
		let imageReady = false;
		image.onload = () => {
			imageReady = true;
			draw();
		};
		image.src = CHARMS[charmId].image;

		// One reusable frame passed to the behavior each draw / interaction.
		const frame: CharmFrame = {
			ctx,
			image,
			size: SPRITE,
			t: 0,
			dt: 0,
			dragging: false,
			speed: 0,
			dark: darkRef.current,
			mem,
		};

		let dpr = 0;
		const fitCanvas = () => {
			const next = window.devicePixelRatio || 1;
			if (next === dpr) return;
			dpr = next;
			canvas.width = Math.round(CANVAS_W * dpr);
			canvas.height = Math.round(CANVAS_H * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		fitCanvas();

		let elapsed = 0;
		let frameDt = 0;
		let acc = 0;
		let last = 0;
		let lastSave = 0;
		let raf = 0;
		let running = false;

		const persist = () => saveCharmMemory(projectId, charmId, mem);

		const draw = () => {
			const n = rope.n;
			const ink = darkRef.current ? "#e5e7eb" : "#1f2937";
			ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

			// Rope, with a slight wobble along it so it reads as drawn by hand.
			ctx.lineWidth = 2;
			ctx.lineJoin = "round";
			ctx.lineCap = "round";
			ctx.strokeStyle = ink;
			ctx.beginPath();
			for (let i = 0; i < n; i++) {
				const w = i * 2.1 + elapsed * 0.5;
				ctx.lineTo(rope.x[i]! + 0.4 * Math.sin(w), rope.y[i]! + 0.4 * Math.cos(w));
			}
			ctx.stroke();
			ctx.fillStyle = ink;
			ctx.beginPath();
			ctx.arc(rope.anchorX, rope.anchorY + 1, 2.5, 0, Math.PI * 2);
			ctx.fill();

			const ex = rope.x[n - 1]!;
			const ey = rope.y[n - 1]!;
			const angle = Math.atan2(-(ex - rope.x[n - 2]!), ey - rope.y[n - 2]!);

			if (imageReady) {
				frame.t = elapsed;
				frame.dt = frameDt;
				frame.dragging = rope.pinned >= 0;
				frame.speed = charmSpeed(rope, SUBSTEP);
				frame.dark = darkRef.current;
				ctx.save();
				ctx.translate(ex, ey);
				ctx.rotate(angle);
				behavior.draw(frame);
				ctx.restore();
			}

			// The hit box (the only interactive element) follows the sprite's nominal bounds.
			hit.style.transform = `translate(${ex - SPRITE / 2}px, ${ey}px)`;
		};

		const step = (now: number) => {
			if (!running) return;
			frameDt = Math.min((now - last) / 1000, 0.1);
			acc += frameDt;
			last = now;
			const windX = WIND_AMP * ambientWind(now / 1000);
			let steps = 0;
			while (acc >= SUBSTEP && steps < MAX_SUBSTEPS) {
				stepRope(rope, SUBSTEP, { ...PHYSICS, windX });
				elapsed += SUBSTEP;
				acc -= SUBSTEP;
				steps++;
			}
			if (steps === MAX_SUBSTEPS) acc = 0; // a long stall never turns into a burst of catch-up steps
			draw();
			if (elapsed - lastSave > 5) {
				lastSave = elapsed;
				persist();
			}
			raf = requestAnimationFrame(step);
		};
		const start = () => {
			if (running || reduceMotion.matches) return;
			running = true;
			last = performance.now();
			acc = 0;
			raf = requestAnimationFrame(step);
		};
		const stop = () => {
			running = false;
			cancelAnimationFrame(raf);
		};
		const applyMotionPref = () => {
			if (reduceMotion.matches) {
				stop();
				restPose(rope);
				frameDt = 0;
				draw();
			} else {
				start();
			}
		};
		const onVisibility = () => {
			if (document.hidden) {
				stop();
				persist();
			} else {
				applyMotionPref();
			}
		};

		// Pointer: grab pins the charm to the pointer; release flicks it; a short still press = click.
		const samples: Sample[] = [];
		let grabDX = 0;
		let grabDY = 0;
		let downX = 0;
		let downY = 0;
		let downT = 0;
		let moved = 0;
		let lastClickT = -1;
		const local = (e: PointerEvent) => {
			const r = box.getBoundingClientRect();
			return { x: e.clientX - r.left, y: e.clientY - r.top };
		};
		const pushSample = (p: { x: number; y: number }) => {
			samples.push({ x: p.x, y: p.y, t: performance.now() });
			if (samples.length > 5) samples.shift();
		};
		const fireClick = () => {
			frame.t = elapsed;
			const now = performance.now();
			if (lastClickT >= 0 && now - lastClickT < DOUBLE_MS && behavior.onDoubleClick) {
				behavior.onDoubleClick(frame);
				lastClickT = -1;
			} else {
				behavior.onClick?.(frame);
				lastClickT = now;
			}
			persist();
			if (reduceMotion.matches) {
				draw();
				window.setTimeout(draw, 300);
			}
		};
		const onDown = (e: PointerEvent) => {
			e.preventDefault();
			hit.setPointerCapture(e.pointerId);
			playPluck(500, 0.045); // soft catch as the charm is grabbed
			const p = local(e);
			const i = rope.n - 1;
			grabDX = rope.x[i]! - p.x;
			grabDY = rope.y[i]! - p.y;
			downX = p.x;
			downY = p.y;
			downT = performance.now();
			moved = 0;
			samples.length = 0;
			pushSample(p);
			rope.pinned = i;
			rope.pinX = p.x + grabDX;
			rope.pinY = p.y + grabDY;
		};
		const onMove = (e: PointerEvent) => {
			if (rope.pinned < 0) return;
			const p = local(e);
			moved = Math.max(moved, Math.hypot(p.x - downX, p.y - downY));
			rope.pinX = p.x + grabDX;
			rope.pinY = p.y + grabDY;
			pushSample(p);
		};
		const onUp = () => {
			if (rope.pinned < 0) return;
			rope.pinned = -1;
			const now = performance.now();
			const latest = samples[samples.length - 1];
			const oldest = samples.find((s) => now - s.t <= 80);
			let releaseSpeed = 0;
			if (latest && oldest && latest.t > oldest.t) {
				const dt = (latest.t - oldest.t) / 1000;
				let vx = (latest.x - oldest.x) / dt;
				let vy = (latest.y - oldest.y) / dt;
				releaseSpeed = Math.hypot(vx, vy);
				if (releaseSpeed > MAX_FLICK) {
					vx *= MAX_FLICK / releaseSpeed;
					vy *= MAX_FLICK / releaseSpeed;
					releaseSpeed = MAX_FLICK;
				}
				flick(rope, vx, vy, SUBSTEP);
			}
			// A "let go" pluck — a harder flick rings a touch louder and higher.
			playPluck(300 + Math.min(220, releaseSpeed / 12), Math.min(0.09, 0.035 + releaseSpeed / 30000), 0.2);
			frame.t = elapsed;
			frame.speed = releaseSpeed;
			behavior.onRelease?.(frame);
			if (moved < CLICK_MAX_MOVE && now - downT < CLICK_MAX_MS) fireClick();
			persist();
			if (reduceMotion.matches) {
				restPose(rope);
				draw();
			}
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				playPluck(500, 0.045);
				fireClick();
			}
		};

		hit.addEventListener("pointerdown", onDown);
		hit.addEventListener("pointermove", onMove);
		hit.addEventListener("pointerup", onUp);
		hit.addEventListener("pointercancel", onUp);
		hit.addEventListener("keydown", onKey);
		document.addEventListener("visibilitychange", onVisibility);
		window.addEventListener("resize", fitCanvas);
		reduceMotion.addEventListener("change", applyMotionPref);
		applyMotionPref();

		return () => {
			stop();
			persist();
			hit.removeEventListener("pointerdown", onDown);
			hit.removeEventListener("pointermove", onMove);
			hit.removeEventListener("pointerup", onUp);
			hit.removeEventListener("pointercancel", onUp);
			hit.removeEventListener("keydown", onKey);
			document.removeEventListener("visibilitychange", onVisibility);
			window.removeEventListener("resize", fitCanvas);
			reduceMotion.removeEventListener("change", applyMotionPref);
		};
	}, [charmId, projectId]);

	// The slot reserves 64px in the top bar's right-hand group. The drawing box is anchored to the
	// bar's top edge and is click-through except for the charm's hit box.
	return (
		<div className="hidden md:block relative w-16 h-10">
			<div
				ref={boxRef}
				className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
				style={{ top: "calc(50% - 36px)", width: CANVAS_W, height: CANVAS_H }}
			>
				<canvas ref={canvasRef} className="absolute inset-0" style={{ width: CANVAS_W, height: CANVAS_H }} />
				<div
					ref={hitRef}
					role="button"
					tabIndex={0}
					aria-label={`Hanging charm: ${CHARMS[charmId].name}`}
					title={CHARMS[charmId].plaque}
					className="absolute top-0 left-0 rounded-full pointer-events-auto cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
					style={{ width: SPRITE, height: SPRITE, touchAction: "none" }}
				/>
			</div>
		</div>
	);
};

export default CampfireDangle;
