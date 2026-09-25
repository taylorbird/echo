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
import React, { JSX, Suspense, lazy, useEffect, useState } from "react"
import { RoomStateStore, usePreference } from "@/api/statestore"
import { RoomType } from "@/api/types"
import MessageComposer from "../composer/MessageComposer.tsx"
import TypingNotifications from "../composer/TypingNotifications.tsx"
import { HairlineWait } from "../loading"
import RightPanel, { RightPanelProps } from "../rightpanel/RightPanel.tsx"
import TimelineView from "../timeline/TimelineView.tsx"
import ErrorBoundary from "../util/ErrorBoundary.tsx"
import { jumpToEvent } from "../util/jumpToEvent.tsx"
import ElementCall from "../widget/ElementCall.tsx"
import RoomViewHeader from "./RoomViewHeader.tsx"
import SpaceView from "./SpaceView.tsx"
import { RoomContext, RoomContextData } from "./roomcontext.ts"
import AttachIcon from "@/icons/attach.svg?react"
import "./RoomView.css"

interface RoomViewProps {
	room: RoomStateStore
	rightPanel: RightPanelProps | null
	rightPanelResizeHandle: JSX.Element
}

const ImagePackView = lazy(() => import("./ImagePackView.tsx"))

function getViewForRoomType(roomType: RoomType | undefined): JSX.Element | null {
	switch (roomType) {
	case "m.space":
		return <SpaceView />
	case "support.feline.policy.lists.msc.v1":
		return null // TODO <PolicyListEditor />
	case "org.matrix.msc3417.call":
		return <ElementCall />
	case "fi.mau.msc2545.image_pack":
		return <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", marginTop: "2rem" }}>
			<HairlineWait label="Getting the editor" />
		</div>}>
			<ImagePackView />
		</Suspense>
	default:
		return null
	}
}

const RoomView = ({ room, rightPanelResizeHandle, rightPanel }: RoomViewProps) => {
	const [forceViewType, setForceViewType] = useState<RoomType | null>(null)
	const settingsViewType = usePreference(null, room, "room_view_type")
	const [roomContextData] = useState(() => new RoomContextData(room, setForceViewType))
	useEffect(() => {
		if (room.hackyPendingJumpToEventID) {
			jumpToEvent(roomContextData, room.hackyPendingJumpToEventID)
			room.hackyPendingJumpToEventID = null
		}
		window.activeRoomContext = roomContextData
		window.addEventListener("resize", roomContextData.scrollToBottom)
		return () => {
			window.removeEventListener("resize", roomContextData.scrollToBottom)
			if (window.activeRoomContext === roomContextData) {
				window.activeRoomContext = undefined
			}
		}
	}, [room, roomContextData])
	const hasRightPanel = !!rightPanel
	useEffect(() => {
		roomContextData.scrollToBottom()
	}, [roomContextData, hasRightPanel])
	const viewType = forceViewType ?? settingsViewType ?? room.meta.current.creation_content?.type
	const view = getViewForRoomType(viewType) ?? <>
		<TimelineView/>
		<MessageComposer/>
		<TypingNotifications/>
	</>
	// The space dashboard carries its own masthead (avatar, name, topic) plus a
	// quick-actions row, so a room header above it would only repeat all of that.
	// Keyed off the resolved view type, so forcing a space to the timeline view
	// (via the room type override, which resolves to "") brings the header back.
	const isSpaceDashboard = viewType === "m.space"
	// Dropping a file anywhere on the chat pane goes to the composer's upload flow,
	// as dropping it on the composer always did. Only the timeline view has a
	// composer to take it.
	const acceptsDrops = getViewForRoomType(viewType) === null
	const [dropping, setDropping] = useState(false)
	const onDragEnter = (evt: React.DragEvent) => {
		if (acceptsDrops && evt.dataTransfer?.types?.includes("Files")) {
			evt.preventDefault()
			setDropping(true)
		}
	}
	const onOverlayDragOver = (evt: React.DragEvent) => {
		evt.preventDefault()
		evt.dataTransfer.dropEffect = "copy"
	}
	const onOverlayDragLeave = (evt: React.DragEvent) => {
		// The overlay has children; leaving one of them for another is not leaving.
		if (!evt.currentTarget.contains(evt.relatedTarget as Node | null)) {
			setDropping(false)
		}
	}
	const onOverlayDrop = (evt: React.DragEvent) => {
		evt.preventDefault()
		setDropping(false)
		const files = evt.dataTransfer?.files
		if (files?.length) {
			roomContextData.onFileDropped(files)
		}
	}
	return <RoomContext value={roomContextData}>
		<div className={`room-view ${isSpaceDashboard ? "headerless" : ""}`} onDragEnter={onDragEnter}>
			{/* Covers the whole pane while a file is over it, so it takes every drag
			    event itself and nothing underneath (the composer's own drop target
			    included) competes for the drop. */}
			{dropping && <div
				className="room-drop-overlay"
				onDragOver={onOverlayDragOver}
				onDragLeave={onOverlayDragLeave}
				onDrop={onOverlayDrop}
			>
				<div className="room-drop-box">
					<AttachIcon/>
					<span>Drop to upload</span>
				</div>
			</div>}
			<ErrorBoundary thing="room header" wrapperClassName="room-header-error">
				{isSpaceDashboard
					? null
					: <RoomViewHeader room={room} activePanel={rightPanel?.type ?? null}/>}
			</ErrorBoundary>
			<ErrorBoundary thing="room timeline" wrapperClassName="room-timeline-error">
				{view}
			</ErrorBoundary>
		</div>
		{rightPanelResizeHandle}
		{hasRightPanel ? <RightPanel {...rightPanel}/> : null}
	</RoomContext>
}

export default RoomView
