import type { Task } from "../../types";

/**
 * A ticket's status rolled up from its subtasks (Jira-epic style):
 *   any Blocked           -> Blocked
 *   all Done              -> Done
 *   any In Progress/Review, or a mix of Done + not-Done -> In Progress
 *   all To Do (or other)  -> To Do
 * Callers use this only when a ticket HAS subtasks; a childless ticket keeps its own status.
 */
export function rollupStatus(children: readonly Task[]): string {
	const statuses = children.map((c) => c.status.trim().toLowerCase());
	if (statuses.some((s) => s === "blocked")) return "Blocked";
	if (statuses.length > 0 && statuses.every((s) => s === "done")) return "Done";
	if (statuses.some((s) => s === "in progress" || s === "in review")) return "In Progress";
	if (statuses.some((s) => s === "done")) return "In Progress"; // mix of done + not-done
	return "To Do";
}

/** Subtask completion percentage (done / total), rounded. Empty -> 0. */
export function rollupPercent(children: readonly Task[]): number {
	if (children.length === 0) return 0;
	const done = children.filter((c) => c.status.trim().toLowerCase() === "done").length;
	return Math.round((done / children.length) * 100);
}

/** Group tasks by their parentTaskId (only children with a parent are included). */
export function childrenByParent(tasks: readonly Task[]): Map<string, Task[]> {
	const map = new Map<string, Task[]>();
	for (const task of tasks) {
		if (task.parentTaskId) {
			const list = map.get(task.parentTaskId) ?? [];
			list.push(task);
			map.set(task.parentTaskId, list);
		}
	}
	return map;
}
