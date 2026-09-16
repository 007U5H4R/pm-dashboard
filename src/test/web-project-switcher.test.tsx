import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import ProjectSwitcher, { ProjectSwitcherView } from "../web/components/ProjectSwitcher";
import { ProjectProvider } from "../web/contexts/ProjectContext";

const projects = [
	{ id: "alpha", name: "Alpha", path: "/a" },
	{ id: "beta", name: "Beta", path: "/b" },
];

describe("ProjectSwitcher", () => {
	it("renders the single project's name when there is exactly one project", () => {
		const html = renderToString(
			<ProjectSwitcherView projects={projects.slice(0, 1)} activeProjectId="alpha" onSelect={() => {}} />,
		);
		expect(html).toContain("Alpha");
		expect(html).not.toBe("");
	});

	it("renders nothing with zero projects", () => {
		const html = renderToString(<ProjectSwitcherView projects={[]} activeProjectId={null} onSelect={() => {}} />);
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

	it("renders each dropdown row with the project's saved icon, not the name-derived default", () => {
		// "Beta" resolves to the default 'gem' theme by name; a saved icon of 'writing' must win.
		const withIcon = [
			{ id: "alpha", name: "Alpha", path: "/a" },
			{ id: "beta", name: "Beta", path: "/b", icon: "writing" },
		];
		const writingPath = "M5 19l1.3-4.4L15 6"; // unique to the 'writing' icon
		const html = renderToString(
			<ProjectSwitcherView projects={withIcon} activeProjectId="alpha" onSelect={() => {}} open />,
		);
		expect(html).toContain(writingPath);
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
