import { useState, type ChangeEvent } from 'react';
import { useAppearance } from '../contexts/AppearanceContext';
import { ProjectIcon, PROJECT_ICON_THEMES } from './ProjectIcon';
import { DOODLES, DOODLE_KEYS } from '../assets/doodles';
import { GANTT_BACKGROUNDS, GANTT_BG_KEYS } from '../assets/gantt-backgrounds';
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

	// Upload a custom Gantt/Workflow background from the browser: downscale to keep it light, store as
	// a data URI in the ganttBg field (the pages accept either a preset key or a data: URI).
	const onUploadGanttBg = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			const img = new Image();
			img.onload = () => {
				const maxW = 1400;
				const scale = Math.min(1, maxW / img.width);
				const w = Math.max(1, Math.round(img.width * scale));
				const h = Math.max(1, Math.round(img.height * scale));
				const canvas = document.createElement('canvas');
				canvas.width = w;
				canvas.height = h;
				const ctx = canvas.getContext('2d');
				if (!ctx) return;
				ctx.drawImage(img, 0, 0, w, h);
				void pick({ ganttBg: canvas.toDataURL('image/jpeg', 0.72) });
			};
			img.src = reader.result as string;
		};
		reader.readAsDataURL(file);
	};

	const customGanttBg = appearance.ganttBg?.startsWith('data:') ? appearance.ganttBg : undefined;

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

				{/* Gantt / Workflow background */}
				<section>
					<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Execution Gantt &amp; Workflow background</h3>
					<div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
						{GANTT_BG_KEYS.map((k) => (
							<button
								key={k}
								type="button"
								title={cap(k)}
								onClick={() => pick({ ganttBg: k })}
								className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-colors ${
									(appearance.ganttBg ?? '') === k ? 'border-indigo-500' : 'border-transparent hover:border-gray-300'
								}`}
							>
								<img src={GANTT_BACKGROUNDS[k]} alt={cap(k)} className="w-full h-full object-cover" />
								<span className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[10px] py-0.5 text-center">{cap(k)}</span>
							</button>
						))}
						{customGanttBg && (
							<div
								className={`relative aspect-video rounded-xl overflow-hidden border-2 ${'border-indigo-500'}`}
								title="Custom (uploaded)"
							>
								<img src={customGanttBg} alt="Custom" className="w-full h-full object-cover" />
								<span className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[10px] py-0.5 text-center">Custom</span>
							</div>
						)}
						<label
							className="relative aspect-video rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-1 text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-500 cursor-pointer transition-colors"
							title="Upload your own image"
						>
							<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
							<span className="text-[10px] font-medium">Upload</span>
							<input type="file" accept="image/*" className="hidden" onChange={onUploadGanttBg} />
						</label>
					</div>
				</section>
			</div>
		</div>
	);
}
