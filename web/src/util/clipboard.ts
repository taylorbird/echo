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

// navigator.clipboard needs a secure context and, in the Tauri WKWebView,
// permission handling the shell doesn't provide — writes can reject with
// NotAllowedError even inside a user gesture. Fall back to the synchronous
// execCommand path, which works in a click handler everywhere including the
// Tauri webview. Transient user activation survives the rejected promise's
// microtask, so the fallback still counts as gesture-driven.
export default function copyToClipboard(text: string): Promise<void> {
	if (navigator.clipboard?.writeText) {
		return navigator.clipboard.writeText(text).catch(() => execCommandCopy(text))
	}
	return Promise.resolve().then(() => execCommandCopy(text))
}

function execCommandCopy(text: string) {
	const textarea = document.createElement("textarea")
	textarea.value = text
	textarea.style.position = "fixed"
	textarea.style.opacity = "0"
	document.body.appendChild(textarea)
	textarea.focus()
	textarea.select()
	try {
		if (!document.execCommand("copy")) {
			throw new Error("execCommand copy returned false")
		}
	} finally {
		textarea.remove()
	}
}
