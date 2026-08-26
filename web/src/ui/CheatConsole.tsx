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
import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Cheat, getCheats, isCheatActive, matchCheat, toggleCheat } from "@/util/cheats.ts"
import "./CheatConsole.css"

const ARROW_GLYPHS: Record<string, string> = {
	ArrowUp: "↑",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
}

// Solid triangles on the pad itself, thin arrows in the readout: the pad is a
// piece of hardware, the readout is a transcript.
const DPAD_GLYPHS: Record<string, string> = {
	ArrowUp: "▲",
	ArrowDown: "▼",
	ArrowLeft: "◀",
	ArrowRight: "▶",
}

// Row-major 3×3. null cells are the corners and the hub, which are pad body
// rather than buttons.
const DPAD_CELLS: (string | null)[] = [
	null, "ArrowUp", null,
	"ArrowLeft", null, "ArrowRight",
	null, "ArrowDown", null,
]

const FACE_BUTTONS = ["b", "a"]

const CENTER_BUTTONS = ["select", "start"]

// Select and Start ride the -/+ keys; the unshifted forms are accepted too so
// the chord doesn't depend on the keyboard layout's shift behavior.
const KEY_TO_CENTER: Record<string, string> = {
	"-": "select",
	"_": "select",
	"+": "start",
	"=": "start",
}

const MAX_SHOWN_KEYS = 12

// How long the unlock banner holds before the reload. Sender colors are computed
// at render time all over the app, so reloading is the honest way to reapply
// them everywhere — and it suits a cheat code.
const UNLOCK_HOLD_MS = 1200

interface Pulse {
	control: string
	nonce: number
}

interface Unlock {
	cheat: Cheat
	activated: boolean
}

const CheatConsole = () => {
	const [sequence, setSequence] = useState<string[]>([])
	const [pulse, setPulse] = useState<Pulse | null>(null)
	const [unlock, setUnlock] = useState<Unlock | null>(null)
	const rootRef = useRef<HTMLDivElement>(null)
	const lockedRef = useRef(false)
	useLayoutEffect(() => {
		// The modal wrapper focuses its overlay unless something inside it already
		// has focus, so claiming focus here (a layout effect, which runs before the
		// wrapper's) keeps the keydown handler below on the receiving end.
		rootRef.current?.focus()
	}, [])
	useEffect(() => {
		if (!unlock) {
			return
		}
		const timeout = setTimeout(() => window.location.reload(), UNLOCK_HOLD_MS)
		return () => clearTimeout(timeout)
	}, [unlock])
	const onKeyDown = (evt: React.KeyboardEvent<HTMLDivElement>) => {
		if (lockedRef.current) {
			return
		}
		let entry: string | null = null
		if (Object.hasOwn(ARROW_GLYPHS, evt.key)) {
			entry = evt.key
		} else if (evt.key.length === 1 && FACE_BUTTONS.includes(evt.key.toLowerCase())) {
			entry = evt.key.toLowerCase()
		} else if (Object.hasOwn(KEY_TO_CENTER, evt.key)) {
			entry = KEY_TO_CENTER[evt.key]
		} else if (evt.key === "Backspace") {
			evt.preventDefault()
			setSequence(seq => seq.slice(0, -1))
			return
		}
		if (entry === null) {
			// Everything else, Escape included, bubbles up to the modal wrapper.
			return
		}
		evt.preventDefault()
		const pressed = entry
		setPulse(prev => ({ control: pressed, nonce: (prev?.nonce ?? 0) + 1 }))
		const next = [...sequence, pressed]
		setSequence(next)
		const cheat = matchCheat(next)
		if (cheat) {
			lockedRef.current = true
			setUnlock({ cheat, activated: toggleCheat(cheat.id) })
		}
	}
	// Remounting the pulsed control is what restarts its animation — the same
	// class landing on the same element again would not replay it.
	const controlKey = (control: string) =>
		pulse?.control === control ? `${control}-${pulse.nonce}` : control
	const controlClass = (control: string) =>
		pulse?.control === control ? "pulse" : ""
	const shown = sequence.slice(-MAX_SHOWN_KEYS)
	return <div className="cheat-console" ref={rootRef} tabIndex={-1} onKeyDown={onKeyDown}>
		<div className="cheat-console-label">Cheat Console</div>
		<div className="cheat-console-controls">
			<div className="cheat-dpad">
				{DPAD_CELLS.map((cell, i) => cell === null
					? <div className="dpad-cell" key={`cell-${i}`}/>
					: <div className={`dpad-cell dpad-button ${controlClass(cell)}`} key={controlKey(cell)}>
						{DPAD_GLYPHS[cell]}
					</div>)}
			</div>
			<div className="cheat-center-buttons">
				{CENTER_BUTTONS.map(button => <div
					className={`center-button ${controlClass(button)}`}
					key={controlKey(button)}
				>{button.toUpperCase()}</div>)}
			</div>
			<div className="cheat-face-buttons">
				{FACE_BUTTONS.map(button => <div
					className={`face-button ${controlClass(button)}`}
					key={controlKey(button)}
				>{button.toUpperCase()}</div>)}
			</div>
		</div>
		<div className="cheat-sequence">
			{shown.length === 0
				? <div className="sequence-empty">– – –</div>
				: shown.map((entry, i) => <div className="sequence-chip" key={`${sequence.length - shown.length + i}`}>
					{ARROW_GLYPHS[entry] ?? entry.toUpperCase()}
				</div>)}
		</div>
		<div className="cheat-hint">Enter a code…</div>
		{/* Static per render is fine: turning a cheat off reloads the app. */}
		{getCheats().some(cheat => isCheatActive(cheat.id)) && <div className="cheat-active-list">
			<div className="active-label">Active cheats</div>
			{getCheats().filter(cheat => isCheatActive(cheat.id)).map(cheat => <div
				className="active-cheat"
				key={cheat.id}
			>
				<span className="active-name" title={cheat.description}>{cheat.name}</span>
				<button onClick={() => {
					lockedRef.current = true
					setUnlock({ cheat, activated: toggleCheat(cheat.id) })
				}}>Turn off</button>
			</div>)}
		</div>}
		{unlock && <div className="cheat-unlock">
			<div className="unlock-title">{unlock.activated ? "Cheat Activated" : "Cheat Deactivated"}</div>
			<div className="unlock-name">{unlock.cheat.name}</div>
			<div className="unlock-description">{unlock.cheat.description}</div>
		</div>}
	</div>
}

export default CheatConsole
