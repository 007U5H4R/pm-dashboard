import { useMemo } from 'react';
import type { Task } from '../../types';
import { computeSchedule, type ScheduledTask } from '../lib/schedule';
import { childrenByParent, rollupPercent, rollupStatus } from '../utils/ticket-rollup';

export interface CustomGanttProps {
  tasks: Task[];
  projectName: string;
  /** Optional per-task percent override (id -> 0..100). Used by views like Workflow where progress
   * comes from real data rather than the status-derived default. UI is otherwise identical. */
  percentById?: Record<string, number>;
}

/** The scheduler lays tasks out with 1 story point = 1 day-unit; this view reinterprets each unit as
 * one hour, so the axis reads in elapsed hours rather than calendar dates. */
const UNIT_MS = 86_400_000;
const HOUR_WIDTH = 52;
const LEFT_PANEL_WIDTH = 360;
const ROW_HEIGHT = 48;
const ROW_GAP = 6;
const ROW_STRIDE = ROW_HEIGHT + ROW_GAP;

/** Converts a #rrggbb hex color to an rgba() string at the given alpha, for translucent
 * liquid-glass fills over the dark gradient backdrop. */
/** Status -> app status palette (matches the board legend). Blocked overrides status. */
export function statusColor(task: ScheduledTask): string {
  if (task.blocked) return '#ef4444';
  const status = task.status.trim().toLowerCase();
  if (status === 'done') return '#10b981';
  if (status === 'in progress') return '#3b82f6';
  if (status === 'in review') return '#3b82f6';
  return '#cbd5e1';
}

/** Whole hours the task is estimated to take, from its story-point label (1 pt = 1 hour here). */
function estimatedHours(task: ScheduledTask): number {
  return Math.max(1, Math.round(task.points ?? 1));
}

function hoursLabel(task: ScheduledTask): string {
  const hours = estimatedHours(task);
  return `${hours}h`;
}

function ProgressRing({ percent, color }: { percent: number; color: string }) {
  const size = 28;
  const cx = size / 2;
  const cy = size / 2;
  const innerR = 8;
  const outerR = 12.5;
  const segments = 12;
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = clamped >= 100 ? segments : Math.round((clamped / 100) * segments);
  const ticks = Array.from({ length: segments }, (_, i) => {
    const angle = (-90 + i * (360 / segments)) * (Math.PI / 180);
    return {
      x1: cx + innerR * Math.cos(angle),
      y1: cy + innerR * Math.sin(angle),
      x2: cx + outerR * Math.cos(angle),
      y2: cy + outerR * Math.sin(angle),
      on: i < filled,
    };
  });
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 shrink-0">
      {/* Hand-drawn segmented loading ring: discrete ticks filled to the percent. */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${percent}% complete`}
        style={{ filter: 'url(#gantt-rough)' }}
      >
        {ticks.map((t, i) => (
          <line
            key={`tick-${i}`}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            strokeWidth={2.6}
            strokeLinecap="round"
            stroke={t.on ? color : undefined}
            className={t.on ? undefined : 'stroke-gray-200 dark:stroke-gray-600'}
          />
        ))}
      </svg>
    </span>
  );
}

function GanttBar({ task, left, width }: { task: ScheduledTask; left: number; width: number }) {
  const status = task.status.trim().toLowerCase();
  const color = statusColor(task);
  const isDone = status === 'done' && !task.blocked;
  const isInReview = status === 'in review' && !task.blocked;

  return (
    <div
      data-testid={`gantt-bar-${task.id}`}
      data-status={task.blocked ? 'blocked' : status}
      className="absolute top-1/2 -translate-y-1/2 h-7 bg-gray-100 dark:bg-gray-700 border-2 border-gray-800 dark:border-gray-200 overflow-hidden"
      style={{
        left,
        width: Math.max(width, HOUR_WIDTH * 0.4),
        borderRadius: '6px',
        filter: 'url(#gantt-rough)',
      }}
      title={`${task.title} · ${hoursLabel(task)} · ${task.percent}%`}
    >
      <div
        data-testid={`gantt-bar-fill-${task.id}`}
        className="h-full"
        style={{
          width: `${task.percent}%`,
          backgroundColor: color,
        }}
      />
      {/* Sketchy hatched leading edge: diagonal stripes fading out past the fill. */}
      {task.percent > 0 && task.percent < 100 && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 pointer-events-none"
          style={{
            left: `calc(${task.percent}% - 4px)`,
            width: 32,
            backgroundImage: `repeating-linear-gradient(63deg, ${color} 0, ${color} 3px, transparent 3px, transparent 9px)`,
            WebkitMaskImage: 'linear-gradient(to right, #000 0%, #000 38%, transparent 100%)',
            maskImage: 'linear-gradient(to right, #000 0%, #000 38%, transparent 100%)',
          }}
        />
      )}
      {isDone && (
        <svg
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-700 dark:text-white"
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
        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 text-[8px] font-bold text-white">
          R
        </span>
      )}
    </div>
  );
}

interface HourTick {
  hour: number;
  label: string;
}

/** One tick per elapsed hour across the whole schedule span. */
function buildHourTicks(totalHours: number): HourTick[] {
  const ticks: HourTick[] = [];
  const count = Math.max(1, Math.ceil(totalHours));
  for (let hour = 0; hour <= count; hour += 1) {
    ticks.push({ hour, label: `${hour}h` });
  }
  return ticks;
}

export default function CustomGantt({ tasks, projectName, percentById }: CustomGanttProps) {
  // Gantt shows tickets (top-level tasks) only; subtasks are tracked inside their ticket elsewhere.
  // A ticket with subtasks rolls up its status (color) from them and shows subtask completion % (ring).
  const kidsByParent = useMemo(() => childrenByParent(tasks), [tasks]);
  const ticketTasks = useMemo(
    () => tasks.filter(t => !t.parentTaskId).map(t => {
      const kids = kidsByParent.get(t.id);
      return kids && kids.length > 0 ? { ...t, status: rollupStatus(kids) } : t;
    }),
    [tasks, kidsByParent]
  );
  const schedule = useMemo(() => computeSchedule(ticketTasks), [ticketTasks]);
  // Rollup percent per ticket, then let an explicit percentById prop (e.g. Workflow) win.
  const effectivePercent = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [parentId, kids] of kidsByParent.entries()) {
      if (kids.length > 0) map[parentId] = rollupPercent(kids);
    }
    return { ...map, ...(percentById ?? {}) };
  }, [kidsByParent, percentById]);
  const scheduledTasks: ScheduledTask[] = Object.keys(effectivePercent).length > 0
    ? schedule.tasks.map(t => (effectivePercent[t.id] != null ? { ...t, percent: effectivePercent[t.id]! } : t))
    : schedule.tasks;

  if (scheduledTasks.length === 0) {
    return (
      <div
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-8 text-center text-sm text-gray-500 dark:text-gray-400"
        data-testid="gantt-empty"
      >
        No tasks to schedule.
      </div>
    );
  }

  // Elapsed-hours layout: anchor at the earliest start, measure every offset in schedule units (= hours).
  const minStart = Math.min(...scheduledTasks.map(t => t.start.getTime()));
  const maxFinish = Math.max(...scheduledTasks.map(t => t.finish.getTime()));
  const totalHours = (maxFinish - minStart) / UNIT_MS;
  const ticks = buildHourTicks(totalHours);
  const gridWidth = Math.max(ticks.length - 1, 1) * HOUR_WIDTH;
  const rowsHeight = scheduledTasks.length * ROW_STRIDE;

  const rowIndexById = new Map(scheduledTasks.map((t, index) => [t.id, index]));
  const geomById = new Map(
    scheduledTasks.map((t, index) => {
      const left = ((t.start.getTime() - minStart) / UNIT_MS) * HOUR_WIDTH;
      const width = ((t.finish.getTime() - t.start.getTime()) / UNIT_MS) * HOUR_WIDTH;
      const centerY = index * ROW_STRIDE + ROW_HEIGHT / 2;
      return [t.id, { left, width, centerY }];
    }),
  );

  // Dependency connectors: elbow from the end of each blocker's bar to the start of the dependent's bar.
  const connectors = scheduledTasks.flatMap(task => {
    const to = geomById.get(task.id);
    if (!to) return [];
    return task.dependencies.flatMap(depId => {
      const from = geomById.get(depId);
      if (from === undefined || !rowIndexById.has(depId)) return [];
      const startX = from.left + from.width;
      const startY = from.centerY;
      const endX = to.left;
      const endY = to.centerY;
      const midX = Math.max(startX + 10, endX - 12);
      const path = `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
      return [{ key: `${depId}->${task.id}`, path, endX, endY }];
    });
  });

  return (
    <div
      className="gantt-chart bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-3 overflow-hidden"
      aria-label={`Gantt chart · ${projectName}`}
    >
      {/* Hand-drawn (Excalidraw-style) roughening filter for the Gantt bars. */}
      <svg aria-hidden="true" width="0" height="0" className="pointer-events-none absolute">
        <filter id="gantt-rough" x="-6%" y="-60%" width="112%" height="220%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.06" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      {/* Inner scroller carries the overflow; the padding lives on the outer frame so scrolling content
          cannot peek into a padding gap beside the sticky header/left column. */}
      <div className="overflow-auto" style={{ maxHeight: '75vh' }}>
        <div className="relative" style={{ width: LEFT_PANEL_WIDTH + gridWidth, minWidth: '100%' }}>
        {/* Header */}
        <div
          className="flex sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700 mb-2 bg-white dark:bg-gray-800"
        >
          <div
            className="sticky left-0 z-30 flex shrink-0 items-center gap-3 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800"
            style={{ width: LEFT_PANEL_WIDTH, height: ROW_HEIGHT }}
          >
            <span className="flex-1">Title</span>
            <span className="w-16">Est. hours</span>
            <span className="w-20 text-right">Status</span>
          </div>
          <div style={{ width: gridWidth }}>
            <div className="flex h-5 items-center px-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">Elapsed hours</div>
            <div className="flex" style={{ height: ROW_HEIGHT - 20 }}>
              {ticks.slice(0, -1).map(tick => (
                <div
                  key={tick.hour}
                  className="shrink-0 flex items-center justify-start pl-1 text-[10px] font-medium text-gray-500 dark:text-gray-500 border-l border-gray-100 dark:border-gray-700"
                  style={{ width: HOUR_WIDTH }}
                >
                  {tick.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rows + dependency overlay */}
        <div className="relative" style={{ minHeight: rowsHeight }}>
          {scheduledTasks.map(task => {
            const geom = geomById.get(task.id)!;
            const color = statusColor(task);
            return (
              <div
                key={task.id}
                data-testid={`gantt-row-${task.id}`}
                className="flex mb-1.5"
              >
                <div
                  className="sticky left-0 z-10 flex shrink-0 items-center gap-3 px-3 border-b border-gray-100 dark:border-gray-700/60 bg-white dark:bg-gray-800"
                  style={{ width: LEFT_PANEL_WIDTH, height: ROW_HEIGHT }}
                >
                  <span
                    className="flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100 cursor-default"
                    title={task.title}
                  >
                    {task.title}
                  </span>
                  <span className="w-16 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {hoursLabel(task)}
                  </span>
                  <span className="w-20 flex items-center justify-end gap-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{`${task.percent}%`}</span>
                    <ProgressRing percent={task.percent} color={color} />
                  </span>
                </div>
                <div
                  className="relative"
                  style={{
                    width: gridWidth,
                    height: ROW_HEIGHT,
                    backgroundImage: 'linear-gradient(to right, var(--gantt-grid-line) 1px, transparent 1px)',
                    backgroundSize: `${HOUR_WIDTH}px 100%`,
                  }}
                >
                  <GanttBar task={task} left={geom.left} width={geom.width} />
                </div>
              </div>
            );
          })}

          {/* Dependency connectors, drawn over the grid area (offset past the sticky left panel). */}
          {connectors.length > 0 && (
            <svg
              data-testid="gantt-dependencies"
              className="pointer-events-none absolute top-0 z-0"
              style={{ left: LEFT_PANEL_WIDTH, width: gridWidth, height: rowsHeight }}
              width={gridWidth}
              height={rowsHeight}
              aria-hidden="true"
            >
              <defs>
                <marker id="gantt-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" style={{ fill: 'var(--gantt-connector-arrow)' }} />
                </marker>
              </defs>
              {connectors.map(connector => (
                <path
                  key={connector.key}
                  d={connector.path}
                  fill="none"
                  style={{ stroke: 'var(--gantt-connector)' }}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  markerEnd="url(#gantt-arrow)"
                />
              ))}
            </svg>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
