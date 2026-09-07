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

/** Mixes hex toward white (percent > 0) or black (percent < 0) for a soft-emboss gradient. */
function shade(hex: string, percent: number): string {
  const int = Number.parseInt(hex.slice(1), 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const target = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  const mix = (channel: number) => Math.round((target - channel) * p) + channel;
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/** Status -> pastel neumorphism palette (Done mint, In Progress soft green, In Review
 * yellow, Blocked coral, To Do lavender). Blocked overrides status. */
export function statusColor(task: ScheduledTask): string {
  if (task.blocked) return '#FA897B';
  const status = task.status.trim().toLowerCase();
  if (status === 'done') return '#86E3CE';
  if (status === 'in progress') return '#D0E6A5';
  if (status === 'in review') return '#FFDD94';
  return '#CCABD8';
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
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-semibold text-white ring-2 ring-[var(--neu-bg)] ${colorClass}`}
    >
      {avatarLabel(assignee)}
    </span>
  );
}

function ProgressRing({ percent, color }: { percent: number; color: string }) {
  const size = 28;
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full neu-pressed-sm shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${percent}% complete`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-black/10 dark:stroke-white/10"
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
    </span>
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
      className="absolute top-1/2 -translate-y-1/2 h-6 rounded-full neu-pressed-sm"
      style={{ left, width: Math.max(width, DAY_WIDTH * 0.4) }}
      title={`${task.title} · ${task.percent}%${task.assignee?.length ? ` · ${task.assignee.join(', ')}` : ''}`}
    >
      <div
        data-testid={`gantt-bar-fill-${task.id}`}
        className="h-full rounded-full neu-raised-sm"
        style={{
          width: `${task.percent}%`,
          backgroundColor: color,
          backgroundImage: `linear-gradient(135deg, ${shade(color, 0.35)} 0%, ${color} 55%, ${shade(color, -0.12)} 100%)`,
        }}
      />
      {task.assignee && task.assignee.length > 0 && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 z-10">
          <Avatar assignee={task.assignee} />
        </div>
      )}
      {isDone && (
        <svg
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-black/55"
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
        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--neu-bg)] neu-raised-sm text-[8px] font-bold text-amber-700 dark:text-amber-300">
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
      <div className="neu rounded-3xl neu-raised p-8 text-center text-sm text-slate-600 dark:text-slate-300" data-testid="gantt-empty">
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
      className="neu neu-raised rounded-3xl p-3 overflow-auto"
      style={{ maxHeight: '75vh' }}
      aria-label={`Gantt chart · ${projectName}`}
    >
      <div className="relative" style={{ width: LEFT_PANEL_WIDTH + gridWidth, minWidth: '100%' }}>
        {todayOffset !== null && (
          <div
            data-testid="gantt-today-line"
            className="absolute top-0 bottom-0 w-px bg-[#FA897B]/60 dark:bg-[#FA897B]/50 z-10"
            style={{ left: LEFT_PANEL_WIDTH + todayOffset }}
          />
        )}

        {/* Header */}
        <div className="flex sticky top-0 z-20 bg-[var(--neu-bg)] shadow-[0_4px_10px_-6px_rgba(0,0,0,0.35)] dark:shadow-[0_4px_10px_-6px_rgba(0,0,0,0.6)] rounded-2xl mb-2">
          <div
            className="sticky left-0 z-30 flex shrink-0 items-center gap-3 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-[var(--neu-bg)] rounded-2xl"
            style={{ width: LEFT_PANEL_WIDTH, height: ROW_HEIGHT }}
          >
            <span className="flex-1">Title</span>
            <span className="w-16">Duration</span>
            <span className="w-20 text-right">Status</span>
          </div>
          <div style={{ width: gridWidth }}>
            <div className="flex h-5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {months.map((month, index) => (
                <div
                  key={`${month.label}-${index}`}
                  className="px-1.5 flex items-center"
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
                  className="shrink-0 flex items-center justify-center text-[10px] font-medium text-slate-500 dark:text-slate-400"
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
              className="flex mb-1.5"
            >
              <div
                className="sticky left-0 z-10 flex shrink-0 items-center gap-3 px-3 bg-[var(--neu-bg)] neu-raised-sm rounded-2xl"
                style={{ width: LEFT_PANEL_WIDTH, height: ROW_HEIGHT }}
              >
                <span className="flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100" title={task.title}>
                  {task.title}
                </span>
                <span className="w-16 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {`${task.days} day${task.days === 1 ? '' : 's'}`}
                </span>
                <span className="w-20 flex items-center justify-end gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{`${task.percent}%`}</span>
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
