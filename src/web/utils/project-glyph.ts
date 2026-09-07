// A project's glyph, matched to its name/type. Keyed by registry id first, then by keywords in the
// name, so new projects still resolve to something sensible (final fallback: a folder). Shared by the
// project switcher and the top bar so they always agree.
const BY_ID: Record<string, string> = {
	"slag-city": "🎮",
	railcite: "🚆",
	graphology: "✍️",
	game: "🕹️",
	"dino-arcade-pwa": "🦕",
	teachspark: "🎓",
	nuptis: "💍",
	velora: "💎",
	"pratyasa-site": "🪷",
	"bhakti-vilas": "🪔",
};

export function projectGlyph(name: string, id?: string): string {
	if (id && BY_ID[id]) return BY_ID[id];
	const n = (name ?? "").toLowerCase();
	if (BY_ID[n]) return BY_ID[n];
	if (/velora/.test(n)) return "💎";
	if (/pratyasa|patent|lotus/.test(n)) return "🪷";
	if (/bhakti|vilas|temple|devot/.test(n)) return "🪔";
	if (/dino/.test(n)) return "🦕";
	if (/slag|game|arcade|play/.test(n)) return "🎮";
	if (/nupti|wedding|bride/.test(n)) return "💍";
	if (/teach|spark|edu|learn|school/.test(n)) return "🎓";
	if (/rail|cite|train|transit/.test(n)) return "🚆";
	if (/graph|write|hand|sign/.test(n)) return "✍️";
	return "📁";
}
