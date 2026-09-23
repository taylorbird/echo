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
import { use, useCallback, useMemo, useState } from "react"
import { getRoomAvatarThumbnailURL, getRoomAvatarURL } from "@/api/media.ts"
import { RoomStateStore, usePreferences } from "@/api/statestore"
import { hasTabs } from "@/api/tabs.ts"
import {
	PreferenceCategory,
	PreferenceContext,
	PreferenceValueType,
	Preferences,
} from "@/api/types/preferences"
import useAppVersion from "@/util/appversion.ts"
import { useEventAsState } from "@/util/eventdispatcher.ts"
import { isMobileDevice } from "@/util/ismobile.ts"
import ClientContext from "../ClientContext.ts"
import { LightboxContext } from "../modal"
import JSONView from "../util/JSONView.tsx"
import BackendManager from "./BackendManager.tsx"
import CustomCSSInput from "./CustomCSSInput.tsx"
import EncryptionSettings from "./EncryptionSettings.tsx"
import MiscButtons from "./MiscButtons.tsx"
import RoomSettings from "./RoomSettings.tsx"
import SettingsDeck from "./SettingsDeck.tsx"
import { categoryLabels, preferencesByCategory, visiblePreferences } from "./preferenceGroups.ts"
import CloseIcon from "@/icons/close.svg?react"
import BracesIcon from "@/icons/modern/braces.svg?react"
import BackendsIcon from "@/icons/modern/bubble-network.svg?react"
import RoomIcon from "@/icons/modern/door-open.svg?react"
import KeyIcon from "@/icons/modern/key.svg?react"
import LogOutIcon from "@/icons/modern/log-out.svg?react"
import PaletteIcon from "@/icons/modern/palette.svg?react"
import SlidersIcon from "@/icons/modern/sliders-horizontal.svg?react"
import SearchIcon from "@/icons/search.svg?react"
import "./SettingsView.css"

export type SetPrefFunc =
	(context: PreferenceContext, key: keyof Preferences, value: PreferenceValueType | undefined) => void

/*
 * Everything on this screen that is not a preference category. Kept in rail order
 * rather than render order — the rail is the only thing that decides what is on
 * screen now, so the two must not be able to drift apart.
 */
const extraSections = [
	{ id: "room", label: "This room", Icon: RoomIcon },
	{ id: "css", label: "Custom CSS", Icon: PaletteIcon },
	{ id: "keys", label: "Encryption", Icon: KeyIcon },
	{ id: "applied", label: "Applied settings", Icon: BracesIcon },
	{ id: "account", label: "Account", Icon: LogOutIcon },
	{ id: "backends", label: "Backends", Icon: BackendsIcon },
] as const

interface SettingsViewProps {
	room?: RoomStateStore
}

const AppliedSettingsView = ({ room }: SettingsViewProps) => {
	const client = use(ClientContext)!

	return <section className="settings-section applied-settings">
		<header>
			<BracesIcon/>
			<h3>Raw settings data</h3>
		</header>
		{room && <details>
			<summary><h4>Applied settings in this room</h4></summary>
			<JSONView data={room.preferences}/>
		</details>}
		<details open>
			<summary><h4>Global account settings</h4></summary>
			<JSONView data={client.store.serverPreferenceCache}/>
		</details>
		<details open>
			<summary><h4>Global device settings</h4></summary>
			<JSONView data={client.store.localPreferenceCache}/>
		</details>
		{room && <details open>
			<summary><h4>Room account settings</h4></summary>
			<JSONView data={room.serverPreferenceCache}/>
		</details>}
		{room && <details open>
			<summary><h4>Room device settings</h4></summary>
			<JSONView data={room.localPreferenceCache}/>
		</details>}
	</section>
}

const SettingsView = ({ room }: SettingsViewProps) => {
	const roomMeta = useEventAsState(room?.meta)
	const appVersion = useAppVersion()
	const client = use(ClientContext)!
	const setPref = useCallback((
		context: PreferenceContext, key: keyof Preferences, value: PreferenceValueType | undefined,
	) => {
		if (context === PreferenceContext.Account) {
			client.rpc.setAccountData("fi.mau.gomuks.preferences", {
				...client.store.serverPreferenceCache,
				[key]: value,
			})
		} else if (context === PreferenceContext.Device) {
			if (value === undefined) {
				delete client.store.localPreferenceCache[key]
			} else {
				(client.store.localPreferenceCache[key] as PreferenceValueType) = value
			}
			if (key === "web_push") {
				client.registerWebPush()
			}
			if (key === "low_bandwidth" && !value) {
				client.store.deleteCache().then(
					() => console.log("Cleared cache after disabling low bandwidth mode"),
					err => console.error("Failed to clear cache after disabling low bandwidth mode:", err),
				)
			}
		} else if (context === PreferenceContext.RoomAccount && room) {
			client.rpc.setAccountData("fi.mau.gomuks.preferences", {
				...room.serverPreferenceCache,
				[key]: value,
			}, room.roomID)
		} else if (context === PreferenceContext.RoomDevice && room) {
			if (value === undefined) {
				delete room.localPreferenceCache[key]
			} else {
				(room.localPreferenceCache[key] as PreferenceValueType) = value
			}
		}
	}, [client, room])
	const [section, setSection] = useState<string>(preferencesByCategory[0][0])
	const openLightbox = use(LightboxContext)
	const [query, setQuery] = useState("")
	const trimmedQuery = query.trim().toLowerCase()
	const searching = trimmedQuery.length > 0
	/*
	 * Search deliberately ignores the rail: a query you typed is a stronger signal
	 * about what you want than a category you clicked earlier. Results stay grouped
	 * by category so a hit's context is still visible.
	 */
	const groups = useMemo(() => {
		if (!trimmedQuery) {
			return preferencesByCategory.filter(([category]) => category === section)
		}
		return preferencesByCategory
			.map(([category, prefs]) => [category, prefs.filter(([, pref]) =>
				pref.displayName.toLowerCase().includes(trimmedQuery)
				|| (pref.description ?? "").toLowerCase().includes(trimmedQuery),
			)] as const)
			.filter(([, prefs]) => prefs.length > 0)
	}, [trimmedQuery, section])
	const isPreferenceSection = preferencesByCategory.some(([category]) => category === section)
	const showingPreferences = searching || isPreferenceSection
	const matchCount = groups.reduce((total, [, prefs]) => total + prefs.length, 0)

	usePreferences(client.store, room ?? null)
	const globalServer = client.store.serverPreferenceCache
	const globalLocal = client.store.localPreferenceCache
	const roomServer = room?.serverPreferenceCache
	const roomLocal = room?.localPreferenceCache
	// The room section only exists when there is a room to be about, and the backend
	// manager only in a wrapper that can host several backends (upstream's desktop app).
	const railSections = extraSections.filter(({ id }) =>
		(id !== "room" || room) && (id !== "backends" || hasTabs()))
	return <>
		{/*
		  * The headline is "Settings", not the room name. Titling the whole screen
		  * with the room made it look like everything here was room-only, when in
		  * fact most of it is global and only the two right-hand columns are scoped
		  * to one room. The room is named where it actually applies instead.
		  */}
		<div className="settings-masthead">
			<div className="masthead-text">
				{/* The version is only known inside the desktop app; on the web it's simply absent. */}
				<div className="masthead-eyebrow">
					echo
					{appVersion && <span className="masthead-version">{appVersion}</span>}
				</div>
				<h2>Settings</h2>
				{room && roomMeta ? <p className="masthead-note">
					These are your preferences everywhere. You can also override any of them
					for a single room. Right now that room is
					{" "}
					<span className="room-chip" title={room.roomID}>
						<img
							className="avatar"
							loading="lazy"
							src={getRoomAvatarThumbnailURL(roomMeta)}
							data-full-src={getRoomAvatarURL(roomMeta)}
							onClick={openLightbox}
							alt=""
						/>
						{roomMeta.name ?? room.roomID}
					</span>.
				</p> : <p className="masthead-note">
					These are your preferences everywhere. Open settings from a room to
					override any of them for just that room.
				</p>}
			</div>
		</div>

		{/*
		  * Full width above the split, not tucked into the content column: it applies
		  * to every category, and being the first thing under the masthead is what
		  * makes it obvious you can just start typing. Autofocused on open — the
		  * modal only claims focus when nothing inside it already has it, and
		  * autoFocus commits before that runs. Skipped on touch, matching the app's
		  * other modals, so it does not throw up a keyboard unasked.
		  */}
		<div className="settings-toolbar">
			<div className="search-field">
				<SearchIcon />
				<input
					className="settings-search"
					type="search"
					value={query}
					spellCheck={false}
					autoComplete="off"
					autoCorrect="off"
					autoCapitalize="off"
					autoFocus={!isMobileDevice}
					placeholder={`Search ${visiblePreferences.length} settings`}
					aria-label="Search settings"
					onChange={evt => setQuery(evt.target.value)}
				/>
			</div>
		</div>

		<div className="settings-body">
			{/*
			  * The rail is the only thing that decides what is on screen. Every section
			  * below renders only when its own rail entry is current, so nothing can be
			  * reachable by scrolling past something else the way it used to be.
			  */}
			<nav className="settings-rail" aria-label="Settings sections">
				<div className="rail-group-label">Preferences</div>
				{preferencesByCategory.map(([category, prefs]) => <button
					key={category}
					type="button"
					className="rail-item"
					aria-current={!searching && section === category}
					onClick={() => { setSection(category); setQuery("") }}
				>
					{categoryLabels[category]}
					<span className="rail-count">{prefs.length}</span>
				</button>)}
				<div className="rail-group-label">More</div>
				{railSections.map(({ id, label, Icon }) => <button
					key={id}
					type="button"
					className="rail-item"
					aria-current={!searching && section === id}
					onClick={() => { setSection(id); setQuery("") }}
				>
					<Icon />
					{label}
				</button>)}
			</nav>

			<div className="settings-content">
				{showingPreferences && <section className="settings-section">
					<header>
						<SlidersIcon/>
						<h3>{searching
							? `${matchCount} ${matchCount === 1 ? "match" : "matches"}`
							: categoryLabels[section as PreferenceCategory]}</h3>
					</header>
					{matchCount === 0
						? <p className="section-note">
							No setting matches that. Try a word from its name or description.
						</p>
						: <SettingsDeck
							groups={groups}
							setPref={setPref}
							roomName={room ? (roomMeta?.name ?? "this room") : undefined}
							globalServer={globalServer}
							globalLocal={globalLocal}
							roomServer={roomServer}
							roomLocal={roomLocal}
						/>}
					{matchCount > 0 && <p className="section-note">
						Each control shows the value in effect, and the line under it says what that value
						applies to. Open <strong>Where it applies</strong> on a setting to give this room or
						this device its own value, or use
						{" "}<CloseIcon className="inline-icon"/>{" "}to clear one and go back to inheriting.
					</p>}
				</section>}

				{!searching && section === "room" && room && <RoomSettings room={room} />}

				{!searching && section === "css" && <CustomCSSInput setPref={setPref} room={room} />}
				{!searching && section === "applied" && <AppliedSettingsView room={room} />}
				{!searching && section === "keys" && <EncryptionSettings room={room} />}

				{!searching && section === "account" && <MiscButtons />}
				{!searching && section === "backends" && <BackendManager />}
			</div>
		</div>
	</>
}

export default SettingsView
