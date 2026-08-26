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
import React, { JSX, use, useLayoutEffect, useMemo, useRef, useState } from "react"
import { getRoomAccentColor, getRoomAvatarThumbnailURL } from "@/api/media.ts"
import { RoomListEntry, StateStore } from "@/api/statestore"
import toSearchableString from "@/util/searchablestring.ts"
import { MainScreenContextFields } from "./MainScreenContext.ts"
import { ModalCloseContext, modals } from "./modal"
import UnreadCount from "./roomlist/UnreadCount.tsx"
import AddIcon from "@/icons/add.svg?react"
import SettingsIcon from "@/icons/modern/settings.svg?react"
import SearchIcon from "@/icons/search.svg?react"
import "./QuickSwitcher.css"

const MAX_ROOM_RESULTS = 10

// Lower is better: prefix match beats substring, substring beats scattered subsequence.
// -1 means no match at all.
function rankMatch(searchName: string, query: string): number {
	if (searchName.startsWith(query)) {
		return 0
	}
	if (searchName.includes(query)) {
		return 1
	}
	let queryIdx = 0
	for (let i = 0; i < searchName.length && queryIdx < query.length; i++) {
		if (searchName[i] === query[queryIdx]) {
			queryIdx++
		}
	}
	return queryIdx === query.length ? 2 : -1
}

interface QuickAction {
	label: string
	icon: JSX.Element
	run: () => void
}

const QuickSwitcher = ({ store, mainScreen }: {
	store: StateStore
	mainScreen: MainScreenContextFields
}) => {
	const closeModal = use(ModalCloseContext)
	const [query, setQuery] = useState("")
	const [selected, setSelected] = useState(0)
	const rootRef = useRef<HTMLDivElement>(null)
	// Plain per-render computation rather than useMemo: this reads the mutable
	// roomList snapshot, which the React Compiler cannot safely memoize against
	// (react-hooks/preserve-manual-memoization), and the scan is cheap at
	// per-keystroke frequency.
	const rooms = (() => {
		// roomList is sorted oldest-activity-first, so recent rooms come from the end
		const roomList = store.roomList.current
		const cleanedQuery = toSearchableString(query)
		if (!cleanedQuery) {
			return roomList.slice(-MAX_ROOM_RESULTS).reverse()
		}
		const matched: { entry: RoomListEntry, rank: number }[] = []
		for (let i = roomList.length - 1; i >= 0; i--) {
			const rank = rankMatch(roomList[i].search_name, cleanedQuery)
			if (rank !== -1) {
				matched.push({ entry: roomList[i], rank })
			}
		}
		// Stable sort: equal ranks keep their recency order from the loop above
		matched.sort((a, b) => a.rank - b.rank)
		return matched.slice(0, MAX_ROOM_RESULTS).map(m => m.entry)
	})()
	const actions = useMemo(() => {
		const activeRoom = store.activeRoomID ? store.rooms.get(store.activeRoomID) : null
		const all: QuickAction[] = []
		if (activeRoom) {
			all.push({
				label: "Settings",
				icon: <SettingsIcon/>,
				run: () => {
					closeModal()
					window.openNestableModal(modals.settings(activeRoom))
				},
			})
		}
		all.push({
			label: "New room",
			icon: <AddIcon/>,
			run: () => {
				closeModal()
				window.openModal(modals.createRoom())
			},
		})
		if (!query) {
			return all
		}
		const lowerQuery = query.toLowerCase()
		return all.filter(action => action.label.toLowerCase().includes(lowerQuery))
	}, [store, query, closeModal])
	const itemCount = rooms.length + actions.length
	useLayoutEffect(() => {
		rootRef.current?.querySelector(".selected")?.scrollIntoView({ block: "nearest" })
	}, [selected])
	const activateItem = (index: number) => {
		if (index < rooms.length) {
			mainScreen.setActiveRoom(rooms[index].room_id)
			closeModal()
		} else if (actions[index - rooms.length]) {
			actions[index - rooms.length].run()
		}
	}
	const onKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
		if (evt.key === "ArrowDown") {
			evt.preventDefault()
			setSelected(s => Math.min(s + 1, itemCount - 1))
		} else if (evt.key === "ArrowUp") {
			evt.preventDefault()
			setSelected(s => Math.max(s - 1, 0))
		} else if (evt.key === "Enter") {
			evt.preventDefault()
			activateItem(selected)
		} else if (evt.key === "k" && (evt.metaKey || evt.ctrlKey)) {
			evt.preventDefault()
			closeModal()
		}
	}
	return <div className="quick-switcher" ref={rootRef}>
		<div className="quick-switcher-search">
			<SearchIcon/>
			<input
				autoFocus
				type="text"
				placeholder="Search rooms and actions…"
				value={query}
				onChange={evt => {
					setQuery(evt.target.value)
					setSelected(0)
				}}
				onKeyDown={onKeyDown}
			/>
		</div>
		<div className="quick-switcher-results">
			{rooms.length > 0 && <div className="section-label">Rooms</div>}
			{rooms.map((room, i) => <div
				key={room.room_id}
				className={`quick-switcher-entry ${i === selected ? "selected" : ""}`}
				onClick={() => activateItem(i)}
			>
				<img
					loading="lazy"
					className="avatar"
					src={getRoomAvatarThumbnailURL(room)}
					alt=""
				/>
				<div
					className="entry-name"
					style={{ "--room-accent": getRoomAccentColor(room.room_id) } as React.CSSProperties}
				>{room.name}</div>
				{room.dm_user_id && <span className="dm-tag">DM</span>}
				<UnreadCount counts={room}/>
			</div>)}
			{itemCount === 0 && <div className="no-results">No results</div>}
		</div>
		{actions.length > 0 && <div className="quick-switcher-actions">
			<div className="section-label">Actions</div>
			{actions.map((action, i) => <div
				key={action.label}
				className={`quick-switcher-entry action ${rooms.length + i === selected ? "selected" : ""}`}
				onClick={() => activateItem(rooms.length + i)}
			>
				<div className="action-icon">{action.icon}</div>
				<div className="entry-name">{action.label}</div>
			</div>)}
		</div>}
	</div>
}

export default QuickSwitcher
