/**
 * Deterministic "charm of the day" for the Surprise option: the same local date always yields the
 * same charm, stable across a browser session and (for the same local date) across devices, and never
 * the same charm as the day before. Chained day-by-day from a fixed epoch so each day can exclude the
 * previous day's pick.
 */

/** Local YYYY-MM-DD for a date (used as the cache key by the caller). */
export function localDateKey(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function fnv1a(s: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

const EPOCH = Date.UTC(2026, 0, 1);

/** Whole local days from the epoch to this date's local midnight. */
function dayIndex(d: Date): number {
	const localMidnight = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
	return Math.max(0, Math.round((localMidnight - EPOCH) / 86_400_000));
}

/** The charm id for `date`'s local day, never equal to the previous day's. */
export function surpriseCharmFor<T extends string>(date: Date, ids: readonly T[]): T {
	if (ids.length === 0) throw new Error("surpriseCharmFor: no charm ids");
	if (ids.length === 1) return ids[0] as T;
	const days = dayIndex(date);
	let prev = -1;
	for (let k = 0; k <= days; k++) {
		// Pick from every id except the previous day's, then map back to the full range.
		let idx = fnv1a(`campfire-charm-${k}`) % (prev < 0 ? ids.length : ids.length - 1);
		if (prev >= 0 && idx >= prev) idx += 1;
		prev = idx;
	}
	return ids[prev] as T;
}
