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
import { JSX } from "react"
import { RoomListFilter, Space } from "@/api/statestore/space.ts"
import { useEventAsState } from "@/util/eventdispatcher.ts"
import UnreadCount from "./UnreadCount.tsx"
import BellIcon from "@/icons/modern/bell.svg?react"
import HashIcon from "@/icons/modern/hash.svg?react"
import HomeIcon from "@/icons/modern/home.svg?react"
import UserIcon from "@/icons/modern/user.svg?react"
import "./RoomList.css"

export interface FakeSpaceProps {
	space: Space | null
	setSpace: (space: RoomListFilter | null) => void
	isActive: boolean
	onClickUnread?: (evt: React.MouseEvent<HTMLDivElement>, space: Space | null) => void
}

const getFakeSpaceMeta = (space: RoomListFilter | null): [string | undefined, JSX.Element | null] => {
	switch (space?.id) {
	case undefined:
		return ["Home", <HomeIcon />]
	case "fi.mau.gomuks.direct_chats":
		return ["Direct chats", <UserIcon />]
	case "fi.mau.gomuks.unreads":
		return ["Unread chats", <BellIcon />]
	case "fi.mau.gomuks.space_orphans":
		return ["Rooms outside spaces", <HashIcon />]
	default:
		return [undefined, null]
	}
}

const FakeSpace = ({ space, setSpace, isActive, onClickUnread }: FakeSpaceProps) => {
	const unreads = useEventAsState(space?.counts)
	const onClickUnreadWrapped = onClickUnread
		? (evt: React.MouseEvent<HTMLDivElement>) => onClickUnread(evt, space)
		: undefined
	const [title, icon] = getFakeSpaceMeta(space)
	return <div className={`space-entry ${isActive ? "active" : ""}`} onClick={() => setSpace(space)} title={title}>
		<UnreadCount counts={unreads} space={true} onClick={onClickUnreadWrapped} />
		{icon}
	</div>
}

export default FakeSpace
