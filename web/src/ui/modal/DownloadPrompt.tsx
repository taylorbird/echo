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
import React, { useEffect, useState } from "react"
import { formatDate, formatShortTime, newSafeDate } from "@/util/datetime.ts"
import { FileDetails, describeType, formatSize } from "@/util/fileinfo.ts"
import FileTypeIcon from "../FileTypeIcon.tsx"
import "./ConfirmModal.css"
import "./DownloadPrompt.css"

// Starts the download. In Tauri, lib.rs saves it to ~/Downloads and then opens it
// (or, for an image, shows it in Finder); a browser handles it as any download.
function startDownload(details: FileDetails) {
	const anchor = document.createElement("a")
	anchor.href = details.url
	anchor.download = details.filename
	anchor.click()
}

interface DownloadPromptProps {
	details: FileDetails
	onClose: () => void
}

const DownloadPrompt = ({ details, onClose }: DownloadPromptProps) => {
	// A lightbox image arrives without size or type; ask the backend for them rather
	// than show a half-empty sheet. Failure just leaves those rows out.
	const [fetched, setFetched] = useState<{ size?: number, mimetype?: string }>({})
	useEffect(() => {
		if (details.size !== undefined && details.mimetype) {
			return
		}
		const controller = new AbortController()
		fetch(details.url, { method: "HEAD", signal: controller.signal, credentials: "include" })
			.then(res => {
				if (!res.ok) {
					return
				}
				const length = Number(res.headers.get("Content-Length"))
				setFetched({
					size: Number.isFinite(length) && length > 0 ? length : undefined,
					mimetype: res.headers.get("Content-Type") ?? undefined,
				})
			})
			.catch(() => {})
		return () => controller.abort()
	}, [details.url, details.size, details.mimetype])
	const merged: FileDetails = {
		...details,
		size: details.size ?? fetched.size,
		mimetype: details.mimetype || fetched.mimetype,
	}
	const sentAt = merged.timestamp ? newSafeDate(merged.timestamp) : null

	const rows: [string, string][] = []
	const type = describeType(merged)
	if (type) {
		rows.push(["Type", type])
	}
	if (merged.size !== undefined) {
		rows.push(["Size", formatSize(merged.size)])
	}
	if (merged.width && merged.height) {
		rows.push(["Dimensions", `${merged.width} × ${merged.height}`])
	}
	if (merged.sender) {
		rows.push(["Sent by", merged.sender])
	}
	if (sentAt) {
		rows.push(["Sent", `${formatDate(sentAt)}, ${formatShortTime(sentAt)}`])
	}
	if (merged.encrypted !== undefined) {
		rows.push(["Encryption", merged.encrypted ? "End-to-end encrypted" : "Not encrypted"])
	}

	const onSubmit = (evt: React.FormEvent) => {
		evt.preventDefault()
		startDownload(merged)
		onClose()
	}

	return <form className="confirm-message-modal download-prompt" onSubmit={onSubmit}>
		<h3>Download file?</h3>
		<div className="download-body">
			<div className="download-file">
				<FileTypeIcon details={merged}/>
				<div className="download-name">{merged.filename}</div>
			</div>
			{rows.length > 0 && <dl className="download-details">
				{rows.map(([label, value]) => <React.Fragment key={label}>
					<dt>{label}</dt>
					<dd>{value}</dd>
				</React.Fragment>)}
			</dl>}
		</div>
		<div className="confirm-buttons">
			<button type="button" className="download-cancel" onClick={onClose}>Cancel</button>
			<button type="submit" className="download-confirm" autoFocus>Download</button>
		</div>
	</form>
}

export default DownloadPrompt
