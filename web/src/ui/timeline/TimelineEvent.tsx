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
import React, { JSX, use, useCallback, useEffect, useRef, useState } from "react"
import { HexColorPicker } from "react-colorful"
import { createPortal } from "react-dom"
import type Client from "@/api/client.ts"
import {
	getAvatarThumbnailURL, getCustomUserColor, getMediaURL, getUserColorIndex, getUserColorOverride,
	setCustomUserColor,
} from "@/api/media.ts"
import {
	RoomStateStore,
	applyPerMessageSender,
	maybeRedactMemberEvent,
	usePreference,
	useRoomMember,
} from "@/api/statestore"
import {
	EventID,
	MemDBEvent,
	ReactionEventContent,
	URLPreview as URLPreviewType,
	UnreadType,
	UserID,
	UserProfile,
} from "@/api/types"
import { displayAsRedacted } from "@/util/displayAsRedacted.ts"
import { isMobileDevice } from "@/util/ismobile.ts"
import { getDisplayname, getRelatesTo, isEventID } from "@/util/validation.ts"
import ClientContext from "../ClientContext.ts"
import MainScreenContext from "../MainScreenContext.ts"
import { EventFixedMenu, EventFullMenu, EventHoverMenu, getModalStyleFromMouse } from "../menu"
import { ModalCloseContext, ModalContext, NestableModalContext, modals } from "../modal"
import { useRoomContext } from "../roomview/roomcontext.ts"
import FetchedURLPreview, { extractPreviewableURLs } from "../urlpreview/FetchedURLPreview.tsx"
import URLPreview from "../urlpreview/URLPreview.tsx"
import { jumpToEventInView } from "../util/jumpToEvent.tsx"
import ReadReceipts from "./ReadReceipts.tsx"
import { ReplyBody, ReplyIDBody } from "./ReplyBody.tsx"
import { ContentErrorBoundary, HiddenEvent, getBodyType, getPerMessageProfile, isSmallEvent } from "./content"
import ErrorIcon from "@/icons/error.svg?react"
import PendingIcon from "@/icons/pending.svg?react"
import SentIcon from "@/icons/sent.svg?react"
import "./TimelineEvent.css"

export type TimelineEventViewType =
	"timeline" | "thread" | "context" | "pinned" | "edit-history" | "confirm" | "notifications"

export interface TimelineEventProps {
	evt: MemDBEvent
	prevEvt: MemDBEvent | null
	disableMenu?: boolean
	smallReplies?: boolean
	smallThreads?: boolean
	isFocused?: boolean
	viewType: TimelineEventViewType
}

const fullTimeFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "medium" })
const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "full" })
const formatShortTime = (time: Date) =>
	`${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`
const formatFullTime = (time: Date) => fullTimeFormatter.format(time)
const formatDate = (time: Date) => dateFormatter.format(time)
const newSafeDate = (val: number) => {
	const date = new Date(val)
	if (isNaN(+date)) {
		return new Date(0)
	}
	return date
}

interface EventReactionsProps {
	reactions: Record<string, number>
	onRereact: (mouseEvt: React.MouseEvent) => void
	client: Client
	room: RoomStateStore
	eventID: EventID
}

const EventReactions = ({ reactions, onRereact, client, room, eventID }: EventReactionsProps) => {
	const reactionEntries = Object.entries(reactions).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1])
	// Senders are not part of the event's reaction data — the backend aggregates
	// m.reaction events down to counts before sending them. The individual
	// annotations have to be fetched separately, so it happens on first hover
	// rather than for every reacted event in the timeline.
	const [senders, setSenders] = useState<Map<string, UserID[]> | null>(null)
	const [failed, setFailed] = useState(false)
	const requested = useRef(false)
	// Counts changing means someone reacted or unreacted, so any names already
	// fetched are stale and the next hover should fetch again.
	const countSignature = reactionEntries.map(([key, count]) => `${key}:${count}`).join(",")
	useEffect(() => {
		requested.current = false
		setSenders(null)
		setFailed(false)
	}, [countSignature, eventID])
	const loadSenders = () => {
		if (requested.current) {
			return
		}
		requested.current = true
		client.getRelatedEvents(room, eventID, "m.annotation").then(
			events => {
				const bySender = new Map<string, UserID[]>()
				for (const reactionEvt of events) {
					if (reactionEvt.redacted_by) {
						continue
					}
					const key = (reactionEvt.content as ReactionEventContent)?.["m.relates_to"]?.key
					if (typeof key !== "string") {
						continue
					}
					const existing = bySender.get(key)
					if (existing) {
						existing.push(reactionEvt.sender)
					} else {
						bySender.set(key, [reactionEvt.sender])
					}
				}
				setSenders(bySender)
			},
			err => {
				console.error("Failed to get reaction senders", err)
				setFailed(true)
			},
		)
	}
	const tooltipText = (reaction: string): string => {
		if (failed) {
			return "Failed to load who reacted"
		} else if (senders === null) {
			return "Loading…"
		}
		const users = senders.get(reaction)
		if (!users?.length) {
			return "Nobody?"
		}
		return users
			.map(userID => getDisplayname(
				userID,
				room.getStateEvent("m.room.member", userID)?.content as UserProfile | undefined,
			))
			.join(", ")
	}
	if (reactionEntries.length === 0) {
		return null
	}
	return <div className="event-reactions">
		{reactionEntries.map(([reaction, count]) =>
			<div key={reaction} className="reaction" onClick={onRereact} onMouseEnter={loadSenders}>
				<div className="reaction-inner">
					{reaction.startsWith("mxc://")
						? <img className="reaction-emoji" src={getMediaURL(reaction)} alt=""/>
						: <span className="reaction-emoji">{reaction}</span>}
					<span className="reaction-count">{count}</span>
				</div>
				<div className="reaction-tooltip">{tooltipText(reaction)}</div>
			</div>)}
	</div>
}

const EventSendStatus = ({ evt }: { evt: MemDBEvent }) => {
	if (evt.send_error && evt.send_error !== "not sent") {
		return <div className="event-send-status error" title={evt.send_error}><ErrorIcon/></div>
	} else if (evt.event_id.startsWith("~")) {
		return <div title="Waiting for /send to return" className="event-send-status sending"><PendingIcon/></div>
	} else if (evt.pending) {
		return <div title="Waiting to receive event in /sync" className="event-send-status sent"><SentIcon/></div>
	} else {
		return <div title="Event sent and remote echo received" className="event-send-status sent"><SentIcon/></div>
	}
}

interface UserColorCardProps {
	userID: UserID
	displayName: string
	avatarUrl?: string
	style: React.CSSProperties
	onColorChange: () => void
}

const UserColorCard = ({ userID, displayName, avatarUrl, style, onColorChange }: UserColorCardProps) => {
	const closeModal = use(ModalCloseContext)
	const [currentColor, setCurrentColor] = useState(getCustomUserColor(userID) || "#fecdb2")
	const [showPicker, setShowPicker] = useState(false)

	const presetColors = [
		{ name: "Red", value: "#e06b75" },
		{ name: "Orange", value: "#ffa07a" },
		{ name: "Yellow", value: "#f5d76e" },
		{ name: "Green", value: "#b1b695" },
		{ name: "Teal", value: "#1fc090" },
		{ name: "Blue", value: "#7aacf4" },
		{ name: "Purple", value: "#ad9cfe" },
		{ name: "Pink", value: "#f6b6c9" },
		{ name: "Peach", value: "#fecdb2" },
	]

	const handleColorSelect = (color: string | null) => {
		setCustomUserColor(userID, color)
		setCurrentColor(color || "#fecdb2")
		onColorChange()
	}

	const savedColor = getCustomUserColor(userID)
	const isCustomColor = savedColor && !presetColors.some(c => c.value === savedColor)

	return <div className="context-menu user-color-card" style={style}>
		<div className="user-card-header">
			<img className="avatar" src={avatarUrl} alt="" />
			<div className="user-card-info">
				<div className="user-display-name">{displayName}</div>
				<div className="user-id">{userID}</div>
			</div>
			<button className="close-button" onClick={closeModal} title="Close">×</button>
		</div>
		<hr />
		<div className="color-picker-section">
			<div className="color-picker-label">Name Color</div>
			{showPicker ? (
				<div className="color-wheel-container">
					<HexColorPicker color={currentColor} onChange={(color) => {
						setCurrentColor(color)
						handleColorSelect(color)
					}} />
					<button className="back-to-presets" onClick={() => setShowPicker(false)}>
						← Back to presets
					</button>
				</div>
			) : (
				<div className="color-picker-grid">
					{presetColors.map(c => (
						<button
							key={c.name}
							className={`color-swatch ${savedColor === c.value ? "selected" : ""}`}
							onClick={() => handleColorSelect(c.value)}
							style={{ backgroundColor: c.value }}
							title={c.name}
						/>
					))}
					<button
						className={`color-swatch custom ${isCustomColor ? "selected" : ""}`}
						title="Custom color picker"
						style={isCustomColor ? { backgroundColor: savedColor } : undefined}
						onClick={() => setShowPicker(true)}
					>
						🎨
					</button>
					<button
						className={`color-swatch reset ${!savedColor ? "selected" : ""}`}
						onClick={() => handleColorSelect(null)}
						title="Reset to default"
					>
						↺
					</button>
				</div>
			)}
		</div>
	</div>
}

// Messages older than this get a click-to-load button instead of auto-fetching previews
const AUTO_LOAD_PREVIEW_MAX_AGE = 48 * 60 * 60 * 1000

const EventURLPreviews = ({ event, room }: {
	room: RoomStateStore
	event: MemDBEvent
}) => {
	const client = use(ClientContext)!
	const renderPreviews = usePreference(client.store, room, "render_url_previews")
	const autoLoadEncrypted = usePreference(client.store, room, "auto_load_encrypted_url_previews")
	const previews = (event.content["com.beeper.linkpreviews"] ?? event.content["m.url_previews"]) as URLPreviewType[]
	if (previews?.length) {
		return <div className="url-previews">
			{previews.map((p, i) => <URLPreview key={i} room={room} preview={p}/>)}
		</div>
	}
	if (!renderPreviews) {
		return null
	}
	const urls = extractPreviewableURLs(event.content.body)
	if (!urls.length) {
		return null
	}
	const isEncrypted = Boolean(room.meta.current.encryption_event)
	const autoLoad = Date.now() - event.timestamp < AUTO_LOAD_PREVIEW_MAX_AGE
		&& (!isEncrypted || autoLoadEncrypted)
	return <div className="url-previews">
		{urls.map(url => <FetchedURLPreview key={url} url={url} room={room} autoLoad={autoLoad}/>)}
	</div>
}

const TimelineEvent = ({
	evt, prevEvt, disableMenu, smallReplies, smallThreads, isFocused, viewType,
}: TimelineEventProps) => {
	const roomCtx = useRoomContext()
	const client = use(ClientContext)!
	const mainScreen = use(MainScreenContext)
	const openModal = use(ModalContext)
	const openNestableModal = use(NestableModalContext)
	const [forceContextMenuOpen, setForceContextMenuOpen] = useState(false)
	const onContextMenu = (mouseEvt: React.MouseEvent) => {
		const targetElem = mouseEvt.target as HTMLElement
		if (
			!roomCtx.store.preferences.message_context_menu
			|| targetElem.tagName === "A"
			|| targetElem.tagName === "IMG"
			|| targetElem.tagName === "VIDEO"
			|| window.getSelection()?.type === "Range"
		) {
			return
		}
		mouseEvt.preventDefault()
		openModal({
			content: <EventFullMenu
				evt={evt}
				roomCtx={roomCtx}
				style={getModalStyleFromMouse(mouseEvt, EventFullMenu.height)}
			/>,
		})
	}
	const onRereact = useCallback((mouseEvt: React.MouseEvent) => {
		client.sendEvent(evt.room_id, "m.reaction", {
			"m.relates_to": {
				rel_type: "m.annotation",
				event_id: evt.event_id,
				key: mouseEvt.currentTarget.getAttribute("title"),
			},
		}).catch(err => {
			console.error("Failed to send reaction", err)
			window.alert(`Failed to send reaction: ${err}`)
		})
	}, [client, evt])
	const onClick = (mouseEvt: React.MouseEvent) => {
		const targetElem = mouseEvt.target as HTMLElement
		if (
			targetElem.tagName === "A"
			|| targetElem.tagName === "IMG"
			|| targetElem.tagName === "VIDEO"
			|| targetElem.tagName === "SUMMARY"
		) {
			return
		}
		mouseEvt.preventDefault()
		mouseEvt.stopPropagation()
		roomCtx.setFocusedEventRowID(roomCtx.focusedEventRowID === evt.rowid ? null : evt.rowid)
	}
	const onClickTimestamp = () => {
		if (viewType === "pinned" || (viewType === "notifications" && evt.room_id === roomCtx.store.roomID)) {
			jumpToEventInView(roomCtx, evt.event_id, document.querySelector("div.room-view"))
		} else if (viewType === "notifications") {
			mainScreen.setActiveRoom(evt.room_id, { openEventID: evt.event_id })
		}
	}
	const [, forceUpdate] = useState(0)
	const onSenderContextMenu = useCallback((mouseEvt: React.MouseEvent) => {
		mouseEvt.preventDefault()
		const userID = mouseEvt.currentTarget.getAttribute("data-target-user") as UserID
		if (!userID) {return}

		const displayName = mouseEvt.currentTarget.textContent || userID
		const member = roomCtx.store.getStateEvent("m.room.member", userID)
		const avatarUrl = getAvatarThumbnailURL(
			userID, member?.content as import("@/api/types").UserProfile | undefined)

		const style = getModalStyleFromMouse(mouseEvt, 280)
		openModal({
			content: <UserColorCard
				userID={userID}
				displayName={displayName}
				avatarUrl={avatarUrl}
				style={style}
				onColorChange={() => forceUpdate(n => n + 1)}
			/>,
		})
	}, [openModal, roomCtx.store])
	const openEditHistory = () => {
		openNestableModal(modals.eventEditHistory(roomCtx, evt))
	}
	const perMessageSender = getPerMessageProfile(evt)
	const prevPerMessageSender = getPerMessageProfile(prevEvt)
	const memberEvt = useRoomMember(client, roomCtx.store, evt.sender)
	const memberEvtContent = maybeRedactMemberEvent(memberEvt)
	const renderMemberEvtContent = applyPerMessageSender(memberEvtContent, perMessageSender)

	const eventTS = newSafeDate(evt.timestamp)
	const editEventTS = evt.last_edit ? newSafeDate(evt.last_edit.timestamp) : null
	const wrapperClassNames = ["timeline-event"]
	const isRedacted = displayAsRedacted(evt, memberEvt, roomCtx.store)
	if (isRedacted) {
		wrapperClassNames.push("redacted-event")
	}
	const relatesTo = getRelatesTo(evt)
	const replyTo = relatesTo?.["m.in_reply_to"]?.event_id
	const isFallbackReply = relatesTo?.is_falling_back
	const threadRoot = relatesTo?.rel_type === "m.thread" && isEventID(relatesTo.event_id)
		? relatesTo.event_id : undefined
	const isSmallThreadMessage = Boolean(threadRoot && smallThreads)
	const BodyType = getBodyType(evt, isRedacted, isSmallThreadMessage)
	if (evt.unread_type & UnreadType.Highlight) {
		wrapperClassNames.push("highlight")
	}
	if (evt.type === "m.room.member") {
		wrapperClassNames.push("membership-event")
	}
	if (BodyType === HiddenEvent) {
		wrapperClassNames.push("hidden-event")
	}
	if (evt.sender === client.userID) {
		wrapperClassNames.push("own-event")
	}
	const forceContextMenuOnMobile =
		viewType === "edit-history" || viewType === "context" || viewType === "pinned" || viewType === "notifications"
	if ((isMobileDevice && !forceContextMenuOnMobile) || disableMenu) {
		wrapperClassNames.push("no-hover")
	}
	if (isFocused) {
		wrapperClassNames.push("focused-event")
	}
	if (evt.unsigned["io.element.synapse.soft_failed"]) {
		wrapperClassNames.push("soft-failed")
	}
	if (evt.unsigned["io.element.synapse.policy_server_spammy"]) {
		wrapperClassNames.push("policy-server-spammy")
	}
	let dateSeparator = null
	const showInitialDateSeparator = viewType === "timeline" || viewType === "thread" || viewType === "context"
	const prevEvtDate = prevEvt ? newSafeDate(prevEvt.timestamp) : null
	if (
		(showInitialDateSeparator && !prevEvt)
		|| (prevEvtDate && (
			eventTS.getDate() !== prevEvtDate.getDate() ||
			eventTS.getMonth() !== prevEvtDate.getMonth() ||
			eventTS.getFullYear() !== prevEvtDate.getFullYear()
		))
	) {
		dateSeparator = <div className="date-separator">
			<hr role="none"/>
			{formatDate(eventTS)}
			<hr role="none"/>
		</div>
	}
	const isSmallBodyType = isSmallEvent(BodyType)
	let replyAboveMessage: JSX.Element | null = null
	let replyInMessage: JSX.Element | null = null
	if (
		isEventID(replyTo)
		&& BodyType !== HiddenEvent
		&& !isSmallThreadMessage
		&& !isRedacted
		&& viewType !== "edit-history"
		&& (!isFallbackReply || viewType !== "thread")
	) {
		const replyElem = <ReplyIDBody
			roomCtx={roomCtx}
			eventID={replyTo}
			isThread={viewType !== "thread" && relatesTo?.rel_type === "m.thread"}
			threadRoot={threadRoot}
			small={!!smallReplies}
		/>
		if (smallReplies && !isSmallBodyType) {
			replyAboveMessage = replyElem
			wrapperClassNames.push("reply-above")
		} else {
			replyInMessage = replyElem
		}
	}

	let smallAvatar = false
	let renderAvatar = true
	let eventTimeOnly = false
	if (isSmallBodyType) {
		wrapperClassNames.push("small-event")
		smallAvatar = true
		eventTimeOnly = true
	} else if (
		prevEvt?.sender === evt.sender
		&& prevEvt.timestamp + 15 * 60 * 1000 > evt.timestamp
		&& dateSeparator === null
		&& !replyAboveMessage
		&& !isSmallEvent(getBodyType(prevEvt, displayAsRedacted(prevEvt, memberEvt, roomCtx.store)))
		&& prevPerMessageSender?.id === perMessageSender?.id
	) {
		wrapperClassNames.push("same-sender")
		eventTimeOnly = true
		renderAvatar = false
	}
	if (viewType === "edit-history") {
		wrapperClassNames.push("edit-history-event")
	}
	if (isSmallThreadMessage) {
		const prevRelatesTo = getRelatesTo(prevEvt)
		if (dateSeparator === null && prevRelatesTo?.rel_type === "m.thread" && prevRelatesTo.event_id === threadRoot) {
			wrapperClassNames.push("same-thread")
		}
		wrapperClassNames.push("small-thread-message")
		eventTimeOnly = true
		renderAvatar = !smallAvatar
		smallAvatar = false
	}

	const fullTime = formatFullTime(eventTS)
	const shortTime = formatShortTime(eventTS)
	const mainEvent = <div
		data-event-id={evt.event_id}
		className={wrapperClassNames.join(" ")}
		onContextMenu={onContextMenu}
		onClick={!disableMenu && viewType !== "edit-history" && isMobileDevice && !isSmallThreadMessage
			? onClick : undefined}
	>
		{!disableMenu && (!isMobileDevice || forceContextMenuOnMobile) && <div
			className={`context-menu-container ${forceContextMenuOpen ? "force-open" : ""}`}
		>
			<EventHoverMenu evt={evt} roomCtx={roomCtx} setForceOpen={setForceContextMenuOpen}/>
		</div>}
		{isMobileDevice && isFocused && createPortal(
			<EventFixedMenu evt={evt} roomCtx={roomCtx} />,
			document.getElementById(roomCtx.threadRoot
				? "mobile-thread-event-menu-container" : "mobile-event-menu-container")!,
		)}
		{replyAboveMessage}
		{renderAvatar && <div
			className="sender-avatar"
			title={perMessageSender ? `${perMessageSender.id} via ${evt.sender}` : evt.sender}
			data-target-panel="user"
			data-target-user={evt.sender}
			onClick={mainScreen.clickRightPanelOpener}
		>
			<img
				className={`${smallAvatar ? "small" : ""} avatar`}
				loading="lazy"
				src={getAvatarThumbnailURL(perMessageSender?.id ?? evt.sender, renderMemberEvtContent)}
				alt=""
			/>
		</div>}
		{!eventTimeOnly ? <div className="event-sender-and-time">
			<span
				className={`event-sender sender-color-${getUserColorIndex(perMessageSender?.id ?? evt.sender)}`}
				data-target-user={perMessageSender?.id ?? evt.sender}
				onClick={perMessageSender ? undefined : roomCtx.appendMentionToComposer}
				onContextMenu={onSenderContextMenu}
				title={`${perMessageSender ? perMessageSender.id : evt.sender} (right-click for color)`}
				style={getUserColorOverride(perMessageSender?.id ?? evt.sender)
					? { color: getUserColorOverride(perMessageSender?.id ?? evt.sender) }
					: undefined}
			>
				{getDisplayname(evt.sender, renderMemberEvtContent)}
			</span>
			{perMessageSender && <div className="per-message-event-sender">
				<span className="via">via</span>
				<span
					className={`event-sender sender-color-${getUserColorIndex(evt.sender)}`}
					data-target-user={evt.sender}
					onClick={roomCtx.appendMentionToComposer}
					onContextMenu={onSenderContextMenu}
					title={`${evt.sender} (right-click for color)`}
					style={getUserColorOverride(evt.sender) ? { color: getUserColorOverride(evt.sender) } : undefined}
				>
					{getDisplayname(evt.sender, memberEvtContent)}
				</span>
			</div>}
			<span className="event-time" title={fullTime} onClick={onClickTimestamp}>{shortTime}</span>
		</div> : <div className="event-time-only" onClick={onClickTimestamp}>
			<span className="event-time" title={fullTime}>{shortTime}</span>
		</div>}
		{isSmallThreadMessage ? <ReplyBody
			roomCtx={roomCtx}
			event={evt}
			isThread={true}
			threadRoot={threadRoot}
			timelineThreadMsg={true}
			reactions={evt.reactions ? <EventReactions
				reactions={evt.reactions}
				onRereact={onRereact}
				client={client}
				room={roomCtx.store}
				eventID={evt.event_id}
			/> : null}
		/> : <div className="event-content">
			{replyInMessage}
			<ContentErrorBoundary>
				<BodyType room={roomCtx.store} sender={memberEvt} event={evt}/>
				{!isSmallBodyType && !isRedacted && <EventURLPreviews room={roomCtx.store} event={evt}/>}
			</ContentErrorBoundary>
			{(viewType !== "edit-history" && editEventTS) ? <div
				className="event-edited"
				title={`Edited at ${formatFullTime(editEventTS)}`}
				onClick={openEditHistory}
			>
				(edited at {formatShortTime(editEventTS)})
			</div> : null}
			{evt.reactions ? <EventReactions
				reactions={evt.reactions}
				onRereact={onRereact}
				client={client}
				room={roomCtx.store}
				eventID={evt.event_id}
			/> : null}
		</div>}
		{!evt.event_id.startsWith("~")
			&& roomCtx.store.preferences.display_read_receipts
			&& viewType === "timeline"
			? <ReadReceipts room={roomCtx.store} eventID={evt.event_id} extraEvents={evt.receipt_flattening} /> : null}
		{evt.sender === client.userID && evt.transaction_id && viewType !== "edit-history"
			? <EventSendStatus evt={evt}/> : null}
	</div>
	return <>
		{dateSeparator}
		{mainEvent}
	</>
}

export default React.memo(TimelineEvent)
