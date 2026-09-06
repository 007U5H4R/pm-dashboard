import { describe, expect, it } from "bun:test";
import type { Task } from "../../types/index.ts";
import { computeSchedule, formatIsoDate, parseStoryPoints, percentComplete } from "./schedule.ts";

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

describe("computeSchedule", () => {
	it("maps sp:3 to 3 days", () => {
		const { tasks } = computeSchedule([task("A", { labels: ["sp:3"] })], { projectStart: START });
		expect(tasks[0]?.days).toBe(3);
		expect(tasks[0]?.estimated).toBe(true);
		expect(formatIsoDate(tasks[0]?.start as Date)).toBe("2026-01-01");
		expect(formatIsoDate(tasks[0]?.finish as Date)).toBe("2026-01-04");
	});

	it("applies the daysPerPoint factor", () => {
		const { tasks } = computeSchedule([task("A", { labels: ["sp:2"] })], { projectStart: START, daysPerPoint: 2 });
		expect(tasks[0]?.days).toBe(4);
	});

	it("defaults to 1 day and flags estimated:false when there is no sp: label", () => {
		const { tasks } = computeSchedule([task("A")], { projectStart: START });
		expect(tasks[0]?.days).toBe(1);
		expect(tasks[0]?.points).toBeNull();
		expect(tasks[0]?.estimated).toBe(false);
	});

	it("starts a dependent when its blocker finishes", () => {
		const { tasks } = computeSchedule([task("B", { dependencies: ["A"] }), task("A", { labels: ["sp:2"] })], {
			projectStart: START,
		});
		const byId = new Map(tasks.map((t) => [t.id, t]));
		expect(tasks.map((t) => t.id)).toEqual(["A", "B"]);
		expect(formatIsoDate(byId.get("A")?.finish as Date)).toBe("2026-01-03");
		expect(formatIsoDate(byId.get("B")?.start as Date)).toBe("2026-01-03");
	});

	it("starts at the latest blocker finish when there are several blockers", () => {
		const { tasks } = computeSchedule(
			[task("A", { labels: ["sp:2"] }), task("B", { labels: ["sp:5"] }), task("C", { dependencies: ["A", "B"] })],
			{ projectStart: START },
		);
		const c = tasks.find((t) => t.id === "C");
		expect(formatIsoDate(c?.start as Date)).toBe("2026-01-06");
	});

	it("breaks a cycle with a warning instead of looping", () => {
		const { tasks, warnings } = computeSchedule(
			[task("A", { dependencies: ["B"] }), task("B", { dependencies: ["A"] })],
			{ projectStart: START },
		);
		expect(tasks).toHaveLength(2);
		expect(warnings.some((w) => w.includes("cycle"))).toBe(true);
	});

	it("ignores unknown dependency ids with a warning", () => {
		const { tasks, warnings } = computeSchedule([task("A", { dependencies: ["ZZZ"] })], { projectStart: START });
		expect(tasks[0]?.dependencies).toEqual([]);
		expect(warnings[0]).toContain("ZZZ");
	});

	it("derives percent and blocked flag from status", () => {
		const { tasks } = computeSchedule(
			[
				task("A", { status: "Done" }),
				task("B", { status: "In Review" }),
				task("C", { status: "In Progress" }),
				task("D", { status: "Blocked" }),
				task("E", { status: "To Do" }),
			],
			{ projectStart: START },
		);
		expect(tasks.map((t) => t.percent)).toEqual([100, 75, 50, 0, 0]);
		expect(tasks.map((t) => t.blocked)).toEqual([false, false, false, true, false]);
	});

	it("anchors on the earliest createdDate when projectStart is not given", () => {
		const { tasks } = computeSchedule([
			task("A", { createdDate: "2026-03-10" }),
			task("B", { createdDate: "2026-03-02" }),
		]);
		expect(formatIsoDate(tasks[0]?.start as Date)).toBe("2026-03-02");
	});
});
