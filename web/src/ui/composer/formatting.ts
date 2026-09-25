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

// Formatting for people who don't write markdown: a format-bar button wraps the
// selection in the markers the backend's markdown renderer already understands
// (pkg/hicli/send.go), so the composer stays a plain textarea and nothing about
// sending changes.

export type FormatKind = "bold" | "italic" | "strike" | "code" | "link"

const markers: Record<Exclude<FormatKind, "link">, string> = {
	bold: "**",
	// Underscores rather than a single star, so toggling italic never mistakes
	// half of a bold's ** for its own marker.
	italic: "_",
	strike: "~~",
	code: "`",
}

// Every edit goes through execCommand("insertText"): it keeps the change on the
// textarea's undo stack and fires the input event React's onChange listens to.
function replace(area: HTMLTextAreaElement, start: number, end: number, text: string) {
	area.focus()
	area.setSelectionRange(start, end)
	document.execCommand("insertText", false, text)
}

export function applyFormat(area: HTMLTextAreaElement, kind: FormatKind) {
	const value = area.value
	let start = area.selectionStart
	let end = area.selectionEnd
	// Double-clicking a word on macOS can take the space after it too, and
	// `**word **` is not bold. Keep the markers against the text itself.
	while (start < end && /\s/.test(value[start])) {
		start++
	}
	while (end > start && /\s/.test(value[end - 1])) {
		end--
	}
	const selected = value.slice(start, end)

	if (kind === "link") {
		if (/^(https?:\/\/|matrix:)\S+$/.test(selected)) {
			// A URL was selected: it becomes the target, the caret goes where the label belongs.
			replace(area, start, end, `[](${selected})`)
			area.setSelectionRange(start + 1, start + 1)
		} else {
			const label = selected || "text"
			replace(area, start, end, `[${label}](url)`)
			// Select the placeholder so pasting or typing the address replaces it.
			const urlStart = start + label.length + 3
			area.setSelectionRange(urlStart, urlStart + 3)
		}
		return
	}

	if (kind === "code" && selected.includes("\n")) {
		replace(area, start, end, "```\n" + selected + "\n```")
		area.setSelectionRange(start + 4, start + 4 + selected.length)
		return
	}

	const marker = markers[kind]
	const len = marker.length
	// Already formatted, markers just outside the selection: take them off.
	if (value.slice(start - len, start) === marker && value.slice(end, end + len) === marker) {
		replace(area, start - len, end + len, selected)
		area.setSelectionRange(start - len, end - len)
		return
	}
	// Already formatted, markers inside the selection: take them off.
	if (selected.length >= 2 * len && selected.startsWith(marker) && selected.endsWith(marker)) {
		const inner = selected.slice(len, -len)
		replace(area, start, end, inner)
		area.setSelectionRange(start, start + inner.length)
		return
	}
	replace(area, start, end, marker + selected + marker)
	// Nothing selected leaves the caret between the markers, ready to type.
	area.setSelectionRange(start + len, end + len)
}
