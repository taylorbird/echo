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
// Cheat codes. Deliberately dependency-free: getUserColor in api/media.ts calls
// isCheatActive on every render of every sender name, and media.ts is imported
// from nearly everywhere, so anything imported here would land in an import
// cycle. localStorage and nothing else.

export interface Cheat {
	id: string
	name: string
	description: string
	sequence: string[]
}

const CHEATS: Cheat[] = [{
	id: "raam-green",
	name: "RAAM stays green",
	description: "Every user named raam is drawn green, everywhere.",
	sequence: [
		"ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
		"ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
		"b", "a",
	],
}]

// Renamed from the pre-rebrand "seabug_" prefix; see the note on collapsedSectionsKey in
// RoomList.tsx for why this was safe to change when it was.
const ACTIVE_CHEATS_KEY = "echo_active_cheats"

function loadActiveCheats(): Set<string> {
	try {
		const stored = localStorage.getItem(ACTIVE_CHEATS_KEY)
		const parsed = stored ? JSON.parse(stored) : null
		return Array.isArray(parsed) ? new Set(parsed.filter(id => typeof id === "string")) : new Set()
	} catch {
		return new Set()
	}
}

// Loaded once at module init so isCheatActive stays a set lookup: it runs in
// render-time colour code, not in an event handler.
const activeCheats = loadActiveCheats()

export const getCheats = (): Cheat[] => CHEATS

export const isCheatActive = (id: string): boolean => activeCheats.has(id)

// Returns the new state, so the console can say "activated" or "deactivated".
export function toggleCheat(id: string): boolean {
	const nowActive = !activeCheats.has(id)
	if (nowActive) {
		activeCheats.add(id)
	} else {
		activeCheats.delete(id)
	}
	try {
		localStorage.setItem(ACTIVE_CHEATS_KEY, JSON.stringify(Array.from(activeCheats)))
	} catch {}
	return nowActive
}

// Matches the tail of the entered sequence against every cheat's full code, so a
// mistyped prefix doesn't force the user to start over.
export function matchCheat(entered: string[]): Cheat | null {
	for (const cheat of CHEATS) {
		const offset = entered.length - cheat.sequence.length
		if (offset < 0) {
			continue
		}
		if (cheat.sequence.every((key, i) => entered[offset + i] === key)) {
			return cheat
		}
	}
	return null
}
