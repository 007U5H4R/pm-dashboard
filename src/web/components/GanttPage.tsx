import { useMemo } from 'react';
import type { Task } from '../../types';
import { computeSchedule } from '../lib/schedule';
import CustomGantt from './CustomGantt';
import LoadingSpinner from './LoadingSpinner';

export interface GanttPageProps {
  tasks: Task[];
  isLoading: boolean;
  loadError?: Error | null;
  projectName: string;
  onRetry?: () => void;
}

const LEGEND: Array<{ label: string; hex: string }> = [
  { label: 'Done', hex: '#10b981' },
  { label: 'In Progress', hex: '#3b82f6' },
  { label: 'In Review', hex: '#3b82f6' },
  { label: 'Blocked', hex: '#ef4444' },
  { label: 'To Do', hex: '#cbd5e1' },
];

export default function GanttPage({ tasks, isLoading, loadError, projectName, onRetry }: GanttPageProps) {
  const schedule = useMemo(() => computeSchedule(tasks), [tasks]);
  const unestimated = schedule.tasks.filter(t => !t.estimated).length;
  const headText = 'text-gray-900 dark:text-gray-100';
  const subText = 'text-gray-500 dark:text-gray-400';

  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8" role="status">
        <LoadingSpinner size="md" text="Loading Gantt…" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (loadError && tasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" role="alert">
        <div className="p-4 bg-black/30 dark:bg-black/40 backdrop-blur-lg border border-white/15 dark:border-white/10 border-t-white/40 dark:border-t-white/20 rounded-2xl shadow-lg shadow-black/20 dark:shadow-black/40">
          <p className="text-sm text-red-300 mb-3">{loadError.message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${subText}`}>
        <p className={`text-base font-medium ${headText}`}>No tickets yet</p>
        <p className="text-sm mt-1">
          Create tasks with an <code className="px-1 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">sp:&lt;n&gt;</code> label and
          dependencies to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className={`text-xl font-semibold ${headText}`}>Gantt · {projectName}</h1>
        <ul className={`flex flex-wrap gap-3 text-xs ${subText}`}>
          {LEGEND.map(item => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-[4px] border border-black/10"
                style={{ backgroundColor: item.hex, opacity: 0.85 }}
              />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
      {(unestimated > 0 || schedule.warnings.length > 0) && (
        <div className="mb-3 text-xs text-amber-200 space-y-1">
          {unestimated > 0 && (
            <p>
              {`${unestimated} ticket${unestimated === 1 ? '' : 's'} without an estimate (shown as "no est.", scheduled as 1 pt).`}
            </p>
          )}
          {schedule.warnings.map(warning => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
      <CustomGantt tasks={tasks} projectName={projectName} />
    </div>
  );
}
