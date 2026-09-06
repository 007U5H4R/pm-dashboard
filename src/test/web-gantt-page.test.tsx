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

describe("GanttPage live updates (AC3)", () => {
	afterEach(() => {
		delete (globalThis as { __MERMAID_MOCK__?: unknown }).__MERMAID_MOCK__;
		delete (globalThis as { window?: Window & typeof globalThis }).window;
		delete (globalThis as { document?: Document }).document;
		delete (globalThis as { navigator?: Navigator }).navigator;
		delete (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame;
		delete (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame;
	});

	it("re-renders the mermaid diagram in place when the tasks prop changes over WS", async () => {
		const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
			url: "http://localhost/gantt",
			pretendToBeVisual: true,
		});
		globalThis.window = dom.window as unknown as Window & typeof globalThis;
		globalThis.document = dom.window.document as Document;
		globalThis.navigator = dom.window.navigator as Navigator;
		globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
		globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

		// Echo the raw gantt DSL back as the "svg" so the container's rendered text is
		// literally the mermaid source, letting the test see whether it actually changed.
		(globalThis as { __MERMAID_MOCK__?: unknown }).__MERMAID_MOCK__ = {
			default: {
				initialize: () => {},
				render: async (_id: string, text: string) => ({ svg: text }),
			},
		};

		const container = document.getElementById("root") as HTMLElement;
		const root = createRoot(container);

		const flush = async () => {
			await act(async () => {
				for (let i = 0; i < 5; i++) {
					await new Promise((resolve) => setTimeout(resolve, 10));
				}
			});
		};

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
			await flush();
		};

		await renderWith([task("TASK-1", { title: "Schema", labels: ["sp:2"], status: "To Do" })]);
		expect(container.textContent).toContain("Schema · 2 pt :TASK_1, 2026-01-01, 2d");

		// Simulate the WS → refreshData → setTasks path handing GanttPage a new tasks array
		// (a move-ticket status change), without unmounting the page itself.
		await renderWith([task("TASK-1", { title: "Schema", labels: ["sp:2"], status: "In Progress" })]);

		expect(container.textContent).toContain("Schema · 2 pt :active, TASK_1, 2026-01-01, 2d");
		// The stale untagged line must be gone, not merely joined by the new one.
		expect(container.textContent).not.toContain("Schema · 2 pt :TASK_1, 2026-01-01, 2d");

		act(() => {
			root.unmount();
		});
	});
});
