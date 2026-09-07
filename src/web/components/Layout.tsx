import { Outlet } from 'react-router-dom';
import SideNavigation from './SideNavigation';
import Navigation from './Navigation';
import { HealthIndicator, HealthSuccessToast } from './HealthIndicator';
import { DuplicateIdWarning } from './DuplicateIdWarning';
import type { DuplicateRepairPlan } from '../../core/duplicate-task-repair';
import { type Task, type Document, type Decision } from '../../types';
import { BOARD_BG } from '../assets/boardBg';

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
	return (
		<div className="relative isolate h-screen bg-gray-50 dark:bg-gray-900 flex overflow-hidden transition-colors duration-200">
			{/* Decorative backdrop for the frosted-glass app shell: the warm gradient image, plus a
			    light scrim so text sitting directly on it keeps enough contrast. `isolate` on the root
			    gives this its own stacking context so the `-z-10` layers stay behind the sidebar,
			    header, and page content instead of escaping to a parent stacking context and landing
			    under an opaque ancestor background (the bug that made an earlier backdrop attempt
			    invisible when this lived only inside the board). Moved here from Board.tsx so the
			    gradient spans the whole window instead of just the board area. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center"
				style={{ backgroundImage: `url(${BOARD_BG})` }}
			/>
			<div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-white/25 dark:bg-black/30" />
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
					<Outlet context={{ tasks, docs, decisions, isLoading, onRefreshData }} />
				</main>
			</div>
			{showSuccessToast && (
				<HealthSuccessToast onDismiss={onDismissToast} />
			)}
		</div>
	);
}
