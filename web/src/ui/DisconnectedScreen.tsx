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
import echoPenguin from "@/icons/echo-penguin.png"
import { restartApp } from "@/util/updater.ts"
import { RoomListSkeleton } from "./roomlist/RoomList.tsx"
import "./DisconnectedScreen.css"

interface DisconnectedScreenProps {
	error: string
	reconnecting: boolean
	nextAttempt?: string
}

/*
 * Widths for the fake timeline groups: name, then two body lines. Fixed rather than random
 * so the layer does not reshuffle on every render while the socket retries.
 */
const timelineWidths: [number, number, number][] = [
	[18, 76, 52], [24, 64, 81], [15, 88, 41], [21, 70, 63], [19, 82, 48],
]

/*
 * What the app shows once the websocket to the local server is gone.
 *
 * The app behind is NOT blurred — it is replaced. A disconnected window holds a frozen
 * conversation that cannot scroll, cannot send and is already going stale, and leaving it
 * legible invites reading it as live. The skeleton says the same thing the first-sync screen
 * says (the shape is here, the content is not) and it is honest in both directions.
 *
 * The rows come from RoomListSkeleton so this and the first-sync list can never drift apart;
 * the rail and timeline shapes are local because nothing else draws them yet.
 */
const AppSkeleton = () => <div className="disconnected-skeleton" aria-hidden="true">
	<div className="sk-space-bar">
		<i/><i/><i/><i/>
	</div>
	<div className="sk-room-list">
		<RoomListSkeleton count={12}/>
	</div>
	<div className="sk-room-view">
		<div className="sk-room-header"><i/></div>
		<div className="sk-timeline">
			{timelineWidths.map(([name, line1, line2], i) => <div className="sk-event" key={i}>
				<div className="sk-event-avatar"/>
				<div className="sk-event-lines">
					<i style={{ width: `${name}%` }}/>
					<b style={{ width: `${line1}%` }}/>
					<b style={{ width: `${line2}%` }}/>
				</div>
			</div>)}
		</div>
		<div className="sk-composer"/>
	</div>
</div>

/*
 * Unlike the sync box, this one IS a box.
 *
 * The sync box sits bare on the pane because during first sync the skeleton behind it is
 * live — rooms really are arriving and the count really is climbing, so framing it would
 * fence off the thing worth watching. Here nothing behind is real, so the message is the
 * only live object on screen and it gets the app's existing modal treatment (the quick
 * switcher's: see DisconnectedScreen.css) rather than floating on a surface it has no
 * relationship to.
 */
const DisconnectedScreen = ({ error, reconnecting, nextAttempt }: DisconnectedScreenProps) => {
	// tabIndex kept from the wrapper this replaces: it takes focus out of the app behind,
	// alongside the capture-phase key and click blocking App.tsx installs.
	return <div className="disconnected-screen" tabIndex={-1}>
		<AppSkeleton/>
		<div className="disconnected-overlay">
			{/* The raw close code lives here rather than on screen: it is the first thing
			    asked for in a bug report and the last thing worth reading otherwise. */}
			<div className="disconnected-box" title={error}>
				<div className="disconnected-title">
					<span className="disconnected-glyph"/>
					Lost the local server
				</div>
				<p className="disconnected-body">
					echo&rsquo;s window cannot reach the local server that holds your
					conversations. Nothing has been lost &mdash; it will pick up where it
					left off.
				</p>
				<div className="disconnected-rule"/>
				<div className="disconnected-foot">
					<span>
						{reconnecting
							? nextAttempt
								? `Next attempt at ${nextAttempt}`
								: "Reconnecting"
							: "Not retrying"}
					</span>
					<button type="button" className="disconnected-action" onClick={restartApp}>
						Restart echo
					</button>
				</div>
			</div>
			{/*
			 * Below the box, halfway to the window's bottom edge — the overlay is a
			 * 1fr / auto / 1fr grid and this is centred in the lower track, so the
			 * midpoint holds at any window height. Not inside the box: the box is the
			 * message, the lockup is the app signing its own name.
			 */}
			<div className="disconnected-lockup">
				<img src={echoPenguin} alt="" draggable={false}/>
				echo
			</div>
		</div>
	</div>
}

export default DisconnectedScreen
