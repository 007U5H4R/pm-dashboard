import { describe, expect, it } from "bun:test";
import type { Document, Task } from "../types";
import { computeWorkflowStages } from "../web/lib/workflow-stages";

const doc = (title: string): Document => ({
	id: "doc-handoff",
	title,
	type: "other" as Document["type"],
	createdDate: "2026-10-21",
	rawContent: "",
});
const task = (status: string): Task =>
	({
		id: "task-1",
		title: "t",
		status,
		assignee: [],
		createdDate: "2026-10-21",
		labels: [],
		dependencies: [],
		rawContent: "",
	}) as Task;
const statusOf = (stages: Task[], n: number) => stages.find((s) => s.id === `STAGE-${n}`)!.status;

describe("workflow stages follow the HANDOFF baton", () => {
	it("'Stage 8 … COMPLETE' marks 1-8 Done and 9 In Progress, even with open tickets", () => {
		const { stageTasks } = computeWorkflowStages(
			[task("In Review")],
			[doc("HANDOFF — X · Stage 8 Design Critique COMPLETE → next: Stage 9 Code Review")],
		);
		for (let n = 1; n <= 8; n++) expect(statusOf(stageTasks, n)).toBe("Done");
		expect(statusOf(stageTasks, 9)).toBe("In Progress");
		expect(statusOf(stageTasks, 10)).toBe("To Do");
	});
	it("a HANDOFF title without COMPLETE changes nothing", () => {
		const { stageTasks } = computeWorkflowStages(
			[task("Done"), task("To Do")],
			[doc("HANDOFF — X · Stage 8 in flight")],
		);
		expect(statusOf(stageTasks, 8)).toBe("To Do");
		expect(statusOf(stageTasks, 7)).toBe("In Progress");
	});
	it("'Stage 12 … COMPLETE' marks every stage Done", () => {
		const { stageTasks } = computeWorkflowStages([task("Done")], [doc("HANDOFF — X · Stage 12 Feedback COMPLETE")]);
		for (let n = 1; n <= 12; n++) expect(statusOf(stageTasks, n)).toBe("Done");
	});
});
