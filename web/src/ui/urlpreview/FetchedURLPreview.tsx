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
import { invoke } from "@tauri-apps/api/core"
import React, { useCallback, useEffect, useState } from "react"
import { BACKEND_CREDENTIALS, BACKEND_URL, isTauri } from "@/api/backend.ts"
import { RoomStateStore } from "@/api/statestore"
import { URLPreview as URLPreviewType } from "@/api/types"
import URLPreview from "./URLPreview.tsx"
import RefreshIcon from "@/icons/refresh.svg?react"

// null means neither tier could produce a preview (cached so we don't retry in a loop)
const previewCache = new Map<string, URLPreviewType | null>()
// URLs where the homeserver failed but the local webview tier hasn't been tried yet.
// These render as a click-to-load chip instead of being hidden.
const backendFailedURLs = new Set<string>()
const inFlight = new Map<string, Promise<URLPreviewType | null>>()

export function extractPreviewableURLs(body: unknown): string[] {
	if (typeof body !== "string") {
		return []
	}
	const urls = new Set<string>()
	for (const match of body.matchAll(/\bhttps?:\/\/[^\s/_*]+(?:\/\S*)?\b/gi)) {
		if (!match[0].startsWith("https://matrix.to")) {
			urls.add(match[0])
		}
	}
	return Array.from(urls)
}

async function fetchFromBackend(url: string): Promise<URLPreviewType | null> {
	const res = await fetch(`${BACKEND_URL}_gomuks/url_preview?url=${encodeURIComponent(url)}`, {
		credentials: BACKEND_CREDENTIALS,
	})
	const json = await res.json()
	if (!res.ok) {
		throw new Error(json.error)
	}
	return json as URLPreviewType
}

// Loads the page in a hidden native webview (via the fetch_og_tags Tauri command) and
// builds a preview from its OpenGraph tags. Works on sites whose bot protection blocks
// the homeserver's scraper, since the request comes from a real browser engine.
async function fetchFromWebview(url: string): Promise<URLPreviewType | null> {
	const tags = await invoke<Record<string, string>>("fetch_og_tags", { url })
	const title = tags["og:title"] ?? tags["twitter:title"]
	let description: string | undefined = tags["og:description"] ?? tags["twitter:description"] ?? tags["description"]
	if (description === title) {
		description = undefined
	}
	let image: string | undefined = tags["og:image"] ?? tags["og:image:url"] ?? tags["twitter:image"]
	if (image) {
		try {
			image = new URL(image, tags["__final_url"] ?? url).href
		} catch {
			image = undefined
		}
	}
	if (!title && !image) {
		return null
	}
	const preview = {
		matched_url: url,
		"og:url": tags["og:url"] ?? url,
		"og:title": title,
		"og:description": description,
	} as URLPreviewType
	if (image) {
		preview["og:image"] = image as URLPreviewType["og:image"]
		const width = parseInt(tags["og:image:width"] ?? "")
		const height = parseInt(tags["og:image:height"] ?? "")
		if (width) {
			preview["og:image:width"] = width
		}
		if (height) {
			preview["og:image:height"] = height
		}
	}
	return preview
}

function loadPreview(url: string, allowWebview: boolean): Promise<URLPreviewType | null> {
	const cached = previewCache.get(url)
	if (cached !== undefined) {
		return Promise.resolve(cached)
	}
	const running = inFlight.get(url)
	if (running) {
		return running
	}
	const promise = (async () => {
		let result: URLPreviewType | null = null
		let backendErrored = backendFailedURLs.has(url)
		if (!backendErrored) {
			try {
				result = await fetchFromBackend(url)
			} catch (err) {
				console.warn("Homeserver preview failed for", url, err)
				backendErrored = true
				backendFailedURLs.add(url)
			}
		}
		if (!result && backendErrored && allowWebview && isTauri) {
			try {
				result = await fetchFromWebview(url)
			} catch (err) {
				console.error("Local webview preview failed for", url, err)
			}
			// The webview tier was the last resort, so whatever it produced is final
			backendFailedURLs.delete(url)
			previewCache.set(url, result)
			return result
		}
		if (!backendErrored || !isTauri) {
			// Definitive: backend answered (even if with an empty preview), or there is no fallback tier
			previewCache.set(url, result)
		}
		return result
	})().finally(() => inFlight.delete(url))
	inFlight.set(url, promise)
	return promise
}

const FetchedURLPreview = ({ url, room, autoLoad }: {
	url: string
	room: RoomStateStore
	autoLoad: boolean
}) => {
	const [preview, setPreview] = useState(() => previewCache.get(url))
	const [status, setStatus] = useState<"idle" | "loading-auto" | "loading-manual">("idle")
	const loadManual = useCallback(() => {
		setStatus("loading-manual")
		loadPreview(url, true).then(result => {
			setPreview(result)
			setStatus("idle")
		})
	}, [url])
	useEffect(() => {
		const cached = previewCache.get(url)
		setPreview(cached)
		setStatus("idle")
		if (cached === undefined && autoLoad && !backendFailedURLs.has(url)) {
			setStatus("loading-auto")
			loadPreview(url, false).then(result => {
				setPreview(result ?? previewCache.get(url))
				setStatus("idle")
			})
		}
	}, [url, autoLoad])
	if (preview) {
		return <URLPreview room={room} preview={preview}/>
	}
	// Auto-loads appear when ready without an interim placeholder; a homeserver failure
	// falls back to the chip below (webview tier) rather than hiding silently.
	if (preview === null || status === "loading-auto") {
		return null
	}
	let host = url
	try {
		host = new URL(url).hostname
	} catch {
		// fall back to showing the full URL in the label
	}
	const loading = status === "loading-manual"
	return <button className="load-url-preview" onClick={loadManual} disabled={loading} title={url}>
		<RefreshIcon/> {loading ? "Loading preview…" : `Load preview · ${host}`}
	</button>
}

export default React.memo(FetchedURLPreview)
