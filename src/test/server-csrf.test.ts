import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { DashboardServer } from "../server/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let root: string;
let dashboard: DashboardServer | null = null;
let port = 0;

async function makeProject(dir: string, name: string): Promise<void> {
	await mkdir(dir, { recursive: true });
	const core = new Core(dir);
	await core.filesystem.ensureBacklogStructure();
	await core.filesystem.saveConfig({
		projectName: name,
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
		checkActiveBranches: false,
		autoCommit: false,
	});
}

const api = (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${port}${path}`, init);

/** POST a new task, optionally stamping the browser's `Sec-Fetch-Site` header. */
const createTask = (path: string, title: string, secFetchSite?: string) =>
	api(path, {
		method: "POST",
		headers: { "Content-Type": "application/json", ...(secFetchSite ? { "Sec-Fetch-Site": secFetchSite } : {}) },
		body: JSON.stringify({ title, status: "To Do" }),
	});

const listTitles = async (path: string, init?: RequestInit) =>
	((await (await api(path, init)).json()) as Array<{ title: string }>).map((task) => task.title);

beforeEach(async () => {
	root = createUniqueTestDir("server-csrf");
	await makeProject(join(root, "alpha"), "Alpha");
	await writeFile(
		join(root, "projects.json"),
		JSON.stringify({ projects: [{ id: "alpha", name: "Alpha", path: "./alpha" }], defaultProjectId: "alpha" }),
	);
	dashboard = await DashboardServer.fromManifestFile(join(root, "projects.json"));
	await dashboard.start(0, false);
	port = dashboard.getPort() ?? 0;
	await retry(async () => {
		const response = await api("/api/projects");
		if (!response.ok) throw new Error("not ready");
	});
});

afterEach(async () => {
	await dashboard?.stop();
	dashboard = null;
	await safeCleanup(root);
});

describe("localhost CSRF guard", () => {
	const mutatingRoutes = ["/api/p/alpha/tasks", "/api/tasks"];

	it("rejects cross-site mutations on scoped and legacy routes with 403 and does not mutate", async () => {
		for (const path of mutatingRoutes) {
			const response = await createTask(path, "Injected", "cross-site");
			expect(response.status).toBe(403);
			expect(await response.json()).toEqual({ error: "Cross-site request blocked" });
		}
		expect(await listTitles("/api/p/alpha/tasks")).toEqual([]);
	});

	it("rejects same-site (sibling origin) mutations too", async () => {
		const response = await createTask("/api/p/alpha/tasks", "Injected", "same-site");
		expect(response.status).toBe(403);
	});

	it("allows same-origin mutations (the SPA) through to the handler", async () => {
		const response = await createTask("/api/p/alpha/tasks", "From SPA", "same-origin");
		expect(response.status).toBe(201);
		expect(await listTitles("/api/p/alpha/tasks")).toEqual(["From SPA"]);
	});

	it("allows mutations with no Sec-Fetch-Site header (CLI, curl, tests)", async () => {
		for (const [index, path] of mutatingRoutes.entries()) {
			const response = await createTask(path, `Non-browser ${index}`);
			expect(response.status).toBe(201);
		}
		expect(await listTitles("/api/p/alpha/tasks")).toEqual(["Non-browser 0", "Non-browser 1"]);
	});

	it("allows mutations with Sec-Fetch-Site: none (direct navigation)", async () => {
		const response = await createTask("/api/p/alpha/tasks", "Direct", "none");
		expect(response.status).toBe(201);
	});

	it("leaves GET requests alone even when cross-site", async () => {
		await createTask("/api/p/alpha/tasks", "Visible");
		const cross = { headers: { "Sec-Fetch-Site": "cross-site" } };
		expect(await listTitles("/api/p/alpha/tasks", cross)).toEqual(["Visible"]);
		expect(await listTitles("/api/tasks", cross)).toEqual(["Visible"]);
		const projects = await api("/api/projects", cross);
		expect(projects.status).toBe(200);
	});
});
