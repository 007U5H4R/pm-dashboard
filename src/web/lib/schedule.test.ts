import { describe, expect, it } from "bun:test";
import type { Task } from "../../types/index.ts";
import { parseStoryPoints, percentComplete } from "./schedule.ts";

export function task(id: string, overrides: Partial<Task> = {}): Task {
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

export const START = new Date("2026-01-01T00:00:00.000Z");

describe("parseStoryPoints", () => {
	it("reads sp:<n> labels", () => {
		expect(parseStoryPoints(["bug", "sp:3"])).toBe(3);
		expect(parseStoryPoints(["sp:0.5"])).toBe(0.5);
	});

	it("returns null when absent or invalid", () => {
		expect(parseStoryPoints([])).toBeNull();
		expect(parseStoryPoints(["sp:", "sp:abc", "sp:-1", "points:3"])).toBeNull();
	});
});

describe("percentComplete", () => {
	it("maps status to percent", () => {
		expect(percentComplete("Done")).toBe(100);
		expect(percentComplete("In Review")).toBe(75);
		expect(percentComplete("In Progress")).toBe(50);
		expect(percentComplete("To Do")).toBe(0);
		expect(percentComplete("Blocked")).toBe(0);
		expect(percentComplete("Something Else")).toBe(0);
	});
});
