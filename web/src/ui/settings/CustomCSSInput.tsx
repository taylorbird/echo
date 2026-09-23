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
import React, { Suspense, lazy, use, useRef, useState } from "react"
import Client from "@/api/client.ts"
import { RoomStateStore, usePreference } from "@/api/statestore"
import { PreferenceContext, preferenceContextToInt, preferences } from "@/api/types/preferences"
import useEvent from "@/util/useEvent.ts"
import ClientContext from "../ClientContext.ts"
import { HairlineWait } from "../loading"
import type { SetPrefFunc } from "./SettingsView.tsx"
import PaletteIcon from "@/icons/modern/palette.svg?react"

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
const allCSSContexts = preferences.custom_css.allowedContexts.filter(ctx => ctx in cssContextLabels)
const isRoomContext = (ctx: PreferenceContext) =>
	ctx === PreferenceContext.RoomAccount || ctx === PreferenceContext.RoomDevice

function getCSSForContext(client: Client, room: RoomStateStore | undefined, context: PreferenceContext) {
	if (context === PreferenceContext.Account) {
		return client.store.serverPreferenceCache.custom_css
	} else if (context === PreferenceContext.Device) {
		return client.store.localPreferenceCache.custom_css
	} else if (context === PreferenceContext.RoomAccount) {
		return room?.serverPreferenceCache.custom_css
	} else if (context === PreferenceContext.RoomDevice) {
		return room?.localPreferenceCache.custom_css
	}
}

// allowedContexts is ordered most-specific first, which is the same order the
// preference proxy resolves in, so the first hit is the one actually applied.
function getActiveCSSContext(
	client: Client, room: RoomStateStore | undefined, contexts: PreferenceContext[],
): PreferenceContext {
	return contexts.find(ctx => getCSSForContext(client, room, ctx) !== undefined)
		?? PreferenceContext.Account
}

const Monaco = lazy(() => import("../util/monaco.tsx"))

interface CustomCSSInputProps {
	setPref: SetPrefFunc
	room?: RoomStateStore
}

const CustomCSSInput = ({ setPref, room }: CustomCSSInputProps) => {
	const client = use(ClientContext)!
	usePreference(client.store, room ?? null, "custom_css")
	// Without a room there is nowhere for the room scopes to apply.
	const cssContexts = room ? allCSSContexts : allCSSContexts.filter(ctx => !isRoomContext(ctx))
	const appliedContext = getActiveCSSContext(client, room, cssContexts)
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
	const closeVSCode = useEvent(() => {
		setVSCodeOpen(false)
		setText(vscodeContentRef.current)
		vscodeContentRef.current = ""
	})
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
				<div className="loader"><HairlineWait label="Getting the editor" /></div>
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

export default CustomCSSInput
