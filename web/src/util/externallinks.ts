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

let warnedAboutExternalLinks = false

export default function handleExternalLinks() {
	if (!window.__TAURI_INTERNALS__) {
		return
	}
	// Capture, not bubble, and that is load-bearing.
	//
	// tauri-plugin-shell unconditionally injects an init script that adds its own click listener
	// to <body> (see js_init_script in the plugin's lib.rs). That listener grabs any
	// target="_blank" link, calls preventDefault, and invokes `plugin:shell|open` — a command
	// this app has never granted, because nothing else needs shell. body is a descendant of
	// document, so in the bubble phase it ran first: it cancelled the click, its own invoke was
	// denied by the ACL, and this handler then bailed on defaultPrevented without ever calling
	// openUrl. tauri-plugin-opener injects a similar listener on window, which bailed for the
	// same reason. Net effect: every external link was dead and nothing reported why.
	//
	// A capture listener on document runs before any bubble listener on body, so claiming the
	// event here and stopping propagation keeps the shell script from ever seeing it. The plugin
	// cannot be dropped — the gomuks sidecar is spawned through it.
	//
	// Its handler is also worse than this one: it does not skip same-origin links, so it would
	// hand gomuks' own media and download URLs to a browser that has no session cookie for them.
	document.addEventListener("click", evt => {
		// Left click only, and never override a handler that already claimed it.
		if (evt.defaultPrevented || evt.button !== 0) {
			return
		}
		// Running in capture means this fires before the spoiler handler in TextMessageBody
		// rather than after it, so an unrevealed spoiler has to be checked for directly —
		// otherwise clicking one would open the link it was hiding instead of revealing it.
		if ((evt.target as Element | null)?.closest?.("span.hicli-spoiler:not(.spoiler-revealed)")) {
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
		// Stops the shell plugin's body listener from also claiming this click and firing a
		// denied `plugin:shell|open` at it.
		evt.stopPropagation()
		// We've already cancelled the click, so a rejection here means the link did nothing at
		// all. Logging that to a console no one opens is how a dead-link bug survived from
		// 2026-08-25 to 0.3.4: the capability granted opener's command but not its URL scope, so
		// every call came back ForbiddenUrl. Say so once, and hand over the URL so it can at
		// least be copied. Once per session — a broken scope would otherwise alert on every click.
		openUrl(url.href).catch(err => {
			console.error("Failed to open link externally:", url.href, err)
			if (!warnedAboutExternalLinks) {
				warnedAboutExternalLinks = true
				window.alert(`echo couldn't hand this link to your browser:\n\n${url.href}\n\n(${err})`)
			}
		})
	}, { capture: true })
}
