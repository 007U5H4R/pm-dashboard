import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import GanttPage, { type GanttPageProps } from "../web/components/GanttPage";
import { TaskIdIndexProvider } from "../web/contexts/TaskIdIndexContext";

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

const render = (props: Partial<GanttPageProps> = {}) =>
	renderToString(
		<MemoryRouter>
			<TaskIdIndexProvider tasks={props.tasks ?? []}>
				<GanttPage tasks={[]} isLoading={false} projectName="Demo" {...props} />
			</TaskIdIndexProvider>
		</MemoryRouter>,
	);

describe("GanttPage", () => {
	it("shows a loading state", () => {
		expect(render({ isLoading: true })).toContain("Loading");
	});

	it("shows an empty state when there are no tasks", () => {
		expect(render({ tasks: [] })).toContain("No tickets yet");
	});

	it("shows the error state with a retry button", () => {
		const html = render({ loadError: new Error("boom"), onRetry: () => {} });
		expect(html).toContain("boom");
		expect(html).toContain("Retry");
	});

	it("renders one gantt line per task in dependency order", () => {
		const html = render({
			tasks: [
				task("TASK-2", { title: "API", labels: ["sp:3"], dependencies: ["TASK-1"], status: "In Progress" }),
				task("TASK-1", { title: "Schema", labels: ["sp:2"], status: "Done" }),
				task("TASK-3", { title: "Unsized", status: "Blocked" }),
			],
		});
		const schema = html.indexOf("Schema · 2 pt");
		const api = html.indexOf("API · 3 pt");
		expect(schema).toBeGreaterThan(-1);
		expect(api).toBeGreaterThan(schema);
		expect(html).toContain("Unsized · no est. (blocked)");
		expect(html).toContain("1 ticket without an estimate");
	});
});
