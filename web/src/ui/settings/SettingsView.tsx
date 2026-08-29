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
import { Fragment, Suspense, lazy, use, useCallback, useMemo, useRef, useState } from "react"
import { ScaleLoader } from "react-spinners"
import { BACKEND_CROSS_ORIGIN, BACKEND_URL } from "@/api/backend.ts"
import Client from "@/api/client.ts"
import { getRoomAvatarThumbnailURL, getRoomAvatarURL } from "@/api/media.ts"
import { RoomStateStore, usePreferences } from "@/api/statestore"
import { KeyRestoreProgress, RoomID, RoomType } from "@/api/types"
import {
	Preference,
	PreferenceCategory,
	PreferenceContext,
	PreferenceValueType,
	Preferences,
	preferenceCategories,
	preferenceContextToInt,
	preferences,
} from "@/api/types/preferences"
import useAppVersion from "@/util/appversion.ts"
import { NonNullCachedEventDispatcher, useEventAsState } from "@/util/eventdispatcher.ts"
import { isMobileDevice } from "@/util/ismobile.ts"
import useEvent from "@/util/useEvent.ts"
import ClientContext from "../ClientContext.ts"
import { LightboxContext, ModalCloseContext, ModalContext, modals } from "../modal"
import JSONView from "../util/JSONView.tsx"
import Toggle from "../util/Toggle.tsx"
import CloseIcon from "@/icons/close.svg?react"
import BracesIcon from "@/icons/modern/braces.svg?react"
import ChevronDownIcon from "@/icons/modern/chevron-down.svg?react"
import RoomIcon from "@/icons/modern/door-open.svg?react"
import KeyIcon from "@/icons/modern/key.svg?react"
import LogOutIcon from "@/icons/modern/log-out.svg?react"
import PaletteIcon from "@/icons/modern/palette.svg?react"
import SlidersIcon from "@/icons/modern/sliders-horizontal.svg?react"
import SearchIcon from "@/icons/search.svg?react"
import "./SettingsView.css"

interface PreferenceCellProps<T extends PreferenceValueType> {
	context: PreferenceContext
	name: keyof Preferences
	pref: Preference<T>
	setPref: SetPrefFunc
	value: T | undefined
	inheritedValue: T
}

const makeRemover = (
	context: PreferenceContext, setPref: SetPrefFunc, name: keyof Preferences, value: PreferenceValueType | undefined,
) => {
	if (value === undefined) {
		return null
	}
	return <button onClick={() => setPref(context, name, undefined)}><CloseIcon /></button>
}

/*
 * Every cell carries its scope so the two room-scoped columns can be tinted as a
 * group, and gets `set` when this scope defines the value itself rather than
 * inheriting it. A set cell is highlighted with an accent edge — the vertical runs
 * of highlight are what show where overrides actually live.
 */
const cellClass = (kind: string, context: PreferenceContext, value: PreferenceValueType | undefined) =>
	`preference ${kind} scope-${context}${value !== undefined ? " set" : ""}`

const BooleanPreferenceCell = ({ context, name, setPref, value, inheritedValue }: PreferenceCellProps<boolean>) => {
	return <div className={cellClass("boolean-preference", context, value)}>
		<Toggle checked={value ?? inheritedValue} onChange={evt => setPref(context, name, evt.target.checked)}/>
		{makeRemover(context, setPref, name, value)}
	</div>
}

const TextPreferenceCell = ({ context, name, setPref, value, inheritedValue }: PreferenceCellProps<string>) => {
	return <div className={cellClass("string-preference", context, value)}>
		<input value={value ?? inheritedValue} onChange={evt => setPref(context, name, evt.target.value)}/>
		{makeRemover(context, setPref, name, value)}
	</div>
}

const SelectPreferenceCell = ({ context, name, pref, setPref, value, inheritedValue }: PreferenceCellProps<string>) => {
	if (!pref.allowedValues) {
		return null
	}
	return <div className={cellClass("select-preference", context, value)}>
		<select value={value ?? inheritedValue} onChange={evt => setPref(context, name, evt.target.value)}>
			{pref.allowedValues.map((value, i) =>
				<option key={i} value={value}>{pref.valueLabels ? pref.valueLabels[i] : value}</option>)}
		</select>
		{makeRemover(context, setPref, name, value)}
	</div>
}

type SetPrefFunc = (context: PreferenceContext, key: keyof Preferences, value: PreferenceValueType | undefined) => void

interface PreferenceRowProps {
	name: keyof Preferences
	pref: Preference
	setPref: SetPrefFunc
	globalServer?: PreferenceValueType
	globalLocal?: PreferenceValueType
	roomServer?: PreferenceValueType
	roomLocal?: PreferenceValueType
}

const customUIPrefs = new Set([
	"custom_css",
	"custom_notification_sound",
] as (keyof Preferences)[])

const categoryLabels: Record<PreferenceCategory, string> = {
	appearance: "Appearance",
	chat: "Chat",
	media: "Media",
	input: "Input",
	notifications: "Notifications",
	advanced: "Advanced",
}

/*
 * The flat alphabet-soup list was the actual problem with this table: thirty-odd
 * unrelated switches with no shape to them. Grouping is computed once at module
 * level rather than per render — `hidden` is decided by platform globals at import
 * time and the custom-UI set is a constant, so nothing here can change later.
 * Categories with nothing left to show drop out entirely.
 */
const visiblePreferences = (Object.entries(preferences) as [keyof Preferences, Preference][])
	.filter(([key, pref]) => !pref.hidden && !customUIPrefs.has(key))
const preferencesByCategory = preferenceCategories
	.map(category => [category, visiblePreferences.filter(([, pref]) => pref.category === category)] as const)
	.filter(([, prefs]) => prefs.length > 0)

/*
 * Simple mode shows one control per preference — the value actually in effect —
 * rather than the four cells it could be set in. The chip beside it names where
 * that value comes from, which is the one thing the matrix said structurally and
 * a plain list would otherwise throw away.
 */
/* Highest precedence first, mirroring the inherit chain PreferenceRow walks. */
const scopesByPrecedence = [
	PreferenceContext.RoomDevice,
	PreferenceContext.RoomAccount,
	PreferenceContext.Device,
	PreferenceContext.Account,
] as const

/*
 * Editing in simple mode writes to whichever scope currently supplies the value,
 * so the control you flip is the one you are looking at. Always writing to the
 * account scope would silently do nothing whenever a room override was shadowing
 * it — the switch would move and the app would not change. With nothing set
 * anywhere, the broadest scope the preference allows takes the write, because
 * "everywhere" is what a plain toggle in a settings page is expected to mean.
 */
const resolvePreference = (pref: Preference, values: (PreferenceValueType | undefined)[]) => {
	for (let i = 0; i < scopesByPrecedence.length; i++) {
		const value = values[i]
		if (value !== undefined) {
			return { value, source: scopesByPrecedence[i], editContext: scopesByPrecedence[i] }
		}
	}
	const editContext = pref.allowedContexts.includes(PreferenceContext.Account)
		? PreferenceContext.Account
		: PreferenceContext.Device
	return { value: pref.defaultValue, source: null, editContext }
}

/*
 * How the value in effect is described in one line. Says what the setting applies
 * to rather than naming an internal scope: "This device" told you which column a
 * matrix cell was in, which stops meaning anything once the matrix is gone.
 */
const appliesTo = (source: PreferenceContext | null, roomName: string) => {
	switch (source) {
	case PreferenceContext.Account:
		return "Applies everywhere, on all your devices"
	case PreferenceContext.Device:
		return "Applies everywhere, on this device only"
	case PreferenceContext.RoomAccount:
		return `Applies only in ${roomName}, on all your devices`
	case PreferenceContext.RoomDevice:
		return `Applies only in ${roomName}, on this device only`
	default:
		return "Using the built-in default"
	}
}

interface ScopeLineProps extends PreferenceCellProps<PreferenceValueType> {
	label: string
}

const ScopeLine = ({ label, ...cellProps }: ScopeLineProps) => {
	const { pref, context } = cellProps
	if (!pref.allowedContexts.includes(context)) {
		return null
	}
	const prefType = typeof pref.defaultValue
	let cell = null
	if (prefType === "boolean") {
		cell = <BooleanPreferenceCell {...cellProps as PreferenceCellProps<boolean>} />
	} else if (pref.allowedValues) {
		cell = <SelectPreferenceCell {...cellProps as PreferenceCellProps<string>} />
	} else if (prefType === "string") {
		cell = <TextPreferenceCell {...cellProps as PreferenceCellProps<string>} />
	}
	return <div className="scope-line">
		<span className="scope-line-label">{label}</span>
		{cell}
	</div>
}

const SimplePreferenceRow = ({
	name, pref, setPref, roomName, globalServer, globalLocal, roomServer, roomLocal,
}: PreferenceRowProps & { roomName: string }) => {
	const [expanded, setExpanded] = useState(false)
	const { value, source, editContext } = resolvePreference(
		pref, [roomLocal, roomServer, globalLocal, globalServer],
	)
	const prefType = typeof pref.defaultValue
	const renderControl = () => {
		if (prefType === "boolean") {
			return <Toggle
				checked={value as boolean}
				onChange={evt => setPref(editContext, name, evt.target.checked)}
			/>
		} else if (pref.allowedValues) {
			const stringPref = pref as Preference<string>
			return <select
				value={value as string}
				onChange={evt => setPref(editContext, name, evt.target.value)}
			>
				{stringPref.allowedValues!.map((val, i) =>
					<option key={i} value={val}>
						{stringPref.valueLabels ? stringPref.valueLabels[i] : val}
					</option>)}
			</select>
		} else if (prefType === "string") {
			return <input
				value={value as string}
				onChange={evt => setPref(editContext, name, evt.target.value)}
			/>
		}
		return null
	}
	/*
	 * Same inherit chain PreferenceRow walked, kept in one place: each scope falls
	 * back to the one above it, so an unset cell shows what it would be rather than
	 * going blank.
	 */
	const fromDefault = pref.defaultValue
	const fromAccount = globalServer ?? fromDefault
	const fromDevice = globalLocal ?? fromAccount
	const fromRoomAccount = roomServer ?? fromDevice
	const scopeCount = pref.allowedContexts.filter(context =>
		context !== PreferenceContext.Config).length
	return <div className={`simple-preference-row${expanded ? " expanded" : ""}`}>
		<div className="row-main">
			<div className="name">
				<div className="pref-label">{pref.displayName}</div>
				<div className="pref-description">{pref.description}</div>
				<div className="scope-meta">
					<span className={`applies-to${source !== null ? " set" : ""}`}>
						{appliesTo(source, roomName)}
					</span>
					{source !== null && <button
						type="button"
						className="clear-override"
						title="Clear this override and go back to inheriting"
						onClick={() => setPref(source, name, undefined)}
					><CloseIcon /></button>}
				</div>
			</div>
			<div className="simple-control">
				{renderControl()}
				{/* One scope means there is nothing to choose between — the control
				    already is that scope, so the disclosure would open onto a single
				    row restating it. The spacer keeps the controls in one column on
				    rows where the chevron does not render. */}
				{scopeCount > 1
					? <button
						type="button"
						className="expand-scopes"
						aria-expanded={expanded}
						title={expanded ? "Hide per-room and per-device values" : "Set per room or per device"}
						onClick={() => setExpanded(value => !value)}
					><ChevronDownIcon /></button>
					: <span className="expand-scopes-spacer" />}
			</div>
		</div>
		{expanded && <div className="scope-detail">
			<div className="scope-group">
				<div className="scope-group-title">Everywhere</div>
				<ScopeLine
					label="All devices" context={PreferenceContext.Account}
					name={name} pref={pref} setPref={setPref}
					value={globalServer} inheritedValue={fromDefault}
				/>
				<ScopeLine
					label="This device" context={PreferenceContext.Device}
					name={name} pref={pref} setPref={setPref}
					value={globalLocal} inheritedValue={fromAccount}
				/>
			</div>
			<div className="scope-group room">
				<div className="scope-group-title">Only in {roomName}</div>
				<ScopeLine
					label="All devices" context={PreferenceContext.RoomAccount}
					name={name} pref={pref} setPref={setPref}
					value={roomServer} inheritedValue={fromDevice}
				/>
				<ScopeLine
					label="This device" context={PreferenceContext.RoomDevice}
					name={name} pref={pref} setPref={setPref}
					value={roomLocal} inheritedValue={fromRoomAccount}
				/>
			</div>
		</div>}
	</div>
}

type PreferenceGroups = readonly (readonly [PreferenceCategory, [keyof Preferences, Preference][]])[]

interface PreferenceListProps {
	groups: PreferenceGroups
	setPref: SetPrefFunc
	roomName: string
	globalServer: Partial<Preferences>
	globalLocal: Partial<Preferences>
	roomServer: Partial<Preferences>
	roomLocal: Partial<Preferences>
}

const SimplePreferenceList = ({
	groups, setPref, roomName, globalServer, globalLocal, roomServer, roomLocal,
}: PreferenceListProps) => <div className="simple-preference-list">
	{groups.map(([category, prefs]) => <Fragment key={category}>
		<div className="category-head">{categoryLabels[category]}</div>
		{prefs.map(([key, pref]) => <SimplePreferenceRow
			key={key}
			name={key}
			pref={pref}
			setPref={setPref}
			roomName={roomName}
			globalServer={globalServer[key]}
			globalLocal={globalLocal[key]}
			roomServer={roomServer[key]}
			roomLocal={roomLocal[key]}
		/>)}
	</Fragment>)}
</div>

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
] as const

interface SettingsViewProps {
	room: RoomStateStore
}

/*
 * Custom CSS has its own editor rather than a row in the matrix, so it has to
 * derive its scope picker from the preference's allowed contexts by hand — nothing
 * else stops it offering to save into a scope the preference proxy would then
 * ignore. Config is omitted: it is read-only from here.
 */
const cssContextLabels: Partial<Record<PreferenceContext, string>> = {
	[PreferenceContext.Account]: "Account",
	[PreferenceContext.Device]: "Device",
	[PreferenceContext.RoomAccount]: "Room (account)",
	[PreferenceContext.RoomDevice]: "Room (device)",
}
const cssContexts = preferences.custom_css.allowedContexts.filter(ctx => ctx in cssContextLabels)

function getCSSForContext(client: Client, room: RoomStateStore, context: PreferenceContext): string | undefined {
	if (context === PreferenceContext.Account) {
		return client.store.serverPreferenceCache.custom_css
	} else if (context === PreferenceContext.Device) {
		return client.store.localPreferenceCache.custom_css
	} else if (context === PreferenceContext.RoomAccount) {
		return room.serverPreferenceCache.custom_css
	} else if (context === PreferenceContext.RoomDevice) {
		return room.localPreferenceCache.custom_css
	}
}

// allowedContexts is ordered most-specific first, which is the same order the
// preference proxy resolves in, so the first hit is the one actually applied.
function getActiveCSSContext(client: Client, room: RoomStateStore): PreferenceContext {
	return cssContexts.find(ctx => getCSSForContext(client, room, ctx) !== undefined)
		?? PreferenceContext.Account
}

const Monaco = lazy(() => import("../util/monaco.tsx"))

const CustomCSSInput = ({ setPref, room }: { setPref: SetPrefFunc, room: RoomStateStore }) => {
	const client = use(ClientContext)!
	const appliedContext = getActiveCSSContext(client, room)
	const [context, setContext] = useState(appliedContext)
	const origText = getCSSForContext(client, room, context)
	const [text, setText] = useState(origText ?? "")
	const onChangeContext = (evt: React.ChangeEvent<HTMLSelectElement>) => {
		const newContext = evt.target.value as PreferenceContext
		setContext(newContext)
		setText(getCSSForContext(client, room, newContext) ?? "")
	}
	const onChangeText = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
		setText(evt.target.value)
	}
	const onSave = useEvent(() => {
		if (vscodeOpen) {
			setText(vscodeContentRef.current)
			setPref(context, "custom_css", vscodeContentRef.current)
		} else {
			setPref(context, "custom_css", text)
		}
	})
	const onDelete = () => {
		setPref(context, "custom_css", undefined)
		setText("")
	}
	const [vscodeOpen, setVSCodeOpen] = useState(false)
	const vscodeContentRef = useRef("")
	const vscodeInitialContentRef = useRef("")
	const onClickVSCode = () => {
		vscodeContentRef.current = text
		vscodeInitialContentRef.current = text
		setVSCodeOpen(true)
	}
	const closeVSCode = useCallback(() => {
		setVSCodeOpen(false)
		setText(vscodeContentRef.current)
		vscodeContentRef.current = ""
	}, [])
	return <section className="settings-section custom-css-input">
		<header>
			<PaletteIcon/>
			<h3>Custom CSS</h3>
			<select value={context} onChange={onChangeContext}>
				{cssContexts.map(ctx => <option key={ctx} value={ctx}>{cssContextLabels[ctx]}</option>)}
			</select>
			{preferenceContextToInt(context) < preferenceContextToInt(appliedContext) &&
				<span className="warning">
					&#x26a0;&#xfe0f; This context will not be applied, <code>{appliedContext}</code> has content
				</span>}
		</header>
		{vscodeOpen ? <div className="vscode-wrapper">
			<Suspense fallback={
				<div className="loader"><ScaleLoader width={40} height={80} color="var(--primary-color)"/></div>
			}>
				<Monaco
					initData={vscodeInitialContentRef.current}
					onClose={closeVSCode}
					onSave={onSave}
					contentRef={vscodeContentRef}
				/>
			</Suspense>
		</div> : <textarea value={text} onChange={onChangeText}/>}
		<div className="buttons">
			<button onClick={onClickVSCode}>Open in VS Code</button>
			{origText !== undefined && <button className="delete" onClick={onDelete}>Delete</button>}
			<button className="save primary-color-button" onClick={onSave} disabled={origText === text}>Save</button>
		</div>
	</section>
}

const AppliedSettingsView = ({ room }: SettingsViewProps) => {
	const client = use(ClientContext)!

	return <section className="settings-section applied-settings">
		<header>
			<BracesIcon/>
			<h3>Raw settings data</h3>
		</header>
		<details>
			<summary><h4>Applied settings in this room</h4></summary>
			<JSONView data={room.preferences}/>
		</details>
		<details open>
			<summary><h4>Global account settings</h4></summary>
			<JSONView data={client.store.serverPreferenceCache}/>
		</details>
		<details open>
			<summary><h4>Global device settings</h4></summary>
			<JSONView data={client.store.localPreferenceCache}/>
		</details>
		<details open>
			<summary><h4>Room account settings</h4></summary>
			<JSONView data={room.serverPreferenceCache}/>
		</details>
		<details open>
			<summary><h4>Room device settings</h4></summary>
			<JSONView data={room.localPreferenceCache}/>
		</details>
	</section>
}

export interface KeyRestoreStatus {
	progress: KeyRestoreProgress
	connected: boolean
	done?: "ok" | string
}

const KeyRestoreProgressModal = ({ evt }: { evt: NonNullCachedEventDispatcher<KeyRestoreStatus> }) => {
	const status = useEventAsState(evt)
	const prog = status.progress
	let statusMessage: string = "Unknown status"
	let handledCountMessage: string = ""

	const decryptedCount = prog.decrypted + prog.decryption_failed + prog.import_failed
	const statusMax = prog.total * 3 - (prog.decryption_failed * 2) - (prog.import_failed * 2)
	const statusValue = prog.stage === "fetching"
		? undefined
		: decryptedCount + prog.saved + prog.post_processed

	if (prog.stage === "fetching") {
		statusMessage = "Fetching keys from server"
	} else if (prog.stage === "decrypting") {
		statusMessage = "Decrypting keys"
		handledCountMessage = `Decrypted ${prog.decrypted} / ${prog.total} keys`
	} else if (prog.stage === "saving") {
		statusMessage = "Saving decrypted keys"
		handledCountMessage = `Saved ${prog.saved} / ${prog.decrypted} keys`
	} else if (prog.stage === "postprocessing") {
		statusMessage = "Decrypting pending messages"
		handledCountMessage = `Post-processed ${prog.post_processed} / ${prog.decrypted} keys`
	} else if (prog.stage === "done") {
		statusMessage = "Restore completed"
		handledCountMessage = `Successfully restored ${prog.post_processed} / ${prog.total} keys`
	}
	if (status.done && status.done !== "ok") {
		statusMessage = status.done
	} else if (!status.connected) {
		statusMessage = "Connecting to server"
	}
	return <>
		<div className="status">
			{statusMessage}
		</div>
		{prog.current_room_id && !status.done ? <div className="active-room-id">
			Currently processing <code>{prog.current_room_id}</code>
		</div> : null}
		<progress id="key-backup-restore-progress" value={statusValue} max={statusMax}/>

		<label htmlFor="key-backup-restore-progress">
			<div>{handledCountMessage}</div>
			{prog.decryption_failed ? <div>Failed to decrypt {prog.decryption_failed} keys</div> : null}
			{prog.import_failed ? <div>Failed to import {prog.import_failed} keys</div> : null}
		</label>
	</>
}

const KeyExportView = ({ room }: SettingsViewProps) => {
	const [passphrase, setPassphrase] = useState("")
	const [hasFile, setHasFile] = useState(false)
	const openModal = use(ModalContext)
	const importBackup = (roomID?: RoomID) => {
		let path = `${BACKEND_URL}_gomuks/keys/restorebackup`
		if (roomID) {
			path += `/${encodeURIComponent(roomID)}`
		}
		const evtSource = new EventSource(path, { withCredentials: BACKEND_CROSS_ORIGIN })
		let progress: KeyRestoreProgress = {
			stage: "fetching",
			current_room_id: "",
			decrypted: 0,
			decryption_failed: 0,
			import_failed: 0,
			saved: 0,
			post_processed: 0,
			total: 0,
		}
		let connected = false
		const disp = new NonNullCachedEventDispatcher<KeyRestoreStatus>({
			progress,
			connected,
		})
		evtSource.addEventListener("progress", evt => {
			progress = JSON.parse(evt.data)
			connected = true
			disp.emit({ progress, connected })
		})
		evtSource.addEventListener("done", evt => {
			disp.emit({ progress, connected, done: evt.data })
			evtSource.close()
		})
		evtSource.addEventListener("error", () => {
			disp.emit({ progress, connected, done: "Failed to connect to server" })
			evtSource.close()
		})
		evtSource.addEventListener("close", () => {
			if (!disp.current.done) {
				disp.emit({ progress, connected, done: "Connection closed unexpectedly" })
			}
			evtSource.close()
		})
		openModal({
			dimmed: true,
			boxed: true,
			content: <KeyRestoreProgressModal evt={disp}/>,
			innerBoxClass: "key-restore-modal",
			boxClass: "key-restore-modal-wrapper",
		})
	}
	return <section className="settings-section key-export">
		<header>
			<KeyIcon/>
			<h3>Encryption keys</h3>
		</header>
		<p className="section-note">
			The passphrase encrypts the export file, and is required to read it back.
		</p>
		<input
			className="passphrase"
			type="password"
			value={passphrase}
			onChange={evt => setPassphrase(evt.target.value)}
			placeholder="Passphrase"
		/>
		<form
			className="import-buttons"
			action={`${BACKEND_URL}_gomuks/keys/import`}
			encType="multipart/form-data"
			method="post"
			target="_blank"
		>
			<input type="password" name="passphrase" hidden readOnly value={passphrase} />
			<input
				className="import-file"
				type="file"
				accept="text/plain"
				name="export"
				defaultValue=""
				onChange={evt => setHasFile(!!evt.target.files?.length)}
			/>
			<button type="submit" disabled={passphrase == "" || !hasFile}>Import file</button>
		</form>
		<div className="export-buttons">
			<form action={`${BACKEND_URL}_gomuks/keys/export`} method="post" target="_blank">
				<input type="password" name="passphrase" hidden readOnly value={passphrase} />
				<button type="submit" disabled={passphrase == ""}>Export all keys</button>
			</form>
			<form
				action={`${BACKEND_URL}_gomuks/keys/export/${encodeURIComponent(room.roomID)}`}
				method="post"
				target="_blank"
			>
				<input type="password" name="passphrase" hidden readOnly value={passphrase} />
				<button type="submit" disabled={passphrase == ""}>Export room keys</button>
			</form>
		</div>
		<hr/>
		<div className="key-backup-buttons">
			<button onClick={() => importBackup(room.roomID)}>Import room backup</button>
			<button onClick={() => importBackup()}>Import entire backup</button>
		</div>
	</section>
}

const SettingsView = ({ room }: SettingsViewProps) => {
	const roomMeta = useEventAsState(room.meta)
	const appVersion = useAppVersion()
	const client = use(ClientContext)!
	const closeModal = use(ModalCloseContext)
	const openModal = use(ModalContext)
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
		} else if (context === PreferenceContext.RoomAccount) {
			client.rpc.setAccountData("fi.mau.gomuks.preferences", {
				...room.serverPreferenceCache,
				[key]: value,
			}, room.roomID)
		} else if (context === PreferenceContext.RoomDevice) {
			if (value === undefined) {
				delete room.localPreferenceCache[key]
			} else {
				(room.localPreferenceCache[key] as PreferenceValueType) = value
			}
		}
	}, [client, room])
	const onClickLogout = () => {
		if (window.confirm("Really log out and delete all local data?")) {
			client.logout().then(
				() => console.info("Successfully logged out"),
				err => window.alert(`Failed to log out: ${err}`),
			)
		}
	}
	const onClickLeave = () => {
		if (window.confirm(`Really leave ${room.meta.current.name}?`)) {
			client.rpc.leaveRoom(room.roomID).then(
				() => {
					console.info("Successfully left", room.roomID)
					closeModal()
				},
				err => window.alert(`Failed to leave room: ${err}`),
			)
		}
	}
	const openDevtools = () => {
		openModal(modals.roomStateExplorer(room))
	}
	const onClickOpenCSSApp = () => {
		client.rpc.requestOpenIDToken().then(
			resp => window.open(
				`https://css.gomuks.app/login?token=${resp.access_token}&server_name=${resp.matrix_server_name}`,
				"_blank",
				"noreferrer noopener",
			),
			err => window.alert(`Failed to request OpenID token: ${err}`),
		)
	}
	const previousRoomID = roomMeta.creation_content?.predecessor?.room_id
	const openPredecessorRoom = () => {
		window.mainScreenContext.setActiveRoom(previousRoomID!)
		closeModal()
	}
	const [section, setSection] = useState<string>(preferencesByCategory[0][0])
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

	usePreferences(client.store, room)
	const globalServer = client.store.serverPreferenceCache
	const globalLocal = client.store.localPreferenceCache
	const roomServer = room.serverPreferenceCache
	const roomLocal = room.localPreferenceCache
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
				<p className="masthead-note">
					These are your preferences everywhere. You can also override any of them
					for a single room — right now that room is
					{" "}
					<span className="room-chip" title={room.roomID}>
						<img
							className="avatar"
							loading="lazy"
							src={getRoomAvatarThumbnailURL(roomMeta)}
							data-full-src={getRoomAvatarURL(roomMeta)}
							onClick={use(LightboxContext)}
							alt=""
						/>
						{roomMeta.name ?? room.roomID}
					</span>.
				</p>
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
				{extraSections.map(({ id, label, Icon }) => <button
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
						: <SimplePreferenceList
							groups={groups}
							setPref={setPref}
							roomName={roomMeta.name ?? "this room"}
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

				{!searching && section === "room" && <section className="settings-section">
					<header>
						<RoomIcon/>
						<h3>This room</h3>
					</header>
					{roomMeta.topic && <p className="room-topic">{roomMeta.topic}</p>}
					<div className="room-buttons">
						<button className="devtools" onClick={openDevtools}>Explore room state</button>
						<select onChange={evt => {
							window.activeRoomContext?.setForceViewType(evt.target.value as RoomType)
							closeModal()
						}} defaultValue="__null__">
							{preferences.room_view_type.allowedValues!.map((val, i) =>
								<option key={i} value={val ?? "__null__"} disabled={i === 0}>
									{i === 0 ? "Override view" : preferences.room_view_type.valueLabels![i]}
								</option>)}
						</select>
						{previousRoomID &&
					<button className="previous-room" onClick={openPredecessorRoom}>
						Open predecessor room
					</button>}
						<button className="leave-room danger" onClick={onClickLeave}>Leave room</button>
					</div>
				</section>}

				{!searching && section === "css" && <CustomCSSInput setPref={setPref} room={room} />}
				{!searching && section === "applied" && <AppliedSettingsView room={room} />}
				{!searching && section === "keys" && <KeyExportView room={room} />}

				{!searching && section === "account" && <section className="settings-section">
					<header>
						<LogOutIcon/>
						<h3>Account</h3>
					</header>
					<div className="misc-buttons">
						<button onClick={onClickOpenCSSApp}>Sign into css.gomuks.app</button>
						{window.Notification && !window.gomuksAndroid && <button
							onClick={client.requestNotificationPermission}
						>
							Request notification permission
						</button>}
						{!window.gomuksAndroid &&
					<button onClick={client.registerURIHandler}>Register <code>matrix:</code> URI handler</button>
						}
						<button className="logout danger" onClick={onClickLogout}>Log out</button>
					</div>
				</section>}
			</div>
		</div>
	</>
}

export default SettingsView
