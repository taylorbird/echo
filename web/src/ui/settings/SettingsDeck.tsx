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
import { Fragment, useEffect, useRef, useState } from "react"
import {
	Preference,
	PreferenceContext,
	PreferenceValueType,
	Preferences,
} from "@/api/types/preferences"
import Toggle from "../util/Toggle.tsx"
import type { SetPrefFunc } from "./SettingsView.tsx"
import { type PreferenceGroups, categoryLabels } from "./preferenceGroups.ts"
import CloseIcon from "@/icons/close.svg?react"
import ChevronDownIcon from "@/icons/modern/chevron-down.svg?react"

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

const makeRemoverPacked = (props: PreferenceCellProps<PreferenceValueType>) => {
	return makeRemover(props.context, props.setPref, props.name, props.value)
}

const BooleanPreferenceCell = ({ context, name, setPref, value, inheritedValue }: PreferenceCellProps<boolean>) => {
	return <div className={cellClass("boolean-preference", context, value)}>
		<Toggle checked={value ?? inheritedValue} onChange={evt => setPref(context, name, evt.target.checked)}/>
		{makeRemover(context, setPref, name, value)}
	</div>
}

const useLocalValue = <T extends PreferenceValueType = number | string>(
	{ context, name, setPref, value, inheritedValue }: PreferenceCellProps<T>,
) => {
	const realVal = value ?? inheritedValue
	const [localVal, setLocalVal] = useState(realVal)
	const saveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	useEffect(() => {
		clearTimeout(saveTimeout.current)
		setLocalVal(realVal)
	}, [realVal])
	const onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
		if (typeof realVal === "number") {
			setLocalVal(evt.target.valueAsNumber as T)
		} else {
			setLocalVal(evt.target.value as T)
		}
		clearTimeout(saveTimeout.current)
		saveTimeout.current = setTimeout(() => {
			save()
		}, 500)
	}
	const save = () => {
		clearTimeout(saveTimeout.current)
		if (localVal !== realVal && (localVal || realVal)) {
			setPref(context, name, localVal)
		}
	}
	return [localVal, onChange, save] as const
}

const TextPreferenceCell = (props: PreferenceCellProps<string>) => {
	const [localVal, onChange, save] = useLocalValue(props)
	return <div className={cellClass("string-preference", props.context, props.value)}>
		<input value={localVal} onChange={onChange} onBlur={save} />
		{makeRemoverPacked(props)}
	</div>
}

const NumberPreferenceCell = (props: PreferenceCellProps<number>) => {
	const [localVal, onChange, save] = useLocalValue(props)
	return <div className={cellClass("number-preference", props.context, props.value)}>
		<input
			type={props.pref.numberType ?? "number"}
			min={props.pref.minValue}
			max={props.pref.maxValue}
			value={localVal}
			onChange={onChange}
			onBlur={save}
			onMouseUp={props.pref.numberType === "range" ? save : undefined}
		/>
		{makeRemoverPacked(props)}
	</div>
}

/*
 * The simple row's field controls. Same debounced local value as the cells above, so
 * typing does not write a preference on every keystroke; the value passed in is the
 * one in effect, and the write goes to whichever scope supplies it.
 */
const SimpleTextControl = (props: PreferenceCellProps<string>) => {
	const [localVal, onChange, save] = useLocalValue(props)
	return <input value={localVal} onChange={onChange} onBlur={save} />
}

const SimpleNumberControl = (props: PreferenceCellProps<number>) => {
	const [localVal, onChange, save] = useLocalValue(props)
	return <input
		type={props.pref.numberType ?? "number"}
		min={props.pref.minValue}
		max={props.pref.maxValue}
		value={localVal}
		onChange={onChange}
		onBlur={save}
		onMouseUp={props.pref.numberType === "range" ? save : undefined}
	/>
}

const ColorPreferenceCell = ({ context, name, setPref, value, inheritedValue }: PreferenceCellProps<string>) => {
	return <div className={cellClass("color-preference", context, value)}>
		<input
			type="color"
			value={value ?? inheritedValue}
			onChange={evt => setPref(context, name, evt.target.value)}
		/>
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

interface PreferenceRowProps {
	name: keyof Preferences
	pref: Preference
	setPref: SetPrefFunc
	globalServer?: PreferenceValueType
	globalLocal?: PreferenceValueType
	roomServer?: PreferenceValueType
	roomLocal?: PreferenceValueType
}

/*
 * String preferences that hold a colour, and so get a swatch instead of a hex field.
 * A set here rather than a flag on Preference: how a value is edited is a fact about
 * this screen, not about the preference, and the same list already works that way for
 * customUIPrefs in preferenceGroups.ts.
 */
const colorPreferences = new Set([
	"room_list_color",
] as (keyof Preferences)[])

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
		cell = colorPreferences.has(cellProps.name)
			? <ColorPreferenceCell {...cellProps as PreferenceCellProps<string>} />
			: <TextPreferenceCell {...cellProps as PreferenceCellProps<string>} />
	} else if (prefType === "number") {
		cell = <NumberPreferenceCell {...cellProps as PreferenceCellProps<number>} />
	}
	return <div className="scope-line">
		<span className="scope-line-label">{label}</span>
		{cell}
	</div>
}

/*
 * roomName is absent when settings were opened without a room. The room scopes then
 * have nowhere to apply, so the row offers only the two global ones.
 */
const SimplePreferenceRow = ({
	name, pref, setPref, roomName, globalServer, globalLocal, roomServer, roomLocal,
}: PreferenceRowProps & { roomName?: string }) => {
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
			return colorPreferences.has(name)
				? <input
					type="color"
					value={value as string}
					onChange={evt => setPref(editContext, name, evt.target.value)}
				/>
				: <SimpleTextControl
					context={editContext} name={name} pref={pref as Preference<string>} setPref={setPref}
					value={undefined} inheritedValue={value as string}
				/>
		} else if (prefType === "number") {
			return <SimpleNumberControl
				context={editContext} name={name} pref={pref as Preference<number>} setPref={setPref}
				value={undefined} inheritedValue={value as number}
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
		context !== PreferenceContext.Config
		&& (roomName !== undefined
			|| (context !== PreferenceContext.RoomAccount && context !== PreferenceContext.RoomDevice)),
	).length
	return <div className={`simple-preference-row${expanded ? " expanded" : ""}`}>
		<div className="row-main">
			<div className="name">
				<div className="pref-label">{pref.displayName}</div>
				<div className="pref-description">{pref.description}</div>
				<div className="scope-meta">
					<span className={`applies-to${source !== null ? " set" : ""}`}>
						{appliesTo(source, roomName ?? "this room")}
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
			{roomName !== undefined && <div className="scope-group room">
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
			</div>}
		</div>}
	</div>
}

interface PreferenceListProps {
	groups: PreferenceGroups
	setPref: SetPrefFunc
	roomName?: string
	globalServer: Partial<Preferences>
	globalLocal: Partial<Preferences>
	roomServer?: Partial<Preferences>
	roomLocal?: Partial<Preferences>
}

const SettingsDeck = ({
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
			roomServer={roomServer?.[key]}
			roomLocal={roomLocal?.[key]}
		/>)}
	</Fragment>)}
</div>

export default SettingsDeck
