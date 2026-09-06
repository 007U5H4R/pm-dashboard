import type { Task } from "../../types/index.ts";

/** Story points ride on a label because the CLI strips custom frontmatter keys (Design.md §3). */
export const SP_LABEL_REGEX = /^sp:(\d+(?:\.\d+)?)$/;
export const DEFAULT_DAYS_PER_POINT = 1;

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
