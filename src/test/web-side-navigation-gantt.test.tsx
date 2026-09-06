import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import SideNavigation from "../web/components/SideNavigation";
import { ProjectProvider } from "../web/contexts/ProjectContext";

const storage = new Map<string, string>();
globalThis.localStorage = {
	getItem: (key) => storage.get(key) ?? null,
	setItem: (key, value) => storage.set(key, value),
	removeItem: (key) => storage.delete(key),
	clear: () => storage.clear(),
	key: (index) => [...storage.keys()][index] ?? null,
	get length() {
		return storage.size;
	},
} as Storage;

describe("SideNavigation Gantt link", () => {
	it("renders a Gantt link next to the Kanban Board link", () => {
		const html = renderToString(
			<MemoryRouter>
				<ProjectProvider>
					<SideNavigation taskCount={0} docs={[]} decisions={[]} isLoading={false} onRefreshData={async () => {}} />
				</ProjectProvider>
			</MemoryRouter>,
		);
		const board = html.indexOf('href="/board"');
		const gantt = html.indexOf('href="/gantt"');
		expect(board).toBeGreaterThan(-1);
		expect(gantt).toBeGreaterThan(board);
		expect(html).toContain(">Gantt<");
	});
});
