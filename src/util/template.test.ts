import { describe, expect, it } from "vitest";
import { renderTemplate } from "./template";

describe("renderTemplate", () => {
	it("replaces a simple variable", () => {
		expect(renderTemplate("Hello {{name}}!", { name: "World" })).toBe("Hello World!");
	});

	it("replaces multiple occurrences of the same variable", () => {
		expect(renderTemplate("{{name}} and {{name}}", { name: "Alice" })).toBe("Alice and Alice");
	});

	it("renders unknown variables as empty string", () => {
		expect(renderTemplate("Hello {{unknown}}!", {})).toBe("Hello !");
	});

	it("returns the template unchanged when empty", () => {
		expect(renderTemplate("", { name: "World" })).toBe("");
	});

	it("handles adjacent variables", () => {
		expect(renderTemplate("{{a}}{{b}}", { a: "foo", b: "bar" })).toBe("foobar");
	});

	it("allows whitespace inside the braces", () => {
		expect(renderTemplate("Hello {{ name }}!", { name: "World" })).toBe("Hello World!");
		expect(renderTemplate("Hello {{  name  }}!", { name: "World" })).toBe("Hello World!");
	});
});
