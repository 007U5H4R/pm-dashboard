import { useMemo } from 'react';
import type { Task } from '../../types';
import { computeSchedule, toMermaidGantt } from '../lib/schedule';
import LoadingSpinner from './LoadingSpinner';
import MermaidMarkdown from './MermaidMarkdown';

export interface GanttPageProps {
  tasks: Task[];
  isLoading: boolean;
  loadError?: Error | null;
  projectName: string;
  onRetry?: () => void;
}

const LEGEND: Array<{ label: string; className: string }> = [
  { label: 'Done', className: 'bg-emerald-500' },
  { label: 'In Progress / In Review', className: 'bg-blue-500' },
  { label: 'Blocked', className: 'bg-red-500' },
  { label: 'To Do', className: 'bg-gray-300 dark:bg-gray-600' },
];

export default function GanttPage({ tasks, isLoading, loadError, projectName, onRetry }: GanttPageProps) {
  const schedule = useMemo(() => computeSchedule(tasks), [tasks]);
  const source = useMemo(
    () => `\`\`\`mermaid\n${toMermaidGantt(schedule, projectName)}\n\`\`\``,
    [schedule, projectName],
  );
  const unestimated = schedule.tasks.filter(t => !t.estimated).length;

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
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{loadError.message}</p>
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
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400">
        <p className="text-base font-medium">No tickets yet</p>
        <p className="text-sm mt-1">
          Create tasks with an <code className="px-1 rounded bg-gray-100 dark:bg-gray-800">sp:&lt;n&gt;</code> label and
          dependencies to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Gantt · {projectName}</h1>
        <ul className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
          {LEGEND.map(item => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded-sm ${item.className}`} />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
      {(unestimated > 0 || schedule.warnings.length > 0) && (
        <div className="mb-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
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
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 overflow-x-auto">
        {/*
          MermaidMarkdown replaces its rendered <pre><code> with a raw DOM node once the
          diagram is drawn, outside React's tracking. A same-instance prop update (a live
          schedule change) then has no `<pre><code>` left for the effect to find, so the
          chart never redraws until a full remount. Keying on the source forces exactly
          that remount whenever the computed schedule actually changes.
        */}
        <MermaidMarkdown key={source} source={source} />
      </div>
    </div>
  );
}
