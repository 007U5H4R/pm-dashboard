import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { BacklogServer, DashboardServer } from "../server/index.ts";
import type { ProjectRegistry } from "../server/project-registry.ts";
import { createUniqueTestDir, retry, safeCleanup, withTimeout } from "./test-utils.ts";

let root: string;
let dashboard: DashboardServer | null = null;
let port = 0;

async function makeProject(dir: string, name: string): Promise<void> {
	await mkdir(dir, { recursive: true });
	const core = new Core(dir);
	await core.filesystem.ensureBacklogStructure();
	await core.filesystem.saveConfig({
		projectName: name,
		statuses: ["To Do", "In Progress", "In Review", "Blocked", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
		checkActiveBranches: false,
		autoCommit: false,
	});
}

const api = (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${port}${path}`, init);

const createTask = (pid: string, title: string) =>
	api(`/api/p/${pid}/tasks`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ title, status: "To Do" }),
	});

const listTitles = async (path: string) =>
	((await (await api(path)).json()) as Array<{ title: string }>).map((task) => task.title);

/** The registry is private; tests peek at it to prove lazy instances were created and prepared. */
const registry = (): ProjectRegistry<BacklogServer> =>
	(dashboard as unknown as { registry: ProjectRegistry<BacklogServer> }).registry;
const createdPaths = () =>
	registry()
		.created()
		.map((instance) => instance.projectPath);
// Note: registry.get() constructs on demand, so only call it once the instance is expected to exist
const projectInstance = (pid: string): BacklogServer | undefined => registry().get(pid);

/** Open a WebSocket and resolve with its first message (or reject on error/timeout). */
async function firstSocketMessage(path: string): Promise<string> {
	const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`);
	try {
		return await withTimeout(
			new Promise<string>((resolve, reject) => {
				socket.onmessage = (event) => resolve(String(event.data));
				socket.onerror = () => reject(new Error("WebSocket failed to open"));
			}),
			`WebSocket ${path}`,
			2000,
		);
	} finally {
		socket.close();
	}
}

beforeEach(async () => {
	root = createUniqueTestDir("server-multi-project");
	await makeProject(join(root, "alpha"), "Alpha");
	await makeProject(join(root, "beta"), "Beta");
	await writeFile(
		join(root, "projects.json"),
		JSON.stringify({
			projects: [
				{ id: "alpha", name: "Alpha", path: "./alpha" },
				{ id: "beta", name: "Beta", path: "./beta" },
			],
			defaultProjectId: "alpha",
		}),
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

describe("multi-project dashboard", () => {
	it("lists registered projects", async () => {
		const body = (await (await api("/api/projects")).json()) as {
			projects: Array<{ id: string; name: string; path: string }>;
			defaultProjectId: string;
		};
		expect(body.defaultProjectId).toBe("alpha");
		expect(body.projects.map((p) => p.id)).toEqual(["alpha", "beta"]);
		expect(body.projects[0]).toEqual({ id: "alpha", name: "Alpha", path: join(root, "alpha") });
	});

	it("serves each project's own tasks and isolates writes per project", async () => {
		const created = await createTask("alpha", "Only in alpha");
		expect(created.status).toBe(201);

		expect(await listTitles("/api/p/alpha/tasks")).toEqual(["Only in alpha"]);
		expect(await listTitles("/api/p/beta/tasks")).toEqual([]);

		// Legacy (unscoped) routes are the default project
		expect(await listTitles("/api/tasks")).toEqual(["Only in alpha"]);
	});

	it("loads a lazily created project's own config on its first scoped request", async () => {
		// Only the default project is created (and prepared) at start; beta must not exist yet
		expect(createdPaths()).toEqual([join(root, "alpha")]);

		const config = (await (await api("/api/p/beta/config")).json()) as { projectName: string };
		expect(config.projectName).toBe("Beta");
		// displayName is only set by prepare(); "Untitled Project" would mean the lazy instance was never prepared
		expect(projectInstance("beta")?.displayName).toBe("Beta");
		expect(projectInstance("alpha")?.displayName).toBe("Alpha");
	});

	it("returns 404 for an unknown project", async () => {
		const response = await api("/api/p/nope/tasks");
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Unknown project: nope" });
	});

	it("routes POST /tasks/reorder to the reorder handler on scoped and legacy paths", async () => {
		expect((await createTask("alpha", "first")).status).toBe(201);
		expect((await createTask("alpha", "second")).status).toBe(201);
		const ids = ((await (await api("/api/p/alpha/tasks")).json()) as Array<{ id: string }>).map((task) => task.id);
		expect(ids).toHaveLength(2);

		// If "/tasks/:id" captured id="reorder" this would never reach handleReorderTask (405/404, not 200)
		for (const path of ["/api/p/alpha/tasks/reorder", "/api/tasks/reorder"]) {
			const response = await api(path, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId: ids[1], targetStatus: "To Do", orderedTaskIds: [ids[1], ids[0]] }),
			});
			expect(response.status).toBe(200);
			const result = (await response.json()) as { success: boolean; task: { id: string } };
			expect(result.success).toBe(true);
			expect(result.task.id).toBe(ids[1] ?? "");
		}
	});

	it("upgrades WebSockets per project and rejects an unknown pid with a JSON 404", async () => {
		// A lazily created project still gets its loading-state handshake
		expect(JSON.parse(await firstSocketMessage("/ws?pid=beta"))).toHaveProperty("type");
		expect(projectInstance("beta")?.displayName).toBe("Beta");

		const response = await api("/ws?pid=nope", { headers: { upgrade: "websocket", connection: "Upgrade" } });
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Unknown project: nope" });
	});

	it("serves the SPA shell for /gantt", async () => {
		expect((await api("/gantt")).status).toBe(200);
	});
});

describe("single-project BacklogServer start", () => {
	it("stays retryable after a failed start instead of reporting an already-running server", async () => {
		const server = new BacklogServer(join(root, "beta"));
		const filesystem = (server as unknown as { core: Core }).core.filesystem;
		const loadConfig = filesystem.loadConfig.bind(filesystem);
		filesystem.loadConfig = async () => {
			throw new Error("config exploded");
		};
		try {
			await expect(server.start(0, false)).rejects.toThrow("config exploded");
			expect(server.getPort()).toBeNull();

			filesystem.loadConfig = loadConfig;
			await server.start(0, false);
			expect(server.getPort()).not.toBeNull();
		} finally {
			await server.stop();
		}
	});
});
