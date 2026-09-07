import { Outlet, useLocation } from 'react-router-dom';
import SideNavigation from './SideNavigation';
import Navigation from './Navigation';
import { useAppearance } from '../contexts/AppearanceContext';
import { projectTheme } from './ProjectIcon';
import { DOODLES } from '../assets/doodles';
import { HealthIndicator, HealthSuccessToast } from './HealthIndicator';
import { DuplicateIdWarning } from './DuplicateIdWarning';
import type { DuplicateRepairPlan } from '../../core/duplicate-task-repair';
import { type Task, type Document, type Decision } from '../../types';

interface LayoutProps {
	projectName: string;
	showSuccessToast: boolean;
	onDismissToast: () => void;
	tasks: Task[];
	docs: Document[];
	decisions: Decision[];
	isLoading: boolean;
	loadingMessage?: string | null;
	error?: Error | null;
	onRefreshData: () => Promise<void>;
	duplicateRepairPlan?: DuplicateRepairPlan | null;
}

export default function Layout({
	projectName,
	showSuccessToast,
	onDismissToast,
	tasks,
	docs,
	decisions,
	isLoading,
	loadingMessage,
	error,
	onRefreshData,
	duplicateRepairPlan = null,
}: LayoutProps) {
	const location = useLocation();
	const { appearance } = useAppearance();
	// Doodle background shows on every page EXCEPT the board, Gantt, and Workflow (those keep their
	// own backgrounds). The doodle is the project's chosen one, else its theme default.
	const doodleExcluded = ['/board', '/gantt', '/workflow'].some((p) => location.pathname.startsWith(p));
	const doodleKey = appearance.doodleBg || projectTheme(projectName);
	const doodleUrl = !doodleExcluded ? DOODLES[doodleKey] : undefined;
	return (
		<div className="relative isolate h-screen bg-gray-50 dark:bg-gray-900 flex overflow-hidden transition-colors duration-200">
			<HealthIndicator />
			<SideNavigation 
				taskCount={tasks.length}
				docs={docs}
				decisions={decisions}
				isLoading={isLoading}
				error={error}
				onRetry={onRefreshData}
				onRefreshData={onRefreshData}
			/>
			<div className="flex-1 flex flex-col min-h-0 min-w-0">
				<Navigation projectName={projectName} loadingMessage={loadingMessage} />
				<DuplicateIdWarning plan={duplicateRepairPlan} onRepaired={onRefreshData} />
				<main className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
					<div className="relative min-h-full">
						{doodleUrl && (
							<div
								aria-hidden="true"
								className="pointer-events-none absolute inset-0"
								style={{ backgroundImage: `url(${doodleUrl})`, backgroundSize: '460px', opacity: 0.06 }}
							/>
						)}
						<div className="relative min-h-full">
							<Outlet context={{ tasks, docs, decisions, isLoading, onRefreshData }} />
						</div>
					</div>
				</main>
			</div>
			{showSuccessToast && (
				<HealthSuccessToast onDismiss={onDismissToast} />
			)}
		</div>
	);
}
