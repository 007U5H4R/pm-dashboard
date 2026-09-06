import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { DashboardServer } from "../server/index.ts";
import { createUniqueTestDir, retry, safeCleanup, sleep, waitUntil, withTimeout } from "./test-utils.ts";

let root: string;
let dashboard: DashboardServer | null = null;
let port = 0;
const sockets: WebSocket[] = [];

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

/** `pid === null` opens a root-path socket (no `/ws`, no `?pid`) — the legacy client URL. */
async function openSocket(pid: string | null, messages: string[]): Promise<WebSocket> {
	const url = pid === null ? `ws://127.0.0.1:${port}` : `ws://127.0.0.1:${port}/ws?pid=${encodeURIComponent(pid)}`;
	const socket = new WebSocket(url);
	sockets.push(socket);
	socket.onmessage = (event) => messages.push(String(event.data));
	await withTimeout(
		new Promise<void>((resolve, reject) => {
			socket.onopen = () => resolve();
			socket.onerror = () => reject(new Error(`WebSocket failed to open for ${pid ?? "root"}`));
		}),
		"room test socket",
		2000,
	);
	return socket;
}

async function createTask(pid: string, title: string): Promise<void> {
	const response = await fetch(`http://127.0.0.1:${port}/api/p/${pid}/tasks`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ title, status: "To Do" }),
	});
	expect(response.status).toBe(201);
}

const dataMessages = (messages: string[]) => messages.filter((m) => m === "tasks-updated");
const notified = (messages: string[], label: string) =>
	waitUntil(() => dataMessages(messages).length > 0, `${label} to receive tasks-updated`);

beforeEach(async () => {
	root = createUniqueTestDir("server-ws-rooms");
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
		if (!(await fetch(`http://127.0.0.1:${port}/api/projects`)).ok) throw new Error("not ready");
	});
});

afterEach(async () => {
	for (const socket of sockets) socket.close();
	sockets.length = 0;
	await dashboard?.stop();
	dashboard = null;
	await safeCleanup(root);
});

describe("WebSocket project rooms", () => {
	it("notifies only sockets of the edited project", async () => {
		const alphaMessages: string[] = [];
		const betaMessages: string[] = [];
		await openSocket("alpha", alphaMessages);
		await openSocket("beta", betaMessages);

		await createTask("alpha", "Alpha task");
		await notified(alphaMessages, "alpha");
		await sleep(300);
		expect(dataMessages(betaMessages)).toEqual([]);
	});

	it("a socket re-opened on B no longer hears A", async () => {
		const first: string[] = [];
		const viewer = await openSocket("alpha", first);
		viewer.close();
		const second: string[] = [];
		await openSocket("beta", second);

		await createTask("alpha", "Alpha task after switch");
		await sleep(400);
		expect(dataMessages(second)).toEqual([]);

		await createTask("beta", "Beta task");
		await notified(second, "beta");
	});

	it("root-path sockets join the default project", async () => {
		const messages: string[] = [];
		const betaMessages: string[] = [];
		await openSocket(null, messages);
		await openSocket("beta", betaMessages);

		await createTask("alpha", "Default room task");
		await notified(messages, "default room");
		await sleep(300);
		expect(dataMessages(betaMessages)).toEqual([]);
	});

	it("rejects an unknown project id on upgrade", async () => {
		const response = await fetch(`http://127.0.0.1:${port}/ws?pid=nope`, {
			headers: { upgrade: "websocket", connection: "Upgrade" },
		});
		expect(response.status).toBe(404);
	});
});
