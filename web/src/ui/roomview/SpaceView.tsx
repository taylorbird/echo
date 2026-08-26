// gomuks - A Matrix client written in Go.
// Copyright (C) 2025 Tulir Asokan
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
import React, { CSSProperties, use, useCallback, useEffect, useMemo, useState } from "react"
import {
	getAvatarThumbnailURL, getRoomAccentColor, getRoomAvatarThumbnailURL, getUserColor,
} from "@/api/media.ts"
import { RoomStateStore, useRoomState, useSpaceEdges } from "@/api/statestore"
import { DBSpaceEdge, MemDBEvent, MemberEventContent, RoomID, SpaceHierarchyChild } from "@/api/types"
import { useEventAsState } from "@/util/eventdispatcher.ts"
import { getEventLevel } from "@/util/powerlevel.ts"
import { ensureStringArray } from "@/util/validation.ts"
import ClientContext from "../ClientContext.ts"
import MainScreenContext from "../MainScreenContext.ts"
import { useFilteredMembers, useFilteredRooms } from "../composer/userautocomplete.ts"
import { getPowerLevels } from "../menu/util.ts"
import { ModalContext, NestableModalContext, modals } from "../modal"
import { useRoomContext } from "./roomcontext.ts"
import AddIcon from "@/icons/add.svg?react"
import DeleteIcon from "@/icons/delete.svg?react"
import BackIcon from "@/icons/modern/arrow-left.svg?react"
import TimelineIcon from "@/icons/modern/messages-square.svg?react"
import SettingsIcon from "@/icons/modern/settings.svg?react"
import ShareIcon from "@/icons/modern/share-2.svg?react"
import RecommendIcon from "@/icons/recommend.svg?react"
import VerifiedIcon from "@/icons/verified.svg?react"
import "./SpaceView.css"

interface SpaceChildProps {
	spaceID: RoomID
	roomID: RoomID
	edge?: DBSpaceEdge
	childEvt?: MemDBEvent
	summary?: SpaceHierarchyChild
	canModify: boolean
	store?: RoomStateStore
	onAdd?: () => void
}

const SpaceChild = ({
	spaceID, roomID, edge, summary, childEvt, canModify, store, onAdd,
}: SpaceChildProps) => {
	const mainScreen = use(MainScreenContext)
	const client = use(ClientContext)!
	store = store ?? client.store.rooms.get(roomID)
	const room = useEventAsState(store?.meta)
	const name = room?.name ?? summary?.name
	// The row itself is the click target, so every button inside it has to stop the
	// click from also opening the room.
	const onClickDelete = (evt: React.MouseEvent<HTMLButtonElement>) => {
		evt.stopPropagation()
		if (!edge) {
			return
		}
		let confirmMessage: string
		if (edge.child_event_rowid) {
			if (edge.parent_event_rowid) {
				confirmMessage = `Remove both m.space.child and m.space.parent events of ${name} / ${roomID}?`
			} else {
				confirmMessage = `Remove m.space.child event of ${name} / ${roomID}?`
			}
		} else if (edge.parent_event_rowid) {
			confirmMessage = `Remove m.space.parent event in ${name} / ${roomID}?`
		} else {
			window.alert("No child or parent event rowid found 🤔")
			return
		}
		if (!window.confirm(confirmMessage)) {
			return
		}
		if (edge.child_event_rowid) {
			client.rpc.setState(spaceID, "m.space.child", roomID, {}).then(
				resp => console.info("Removed m.space.child", spaceID, "->", roomID, resp),
				err => {
					console.error("Failed to remove m.space.child", spaceID, "->", roomID, err)
					window.alert(`Failed to remove m.space.child event: ${err}`)
				},
			)
		}
		if (edge.parent_event_rowid) {
			client.rpc.setState(roomID, "m.space.parent", spaceID, {}).then(
				resp => console.info("Removed m.space.parent", roomID, "->", spaceID, resp),
				err => {
					console.error("Failed to remove m.space.parent", roomID, "->", spaceID, err)
					window.alert(`Failed to remove m.space.parent event: ${err}`)
				},
			)
		}
	}
	const onClickAdd = (evt: React.MouseEvent<HTMLButtonElement>) => {
		evt.stopPropagation()
		client.rpc.setState(spaceID, "m.space.child", roomID, { via: store!.getViaServers() }).then(
			resp => console.info("Added m.space.child", spaceID, "->", roomID, resp),
			err => {
				console.error("Failed to add m.space.child", spaceID, "->", roomID, err)
				window.alert(`Failed to add m.space.child event: ${err}`)
			},
		).finally(onAdd)
	}
	const joinRoom = () => {
		mainScreen.setActiveRoom(roomID, {
			previewMeta: {
				roomID: roomID,
				via: ensureStringArray(childEvt?.content.via),
			},
		})
	}
	const [joining, setJoining] = useState(false)
	const onClickJoin = (evt: React.MouseEvent<HTMLButtonElement>) => {
		evt.stopPropagation()
		setJoining(true)
		client.rpc.joinRoom(roomID, ensureStringArray(childEvt?.content.via)).then(
			() => mainScreen.setActiveRoom(roomID),
			err => {
				console.error("Failed to join room", roomID, err)
				window.alert(`Failed to join room: ${err}`)
			},
		).finally(() => setJoining(false))
	}
	const isSpace = (room?.creation_content?.type ?? summary?.room_type) === "m.space"
	// The hierarchy summary is the only source for rooms we haven't joined; joined
	// rooms have the same data locally, and either may be missing it entirely.
	const description = summary?.topic ?? room?.topic ?? roomID
	const memberCount = summary?.num_joined_members ?? room?.lazy_load_summary?.["m.joined_member_count"]
	return <div
		className={`space-child ${room ? "known-room" : "unknown-room"} ${edge ? "existing-edge" : ""}`}
		onClick={edge ? joinRoom : undefined}
		style={{ "--room-accent": getRoomAccentColor(roomID) } as CSSProperties}
	>
		<img
			src={getRoomAvatarThumbnailURL(room ?? summary ?? { room_id: roomID })}
			loading="lazy"
			alt=""
			className={`avatar ${isSpace ? "space" : ""}`}
		/>
		<div className="space-child-text">
			<div className="room-name" title={name ?? roomID}>{name ?? roomID}</div>
			<div className="room-description" title={description}>{description}</div>
		</div>
		{memberCount !== undefined ? <div className="member-count">
			{memberCount} {memberCount === 1 ? "member" : "members"}
		</div> : null}
		{edge ? <div className="buttons">
			{/* No local room store means we haven't joined this child. */}
			{!room && <button className="join-button" onClick={onClickJoin} disabled={joining}>
				{joining ? "Joining…" : "Join"}
			</button>}
			{edge.canonical && <button disabled title="This is the canonical parent space"><VerifiedIcon /></button>}
			{edge.suggested && <button disabled title="Suggested room in space"><RecommendIcon /></button>}
			{canModify && <button onClick={onClickDelete} title="Remove from space"><DeleteIcon /></button>}
		</div> : <div className="buttons">
			<button onClick={onClickAdd} title="Add to space"><AddIcon /></button>
		</div>}
	</div>
}

const SpaceAdder = () => {
	const roomCtx = useRoomContext()
	const client = use(ClientContext)!
	const [query, setQuery] = useState("")
	const clearQuery = useCallback(() => setQuery(""), [])
	const filteredRooms = useFilteredRooms(client.store, query)
	return <div className="space-adder">
		<input
			type="text"
			value={query}
			onChange={e => setQuery(e.target.value)}
			placeholder="Search rooms to add..."
		/>
		<div className="space-children">
			{filteredRooms.map(room => {
				const existingChild = roomCtx.store.getStateEvent("m.space.child", room.roomID)
				if (existingChild && Array.isArray(existingChild.content.via)) {
					return null
				}
				return <SpaceChild
					key={room.roomID}
					spaceID={roomCtx.store.roomID} roomID={room.roomID} canModify={true} store={room} onAdd={clearQuery}
				/>
			})}
		</div>
	</div>
}

interface SectionHeaderProps {
	title: string
	count?: number
}

const SectionHeader = ({ title, count }: SectionHeaderProps) => <h3 className="space-section-header">
	{title}
	{count !== undefined ? <span className="space-section-count">{count}</span> : null}
</h3>

interface SpaceSectionProps {
	title: string
	spaceID: RoomID
	spaceStore: RoomStateStore
	edges: DBSpaceEdge[]
	hierarchy: Map<RoomID, SpaceHierarchyChild>
	canModify: boolean
}

const SpaceSection = ({ title, spaceID, spaceStore, edges, hierarchy, canModify }: SpaceSectionProps) => {
	if (!edges.length) {
		return null
	}
	return <div className="space-section">
		<SectionHeader title={title} count={edges.length} />
		<div className="space-children">
			{edges.map(edge => <SpaceChild
				key={edge.child_id}
				spaceID={spaceID}
				roomID={edge.child_id}
				childEvt={edge.child_event_rowid ? spaceStore.eventsByRowID.get(edge.child_event_rowid) : undefined}
				edge={edge}
				summary={hierarchy.get(edge.child_id)}
				canModify={canModify}
			/>)}
		</div>
	</div>
}

const INITIAL_MEMBER_LIMIT = 30

/*
 * The dashboard's own member roster. Deliberately not the right panel's
 * MemberList: that one is styled for a 300px column and comes with a filter
 * input. The member data comes from the same place though — the store's member
 * cache, with the same lazy fetch kicked off on first render.
 */
const SpaceMembers = () => {
	const roomCtx = useRoomContext()
	const client = use(ClientContext)!
	const mainScreen = use(MainScreenContext)
	const [expanded, setExpanded] = useState(false)
	if (!roomCtx.store.membersRequested && !roomCtx.store.fullMembersLoaded) {
		roomCtx.store.membersRequested = true
		client.loadRoomState(roomCtx.store.roomID, { omitMembers: false, refetch: false })
	}
	// No filter and no slicing: the cap below is what keeps a few hundred members
	// from all being rendered at once.
	const members = useFilteredMembers(roomCtx.store, "", false, false)
	if (!members.length) {
		return null
	}
	const shown = expanded ? members : members.slice(0, INITIAL_MEMBER_LIMIT)
	return <div className="space-section">
		<SectionHeader title="Members" count={members.length} />
		<div className="space-members">
			{shown.map(member => <div
				key={member.userID}
				className="space-member"
				data-target-panel="user"
				data-target-user={member.userID}
				onClick={mainScreen.clickRightPanelOpener}
				title={member.userID}
			>
				<img
					className="avatar"
					src={getAvatarThumbnailURL(member.userID, member.event.content as MemberEventContent)}
					alt=""
					loading="lazy"
				/>
				<div
					className="space-member-name"
					style={{ "--user-accent": getUserColor(member.userID) } as CSSProperties}
				>
					{member.displayName}
				</div>
			</div>)}
		</div>
		{!expanded && members.length > INITIAL_MEMBER_LIMIT && <button
			className="space-show-all"
			onClick={() => setExpanded(true)}
		>
			Show all {members.length} members
		</button>}
	</div>
}

interface SpaceQuickActionsProps {
	room: RoomStateStore
}

/*
 * Everything here already existed as a menu item somewhere; the dashboard just
 * makes the three that matter for a space reachable without a menu. "View
 * timeline" is the only remaining way in now that the header is gone.
 */
const SpaceQuickActions = ({ room }: SpaceQuickActionsProps) => {
	const roomCtx = useRoomContext()
	const openModal = use(ModalContext)
	const openNestableModal = use(NestableModalContext)
	return <div className="space-quick-actions">
		<button onClick={() => openNestableModal(modals.settings(room))}>
			<SettingsIcon /> Settings
		</button>
		<button onClick={() => openModal(modals.shareRoom(room))}>
			<ShareIcon /> Share
		</button>
		<button onClick={() => roomCtx.setForceViewType("")}>
			<TimelineIcon /> View timeline
		</button>
	</div>
}

const emptyMap = new Map<RoomID, SpaceHierarchyChild>()

const SpaceView = () => {
	const [hierarchy, setHierarchy] = useState<Map<RoomID, SpaceHierarchyChild>>(emptyMap)
	const roomCtx = useRoomContext()
	const client = use(ClientContext)!
	const mainScreen = use(MainScreenContext)
	const meta = useEventAsState(roomCtx.store.meta)
	const rootID = roomCtx.store.roomID
	const edgeStore = client.store.spaceEdges.get(rootID)
	const children = useSpaceEdges(edgeStore)
	useRoomState(roomCtx.store, "m.room.power_levels", "")
	useEffect(() => {
		let cancelled = false
		client.rpc.getSpaceHierarchy(rootID, {
			limit: 50,
			max_depth: 1,
		}).then(hier => {
			if (!cancelled) {
				const hierarchyMap = new Map(hier.rooms.map(item => [item.room_id, item]))
				console.debug("Fetched hierarchy", hierarchyMap)
				setHierarchy(hierarchyMap)
			}
		}, err => {
			console.error("Failed to fetch space hierarchy:", err)
			// TODO display error?
		})
		return () => {
			cancelled = true
		}
	}, [client, rootID])
	// Subspaces get their own section above the rooms, the way Cinny's lobby splits
	// them. The hierarchy response also contains the space itself, so a self-edge
	// would otherwise render the lobby's own space as a child of itself.
	const [spaceEdges, roomEdges] = useMemo(() => {
		const subspaces: DBSpaceEdge[] = []
		const rooms: DBSpaceEdge[] = []
		for (const edge of children ?? []) {
			if (!edge.child_event_rowid || edge.child_id === rootID) {
				continue
			}
			const childType = client.store.rooms.get(edge.child_id)?.meta.current.creation_content?.type
				?? hierarchy.get(edge.child_id)?.room_type
			if (childType === "m.space") {
				subspaces.push(edge)
			} else {
				rooms.push(edge)
			}
		}
		return [subspaces, rooms]
	}, [children, hierarchy, client, rootID])
	if (!children) {
		return "not a space? :thinking:"
	}
	const [pls, ownPL] = getPowerLevels(roomCtx.store, client)
	const canModifySpace = getEventLevel(pls, "m.space.child", true) <= ownPL
	const memberCount = meta.lazy_load_summary?.["m.joined_member_count"]
	const childCount = spaceEdges.length + roomEdges.length
	const metaParts: string[] = []
	if (memberCount !== undefined) {
		metaParts.push(`${memberCount} ${memberCount === 1 ? "member" : "members"}`)
	}
	metaParts.push(`${childCount} ${childCount === 1 ? "room" : "rooms"}`)
	if (meta.canonical_alias) {
		metaParts.push(meta.canonical_alias)
	}
	const metaLine = metaParts.join(" · ")
	// TODO display hidden space rooms (only parent rowid set)
	return <div className="space-view">
		<div className="space-lobby">
			{/* The room header is not rendered for this view, so the dashboard owns
			    the space's identity: avatar and name at masthead size, then the full
			    topic (the one place it's readable) and the stats line. */}
			<div className="space-masthead">
				<div className="space-identity">
					{/* The header's back button went with the header, and on a narrow
					    screen that was the only way back to the room list. */}
					<button className="space-back" onClick={mainScreen.clearActiveRoom} title="Back">
						<BackIcon />
					</button>
					<img
						className="avatar space-avatar"
						src={getRoomAvatarThumbnailURL(meta)}
						loading="lazy"
						alt=""
					/>
					<h1
						className="space-name"
						title={meta.name ?? rootID}
						style={{ "--room-accent": getRoomAccentColor(rootID) } as CSSProperties}
					>
						{meta.name ?? rootID}
					</h1>
				</div>
				{meta.topic && <div className="space-topic">{meta.topic}</div>}
				<div className="space-meta">{metaLine}</div>
			</div>
			<SpaceQuickActions room={roomCtx.store} />
			<SpaceSection
				title="Spaces"
				spaceID={rootID}
				spaceStore={roomCtx.store}
				edges={spaceEdges}
				hierarchy={hierarchy}
				canModify={canModifySpace}
			/>
			<SpaceSection
				title="Rooms"
				spaceID={rootID}
				spaceStore={roomCtx.store}
				edges={roomEdges}
				hierarchy={hierarchy}
				canModify={canModifySpace}
			/>
			{childCount === 0 && <div className="space-empty">This space doesn't contain any rooms yet.</div>}
			<SpaceMembers />
			{canModifySpace && <div className="space-section">
				<SectionHeader title="Add a room" />
				<SpaceAdder />
			</div>}
		</div>
	</div>
}

export default SpaceView
