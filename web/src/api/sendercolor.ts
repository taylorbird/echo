// gomuks - A Matrix client written in Go.
// Copyright (C) 2026 Tulir Asokan
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//
// Room-aware sender colour allocation.
//
// Hashing user IDs into a ten-colour palette puts two of the three people in a
// small room on the same or neighbouring hues often enough to be a real
// problem: hue is the only thing telling senders apart at a glance. So instead
// of hashing, the first time a sender is seen in a room they are handed the
// free palette slot whose hue sits farthest from every hue already spoken for
// in that room, and the choice is remembered.
//
// Allocation is deliberately incremental — it happens as senders first appear
// in this client — so it is order-dependent: a different client, or this one
// after its storage is cleared, can land on a different (but equally
// well-spread) assignment for the same room. Stability for one user across
// reloads is what matters here; agreement between clients does not.
import { RoomID, UserID } from "./types"

export const PALETTE_SIZE = 10

const STORAGE_KEY = "echo.room_sender_colors"

/** Persisted palette index per sender, per room. */
export type RoomAssignments = Record<RoomID, Record<UserID, number>>

export interface SenderColorStorage {
	load: () => RoomAssignments
	save: (assignments: RoomAssignments) => void
}

export interface SenderColorDeps extends SenderColorStorage {
	/** The palette, resolved lazily because it comes out of computed style. */
	getPalette: () => string[]
	/** A colour that beats the palette for this user (a cheat or a custom colour). */
	getOverride: (userID: UserID) => string | undefined
	/** The old hash, used as the tie-breaker once a room has run out of palette slots. */
	getHashIndex: (userID: UserID) => number
}

export interface SenderColorAllocator {
	/** The palette index for this sender, or null when an override colour applies instead. */
	getIndex: (roomID: RoomID, userID: UserID) => number | null
	/** The CSS colour for this sender: their override, or their allocated palette entry. */
	getColor: (roomID: RoomID, userID: UserID) => string
}

// Hue angle in degrees of a #rgb / #rrggbb colour, or null when there is no hue
// to speak of (unparseable, or a grey). Lightness and chroma are ignored: two
// senders on the same hue read as the same person however their lightness
// differs, and the palette is already tuned for contrast.
export function hexHue(hex: string): number | null {
	const raw = hex.trim().replace(/^#/, "")
	let r: number, g: number, b: number
	if (raw.length === 3) {
		r = parseInt(raw[0] + raw[0], 16)
		g = parseInt(raw[1] + raw[1], 16)
		b = parseInt(raw[2] + raw[2], 16)
	} else if (raw.length === 6) {
		r = parseInt(raw.slice(0, 2), 16)
		g = parseInt(raw.slice(2, 4), 16)
		b = parseInt(raw.slice(4, 6), 16)
	} else {
		return null
	}
	if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
		return null
	}
	const max = Math.max(r, g, b)
	const min = Math.min(r, g, b)
	if (max === min) {
		return null
	}
	const delta = max - min
	let hue: number
	if (max === r) {
		hue = 60 * ((g - b) / delta)
	} else if (max === g) {
		hue = 60 * (2 + (b - r) / delta)
	} else {
		hue = 60 * (4 + (r - g) / delta)
	}
	return ((hue % 360) + 360) % 360
}

// Shortest way round the hue circle between two angles, so 350° and 10° come
// out 20° apart rather than 340°.
export function hueDistance(a: number, b: number): number {
	const diff = Math.abs(a - b) % 360
	return diff > 180 ? 360 - diff : diff
}

export function createSenderColorAllocator(deps: SenderColorDeps): SenderColorAllocator {
	// Both of these are module-lifetime caches so lookups during render stay
	// synchronous and cheap: the palette is parsed once, and storage is read
	// once and then written through.
	let paletteHues: (number | null)[] | null = null
	let assignments: RoomAssignments | null = null
	// Hues claimed in a room by senders whose colour comes from an override.
	// Not persisted — overrides are looked up fresh every time; this only
	// records the ones we have actually seen speak in the room, which is the
	// same "as they appear" rule the allocation itself follows.
	const overrideHues = new Map<RoomID, Map<UserID, number>>()

	const getPaletteHues = () => paletteHues ??= deps.getPalette().map(hexHue)
	const getAssignments = () => assignments ??= deps.load()

	function noteOverride(roomID: RoomID, userID: UserID, color: string) {
		const hue = hexHue(color)
		if (hue === null) {
			return
		}
		let room = overrideHues.get(roomID)
		if (!room) {
			room = new Map()
			overrideHues.set(roomID, room)
		}
		room.set(userID, hue)
	}

	function allocate(roomID: RoomID, userID: UserID): number {
		const rooms = getAssignments()
		const room = rooms[roomID] ??= {}
		const used = new Set(Object.values(room))
		if (used.size >= PALETTE_SIZE) {
			// Every hue is spoken for, so somebody has to double up. Put the
			// newcomer on the slot with the fewest people already on it, so the
			// eleventh and twelfth senders at least don't land on the same colour
			// as each other — which is what the plain hash did to two people in
			// one room the first day this shipped. The hash still breaks ties,
			// so a sender keeps the colour they'd have had before this existed
			// whenever that slot is among the least loaded.
			const counts = new Array<number>(PALETTE_SIZE).fill(0)
			for (const index of Object.values(room)) {
				if (index >= 0 && index < PALETTE_SIZE) {
					counts[index]++
				}
			}
			const fewest = Math.min(...counts)
			const hash = deps.getHashIndex(userID)
			const best = counts[hash] === fewest ? hash : counts.indexOf(fewest)
			room[userID] = best
			deps.save(rooms)
			return best
		}
		const hues = getPaletteHues()
		const taken: number[] = []
		for (const index of used) {
			const hue = hues[index]
			if (hue !== null && hue !== undefined) {
				taken.push(hue)
			}
		}
		for (const hue of overrideHues.get(roomID)?.values() ?? []) {
			taken.push(hue)
		}
		let best = -1
		let bestDistance = -1
		for (let index = 0; index < PALETTE_SIZE; index++) {
			if (used.has(index)) {
				continue
			}
			const hue = hues[index]
			// A hueless palette entry can't claim distance from anything, so it
			// only wins when nothing better is free.
			let distance = hue === null || hue === undefined ? 0 : Infinity
			if (hue !== null && hue !== undefined) {
				for (const other of taken) {
					distance = Math.min(distance, hueDistance(hue, other))
				}
			}
			// Strictly greater, so ties fall to the lowest index.
			if (distance > bestDistance) {
				best = index
				bestDistance = distance
			}
		}
		if (best === -1) {
			return deps.getHashIndex(userID)
		}
		// Written down immediately: once allocated, a sender's colour in a room
		// never moves again, so nobody reshuffles when the next person joins.
		room[userID] = best
		deps.save(rooms)
		return best
	}

	// Only ever reached for senders without an override.
	function resolveIndex(roomID: RoomID, userID: UserID): number {
		return getAssignments()[roomID]?.[userID] ?? allocate(roomID, userID)
	}

	return {
		getIndex(roomID: RoomID, userID: UserID): number | null {
			const override = deps.getOverride(userID)
			if (override) {
				noteOverride(roomID, userID, override)
				return null
			}
			return resolveIndex(roomID, userID)
		},
		getColor(roomID: RoomID, userID: UserID): string {
			const override = deps.getOverride(userID)
			if (override) {
				// An override wins outright, and its hue counts as taken in the
				// room so the palette allocation steers clear of it.
				noteOverride(roomID, userID, override)
				return override
			}
			return deps.getPalette()[resolveIndex(roomID, userID)]
		},
	}
}

export const localSenderColorStorage: SenderColorStorage = {
	load(): RoomAssignments {
		try {
			const stored = localStorage.getItem(STORAGE_KEY)
			const parsed = stored ? JSON.parse(stored) : null
			return typeof parsed === "object" && parsed !== null ? parsed as RoomAssignments : {}
		} catch {
			return {}
		}
	},
	save(assignments: RoomAssignments) {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments))
		} catch {
			// Colours are a nicety; a blocked or full localStorage is not worth
			// breaking a timeline render over. The in-memory cache still holds
			// the assignment for this session.
		}
	},
}
