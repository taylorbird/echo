import { describe, expect, it } from "vitest"
import { PALETTE_SIZE, RoomAssignments, createSenderColorAllocator, hexHue, hueDistance } from "./sendercolor.ts"
import { UserID } from "./types"

// The shipping dark palette (--sender-color-0..9 in index.css), inlined so the
// allocator can be tested without a DOM to read computed style from.
const PALETTE = [
	"#ff5d73", "#ffa64d", "#4dd6a8", "#a78bfa", "#4db8f5",
	"#f0c674", "#ff7ac6", "#4de0e0", "#ff8a65", "#a3e635",
]

// The user's own custom purple, hue ≈ 250°.
const CUSTOM_PURPLE = "#ad9cfe"

// The hue separation two senders in the same room have to clear to read as
// different people. A tenth of the wheel is 36°; this is over twice that.
const MIN_SEPARATION = 77

const ROOM = "!room:example.com"

const hashIndex = (userID: UserID) =>
	userID.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % PALETTE.length

interface Store {
	value: RoomAssignments
}

function makeAllocator(overrides: Record<string, string> = {}, store: Store = { value: {}}) {
	return createSenderColorAllocator({
		getPalette: () => PALETTE,
		getOverride: userID => overrides[userID],
		getHashIndex: hashIndex,
		load: () => structuredClone(store.value),
		// Round-tripped through a clone the way localStorage would be, so a
		// second allocator can't accidentally share the first one's live object.
		save: assignments => {
			store.value = structuredClone(assignments)
		},
	})
}

const hueOf = (index: number) => hexHue(PALETTE[index])!

describe("createSenderColorAllocator", () => {
	it("spreads hashed senders away from each other and from a custom colour", () => {
		const alloc = makeAllocator({ "@me:example.com": CUSTOM_PURPLE })
		// The override wins outright and has no palette index of its own.
		expect(alloc.getColor(ROOM, "@me:example.com")).toBe(CUSTOM_PURPLE)
		expect(alloc.getIndex(ROOM, "@me:example.com")).toBeNull()

		const alice = alloc.getIndex(ROOM, "@alice:example.com")!
		const bob = alloc.getIndex(ROOM, "@bob:example.com")!
		expect(alice).not.toBe(bob)

		const hues = [hexHue(CUSTOM_PURPLE)!, hueOf(alice), hueOf(bob)]
		for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) {
			expect(hueDistance(hues[a], hues[b])).toBeGreaterThanOrEqual(MIN_SEPARATION)
		}
	})

	it("doubles up on the least-used slot once every palette slot in the room is taken", () => {
		const store: Store = { value: {}}
		const alloc = makeAllocator({}, store)
		const assigned = new Set<number>()
		for (let i = 0; i < PALETTE_SIZE; i++) {
			assigned.add(alloc.getIndex(ROOM, `@u${i}:example.com`)!)
		}
		expect(assigned.size).toBe(PALETTE_SIZE)

		// With every slot holding exactly one person, the eleventh sender keeps
		// the colour the old hash would have given them.
		const eleventh = "@overflow:example.com"
		expect(alloc.getIndex(ROOM, eleventh)).toBe(hashIndex(eleventh))

		// Nine more overflow senders each take a different, still-single slot, so
		// no two of them share a colour with each other.
		const overflowSlots = new Set<number>([hashIndex(eleventh)])
		for (let i = 0; i < PALETTE_SIZE - 1; i++) {
			overflowSlots.add(alloc.getIndex(ROOM, `@more${i}:example.com`)!)
		}
		expect(overflowSlots.size).toBe(PALETTE_SIZE)

		// Overflow assignments persist like any other.
		expect(store.value[ROOM][eleventh]).toBe(hashIndex(eleventh))
		expect(makeAllocator({}, store).getIndex(ROOM, eleventh)).toBe(hashIndex(eleventh))
	})

	it("keeps assignments across reloads and never reshuffles an existing one", () => {
		const store: Store = { value: {}}
		const senders = ["@a:example.com", "@b:example.com", "@c:example.com"]
		const first = makeAllocator({}, store)
		const initial = senders.map(sender => first.getIndex(ROOM, sender))

		// A newcomer must not move anybody who was already placed.
		first.getIndex(ROOM, "@d:example.com")
		expect(senders.map(sender => first.getIndex(ROOM, sender))).toEqual(initial)

		// A fresh allocator over the same storage — i.e. after a reload.
		const second = makeAllocator({}, store)
		expect(senders.map(sender => second.getIndex(ROOM, sender))).toEqual(initial)
	})

	it("allocates per room, so the same sender can differ between rooms", () => {
		const alloc = makeAllocator()
		alloc.getIndex(ROOM, "@first:example.com")
		const other = "!other:example.com"
		// Same palette slot is free again in a room that has seen nobody.
		expect(alloc.getIndex(other, "@second:example.com"))
			.toBe(alloc.getIndex(ROOM, "@first:example.com"))
	})
})

describe("hexHue", () => {
	it("reads both hex lengths and reports no hue for greys or junk", () => {
		expect(hexHue("#f00")).toBe(0)
		expect(hexHue(" #00ff00 ")).toBe(120)
		expect(hexHue("#0000ff")).toBe(240)
		expect(hexHue("#808080")).toBeNull()
		expect(hexHue("rgb(1,2,3)")).toBeNull()
	})
})
