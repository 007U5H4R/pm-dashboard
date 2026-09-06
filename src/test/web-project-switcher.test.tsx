import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import ProjectSwitcher, { ProjectSwitcherView } from "../web/components/ProjectSwitcher";
import { ProjectProvider } from "../web/contexts/ProjectContext";

const projects = [
	{ id: "alpha", name: "Alpha", path: "/a" },
	{ id: "beta", name: "Beta", path: "/b" },
];

describe("ProjectSwitcher", () => {
	it("renders nothing with fewer than two projects", () => {
		const html = renderToString(
			<ProjectSwitcherView projects={projects.slice(0, 1)} activeProjectId="alpha" onSelect={() => {}} />,
		);
		expect(html).toBe("");
	});

	it("shows the active project name and lists every project with a checkmark on the active one", () => {
		const html = renderToString(
			<ProjectSwitcherView projects={projects} activeProjectId="beta" onSelect={() => {}} open />,
		);
		expect(html).toContain("Beta");
		expect(html).toContain('role="menu"');
		expect(html).toContain('aria-current="true"');
		expect((html.match(/role="menuitem"/g) ?? []).length).toBe(2);
	});

	it("is closed by default", () => {
		const html = renderToString(<ProjectSwitcherView projects={projects} activeProjectId="alpha" onSelect={() => {}} />);
		expect(html).toContain('aria-expanded="false"');
		expect(html).not.toContain('role="menu"');
	});

	it("mounts inside a ProjectProvider without crashing (no projects yet → hidden)", () => {
		const html = renderToString(
			<ProjectProvider>
				<ProjectSwitcher />
			</ProjectProvider>,
		);
		expect(html).toBe("");
	});
});
