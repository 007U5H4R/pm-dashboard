import { dirname, isAbsolute, resolve } from "node:path";

export interface ProjectEntry {
	id: string;
	name: string;
	path: string;
}

export interface ProjectsManifest {
	projects: ProjectEntry[];
	defaultProjectId: string;
}

export const PROJECT_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate a parsed projects.json. Relative `path` values resolve against `baseDir` (the file's folder). */
export function parseProjectsManifest(raw: unknown, baseDir: string): ProjectsManifest {
	if (!isRecord(raw)) throw new Error('projects.json must be a JSON object with a "projects" array');
	const projects = raw.projects;
	if (!Array.isArray(projects) || projects.length === 0) {
		throw new Error('projects.json needs a non-empty "projects" array');
	}
	const seen = new Set<string>();
	const entries: ProjectEntry[] = [];
	for (const item of projects) {
		if (!isRecord(item)) throw new Error('Each entry in "projects" must be an object');
		const { id, name, path } = item;
		if (typeof id !== "string" || !PROJECT_ID_REGEX.test(id)) {
			throw new Error(`Invalid project id: ${JSON.stringify(id)} (letters, digits, . _ - only)`);
		}
		if (seen.has(id)) throw new Error(`Duplicate project id: ${id}`);
		if (typeof path !== "string" || path.trim().length === 0) throw new Error(`Project ${id} needs a "path"`);
		seen.add(id);
		entries.push({
			id,
			name: typeof name === "string" && name.trim().length > 0 ? name : id,
			path: isAbsolute(path) ? path : resolve(baseDir, path),
		});
	}
	const first = entries[0];
	if (!first) throw new Error('projects.json needs a non-empty "projects" array');
	const defaultProjectId = typeof raw.defaultProjectId === "string" ? raw.defaultProjectId : first.id;
	if (!seen.has(defaultProjectId)) {
		throw new Error(`defaultProjectId "${defaultProjectId}" is not a registered project`);
	}
	return { projects: entries, defaultProjectId };
}

export async function loadProjectsManifest(filePath: string): Promise<ProjectsManifest> {
	const file = Bun.file(filePath);
	if (!(await file.exists())) throw new Error(`projects file not found: ${filePath}`);
	return parseProjectsManifest(await file.json(), dirname(filePath));
}

/**
 * Registered projects → lazily constructed per-project instances (one `BacklogServer` each in
 * production). Laziness matters: an idle project never opens file watchers.
 */
export class ProjectRegistry<T> {
	private readonly instances = new Map<string, T>();

	constructor(
		readonly manifest: ProjectsManifest,
		private readonly factory: (entry: ProjectEntry) => T,
	) {}

	static single<T>(path: string, factory: (entry: ProjectEntry) => T): ProjectRegistry<T> {
		return new ProjectRegistry(
			{ projects: [{ id: "default", name: "Default", path }], defaultProjectId: "default" },
			factory,
		);
	}

	list(): ProjectEntry[] {
		return this.manifest.projects.map((entry) => ({ ...entry }));
	}

	has(id: string): boolean {
		return this.manifest.projects.some((entry) => entry.id === id);
	}

	get(id: string): T | undefined {
		const entry = this.manifest.projects.find((candidate) => candidate.id === id);
		if (!entry) return undefined;
		let instance = this.instances.get(id);
		if (instance === undefined) {
			instance = this.factory(entry);
			this.instances.set(id, instance);
		}
		return instance;
	}

	getDefault(): T {
		const instance = this.get(this.manifest.defaultProjectId);
		if (instance === undefined) throw new Error(`Default project ${this.manifest.defaultProjectId} is not registered`);
		return instance;
	}

	created(): T[] {
		return [...this.instances.values()];
	}
}
