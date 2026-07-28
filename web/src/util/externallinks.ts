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
import { openUrl } from "@tauri-apps/plugin-opener"

// The message HTML sanitizer marks every link target="_blank". A browser opens
// those in a new tab, but a Tauri webview has nowhere to put one and drops the
// request, so links in messages appear dead. Hand them to the system browser
// instead.
//
// matrix: URIs are deliberately not listed: TextMessageBody handles those
// in-app to jump to the room or user, and must keep doing so.
const externalProtocols = new Set(["http:", "https:", "mailto:"])

export default function handleExternalLinks() {
	if (!window.__TAURI_INTERNALS__) {
		return
	}
	document.addEventListener("click", evt => {
		// Left click only, and never override a handler that already claimed it
		// (spoilers and matrix: links both preventDefault before this runs).
		if (evt.defaultPrevented || evt.button !== 0) {
			return
		}
		const anchor = (evt.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href]")
		if (!anchor) {
			return
		}
		let url: URL
		try {
			url = new URL(anchor.href, location.href)
		} catch {
			return
		}
		if (!externalProtocols.has(url.protocol)) {
			return
		}
		// Same-origin links point at the gomuks backend (media, downloads). The
		// system browser has no session cookie for those, so leave them alone.
		if (url.protocol !== "mailto:" && url.origin === location.origin) {
			return
		}
		evt.preventDefault()
		openUrl(url.href).catch(err => console.error("Failed to open link externally:", url.href, err))
	})
}
