import { useEffect, useRef, useState } from 'react';
import { type ProjectSummary, useProject } from '../contexts/ProjectContext';
import { ProjectIcon } from './ProjectIcon';
import { useAppearance } from '../contexts/AppearanceContext';

interface ProjectSwitcherViewProps {
	projects: ProjectSummary[];
	activeProjectId: string | null;
	onSelect: (id: string) => void;
	/** Test/SSR hook: initial open state. */
	open?: boolean;
}

/** Presentational selector (Railway/Supabase pattern): current name + chevron, popover list, checkmark on active. */
export function ProjectSwitcherView({ projects, activeProjectId, onSelect, open = false }: ProjectSwitcherViewProps) {
	const [isOpen, setIsOpen] = useState(open);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const { appearance } = useAppearance();

	useEffect(() => {
		if (!isOpen) return;
		const onPointerDown = (event: MouseEvent) => {
			if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setIsOpen(false);
		};
		document.addEventListener('mousedown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('mousedown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [isOpen]);

	if (projects.length === 0) return null;
	const active = projects.find(p => p.id === activeProjectId) ?? projects[0];
	if (!active) return null;

	return (
		<div ref={rootRef} className="relative px-4 pt-4 pb-2">
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={isOpen}
				aria-label="Switch project"
				onClick={() => setIsOpen(v => !v)}
				className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-white/40 dark:border-white/10 bg-white/60 dark:bg-gray-800/50 backdrop-blur-md text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-white/80 dark:hover:bg-gray-800/70 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400"
			>
				<span className="flex items-center gap-2 min-w-0">
					<span className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
						<ProjectIcon name={active.name} id={active.id} theme={appearance.icon} className="w-5 h-5" />
					</span>
					<span className="truncate">{active.name}</span>
				</span>
				<svg
					className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</svg>
			</button>
			{isOpen && (
				<ul
					role="menu"
					aria-label="Projects"
					className="absolute left-4 right-4 mt-1 z-20 rounded-lg border border-white/40 dark:border-white/10 bg-white/90 dark:bg-gray-900/85 backdrop-blur-lg shadow-lg py-1 max-h-72 overflow-auto"
				>
					{projects.map(project => {
						const selected = project.id === active.id;
						return (
							<li key={project.id}>
								<button
									type="button"
									role="menuitem"
									aria-current={selected ? 'true' : undefined}
									onClick={() => {
										setIsOpen(false);
										if (!selected) onSelect(project.id);
									}}
									className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 ${
										selected
											? 'text-blue-600 dark:text-blue-400 font-medium'
											: 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
									}`}
								>
									<span className="flex items-center gap-2 min-w-0"><ProjectIcon name={project.name} id={project.id} theme={selected ? appearance.icon : project.icon} className="w-5 h-5 shrink-0" /><span className="truncate">{project.name}</span></span>
									{selected && (
										<svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
										</svg>
									)}
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

export default function ProjectSwitcher() {
	const { projects, activeProjectId, setProjectId } = useProject();
	return <ProjectSwitcherView projects={projects} activeProjectId={activeProjectId} onSelect={setProjectId} />;
}
