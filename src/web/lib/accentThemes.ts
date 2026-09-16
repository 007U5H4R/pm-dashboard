// Office-style per-project accent themes. Each theme is a named set of chrome CSS variables defined
// in styles/source.css (`.accent-<key>` + `.dark .accent-<key>`); this module only enumerates the
// keys and the swatch color shown in the settings picker. Absent/unknown → neutral (today's look).

export interface AccentTheme {
	key: string;
	label: string;
	/** Swatch color shown in the settings picker (the theme's top-bar accent). */
	swatch: string;
}

export const ACCENT_THEMES: AccentTheme[] = [
	{ key: "neutral", label: "Neutral", swatch: "#6b7280" },
	{ key: "blue", label: "Blue", swatch: "#2b579a" },
	{ key: "green", label: "Green", swatch: "#217346" },
	{ key: "orange", label: "Orange", swatch: "#c43e1c" },
	{ key: "purple", label: "Purple", swatch: "#80397b" },
	{ key: "red", label: "Red", swatch: "#a4373a" },
	{ key: "teal", label: "Teal", swatch: "#0f766e" },
];

export const ACCENT_KEYS: string[] = ACCENT_THEMES.map((t) => t.key);

export const DEFAULT_ACCENT = "neutral";

/** The chrome class for a saved accent. Unknown/absent falls back to neutral, so a stored value can
 * never inject an arbitrary class name into the layout. */
export function accentClass(accent?: string): string {
	const key = accent && ACCENT_KEYS.includes(accent) ? accent : DEFAULT_ACCENT;
	return `accent-${key}`;
}
