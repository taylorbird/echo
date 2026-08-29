import { describe, expect, it } from "vitest"
import { parseInline, parseReleaseNotes } from "./releasenotes.ts"

describe("parseReleaseNotes", () => {
	it("groups headings, lists and wrapped paragraphs", () => {
		const blocks = parseReleaseNotes("## Room list\n\n- one\n- two\n\nA wrapped\nparagraph.")
		expect(blocks.map(b => b.kind)).toEqual(["heading", "list", "paragraph"])
		expect(blocks[1]).toMatchObject({
			items: [[{ kind: "text", text: "one" }], [{ kind: "text", text: "two" }]],
		})
		expect(blocks[2]).toMatchObject({ content: [{ kind: "text", text: "A wrapped paragraph." }]})
	})
	it("parses inline runs", () => {
		expect(parseInline("a **b** `c` [d](https://e.com)")).toEqual([
			{ kind: "text", text: "a " },
			{ kind: "strong", text: "b" },
			{ kind: "text", text: " " },
			{ kind: "code", text: "c" },
			{ kind: "text", text: " " },
			{ kind: "link", text: "d", href: "https://e.com/" },
		])
	})
	// The property that matters is that no link node is ever produced for these — what the
	// leftover text looks like is cosmetic. `javascript:alert(1)` also happens to contain a `)`,
	// which ends the href capture early and leaves a stray character behind; harmless, but pinned
	// here so a future change to the pattern cannot quietly turn it into a real link.
	it("never produces a link node for a non-web scheme", () => {
		for (const src of ["[x](javascript:alert(1))", "[y](/relative)", "[z](data:text/html,hi)"]) {
			expect(parseInline(src).some(node => node.kind === "link")).toBe(false)
		}
		expect(parseInline("[y](/relative)")).toEqual([{ kind: "text", text: "y" }])
	})
	it("lets backticks quote the other syntax literally", () => {
		expect(parseInline("`**not bold**`")).toEqual([{ kind: "code", text: "**not bold**" }])
	})
	it("is reusable — the global regex does not carry state between calls", () => {
		const once = parseInline("**a**")
		expect(parseInline("**a**")).toEqual(once)
	})
})
