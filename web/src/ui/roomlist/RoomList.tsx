// gomuks - A Matrix client written in Go.
// Copyright (C) 2024 Tulir Asokan
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
import React, { use, useCallback, useMemo, useRef, useState } from "react"
import { BarLoader } from "react-spinners"
import { getAvatarThumbnailURL } from "@/api/media.ts"
import {
	RoomListEntry,
	RoomListFilter,
	Space as SpaceStore,
	SpaceUnreadCounts,
	usePreference,
} from "@/api/statestore"
import type { RoomID } from "@/api/types"
import { getCheats, isCheatActive } from "@/util/cheats.ts"
import { useEventAsState } from "@/util/eventdispatcher.ts"
import toSearchableString from "@/util/searchablestring.ts"
import ClientContext from "../ClientContext.ts"
import MainScreenContext from "../MainScreenContext.ts"
import { keyToString } from "../keybindings.ts"
import { ModalContext, modals } from "../modal"
import Entry from "./Entry.tsx"
import FakeSpace from "./FakeSpace.tsx"
import Space from "./Space.tsx"
import AddCircleIcon from "@/icons/add-circle.svg?react"
import CloseIcon from "@/icons/close.svg?react"
import ChevronDownIcon from "@/icons/modern/chevron-down.svg?react"
import GamepadIcon from "@/icons/modern/gamepad-2.svg?react"
import SettingsIcon from "@/icons/modern/settings.svg?react"
import UserIcon from "@/icons/modern/user.svg?react"
import UsersIcon from "@/icons/modern/users.svg?react"
import SearchIcon from "@/icons/search.svg?react"
import "./RoomList.css"

const collapsedSectionsKey = "seabug.collapsed_room_list_sections"

function readCollapsedSections(): Set<string> {
	try {
		const raw = localStorage.getItem(collapsedSectionsKey)
		return new Set(raw ? JSON.parse(raw) as string[] : [])
	} catch {
		// A corrupt or unreadable value shouldn't stop the room list from rendering.
		return new Set()
	}
}

interface RoomListProps {
	activeRoomID: RoomID | null
	space: RoomListFilter | null
}

const RoomList = ({ activeRoomID, space }: RoomListProps) => {
	const client = use(ClientContext)!
	const openModal = use(ModalContext)
	const mainScreen = use(MainScreenContext)
	const roomList = useEventAsState(client.store.roomList)
	const spaces = useEventAsState(client.store.topLevelSpaces)
	const initComplete = useEventAsState(client.initComplete)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const [query, directSetQuery] = useState("")

	const setQuery = (evt: React.ChangeEvent<HTMLInputElement>) => {
		client.store.currentRoomListQuery = toSearchableString(evt.target.value)
		directSetQuery(evt.target.value)
	}
	const openCreateRoom = () => {
		openModal(modals.createRoom())
	}
	const onClickSpace = useCallback((evt: React.MouseEvent<HTMLDivElement>) => {
		const spaceID = evt.currentTarget.getAttribute("data-target-space")!
		const store = client.store.getSpaceStore(spaceID)
		mainScreen.setSpace(store)
		// A real space is also a room, so open its lobby (RoomView renders SpaceView
		// for m.space rooms) instead of leaving the chat pane on whatever was there.
		// Pseudo-spaces have no room behind them and stay filter-only — they use the
		// setSpace prop directly rather than going through this handler.
		if (spaceID !== activeRoomID && client.store.rooms.has(spaceID)) {
			mainScreen.setActiveRoom(spaceID)
		}
	}, [mainScreen, client, activeRoomID])
	const onClickSpaceUnread = useCallback((
		evt: React.MouseEvent<HTMLDivElement>, space?: SpaceStore | null,
	) => {
		if (!space) {
			const targetSpace = evt.currentTarget.closest("div.space-entry")?.getAttribute("data-target-space")
			if (!targetSpace) {
				return
			}
			space = client.store.getSpaceStore(targetSpace)
			if (!space) {
				return
			}
		}
		const counts = space.counts.current
		let wantedField: keyof SpaceUnreadCounts
		if (counts.unread_highlights > 0) {
			wantedField = "unread_highlights"
		} else if (counts.unread_notifications > 0) {
			wantedField = "unread_notifications"
		} else if (counts.unread_messages > 0) {
			wantedField = "unread_messages"
		} else {
			return
		}
		for (let i = client.store.roomList.current.length - 1; i >= 0; i--) {
			const entry = client.store.roomList.current[i]
			if (entry[wantedField] > 0 && space.include(entry)) {
				mainScreen.setActiveRoom(entry.room_id, { toSpace: space })
				evt.stopPropagation()
				return
			}
		}
		console.warn(
			"No room found with unreads in space", space.id, "with field", wantedField,
			"- looking for hidden rooms",
		)
		for (const item of client.store.rooms.values()) {
			if (item.meta.current[wantedField] > 0 && space.include({
				...item.meta.current,
				search_name: item.meta.current.name || "",
				name: item.meta.current.name || "",
			})) {
				mainScreen.setActiveRoom(item.roomID, { toSpace: space })
				evt.stopPropagation()
				return
			}
		}
	}, [mainScreen, client])
	const clearQuery = () => {
		client.store.currentRoomListQuery = ""
		directSetQuery("")
		searchInputRef.current?.focus()
	}
	const onKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
		const key = keyToString(evt)
		if (key === "Escape") {
			clearQuery()
			evt.stopPropagation()
			evt.preventDefault()
		} else if (key === "Enter") {
			const roomList = client.store.getFilteredRoomList()
			mainScreen.setActiveRoom(roomList[roomList.length-1]?.room_id)
			clearQuery()
			evt.stopPropagation()
			evt.preventDefault()
		}
	}

	const showInviteAvatars = usePreference(client.store, null, "show_invite_avatars")
	const roomListFilter = client.store.roomListFilterFunc
	// Group rooms from direct messages. dm_user_id is the same signal DirectChatSpace
	// filters on, so the grouping here always agrees with the built-in DM space.
	// roomList is ordered oldest-first, so walk it backwards to keep each group
	// most-recent-first, matching the ungrouped list's ordering.
	const sections = useMemo(() => {
		const rooms: RoomListEntry[] = []
		const directMessages: RoomListEntry[] = []
		for (let i = roomList.length - 1; i >= 0; i--) {
			const room = roomList[i]
			if (room.dm_user_id) {
				directMessages.push(room)
			} else {
				rooms.push(room)
			}
		}
		return [
			{ id: "rooms", name: "Rooms", icon: UsersIcon, entries: rooms },
			{ id: "dms", name: "Direct messages", icon: UserIcon, entries: directMessages },
		]
	}, [roomList])
	const [collapsedSections, setCollapsedSections] = useState(readCollapsedSections)
	const toggleSection = useCallback((evt: React.MouseEvent<HTMLButtonElement>) => {
		const sectionID = evt.currentTarget.getAttribute("data-section-id")
		if (!sectionID) {
			return
		}
		setCollapsedSections(prev => {
			const next = new Set(prev)
			if (next.has(sectionID)) {
				next.delete(sectionID)
			} else {
				next.add(sectionID)
			}
			try {
				localStorage.setItem(collapsedSectionsKey, JSON.stringify([...next]))
			} catch {
				// Remembering the collapse state is a convenience, not worth failing over.
			}
			return next
		})
	}, [])
	return <div className="room-list-wrapper">
		{/* The sidebar's header band is a window drag surface, matching the room header.
		    The bare attribute only fires when the mousedown target is this element itself,
		    so the strip above and below the shorter search input drags the window while
		    the input and its buttons keep working. */}
		<div className="room-search-wrapper" data-tauri-drag-region>
			<input
				value={query}
				onChange={setQuery}
				onKeyDown={onKeyDown}
				className="room-search"
				type="text"
				placeholder="Search rooms"
				ref={searchInputRef}
				id="room-search"
			/>
			{query === "" && <button onClick={openCreateRoom} title="Create room">
				<AddCircleIcon/>
			</button>}
			<button onClick={clearQuery} disabled={query === ""}>
				{query !== "" ? <CloseIcon/> : <SearchIcon/>}
			</button>
		</div>
		<div className="space-bar">
			<FakeSpace space={null} setSpace={mainScreen.setSpace} isActive={space === null} />
			{client.store.pseudoSpaces.map(pseudoSpace => <FakeSpace
				key={pseudoSpace.id}
				space={pseudoSpace}
				setSpace={mainScreen.setSpace}
				onClickUnread={onClickSpaceUnread}
				isActive={space?.id === pseudoSpace.id}
			/>)}
			{spaces.map(roomID => <Space
				key={roomID}
				roomID={roomID}
				client={client}
				onClick={onClickSpace}
				isActive={space?.id === roomID}
				onClickUnread={onClickSpaceUnread}
			/>)}
			<div className="space-bar-footer">
				{/* Static per page load is fine: toggling a cheat reloads the app. */}
				{getCheats().some(cheat => isCheatActive(cheat.id)) && <button
					className="cheat-indicator"
					title="A cheat code is active — click to manage"
					onClick={() => window.openModal(modals.cheatConsole())}
				>
					<GamepadIcon/>
				</button>}
				<button
					className="rail-profile"
					title={`Your profile (${client.userID})`}
					disabled={!activeRoomID}
					onClick={() => mainScreen.setRightPanel({ type: "user", userID: client.userID })}
				>
					<img className="avatar" src={getAvatarThumbnailURL(client.userID)} alt=""/>
				</button>
				<button
					className="rail-settings"
					title="Settings"
					disabled={!activeRoomID}
					onClick={() => {
						const room = activeRoomID ? client.store.rooms.get(activeRoomID) : null
						if (room) {
							window.openNestableModal(modals.settings(room))
						}
					}}
				>
					<SettingsIcon/>
				</button>
			</div>
		</div>
		<div className="room-list">
			{initComplete ? null
				: <BarLoader cssOverride={{ backgroundColor: "unset" }} width="100%" color="var(--primary-color)" />}
			{sections.map(section => {
				// A header with nothing under it is noise, so drop the whole group
				// once the search query filters out every room in it.
				const hasVisibleEntries = roomListFilter
					? section.entries.some(room => roomListFilter(room))
					: section.entries.length > 0
				if (!hasVisibleEntries) {
					return null
				}
				const isCollapsed = collapsedSections.has(section.id)
				return <div key={section.id} className="room-list-section">
					<button
						type="button"
						className={`room-list-section-header ${isCollapsed ? "collapsed" : ""}`}
						data-section-id={section.id}
						onClick={toggleSection}
						aria-expanded={!isCollapsed}
					>
						<section.icon className="section-icon" />
						<span className="section-name">{section.name}</span>
						<ChevronDownIcon className="section-chevron" />
					</button>
					{isCollapsed ? null : section.entries.map(room =>
						<Entry
							key={room.room_id}
							isActive={room.room_id === activeRoomID}
							hidden={roomListFilter ? !roomListFilter(room) : false}
							room={room}
							hideAvatar={room.is_invite && !showInviteAvatars}
						/>,
					)}
				</div>
			})}
		</div>
	</div>
}

export default RoomList
