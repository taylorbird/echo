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
import { use, useEffect, useState } from "react"
import { SkeletonEdge } from "../loading"
import { ModalCloseContext } from "./contexts.ts"
import "./ConfirmModal.css"

export interface ResultModalProps {
	title: string
	// Started by the caller, not here: an effect runs twice under StrictMode in dev, and
	// starting the action inside one would send it twice.
	promise: Promise<unknown>
	pending: string
	success: string
	failure: (err: unknown) => string
}

// Reports how an action went, in the same box as the confirm modals, where a bare
// window.alert used to. The box opens at once with the waiting edge, so the click has
// an answer on screen before the server does.
const ResultModal = ({ title, promise, pending, success, failure }: ResultModalProps) => {
	const closeModal = use(ModalCloseContext)
	const [result, setResult] = useState<{ error: unknown } | "ok" | null>(null)
	useEffect(() => {
		let live = true
		promise.then(
			() => live && setResult("ok"),
			error => live && setResult({ error }),
		)
		return () => {
			live = false
		}
	}, [promise])
	const text = result === null ? pending : result === "ok" ? success : failure(result.error)
	return <div className="confirm-message-modal">
		<h3>{title}</h3>
		<div className="confirm-description">{text}</div>
		<div className="confirm-buttons">
			<button type="button" onClick={closeModal} autoFocus>Done</button>
		</div>
		{result === null ? <SkeletonEdge /> : null}
	</div>
}

export default ResultModal
