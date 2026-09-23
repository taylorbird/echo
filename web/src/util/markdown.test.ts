import { describe, expect, it } from "vitest"
import { addMention, applyMentions, mentionLabel } from "./markdown.ts"

describe("applyMentions", () => {
	it("turns each inserted @label into a mention link at send time", () => {
		const mentions = [{ label: mentionLabel("wreck [fancy]"), userID: "@william:mssj.me" }]
		expect(applyMentions("hi @wreck [fancy] there", mentions))
			.toBe("hi [wreck \\[fancy\\]](https://matrix.to/#/%40william%3Amssj.me) there")
	})
	it("does not let a shorter name take the front off a longer one", () => {
		const mentions = [
			{ label: "@Ann", userID: "@ann:x" },
			{ label: "@Anna", userID: "@anna:x" },
		]
		expect(applyMentions("@Anna and @Ann", mentions))
			.toBe("[Anna](https://matrix.to/#/%40anna%3Ax) and [Ann](https://matrix.to/#/%40ann%3Ax)")
	})
	it("leaves text alone when the label was deleted", () => {
		expect(applyMentions("nothing here", [{ label: "@Ann", userID: "@ann:x" }])).toBe("nothing here")
		expect(applyMentions("plain", undefined)).toBe("plain")
	})
	it("keeps one entry per label", () => {
		const once = addMention(undefined, { label: "@Ann", userID: "@a:x" })
		expect(addMention(once, { label: "@Ann", userID: "@b:x" })).toEqual([{ label: "@Ann", userID: "@b:x" }])
	})
})
