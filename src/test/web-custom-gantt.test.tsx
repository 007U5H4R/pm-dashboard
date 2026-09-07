import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import type { Task } from "../types/index.ts";
import CustomGantt from "../web/components/CustomGantt";

function task(id: string, overrides: Partial<Task> = {}): Task {
	return {
		id,
		title: `Title ${id}`,
		status: "To Do",
		assignee: [],
		createdDate: "2026-01-01",
		labels: [],
		dependencies: [],
		...overrides,
	};
}

const render = (tasks: Task[]) => renderToString(<CustomGantt tasks={tasks} projectName="Demo" />);

describe("CustomGantt", () => {
	it("shows an empty state when there are no tasks", () => {
		const html = render([]);
		expect(html).toContain("No tasks to schedule");
	});

	it("renders one row per task in dependency order", () => {
		const html = render([
			task("TASK-2", { title: "API", labels: ["sp:3"], dependencies: ["TASK-1"], status: "In Progress" }),
			task("TASK-1", { title: "Schema", labels: ["sp:2"], status: "Done" }),
		]);
		const schemaRow = html.indexOf('data-testid="gantt-row-TASK-1"');
		const apiRow = html.indexOf('data-testid="gantt-row-TASK-2"');
		expect(schemaRow).toBeGreaterThan(-1);
		expect(apiRow).toBeGreaterThan(schemaRow);
	});

	it("shows duration and percent text per task", () => {
		const html = render([task("TASK-1", { title: "Schema", labels: ["sp:3"], status: "In Review" })]);
		expect(html).toContain("3 days");
		expect(html).toContain("75%");
	});

	it("uses singular day text for a 1-day task", () => {
		const html = render([task("TASK-1", { title: "Solo", labels: ["sp:1"] })]);
		expect(html).toContain("1 day<");
	});

	it("renders a bar per task", () => {
		const html = render([
			task("TASK-1", { title: "A" }),
			task("TASK-2", { title: "B", dependencies: ["TASK-1"] }),
		]);
		expect(html).toContain('data-testid="gantt-bar-TASK-1"');
		expect(html).toContain('data-testid="gantt-bar-TASK-2"');
	});

	it("maps status to the expected bar color", () => {
		const html = render([
			task("TASK-1", { title: "Done task", status: "Done" }),
			task("TASK-2", { title: "In progress task", status: "In Progress" }),
			task("TASK-3", { title: "In review task", status: "In Review" }),
			task("TASK-4", { title: "Blocked task", status: "Blocked" }),
			task("TASK-5", { title: "To do task", status: "To Do" }),
		]);
		expect(html).toContain('data-testid="gantt-bar-fill-TASK-1" class="h-full rounded-full" style="width:100%;background-color:#10b981"');
		expect(html).toContain('data-testid="gantt-bar-fill-TASK-2" class="h-full rounded-full" style="width:50%;background-color:#3b82f6"');
		expect(html).toContain('data-testid="gantt-bar-fill-TASK-3" class="h-full rounded-full" style="width:75%;background-color:#3b82f6"');
		expect(html).toContain('data-testid="gantt-bar-fill-TASK-4" class="h-full rounded-full" style="width:0%;background-color:#ef4444"');
		expect(html).toContain('data-testid="gantt-bar-fill-TASK-5" class="h-full rounded-full" style="width:0%;background-color:#d1d5db"');
	});

	it("shows an avatar with initials for an assigned task and none for an unassigned one", () => {
		const html = render([
			task("TASK-1", { title: "Assigned", assignee: ["Jane Doe"] }),
			task("TASK-2", { title: "Unassigned", dependencies: ["TASK-1"] }),
		]);
		const rowTask1 = html.slice(html.indexOf('data-testid="gantt-bar-TASK-1"'), html.indexOf('data-testid="gantt-bar-TASK-2"'));
		const rowTask2 = html.slice(html.indexOf('data-testid="gantt-bar-TASK-2"'));
		expect(rowTask1).toContain('data-testid="gantt-avatar"');
		expect(rowTask1).toContain("JD");
		expect(rowTask2).not.toContain('data-testid="gantt-avatar"');
	});

	it("collapses multiple assignees to a first-initial + count avatar", () => {
		const html = render([task("TASK-1", { title: "Team task", assignee: ["Jane Doe", "Bob Smith"] })]);
		expect(html).toContain(">J+1<");
	});
});
