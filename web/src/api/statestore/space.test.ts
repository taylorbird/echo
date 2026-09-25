import { describe, expect, it } from "vitest"
import type { RoomListEntry, StateStore } from "./main.ts"
import { SpaceEdgeStore, SpaceOrphansSpace, SubFilteredSpace } from "./space.ts"

// Just enough of StateStore for the space stores: they only look each other up.
function fakeStore() {
	const spaces = new Map<string, SpaceEdgeStore>()
	const store = {
		getSpaceStore: (id: string) => spaces.get(id) ?? null,
	} as unknown as StateStore
	const make = (id: string) => {
		const space = new SpaceEdgeStore(id, store)
		spaces.set(id, space)
		return space
	}
	return { store, make }
}

const room = (room_id: string, dm_user_id?: string) => ({ room_id, dm_user_id }) as RoomListEntry

describe("SpaceEdgeStore DMs", () => {
	it("includes a DM whose other person is a member of the space", () => {
		const { make } = fakeStore()
		const space = make("!space")
		space.children = [{ child_id: "!general" }] as never
		expect(space.include(room("!dm", "@zach:x"))).toBe(false)
		expect(space.setMembers(new Set(["@zach:x"]))).toBe(true)
		expect(space.include(room("!dm", "@zach:x"))).toBe(true)
		expect(space.include(room("!other-dm", "@stranger:x"))).toBe(false)
		expect(space.include(room("!general"))).toBe(true)
	})

	it("reports no change for the same member set", () => {
		const { make } = fakeStore()
		const space = make("!space")
		space.setMembers(new Set(["@a:x", "@b:x"]))
		expect(space.setMembers(new Set(["@b:x", "@a:x"]))).toBe(false)
	})

	it("carries a subspace's members up to the parent", () => {
		const { make } = fakeStore()
		const child = make("!child")
		const parent = make("!parent")
		parent.children = [{ child_id: "!child" }] as never
		child.setMembers(new Set(["@nick:x"]))
		expect(parent.include(room("!dm", "@nick:x"))).toBe(true)
		child.setMembers(new Set())
		expect(parent.include(room("!dm", "@nick:x"))).toBe(false)
	})

	it("keeps DMs outside spaces when only a member matches", () => {
		const { store, make } = fakeStore()
		const space = make("!space")
		space.setMembers(new Set(["@zach:x"]))
		const orphans = new SpaceOrphansSpace(store)
		orphans.children = [{ child_id: "!space" }] as never
		expect(orphans.include(room("!dm", "@zach:x"))).toBe(true)
	})

	it("makes the Rooms and DMs sub-filters differ inside a space", () => {
		const { make } = fakeStore()
		const space = make("!space")
		space.children = [{ child_id: "!general" }] as never
		space.setMembers(new Set(["@zach:x"]))
		const dms = new SubFilteredSpace(space, "dms")
		const rooms = new SubFilteredSpace(space, "rooms")
		expect(dms.include(room("!dm", "@zach:x"))).toBe(true)
		expect(rooms.include(room("!dm", "@zach:x"))).toBe(false)
		expect(rooms.include(room("!general"))).toBe(true)
	})
})
