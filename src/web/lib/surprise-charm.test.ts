import { describe, expect, test } from "bun:test";
import { surpriseCharmFor } from "./surprise-charm";

const IDS = [
	"marshmallow",
	"lantern",
	"ember",
	"smore",
	"firefly",
	"compass",
	"acorn",
	"daruma",
	"maneki",
	"horseshoe",
	"clover",
	"wishbone",
	"nazar",
	"duck",
	"rocket",
	"bug",
	"coffee",
] as const;

describe("surprise charm", () => {
	test("same local date always gives the same charm", () => {
		const a = surpriseCharmFor(new Date(2026, 5, 14, 0, 1), IDS);
		const b = surpriseCharmFor(new Date(2026, 5, 14, 23, 59), IDS);
		expect(a).toBe(b);
	});

	test("returns a member of the id list", () => {
		for (let k = 0; k < 30; k++) {
			const id = surpriseCharmFor(new Date(2026, 0, 1 + k), IDS);
			expect(IDS).toContain(id);
		}
	});

	test("never repeats the previous day, and covers every charm over 400 days", () => {
		const seen = new Set<string>();
		let prev = "";
		for (let k = 0; k < 400; k++) {
			const id = surpriseCharmFor(new Date(2026, 0, 1 + k), IDS);
			expect(id).not.toBe(prev);
			seen.add(id);
			prev = id;
		}
		expect(seen.size).toBe(IDS.length);
	});

	test("single-charm list returns that charm", () => {
		expect(surpriseCharmFor(new Date(2026, 3, 3), ["only"] as const)).toBe("only");
	});
});
