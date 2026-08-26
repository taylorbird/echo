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
import { useEffect, useState } from "react"
import { isTauri } from "@/api/backend.ts"

// Resolved once and cached: the bundle version can't change while the app is running, and the
// settings view mounts often enough that re-invoking IPC on every open is pointless.
let cachedVersion: string | null = null

// The version string from the app bundle (i.e. tauri.conf.json's "version"), or null outside
// the desktop app — there's no bundle to ask in a browser tab. Callers render nothing for null.
export default function useAppVersion(): string | null {
	const [version, setVersion] = useState<string | null>(cachedVersion)
	useEffect(() => {
		if (!isTauri || cachedVersion !== null) {
			return
		}
		let cancelled = false
		// Dynamic mostly for symmetry with util/updater.ts; @tauri-apps/api is already a hard
		// dependency of api/backend.ts, so this costs nothing either way.
		import("@tauri-apps/api/app")
			.then(({ getVersion }) => getVersion())
			.then(value => {
				cachedVersion = value
				if (!cancelled) {
					setVersion(value)
				}
			})
			.catch(err => console.warn("Failed to read app version:", err))
		return () => {
			cancelled = true
		}
	}, [])
	return version
}
