import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
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

	it("renders one custom-gantt row per task in dependency order", () => {
		const html = render({
			tasks: [
				task("TASK-2", { title: "API", labels: ["sp:3"], dependencies: ["TASK-1"], status: "In Progress" }),
				task("TASK-1", { title: "Schema", labels: ["sp:2"], status: "Done" }),
				task("TASK-3", { title: "Unsized", status: "Blocked" }),
			],
		});
		const schemaRow = html.indexOf('data-testid="gantt-row-TASK-1"');
		const apiRow = html.indexOf('data-testid="gantt-row-TASK-2"');
		expect(schemaRow).toBeGreaterThan(-1);
		expect(apiRow).toBeGreaterThan(schemaRow);
		expect(html).toContain("Schema");
		expect(html).toContain("2 days");
		expect(html).toContain("API");
		expect(html).toContain("3 days");
		expect(html).toContain("Unsized");
		expect(html).toContain('data-status="blocked"');
		expect(html).toContain("1 ticket without an estimate");
	});
});

describe("GanttPage live updates", () => {
	afterEach(() => {
		delete (globalThis as { window?: Window & typeof globalThis }).window;
		delete (globalThis as { document?: Document }).document;
		delete (globalThis as { navigator?: Navigator }).navigator;
	});

	it("updates a bar's status in place when the tasks prop changes over WS", async () => {
		const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
			url: "http://localhost/gantt",
		});
		globalThis.window = dom.window as unknown as Window & typeof globalThis;
		globalThis.document = dom.window.document as Document;
		globalThis.navigator = dom.window.navigator as Navigator;
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

		const container = document.getElementById("root") as HTMLElement;
		const root = createRoot(container);

		const renderWith = async (tasks: Task[]) => {
			await act(async () => {
				root.render(
					<MemoryRouter>
						<TaskIdIndexProvider tasks={tasks}>
							<GanttPage tasks={tasks} isLoading={false} projectName="Demo" />
						</TaskIdIndexProvider>
					</MemoryRouter>,
				);
			});
		};

		await renderWith([task("TASK-1", { title: "Schema", labels: ["sp:2"], status: "To Do" })]);
		const bar = () => container.querySelector('[data-testid="gantt-bar-TASK-1"]');
		expect(bar()?.getAttribute("data-status")).toBe("to do");

		// Simulate the WS → refreshData → setTasks path handing GanttPage a new tasks array
		// (a move-ticket status change), without unmounting the page itself. A plain React
		// component re-renders on prop change, so no remount workaround is needed here.
		await renderWith([task("TASK-1", { title: "Schema", labels: ["sp:2"], status: "In Progress" })]);
		expect(bar()?.getAttribute("data-status")).toBe("in progress");

		act(() => {
			root.unmount();
		});
	});
});
