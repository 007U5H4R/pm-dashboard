import React from 'react';

// Colorful, dark-outlined flat project icons matched to a project's theme (same style as the nav icons).
// Resolves by registry id first, then name keywords, so new projects still get a sensible icon.
export type Theme = 'game' | 'wedding' | 'education' | 'writing' | 'rail' | 'devotion' | 'gem' | 'tech' | 'nature' | 'finance';

export const PROJECT_ICON_THEMES: Theme[] = ['game', 'wedding', 'education', 'writing', 'rail', 'devotion', 'gem', 'tech', 'nature', 'finance'];

const BY_ID: Record<string, Theme> = {
	'slag-city': 'game',
	game: 'game',
	'dino-arcade-pwa': 'game',
	nuptis: 'wedding',
	teachspark: 'education',
	graphology: 'writing',
	railcite: 'rail',
	'bhakti-vilas': 'devotion',
	'pratyasa-site': 'devotion',
	velora: 'gem',
};

export function projectTheme(name: string, id?: string): Theme {
	if (id && BY_ID[id]) return BY_ID[id];
	const n = (name ?? '').toLowerCase();
	if (/velora|gem|jewel/.test(n)) return 'gem';
	if (/dino|slag|game|arcade|play/.test(n)) return 'game';
	if (/nupti|wedding|bride/.test(n)) return 'wedding';
	if (/teach|spark|edu|learn|school/.test(n)) return 'education';
	if (/graph|write|hand|sign/.test(n)) return 'writing';
	if (/rail|cite|train|transit/.test(n)) return 'rail';
	if (/bhakti|vilas|temple|devot|patent|pratyasa|lotus/.test(n)) return 'devotion';
	if (/tech|software|app|dev|code|web|api|pwa/.test(n)) return 'tech';
	if (/nature|eco|green|plant|garden|farm/.test(n)) return 'nature';
	if (/finance|bank|money|budget|invest|sales|account/.test(n)) return 'finance';
	return 'gem';
}

const PATHS: Record<Theme, React.ReactNode> = {
	game: (
		<>
			<rect x="3" y="8" width="18" height="9" rx="4.5" fill="#93c5fd" />
			<path d="M6.5 12.5h3M8 11v3" />
			<circle cx="15.5" cy="11.8" r="1.1" fill="#fde68a" />
			<circle cx="17.6" cy="13.8" r="1.1" fill="#fca5a5" />
		</>
	),
	wedding: (
		<>
			<circle cx="9.5" cy="14" r="5" fill="#fde68a" />
			<circle cx="15" cy="14" r="5" fill="none" />
			<path d="M15 4.5l2 3h-4z" fill="#fca5a5" />
		</>
	),
	education: (
		<>
			<path d="M2 9l10-4 10 4-10 4z" fill="#fcd34d" />
			<path d="M6 11.2V15c0 1.6 2.7 3 6 3s6-1.4 6-3v-3.8" />
			<line x1="21" y1="9" x2="21" y2="14.5" />
		</>
	),
	writing: (
		<>
			<path d="M5 19l1.3-4.4L15 6l3 3-8.6 8.6L5 19z" fill="#fca5a5" />
			<path d="M14 7l3 3" />
		</>
	),
	rail: (
		<>
			<rect x="5" y="4" width="14" height="13" rx="3.5" fill="#5eead4" />
			<rect x="8" y="7" width="8" height="5" rx="1.2" fill="#ffffff" />
			<path d="M8 20l-2 1M16 20l2 1" />
			<circle cx="9" cy="19" r="1.5" fill="#334155" stroke="none" />
			<circle cx="15" cy="19" r="1.5" fill="#334155" stroke="none" />
		</>
	),
	devotion: (
		<>
			<path d="M12 4c-4 3-6 6.5-6 9a6 6 0 0 0 12 0c0-2.5-2-6-6-9z" fill="#c4b5fd" />
			<path d="M8.5 12.5q3.5-4 7 0" />
		</>
	),
	gem: (
		<>
			<path d="M7 4h10l4 5-9 11L3 9z" fill="#a5f3fc" />
			<path d="M3 9h18M9 4l-2 5 5 11 5-11-2-5" />
		</>
	),
	tech: (
		<>
			<rect x="3" y="5" width="18" height="14" rx="2.5" fill="#bfdbfe" />
			<path d="M9 10l-2.5 2.5L9 15M15 10l2.5 2.5L15 15" />
		</>
	),
	nature: (
		<>
			<path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14z" fill="#86efac" />
			<path d="M5 19c4-4.5 8.5-7.5 13-9.5" />
		</>
	),
	finance: (
		<>
			<rect x="3.5" y="12" width="4.2" height="8" rx="1.2" fill="#6ee7b7" />
			<rect x="9.9" y="8" width="4.2" height="12" rx="1.2" fill="#34d399" />
			<rect x="16.3" y="4" width="4.2" height="16" rx="1.2" fill="#10b981" />
		</>
	),
};

export function ProjectIcon({
	name,
	id,
	theme,
	className = 'w-5 h-5',
}: { name: string; id?: string; theme?: string; className?: string }) {
	const resolved = (theme && (PROJECT_ICON_THEMES as string[]).includes(theme) ? (theme as Theme) : null) ?? projectTheme(name, id);
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
			{PATHS[resolved]}
		</svg>
	);
}
