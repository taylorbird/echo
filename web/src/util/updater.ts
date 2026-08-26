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
import { isTauri } from "@/api/backend.ts"
import Subscribable from "./subscribable.ts"

// "ready" means a new version is downloaded and staged — restarting applies it.
export type UpdateState = "idle" | "checking" | "downloading" | "ready"

// Only the packaged app can update itself: `npm run dev` runs against the Vite dev server
// (no bundle to replace), and the plain-web build has no Tauri IPC at all.
const updatesSupported = isTauri && import.meta.env.PROD

const updateStore = new Subscribable()
// useSyncExternalStore compares snapshots with Object.is, so the snapshot has to be a stable
// reference. Keeping the whole state in one string means getUpdateState can just return it.
let updateState: UpdateState = "idle"
let checkStarted = false

function setUpdateState(state: UpdateState) {
	if (updateState === state) {
		return
	}
	updateState = state
	updateStore.notify()
}

export const subscribeToUpdateState = updateStore.subscribe
export const getUpdateState = (): UpdateState => updateState

// Fire-and-forget: any failure here (no network, malformed feed, bad signature) must leave the
// app exactly as it was, so everything is logged and swallowed rather than surfaced.
export async function checkForUpdates() {
	if (!updatesSupported || checkStarted) {
		return
	}
	checkStarted = true
	try {
		setUpdateState("checking")
		// Dynamic so the plugin module body only runs once we've decided we're in the packaged
		// app. (It doesn't keep the code out of the web bundle: vite's manualChunks sends every
		// non-splitDeps dependency to the eager `vendor` chunk. It's ~2KB, so that's fine.)
		const { check } = await import("@tauri-apps/plugin-updater")
		const update = await check()
		if (!update) {
			setUpdateState("idle")
			return
		}
		console.log("Update available:", update.version)
		setUpdateState("downloading")
		await update.downloadAndInstall()
		setUpdateState("ready")
	} catch (err) {
		console.warn("Update check failed:", err)
		setUpdateState("idle")
		// Allow a later call to retry: a failed check shouldn't permanently disable updating.
		checkStarted = false
	}
}

// The staged bundle only takes effect after a relaunch. The Rust side kills the gomuks sidecar
// before restarting — otherwise the old backend keeps port 29325 and serves the old frontend.
export function restartToApply() {
	if (!updatesSupported) {
		return
	}
	invoke("restart_for_update").catch(err => console.error("Failed to restart for update:", err))
}
