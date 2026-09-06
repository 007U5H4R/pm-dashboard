import type { Task } from "../../types/index.ts";

/** Story points ride on a label because the CLI strips custom frontmatter keys (Design.md §3). */
export const SP_LABEL_REGEX = /^sp:(\d+(?:\.\d+)?)$/;
export const DEFAULT_DAYS_PER_POINT = 1;
const DAY_MS = 86_400_000;

export interface ScheduleOptions {
	/** Calendar anchor for tasks with no blockers. Default: earliest createdDate, else today. */
	projectStart?: Date;
	/** Points → days factor. Default 1 pt = 1 day. */
	daysPerPoint?: number;
}

export interface ScheduledTask {
	id: string;
	title: string;
	status: string;
	points: number | null;
	/** false when no valid sp: label was found and the 1 pt default was used */
	estimated: boolean;
	days: number;
	start: Date;
	finish: Date;
	percent: number;
	blocked: boolean;
	/** Blockers actually used for scheduling (unknown ids and cycle-broken edges removed) */
	dependencies: string[];
}

export interface ScheduleResult {
	tasks: ScheduledTask[];
	warnings: string[];
}

export function parseStoryPoints(labels: readonly string[]): number | null {
	for (const label of labels) {
		const match = SP_LABEL_REGEX.exec(label.trim());
		const raw = match?.[1];
		if (raw === undefined) continue;
		const points = Number(raw);
		if (Number.isFinite(points) && points > 0) return points;
	}
	return null;
}

export function percentComplete(status: string): number {
	switch (status.trim().toLowerCase()) {
		case "done":
			return 100;
		case "in review":
			return 75;
		case "in progress":
			return 50;
		default:
			return 0;
	}
}

export function addDays(date: Date, days: number): Date {
	return new Date(date.getTime() + days * DAY_MS);
}

export function formatIsoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function earliestCreatedDate(tasks: readonly Task[]): Date | null {
	let earliest: Date | null = null;
	for (const task of tasks) {
		const parsed = new Date(task.createdDate);
		if (Number.isNaN(parsed.getTime())) continue;
		if (earliest === null || parsed < earliest) earliest = parsed;
	}
	return earliest;
}

function isBlockedStatus(status: string): boolean {
	return status.trim().toLowerCase() === "blocked";
}

/**
 * Kahn topological order. Unknown dependency ids were already dropped by the caller. When no task
 * is free (a cycle), the first remaining task in input order has its unresolved edges treated as
 * soft (warned) so the walk always terminates.
 */
function topologicalOrder(tasks: readonly Task[], deps: Map<string, string[]>, warnings: string[]): string[] {
	const remaining = new Set(tasks.map((t) => t.id));
	const indegree = new Map<string, number>();
	const dependents = new Map<string, string[]>();
	for (const task of tasks) {
		const blockers = deps.get(task.id) ?? [];
		indegree.set(task.id, blockers.length);
		for (const blocker of blockers) {
			const list = dependents.get(blocker) ?? [];
			list.push(task.id);
			dependents.set(blocker, list);
		}
	}

	const queue = tasks.filter((t) => (indegree.get(t.id) ?? 0) === 0).map((t) => t.id);
	const order: string[] = [];
	while (remaining.size > 0) {
		if (queue.length === 0) {
			const victim = tasks.find((t) => remaining.has(t.id));
			if (!victim) break;
			const unresolved = (deps.get(victim.id) ?? []).filter((d) => remaining.has(d));
			warnings.push(`Dependency cycle detected at ${victim.id}; treating ${unresolved.join(", ")} as soft`);
			deps.set(
				victim.id,
				(deps.get(victim.id) ?? []).filter((d) => !remaining.has(d)),
			);
			queue.push(victim.id);
		}
		const id = queue.shift();
		if (id === undefined || !remaining.has(id)) continue;
		remaining.delete(id);
		order.push(id);
		for (const dependent of dependents.get(id) ?? []) {
			if (!remaining.has(dependent)) continue;
			const next = (indegree.get(dependent) ?? 0) - 1;
			indegree.set(dependent, next);
			if (next <= 0) queue.push(dependent);
		}
	}
	return order;
}

export function computeSchedule(tasks: readonly Task[], options: ScheduleOptions = {}): ScheduleResult {
	const daysPerPoint = options.daysPerPoint ?? DEFAULT_DAYS_PER_POINT;
	const warnings: string[] = [];
	const byId = new Map(tasks.map((t) => [t.id, t]));
	const projectStart = startOfUtcDay(options.projectStart ?? earliestCreatedDate(tasks) ?? new Date());

	const deps = new Map<string, string[]>();
	for (const task of tasks) {
		const known: string[] = [];
		for (const dep of task.dependencies) {
			if (byId.has(dep)) known.push(dep);
			else warnings.push(`${task.id}: unknown dependency ${dep} ignored`);
		}
		deps.set(task.id, known);
	}

	const order = topologicalOrder(tasks, deps, warnings);
	const scheduled = new Map<string, ScheduledTask>();
	for (const id of order) {
		const task = byId.get(id);
		if (!task) continue;
		const points = parseStoryPoints(task.labels);
		const days = (points ?? 1) * daysPerPoint;
		const blockers = (deps.get(id) ?? [])
			.map((dep) => scheduled.get(dep))
			.filter((entry): entry is ScheduledTask => entry !== undefined);
		const start = blockers.length > 0 ? new Date(Math.max(...blockers.map((b) => b.finish.getTime()))) : projectStart;
		scheduled.set(id, {
			id,
			title: task.title,
			status: task.status,
			points,
			estimated: points !== null,
			days,
			start,
			finish: addDays(start, days),
			percent: percentComplete(task.status),
			blocked: isBlockedStatus(task.status),
			dependencies: deps.get(id) ?? [],
		});
	}

	return {
		tasks: order.map((id) => scheduled.get(id)).filter((entry): entry is ScheduledTask => entry !== undefined),
		warnings,
	};
}

/** Mermaid gantt ids must be plain identifiers; task ids like TASK-2 are not. */
export function ganttTaskId(id: string): string {
	return id.replace(/[^A-Za-z0-9]/g, "_");
}

/** Colons, commas, hashes and semicolons all have meaning in gantt lines. */
function sanitizeGanttText(text: string): string {
	return text
		.replace(/[:#;,]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function ganttTags(task: ScheduledTask): string[] {
	const status = task.status.trim().toLowerCase();
	if (status === "done") return ["done"];
	if (status === "in progress" || status === "in review") return ["active"];
	if (status === "blocked") return ["crit"];
	return [];
}

function ganttLabel(task: ScheduledTask): string {
	const estimate = task.estimated ? `${task.points} pt` : "no est.";
	const status = task.status.trim().toLowerCase();
	const suffix = status === "in review" ? " (review)" : status === "blocked" ? " (blocked)" : "";
	return `${sanitizeGanttText(task.title)} · ${estimate}${suffix}`;
}

export function toMermaidGantt(result: ScheduleResult, title: string): string {
	const lines = [
		"gantt",
		`  title ${sanitizeGanttText(title) || "Gantt"}`,
		"  dateFormat YYYY-MM-DD",
		"  axisFormat %b %d",
		"  section Tickets",
	];
	for (const task of result.tasks) {
		const meta = [
			...ganttTags(task),
			ganttTaskId(task.id),
			formatIsoDate(task.start),
			`${Math.max(1, Math.ceil(task.days))}d`,
		];
		lines.push(`  ${ganttLabel(task)} :${meta.join(", ")}`);
	}
	return lines.join("\n");
}
