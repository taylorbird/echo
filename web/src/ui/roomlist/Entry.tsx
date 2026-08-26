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
import React, { JSX, memo, use } from "react"
import { getRoomAccentColor, getRoomAvatarThumbnailURL } from "@/api/media.ts"
import type { RoomListEntry } from "@/api/statestore"
import { type MemDBEvent, type MemberEventContent, RoomNameQuality } from "@/api/types"
import { getDisplayname } from "@/util/validation.ts"
import ClientContext from "../ClientContext.ts"
import MainScreenContext from "../MainScreenContext.ts"
import { RoomMenu, getModalStyleFromMouse } from "../menu"
import { ModalContext } from "../modal"
import UnreadCount from "./UnreadCount.tsx"
import MessagesSquareIcon from "@/icons/modern/messages-square.svg?react"
import UserIcon from "@/icons/modern/user.svg?react"
import UsersIcon from "@/icons/modern/users.svg?react"

export interface RoomListEntryProps {
	room: RoomListEntry
	isActive: boolean
	hidden: boolean
	hideAvatar?: boolean
}

function getPreviewText(evt?: MemDBEvent, senderMemberEvt?: MemDBEvent | null): [string, JSX.Element | null] {
	if (!evt) {
		return ["", null]
	}
	if ((evt.type === "m.room.message" || evt.type === "m.sticker") && typeof evt.content.body === "string") {
		// eslint-disable-next-line react-hooks/rules-of-hooks
		const client = use(ClientContext)!
		const displayname = evt.sender === client.userID
			? "You"
			: getDisplayname(evt.sender, senderMemberEvt?.content as MemberEventContent)
		let previewText = evt.content.body
		if (evt.content.formatted_body?.includes?.("data-mx-spoiler")) {
			previewText = "<message contains spoilers>"
		}
		return [
			`${displayname}: ${evt.content.body}`,
			<>
				<span style={{ unicodeBidi: "isolate" }}>
					{displayname.length > 16 ? displayname.slice(0, 12) + "…" : displayname}
				</span>: {previewText}
			</>,
		]
	}
	return ["", null]
}

function renderEntry(room: RoomListEntry, hideAvatar: boolean | undefined, KindIcon: typeof UserIcon) {
	const [previewText, croppedPreviewText] = getPreviewText(room.preview_event, room.preview_sender)

	return <>
		<div className="room-entry-left">
			<img
				loading="lazy"
				className="avatar room-avatar"
				src={getRoomAvatarThumbnailURL(room, undefined, hideAvatar)}
				alt=""
			/>
		</div>
		<div className="room-entry-right">
			<div
				className="room-name"
				style={{ "--room-accent": getRoomAccentColor(room.room_id) } as React.CSSProperties}
			>
				<span className="room-name-text">{room.name}</span>
				<KindIcon className="room-kind-icon" />
			</div>
			{previewText && <div className="message-preview" title={previewText}>{croppedPreviewText}</div>}
		</div>
		<UnreadCount counts={room} />
	</>
}

const Entry = ({ room, isActive, hidden, hideAvatar }: RoomListEntryProps) => {
	const openModal = use(ModalContext)
	const mainScreen = use(MainScreenContext)
	const client = use(ClientContext)!
	const onContextMenu = (evt: React.MouseEvent<HTMLDivElement>) => {
		const realRoom = client.store.rooms.get(room.room_id)
		if (!realRoom) {
			// TODO implement separate menu for invite rooms
			console.error("Room state store not found for", room.room_id)
			return
		}
		openModal({
			content: <RoomMenu
				room={realRoom}
				entry={room}
				style={getModalStyleFromMouse(evt, RoomMenu.height)}
			/>,
		})
		evt.preventDefault()
	}
	// What kind of conversation this is, shown as a glyph after the name:
	// a person for DMs, two people for an ad-hoc group whose name is just
	// its members' names ("X and Y" — name_quality Participants), chat
	// bubbles for rooms with a real name or alias. Meta is read without
	// subscribing — a stale glyph until the next list update is fine.
	let KindIcon = MessagesSquareIcon
	if (room.dm_user_id) {
		KindIcon = UserIcon
	} else if (client.store.rooms.get(room.room_id)
		?.meta.current.name_quality === RoomNameQuality.Participants) {
		KindIcon = UsersIcon
	}
	// Rendered unconditionally: this used to be gated on useContentVisibility,
	// but that hook needs `content-visibility: auto` on the row, which was
	// removed from the CSS because WebKit deferred repaints of the contained
	// rows (stale .active highlight for seconds after switching rooms).
	return <div
		className={`room-entry ${isActive ? "active" : ""} ${hidden ? "hidden" : ""}`}
		onClick={mainScreen.clickRoom}
		onContextMenu={onContextMenu}
		data-room-id={room.room_id}
	>
		{renderEntry(room, hideAvatar, KindIcon)}
	</div>
}

export default memo(Entry)
