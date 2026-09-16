import { describe, expect, it } from "bun:test";
import { ACCENT_KEYS, accentClass, DEFAULT_ACCENT } from "../web/lib/accentThemes";

describe("accentClass", () => {
	it("maps a known accent key to its chrome class", () => {
		expect(accentClass("blue")).toBe("accent-blue");
	});

	it("falls back to the neutral class when the accent is absent", () => {
		expect(accentClass(undefined)).toBe(`accent-${DEFAULT_ACCENT}`);
		expect(accentClass("")).toBe(`accent-${DEFAULT_ACCENT}`);
	});

	it("falls back to neutral for an unknown accent key (no arbitrary class injection)", () => {
		expect(accentClass("bogus")).toBe(`accent-${DEFAULT_ACCENT}`);
		expect(accentClass("blue; drop")).toBe(`accent-${DEFAULT_ACCENT}`);
	});

	it("includes neutral and the office-style colors in the key set", () => {
		expect(ACCENT_KEYS).toContain("neutral");
		for (const key of ["blue", "green", "orange", "purple", "red", "teal"]) {
			expect(ACCENT_KEYS).toContain(key);
		}
	});
});
