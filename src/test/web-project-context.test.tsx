import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ProjectProvider, useProject } from "../web/contexts/ProjectContext";
import { getActiveProjectId, setActiveProjectId } from "../web/lib/api";

// createRoot needs a live `document`; test-preload only wires one up transiently while
// react-dom/client itself loads, so each DOM-using test file sets up its own (see
// web-app-open-detail-refresh.test.tsx for the fuller version of this pattern).
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
Object.assign(globalThis, {
	IS_REACT_ACT_ENVIRONMENT: true,
	window: dom.window,
	document: dom.window.document,
	navigator: dom.window.navigator,
});

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

const MANIFEST = {
	projects: [
		{ id: "alpha", name: "Alpha", path: "/a" },
		{ id: "beta", name: "Beta", path: "/b" },
	],
	defaultProjectId: "alpha",
};

let container: HTMLDivElement;
let root: Root | null = null;
let originalFetch: typeof fetch;
let latest: ReturnType<typeof useProject> | null = null;

function Probe() {
	latest = useProject();
	return <span>{latest.activeProjectId ?? "none"}</span>;
}

async function mount(fetchImpl: typeof fetch) {
	globalThis.fetch = fetchImpl;
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	await act(async () => {
		root?.render(
			<ProjectProvider>
				<Probe />
			</ProjectProvider>,
		);
	});
	await act(async () => {
		await Promise.resolve();
	});
}

beforeEach(() => {
	originalFetch = globalThis.fetch;
	storage.clear();
	setActiveProjectId(null);
	latest = null;
});

afterEach(async () => {
	await act(async () => root?.unmount());
	root = null;
	container.remove();
	globalThis.fetch = originalFetch;
});

const okFetch = (async () => new Response(JSON.stringify(MANIFEST), { status: 200 })) as unknown as typeof fetch;

describe("ProjectProvider", () => {
	it("defaults to defaultProjectId and lists projects", async () => {
		await mount(okFetch);
		expect(latest?.projects.map((p) => p.id)).toEqual(["alpha", "beta"]);
		expect(latest?.activeProjectId).toBe("alpha");
		expect(getActiveProjectId()).toBe("alpha");
	});

	it("restores the stored selection when it is still registered", async () => {
		storage.set("pm.activeProjectId", "beta");
		await mount(okFetch);
		expect(latest?.activeProjectId).toBe("beta");
		expect(getActiveProjectId()).toBe("beta");
	});

	it("falls back to the default when the stored selection is unknown, and overwrites the stale storage", async () => {
		storage.set("pm.activeProjectId", "gone");
		await mount(okFetch);
		expect(latest?.activeProjectId).toBe("alpha");
		// Regression (I1): a stale id must not survive the reconcile, or every future load 404s
		// against a project that no longer exists.
		expect(storage.get("pm.activeProjectId")).toBe("alpha");
		expect(getActiveProjectId()).toBe("alpha");
	});

	it("setProjectId persists and updates the API base", async () => {
		await mount(okFetch);
		await act(async () => latest?.setProjectId("beta"));
		expect(storage.get("pm.activeProjectId")).toBe("beta");
		expect(getActiveProjectId()).toBe("beta");
		expect(container.textContent).toBe("beta");
	});

	it("degrades to legacy single-project mode when /api/projects fails, clearing any stored id", async () => {
		// A stale id left over from a prior multi-project session must not survive a legacy-mode
		// fallback either, or a plain `backlog browser` session repeats the 404 flash forever (I1).
		storage.set("pm.activeProjectId", "beta");
		await mount((async () => new Response("nope", { status: 404 })) as unknown as typeof fetch);
		expect(latest?.projects).toEqual([]);
		expect(latest?.activeProjectId).toBeNull();
		expect(getActiveProjectId()).toBeNull();
		expect(storage.has("pm.activeProjectId")).toBe(false);
	});
});
