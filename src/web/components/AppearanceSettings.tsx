import { useState } from 'react';
import { useAppearance } from '../contexts/AppearanceContext';
import { ProjectIcon, PROJECT_ICON_THEMES } from './ProjectIcon';
import { DOODLES, DOODLE_KEYS } from '../assets/doodles';
import { CHARMS, CHARM_IDS, SURPRISE, SURPRISE_PLAQUE } from '../assets/charms';
import type { AppearanceSettings as AppearanceValues } from '../lib/api';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Per-project appearance picker: choose the project icon, the doodle background (shown on most pages),
 * and the abstract background used by the Execution Gantt + Workflow. Saved server-side per project. */
export default function AppearanceSettings() {
	const { appearance, update } = useAppearance();
	const [busy, setBusy] = useState(false);
	const [saved, setSaved] = useState(false);

	const pick = async (patch: AppearanceValues) => {
		setBusy(true);
		setSaved(false);
		try {
			await update(patch);
			setSaved(true);
			window.setTimeout(() => setSaved(false), 2000);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
			<div className="flex items-center gap-2 mb-1">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Appearance</h2>
				{saved && (
					<span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
						<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
						Saved
					</span>
				)}
			</div>
			<p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Personalize this project's icon and backgrounds — changes save automatically (no need for the Save button below).</p>

			<div className={`space-y-6 ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
				{/* Project description (2-liner, shown in the top bar) */}
				<section>
					<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Project description</h3>
					<textarea
						key={appearance.description ?? ''}
						defaultValue={appearance.description ?? ''}
						onBlur={(e) => {
							const v = e.target.value.trim();
							if (v !== (appearance.description ?? '')) void pick({ description: v });
						}}
						rows={2}
						maxLength={200}
						placeholder="A short two-line description of this project (shown in the top bar)…"
						className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 resize-none"
					/>
				</section>

				{/* Project icon */}
				<section>
					<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Project icon</h3>
					<div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
						{PROJECT_ICON_THEMES.map((t) => (
							<button
								key={t}
								type="button"
								title={cap(t)}
								onClick={() => pick({ icon: t })}
								className={`flex items-center justify-center aspect-square rounded-xl bg-gray-50 dark:bg-gray-900 border-2 transition-colors ${
									appearance.icon === t ? 'border-indigo-500' : 'border-transparent hover:border-gray-300'
								}`}
							>
								<ProjectIcon name="" theme={t} className="w-6 h-6" />
							</button>
						))}
					</div>
				</section>

				{/* Doodle background */}
				<section>
					<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Doodle background</h3>
					<div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
						{DOODLE_KEYS.map((k) => (
							<button
								key={k}
								type="button"
								title={cap(k)}
								onClick={() => pick({ doodleBg: k })}
								className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-colors ${
									(appearance.doodleBg ?? '') === k ? 'border-indigo-500' : 'border-transparent hover:border-gray-300'
								}`}
							>
								<img src={DOODLES[k]} alt={cap(k)} className="w-full h-full object-cover" />
								<span className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[10px] py-0.5 text-center">{cap(k)}</span>
							</button>
						))}
					</div>
				</section>

				{/* Hanging charm (opt-in delighter) */}
				<section>
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Hanging charm</h3>
						<button
							type="button"
							role="switch"
							aria-checked={appearance.charmEnabled === true}
							aria-label="Hanging charm"
							onClick={() => pick({ charmEnabled: !(appearance.charmEnabled === true) })}
							title={appearance.charmEnabled ? 'On — click to turn off' : 'Off — click to turn on'}
							className="relative h-14 w-10 shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							{/* hand-drawn rocker frame (wobbly ink outline) */}
							<span
								aria-hidden="true"
								className="absolute inset-0 border-2 border-gray-800 dark:border-gray-200"
								style={{ borderRadius: '8px 6px 9px 6px / 6px 9px 6px 8px', filter: 'url(#hand-rough)', transform: 'translateZ(0)' }}
							/>
							{/* rocker: the lit/raised half shows the current state (I = on, O = off) */}
							<span className="absolute inset-[4px] flex flex-col overflow-hidden rounded-[5px]">
								<span
									className="relative flex flex-1 items-center justify-center text-[13px] font-bold leading-none text-white"
									style={{ backgroundColor: appearance.charmEnabled ? '#22c55e' : '#b91c1c' }}
								>
									{appearance.charmEnabled && <span className="absolute inset-x-0 top-0 h-1.5 bg-white/40" />}I
								</span>
								<span
									className="relative flex flex-1 items-center justify-center text-[13px] font-bold leading-none text-white"
									style={{ backgroundColor: appearance.charmEnabled ? '#15803d' : '#ef4444' }}
								>
									{!appearance.charmEnabled && <span className="absolute inset-x-0 bottom-0 h-1.5 bg-white/45" />}O
								</span>
							</span>
						</button>
					</div>
					{appearance.charmEnabled && (
						<div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-3">
							{CHARM_IDS.map((id) => (
								<button
									key={id}
									type="button"
									title={CHARMS[id].plaque}
									onClick={() => pick({ charm: id })}
									className={`flex flex-col items-center rounded-xl bg-gray-50 dark:bg-gray-900 border-2 p-1 transition-colors ${
										(appearance.charm ?? 'marshmallow') === id ? 'border-indigo-500' : 'border-transparent hover:border-gray-300'
									}`}
								>
									<img src={CHARMS[id].image} alt={CHARMS[id].name} className="w-10 h-10 object-contain" />
									<span className="mt-0.5 text-[10px] text-gray-600 dark:text-gray-400 truncate max-w-full">{CHARMS[id].name}</span>
								</button>
							))}
							<button
								key={SURPRISE}
								type="button"
								title={SURPRISE_PLAQUE}
								onClick={() => pick({ charm: SURPRISE })}
								className={`flex flex-col items-center rounded-xl bg-gray-50 dark:bg-gray-900 border-2 p-1 transition-colors ${
									appearance.charm === SURPRISE ? 'border-indigo-500' : 'border-transparent hover:border-gray-300'
								}`}
							>
								<span
									className="flex h-10 w-10 items-center justify-center text-lg font-bold text-white bg-amber-500 border-2 border-gray-800 dark:border-gray-200"
									style={{ borderRadius: '12px 10px 13px 9px / 9px 13px 10px 12px', filter: 'url(#hand-rough)', transform: 'translateZ(0)' }}
								>
									?
								</span>
								<span className="mt-0.5 text-[10px] text-gray-600 dark:text-gray-400">Surprise</span>
							</button>
						</div>
					)}
				</section>

			</div>
		</div>
	);
}
