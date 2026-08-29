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
import { Fragment, use } from "react"
import { InlineNode, parseReleaseNotes } from "@/util/releasenotes.ts"
import { restartToApply } from "@/util/updater.ts"
import { ModalCloseContext } from "./modal"
import "./ReleaseNotes.css"

const renderInline = (nodes: InlineNode[]) => nodes.map((node, i) => {
	switch (node.kind) {
	case "strong":
		return <strong key={i}>{node.text}</strong>
	case "code":
		return <code key={i}>{node.text}</code>
	case "link":
		// The app's capture-phase handler in ui/externallinks.ts picks these up and hands them
		// to the system browser; the rel is what makes that safe if it ever does not.
		return <a key={i} href={node.href} target="_blank" rel="noreferrer noopener">{node.text}</a>
	default:
		return <Fragment key={i}>{node.text}</Fragment>
	}
})

export interface ReleaseNotesProps {
	version: string
	notes: string
	// Set when an update is staged and waiting. Cleared when these are the notes for the version
	// already running, where there is nothing left to apply.
	canRestart: boolean
}

const ReleaseNotes = ({ version, notes, canRestart }: ReleaseNotesProps) => {
	const closeModal = use(ModalCloseContext)
	const blocks = parseReleaseNotes(notes)
	return <div className="release-notes">
		<header>
			<div className="eyebrow">{canRestart ? "Update ready" : "Updated"}</div>
			<h2>What&rsquo;s new in {version}</h2>
		</header>

		<div className="release-notes-body">
			{blocks.length === 0
				? <p className="empty">This release came without notes.</p>
				: blocks.map((block, i) => {
					switch (block.kind) {
					case "heading":
						return <h3 key={i}>{block.text}</h3>
					case "list":
						return <ul key={i}>
							{block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
						</ul>
					default:
						return <p key={i}>{renderInline(block.content)}</p>
					}
				})}
		</div>

		<footer>
			{canRestart
				? <>
					<button onClick={closeModal}>Later</button>
					<button className="primary-color-button" onClick={restartToApply}>Restart now</button>
				</>
				: <button className="primary-color-button" onClick={closeModal}>Done</button>}
		</footer>
	</div>
}

export default ReleaseNotes
