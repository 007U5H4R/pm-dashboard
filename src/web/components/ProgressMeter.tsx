import React from "react";

export interface MeterSegment {
	/** Width as a percentage of the full bar (0–100). */
	value: number;
	/** Fill colour for this segment. */
	color: string;
}

interface ProgressMeterProps {
	/** Coloured segments, left→right. Widths are percentages of the full bar and need not sum to 100 —
	 *  any remainder shows as empty track. Same-colour segments are merged so a single fill reads clean. */
	segments: MeterSegment[];
	/** Tailwind height class (default h-3). */
	heightClass?: string;
	/** Extra classes — pass a width (e.g. "w-full", "w-16") and any margin. */
	className?: string;
	title?: string;
}

/**
 * The app-wide progress bar: a hand-drawn (Excalidraw) ink-outlined pill with a transparent track and
 * one coloured segment per part. Shared by the milestone ledger, ticket cards, and Statistics so every
 * progress bar reads the same. Uses the app-wide #hand-rough filter (mounted once in Layout), so it
 * works on any page without a local filter.
 */
const ProgressMeter: React.FC<ProgressMeterProps> = ({ segments, heightClass = "h-3", className = "", title }) => {
	// Merge same-colour segments so keys stay unique and a repeated colour reads as one chunk.
	const merged = segments.reduce<MeterSegment[]>((acc, seg) => {
		if (seg.value <= 0) return acc;
		const hit = acc.find((a) => a.color === seg.color);
		if (hit) hit.value += seg.value;
		else acc.push({ ...seg });
		return acc;
	}, []);

	return (
		<div
			className={`relative flex ${heightClass} overflow-hidden border-2 border-gray-800 bg-transparent dark:border-gray-200 ${className}`}
			style={{ borderRadius: "999px", filter: "url(#hand-rough)" }}
			title={title}
		>
			{merged.map((seg) => (
				<div
					key={seg.color}
					className="h-full transition-all duration-300"
					style={{ width: `${Math.max(0, Math.min(100, seg.value))}%`, backgroundColor: seg.color }}
				/>
			))}
		</div>
	);
};

export default ProgressMeter;
