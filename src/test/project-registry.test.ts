import { describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadProjectsManifest, ProjectRegistry, parseProjectsManifest } from "../server/project-registry.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const BASE = "/base";

describe("parseProjectsManifest", () => {
	it("accepts a valid manifest and resolves relative paths", () => {
		const manifest = parseProjectsManifest(
			{
				projects: [
					{ id: "family-tree", name: "Family Tree", path: "/abs/family-tree" },
					{ id: "demo", path: "./demo" },
				],
				defaultProjectId: "demo",
			},
			BASE,
		);
		expect(manifest.projects).toEqual([
			{ id: "family-tree", name: "Family Tree", path: "/abs/family-tree" },
			{ id: "demo", name: "demo", path: join(BASE, "demo") },
		]);
		expect(manifest.defaultProjectId).toBe("demo");
	});

	it("defaults defaultProjectId to the first project", () => {
		const manifest = parseProjectsManifest(
			{
				projects: [
					{ id: "a", path: "/a" },
					{ id: "b", path: "/b" },
				],
			},
			BASE,
		);
		expect(manifest.defaultProjectId).toBe("a");
	});

	it("rejects empty, duplicate, malformed and unknown-default manifests", () => {
		expect(() => parseProjectsManifest({}, BASE)).toThrow(/projects/);
		expect(() => parseProjectsManifest({ projects: [] }, BASE)).toThrow(/non-empty/);
		expect(() =>
			parseProjectsManifest(
				{
					projects: [
						{ id: "a", path: "/a" },
						{ id: "a", path: "/b" },
					],
				},
				BASE,
			),
		).toThrow(/Duplicate/);
		expect(() => parseProjectsManifest({ projects: [{ id: "bad id", path: "/a" }] }, BASE)).toThrow(
			/Invalid project id/,
		);
		expect(() => parseProjectsManifest({ projects: [{ id: "a" }] }, BASE)).toThrow(/path/);
		expect(() => parseProjectsManifest({ projects: [{ id: "a", path: "/a" }], defaultProjectId: "zzz" }, BASE)).toThrow(
			/defaultProjectId/,
		);
	});
});

describe("loadProjectsManifest", () => {
	it("reads projects.json relative to its own directory", async () => {
		const dir = createUniqueTestDir("project-registry");
		await mkdir(dir, { recursive: true });
		const file = join(dir, "projects.json");
		await writeFile(file, JSON.stringify({ projects: [{ id: "a", name: "A", path: "./a" }] }));
		try {
			const manifest = await loadProjectsManifest(file);
			expect(manifest.projects[0]?.path).toBe(join(dir, "a"));
		} finally {
			await safeCleanup(dir);
		}
	});

	it("fails loudly when the file is missing", async () => {
		await expect(loadProjectsManifest("/nonexistent/projects.json")).rejects.toThrow(/not found/);
	});
});

describe("ProjectRegistry", () => {
	it("constructs instances lazily and caches them", () => {
		const built: string[] = [];
		const registry = new ProjectRegistry(
			{
				projects: [
					{ id: "a", name: "A", path: "/a" },
					{ id: "b", name: "B", path: "/b" },
				],
				defaultProjectId: "b",
			},
			(entry) => {
				built.push(entry.id);
				return { id: entry.id };
			},
		);
		expect(built).toEqual([]);
		expect(registry.get("a")).toEqual({ id: "a" });
		expect(registry.get("a")).toBe(registry.get("a"));
		expect(registry.get("nope")).toBeUndefined();
		expect(registry.getDefault()).toEqual({ id: "b" });
		expect(built).toEqual(["a", "b"]);
		expect(registry.created()).toHaveLength(2);
		expect(registry.has("b")).toBe(true);
		expect(registry.list().map((p) => p.id)).toEqual(["a", "b"]);
	});

	it("single() wraps one path as project 'default'", () => {
		const registry = ProjectRegistry.single("/only", (entry) => entry.path);
		expect(registry.manifest.defaultProjectId).toBe("default");
		expect(registry.getDefault()).toBe("/only");
	});
});
