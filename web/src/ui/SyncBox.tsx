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
import { use } from "react"
import type { SyncStatus } from "@/api/types"
import { useEventAsState } from "@/util/eventdispatcher.ts"
import { restartApp } from "@/util/updater.ts"
import ClientContext from "./ClientContext.ts"
import "./SyncBox.css"

interface SyncBoxProps {
	syncStatus: SyncStatus
}

const relativeTime = (timestamp: number): string => {
	const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
	if (seconds < 60) {
		return "moments ago"
	}
	const minutes = Math.round(seconds / 60)
	if (minutes < 60) {
		return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
	}
	const hours = Math.round(minutes / 60)
	return `${hours} hour${hours === 1 ? "" : "s"} ago`
}

/*
 * The one place the app says what it is waiting for.
 *
 * No container: a text column on the bare pane with a single 2px rule under it. The rule is
 * the only drawn object, which is why it is never dressed up as a progress bar — the backend
 * reports `{type, error, error_count, last_sync}` and nothing else, so there is no fraction
 * to fill toward. It stays a plain hairline while syncing and goes solid red when stopped,
 * and the count beside it is an honest "so far" with no denominator.
 *
 * The skeleton room list beside this is the other half of the answer: it shows the shape of
 * what is arriving while this says why it is taking a moment.
 */
const SyncBox = ({ syncStatus }: SyncBoxProps) => {
	const client = use(ClientContext)!
	// Only mounted while syncing or broken, so this subscription is not paid for in the
	// steady state.
	const roomList = useEventAsState(client.store.roomList)
	const homeserver = client.userID.split(":")[1] ?? "your homeserver"

	if (syncStatus.type === "waiting") {
		return <div className="sync-box-layer">
			<div className="sync-box">
				<div className="sync-box-title">Getting your conversations</div>
				<p className="sync-box-body">
					First sync downloads every room on your account. With a lot of conversations
					this can take several minutes — it only happens once.
				</p>
				<div className="sync-box-rule" />
				<div className="sync-box-foot">
					<span>{roomList.length} {roomList.length === 1 ? "room" : "rooms"} so far</span>
				</div>
			</div>
		</div>
	}

	if (syncStatus.type === "permanently-failed") {
		return <div className="sync-box-layer">
			<div className="sync-box errored">
				<div className="sync-box-title">
					<span className="sync-box-glyph" />
					Sync stopped
				</div>
				<p className="sync-box-body">
					echo has stopped trying to reach {homeserver}. Your conversations are still
					here, but nothing new will arrive.
				</p>
				<div className="sync-box-rule" />
				<div className="sync-box-foot">
					<span>
						{syncStatus.last_sync
							? `Last synced ${relativeTime(syncStatus.last_sync)}`
							: "Never synced"}
					</span>
					<button type="button" className="sync-box-action" onClick={restartApp}>
						Restart echo
					</button>
				</div>
			</div>
		</div>
	}

	return <div className="sync-box-layer">
		<div className="sync-box errored" title={syncStatus.error}>
			<div className="sync-box-title">
				<span className="sync-box-glyph" />
				Sync is failing
			</div>
			<p className="sync-box-body">
				echo can reach the network but not {homeserver}. Anything you send will queue
				until it comes back.
			</p>
			<div className="sync-box-rule" />
			<div className="sync-box-foot">
				<span>Retrying automatically</span>
			</div>
		</div>
	</div>
}

export default SyncBox
