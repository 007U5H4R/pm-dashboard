import { useMemo } from 'react';
import type { Task } from '../../types';
import { computeSchedule, type ScheduledTask } from '../lib/schedule';

export interface CustomGanttProps {
  tasks: Task[];
  projectName: string;
}

const DAY_MS = 86_400_000;
const DAY_WIDTH = 32;
const LEFT_PANEL_WIDTH = 360;
const ROW_HEIGHT = 48;

const AVATAR_PALETTE = [
  'bg-pink-500',
  'bg-purple-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-cyan-500',
  'bg-rose-500',
  'bg-lime-600',
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function hexToRgba(hex: string, alpha: number): string {
  const int = Number.parseInt(hex.slice(1), 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Done -> green, Blocked -> red, In Progress/In Review -> blue, everything else (To Do) -> gray. */
export function statusColor(task: ScheduledTask): string {
  if (task.blocked) return '#ef4444';
  const status = task.status.trim().toLowerCase();
  if (status === 'done') return '#10b981';
  if (status === 'in progress' || status === 'in review') return '#3b82f6';
  return '#d1d5db';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/** Multiple assignees collapse to the first initial + a "+n" count. */
export function avatarLabel(assignee: string[]): string {
  if (assignee.length === 0) return '';
  if (assignee.length === 1) return initials(assignee[0]!);
  return `${assignee[0]!.trim()[0]?.toUpperCase() ?? '?'}+${assignee.length - 1}`;
}

function Avatar({ assignee }: { assignee: string[] }) {
  if (assignee.length === 0) return null;
  const colorClass = AVATAR_PALETTE[hashString(assignee.join(',')) % AVATAR_PALETTE.length];
  return (
    <span
      data-testid="gantt-avatar"
      title={assignee.join(', ')}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-semibold text-white ring-2 ring-white dark:ring-gray-900 ${colorClass}`}
    >
      {avatarLabel(assignee)}
    </span>
  );
}

function ProgressRing({ percent, color }: { percent: number; color: string }) {
  const size = 28;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={`${percent}% complete`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className="stroke-gray-200 dark:stroke-gray-700"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/** ScheduledTask plus the raw assignee list, joined in from the source tasks for avatar rendering. */
type GanttRowTask = ScheduledTask & { assignee: string[] };

function GanttBar({ task, left, width }: { task: GanttRowTask; left: number; width: number }) {
  const status = task.status.trim().toLowerCase();
  const color = statusColor(task);
  const isDone = status === 'done' && !task.blocked;
  const isInReview = status === 'in review' && !task.blocked;

  return (
    <div
      data-testid={`gantt-bar-${task.id}`}
      data-status={task.blocked ? 'blocked' : status}
      className="absolute top-1/2 -translate-y-1/2 h-6 rounded-full"
      style={{ left, width: Math.max(width, DAY_WIDTH * 0.4), backgroundColor: hexToRgba(color, 0.25) }}
      title={`${task.title} · ${task.percent}%${task.assignee?.length ? ` · ${task.assignee.join(', ')}` : ''}`}
    >
      <div
        data-testid={`gantt-bar-fill-${task.id}`}
        className="h-full rounded-full"
        style={{ width: `${task.percent}%`, backgroundColor: color }}
      />
      {task.assignee && task.assignee.length > 0 && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 z-10">
          <Avatar assignee={task.assignee} />
        </div>
      )}
      {isDone && (
        <svg
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {isInReview && (
        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white dark:bg-gray-900 ring-1 ring-blue-500 text-[8px] font-bold text-blue-600 dark:text-blue-400">
          R
        </span>
      )}
    </div>
  );
}

/** Widened by one day on each side, per the spec's "pad a day each side". */
function scheduleRange(tasks: ScheduledTask[]): { start: Date; end: Date } {
  const starts = tasks.map(t => t.start.getTime());
  const finishes = tasks.map(t => t.finish.getTime());
  const start = startOfUtcDay(new Date(Math.min(...starts) - DAY_MS));
  const end = startOfUtcDay(new Date(Math.max(...finishes) + DAY_MS));
  return { start, end };
}

function buildDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    days.push(new Date(t));
  }
  return days;
}

interface MonthGroup {
  label: string;
  days: number;
}

function groupByMonth(days: Date[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  for (const day of days) {
    const label = formatter.format(day);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.days += 1;
    } else {
      groups.push({ label, days: 1 });
    }
  }
  return groups;
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'narrow', timeZone: 'UTC' });

export default function CustomGantt({ tasks, projectName }: CustomGanttProps) {
  const schedule = useMemo(() => computeSchedule(tasks), [tasks]);
  const assigneeById = useMemo(() => new Map(tasks.map(t => [t.id, t.assignee])), [tasks]);
  const scheduledTasks: GanttRowTask[] = schedule.tasks.map(t => ({
    ...t,
    assignee: assigneeById.get(t.id) ?? [],
  }));

  if (scheduledTasks.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400" data-testid="gantt-empty">
        No tasks to schedule.
      </div>
    );
  }

  const { start: rangeStart, end: rangeEnd } = scheduleRange(scheduledTasks);
  const days = buildDays(rangeStart, rangeEnd);
  const months = groupByMonth(days);
  const gridWidth = days.length * DAY_WIDTH;
  const today = startOfUtcDay(new Date());
  const todayOffset = today >= rangeStart && today <= rangeEnd ? (today.getTime() - rangeStart.getTime()) / DAY_MS * DAY_WIDTH : null;

  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-auto"
      style={{ maxHeight: '75vh' }}
      aria-label={`Gantt chart · ${projectName}`}
    >
      <div className="relative" style={{ width: LEFT_PANEL_WIDTH + gridWidth, minWidth: '100%' }}>
        {todayOffset !== null && (
          <div
            data-testid="gantt-today-line"
            className="absolute top-0 bottom-0 w-px bg-red-400/70 dark:bg-red-400/60 z-10"
            style={{ left: LEFT_PANEL_WIDTH + todayOffset }}
          />
        )}

        {/* Header */}
        <div className="flex sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div
            className="sticky left-0 z-30 flex shrink-0 items-center gap-3 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700"
            style={{ width: LEFT_PANEL_WIDTH, height: ROW_HEIGHT }}
          >
            <span className="flex-1">Title</span>
            <span className="w-16">Duration</span>
            <span className="w-20 text-right">Status</span>
          </div>
          <div style={{ width: gridWidth }}>
            <div className="flex h-5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {months.map((month, index) => (
                <div
                  key={`${month.label}-${index}`}
                  className="border-r border-gray-100 dark:border-gray-800 px-1.5 flex items-center"
                  style={{ width: month.days * DAY_WIDTH }}
                >
                  {month.label}
                </div>
              ))}
            </div>
            <div className="flex" style={{ height: ROW_HEIGHT - 20 }}>
              {days.map(day => (
                <div
                  key={day.toISOString()}
                  className="shrink-0 flex items-center justify-center text-[10px] text-gray-400 dark:text-gray-500 border-r border-gray-100 dark:border-gray-800"
                  style={{ width: DAY_WIDTH }}
                >
                  {`${WEEKDAY_FORMATTER.format(day)} ${day.getUTCDate()}`}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rows */}
        {scheduledTasks.map(task => {
          const left = (task.start.getTime() - rangeStart.getTime()) / DAY_MS * DAY_WIDTH;
          const width = (task.finish.getTime() - task.start.getTime()) / DAY_MS * DAY_WIDTH;
          const color = statusColor(task);
          return (
            <div
              key={task.id}
              data-testid={`gantt-row-${task.id}`}
              className="flex border-b border-gray-100 dark:border-gray-800"
            >
              <div
                className="sticky left-0 z-10 flex shrink-0 items-center gap-3 px-3 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700"
                style={{ width: LEFT_PANEL_WIDTH, height: ROW_HEIGHT }}
              >
                <span className="flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100" title={task.title}>
                  {task.title}
                </span>
                <span className="w-16 text-xs text-gray-500 dark:text-gray-400">
                  {`${task.days} day${task.days === 1 ? '' : 's'}`}
                </span>
                <span className="w-20 flex items-center justify-end gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{`${task.percent}%`}</span>
                  <ProgressRing percent={task.percent} color={color} />
                </span>
              </div>
              <div
                className="relative"
                style={{
                  width: gridWidth,
                  height: ROW_HEIGHT,
                  backgroundImage: 'linear-gradient(to right, rgba(148, 163, 184, 0.25) 1px, transparent 1px)',
                  backgroundSize: `${DAY_WIDTH}px 100%`,
                }}
              >
                <GanttBar task={task} left={left} width={width} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
