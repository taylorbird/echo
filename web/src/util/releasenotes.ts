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
//
// Release notes arrive as a string in the updater feed, which is written by whoever cut the
// release. They are rendered by turning them into these typed nodes and building React elements
// from them — never by handing markup to the DOM. That is the whole point of the format being a
// deliberately small subset rather than markdown-in-general: the parser can only ever produce
// headings, paragraphs, lists and four kinds of inline run, so there is no path from the feed to
// arbitrary markup even if the feed is wrong, malicious, or simply garbled.

export type InlineNode =
	| { kind: "text"; text: string }
	| { kind: "strong"; text: string }
	| { kind: "code"; text: string }
	| { kind: "link"; text: string; href: string }

export type ReleaseNoteBlock =
	| { kind: "heading"; text: string }
	| { kind: "paragraph"; content: InlineNode[] }
	| { kind: "list"; items: InlineNode[][] }

// `**bold**`, `` `code` ``, `[label](https://…)`. Ordered so code wins: backticks are the escape
// hatch for showing the other two literally, which only works if they are matched first.
const INLINE_PATTERN = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)]\(([^)\s]+)\)/g

// Anything that is not plainly a web link is dropped back to its label text. `javascript:` is the
// obvious one, but the rule is an allowlist rather than a blocklist so nothing novel slips past.
function safeHref(href: string): string | null {
	try {
		const url = new URL(href)
		return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null
	} catch {
		// Relative or malformed. There is no base a release note could sensibly be relative to.
		return null
	}
}

export function parseInline(line: string): InlineNode[] {
	const nodes: InlineNode[] = []
	let lastIndex = 0
	// Fresh from lastIndex 0 each call: the regex is module-level and /g regexes carry state.
	INLINE_PATTERN.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = INLINE_PATTERN.exec(line)) !== null) {
		if (match.index > lastIndex) {
			nodes.push({ kind: "text", text: line.slice(lastIndex, match.index) })
		}
		const [full, code, strong, linkText, linkHref] = match
		if (code !== undefined) {
			nodes.push({ kind: "code", text: code })
		} else if (strong !== undefined) {
			nodes.push({ kind: "strong", text: strong })
		} else if (linkText !== undefined && linkHref !== undefined) {
			const href = safeHref(linkHref)
			nodes.push(href ? { kind: "link", text: linkText, href } : { kind: "text", text: linkText })
		}
		lastIndex = match.index + full.length
	}
	if (lastIndex < line.length) {
		nodes.push({ kind: "text", text: line.slice(lastIndex) })
	}
	return nodes
}

export function parseReleaseNotes(source: string): ReleaseNoteBlock[] {
	const blocks: ReleaseNoteBlock[] = []
	// Paragraph lines accumulate until something ends them, so a hard-wrapped paragraph in the
	// source still renders as one flowing paragraph rather than one line per source line.
	let paragraph: string[] = []
	let list: InlineNode[][] | null = null

	const flushParagraph = () => {
		if (paragraph.length) {
			blocks.push({ kind: "paragraph", content: parseInline(paragraph.join(" ")) })
			paragraph = []
		}
	}
	const flushList = () => {
		if (list) {
			blocks.push({ kind: "list", items: list })
			list = null
		}
	}
	const flushAll = () => {
		flushParagraph()
		flushList()
	}

	for (const rawLine of source.replace(/\r\n/g, "\n").split("\n")) {
		const line = rawLine.trim()
		if (!line) {
			flushAll()
			continue
		}
		const heading = /^#{1,6}\s+(.*)$/.exec(line)
		if (heading) {
			flushAll()
			// Depth is discarded on purpose. A release note is a flat list of changes; honouring
			// six levels would only invite a hierarchy that this box is far too small to show.
			blocks.push({ kind: "heading", text: heading[1] })
			continue
		}
		const item = /^[-*]\s+(.*)$/.exec(line)
		if (item) {
			flushParagraph()
			list ??= []
			list.push(parseInline(item[1]))
			continue
		}
		flushList()
		paragraph.push(line)
	}
	flushAll()
	return blocks
}

// --- Carrying notes across the restart --------------------------------------------------------
//
// The notes are only in hand while the update is staged — after the relaunch the app is the new
// version and there is no pending update left to ask. So they are stashed before restarting and
// claimed once on the other side. Device-local by nature: it records what this copy has shown.

const PENDING_NOTES_KEY = "echo.pending_release_notes"

export interface StashedReleaseNotes {
	version: string
	notes: string
}

export function stashReleaseNotes(version: string, notes: string) {
	if (!notes.trim()) {
		return
	}
	try {
		localStorage.setItem(PENDING_NOTES_KEY, JSON.stringify({ version, notes }))
	} catch {
		// Losing the notes is not a reason to lose the update.
	}
}

// Returns the stash only when it belongs to the version now running, and clears it either way:
// a stash for some other version is stale (a skipped update, or a manual reinstall) and would
// otherwise sit there waiting to surface at the wrong moment.
export function claimReleaseNotes(currentVersion: string): StashedReleaseNotes | null {
	let raw: string | null
	try {
		raw = localStorage.getItem(PENDING_NOTES_KEY)
	} catch {
		return null
	}
	if (!raw) {
		return null
	}
	try {
		localStorage.removeItem(PENDING_NOTES_KEY)
	} catch {
		// If it cannot be cleared it would show again next launch. Better than never showing.
	}
	try {
		const parsed = JSON.parse(raw) as Partial<StashedReleaseNotes>
		if (typeof parsed?.version !== "string" || typeof parsed?.notes !== "string") {
			return null
		}
		return parsed.version === currentVersion ? { version: parsed.version, notes: parsed.notes } : null
	} catch {
		return null
	}
}
