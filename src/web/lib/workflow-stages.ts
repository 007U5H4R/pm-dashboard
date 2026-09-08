import type { Document, Task } from "../../types";
import { computeSchedule } from "./schedule";

/** One schedule unit = one day in the Gantt views (see CustomGantt). */
const UNIT_MS = 86_400_000;

/** The three statuses the derived workflow stages can ever occupy. Used as the
 *  Kanban columns when the board is in Workflow view. */
export const WORKFLOW_STAGE_STATUSES = ["To Do", "In Progress", "Done"] as const;

/** The 10-stage build workflow (global CLAUDE.md build-workflow.md). Stages 1–5 are marked done when
 * their artifact document exists; Execution reflects ticket completion; the review/deploy stages have
 * no data signal yet, so they read as not-started until marked. */
// `weight` = a stage's estimated duration as a fraction of the Execution stage. Execution is the anchor
// (its duration comes from the real ticket schedule); every other stage is estimated from it, so the
// estimates scale automatically for any project — new or old — from that project's own execution length.
export const STAGES: Array<{ name: string; docMatch?: RegExp; execution?: boolean; weight: number }> = [
	{ name: "Product Discovery", docMatch: /discovery/i, weight: 0.15 },
	{ name: "Solution Design", docMatch: /solution/i, weight: 0.15 },
	{ name: "UI/UX Design", docMatch: /design/i, weight: 0.2 },
	{ name: "Problem Breakdown", docMatch: /ticket/i, weight: 0.3 },
	{ name: "Technical Planning", docMatch: /implementation|plan/i, weight: 0.4 },
	{ name: "Execution", execution: true, weight: 1 },
	{ name: "Design Critique", weight: 0.25 },
	{ name: "Code Review", weight: 0.3 },
	{ name: "Security Review", weight: 0.2 },
	{ name: "Deployment", weight: 0.1 },
];

export interface WorkflowStages {
	/** Synthetic STAGE-N tasks, one per build-workflow stage, with derived status. */
	stageTasks: Task[];
	/** Exact completion percent for stages that have a data signal (Execution). */
	percentById: Record<string, number>;
}

/**
 * Derive the 10 build-workflow stages as synthetic tasks from the project's real tasks + docs.
 * Shared by the Workflow Gantt page and the Kanban board's Workflow view so both stay in sync.
 */
export function computeWorkflowStages(tasks: Task[], docs: Document[]): WorkflowStages {
	const docTitles = docs.map((d) => d.title ?? "");
	const total = tasks.length;
	const done = tasks.filter((t) => t.status.trim().toLowerCase() === "done").length;
	const execPercent = total > 0 ? Math.round((done / total) * 100) : 0;

	// Execution duration is the Execution Gantt's total timeline length: same tickets, same scheduler,
	// so the two views stay in sync. It is the span from earliest start to latest finish, in units.
	const ticketTasks = tasks.filter((t) => !t.parentTaskId);
	const execSchedule = computeSchedule(ticketTasks);
	let execHours = 1;
	if (execSchedule.tasks.length > 0) {
		const minStart = Math.min(...execSchedule.tasks.map((t) => t.start.getTime()));
		const maxFinish = Math.max(...execSchedule.tasks.map((t) => t.finish.getTime()));
		execHours = Math.max(1, Math.round((maxFinish - minStart) / UNIT_MS));
	}

	const stageTasks: Task[] = STAGES.map((stage, index) => {
		let status = "To Do";
		if (stage.execution) {
			status = total === 0 ? "To Do" : done === total ? "Done" : done > 0 ? "In Progress" : "To Do";
		} else if (stage.docMatch && docTitles.some((title) => stage.docMatch!.test(title))) {
			status = "Done";
		}
		const stageHours = stage.execution ? execHours : Math.max(1, Math.round(execHours * stage.weight));
		return {
			id: `STAGE-${index + 1}`,
			title: `${index + 1}. ${stage.name}`,
			status,
			assignee: [],
			createdDate: "2026-01-01",
			labels: [`sp:${stageHours}`],
			dependencies: index > 0 ? [`STAGE-${index}`] : [],
		} as Task;
	});

	return { stageTasks, percentById: { "STAGE-6": execPercent } };
}
