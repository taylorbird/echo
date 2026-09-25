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
import React, { CSSProperties, JSX, use, useState } from "react"
import { getEncryptedMediaURL, getMediaURL } from "@/api/media.ts"
import type { EventType, MediaMessageEventContent } from "@/api/types"
import { FileDetails, describeType, formatSize } from "@/util/fileinfo.ts"
import { ImageContainerSize, calculateMediaSize, defaultVideoContainerSize } from "@/util/mediasize.ts"
import { ensureString } from "@/util/validation.ts"
import FileTypeIcon from "../../FileTypeIcon.tsx"
import { LightboxContext, ModalContext } from "../../modal"
import DownloadPrompt from "../../modal/DownloadPrompt.tsx"
import DownloadIcon from "@/icons/download.svg?react"

export const useMediaContent = (
	content: MediaMessageEventContent,
	evtType: EventType,
	containerSize?: ImageContainerSize,
	onLoad?: () => void,
	autoplayGifs?: boolean,
	// Who sent it and when, for the download prompt. The hook only sees the content.
	origin?: { sender?: string, timestamp?: number },
): [JSX.Element | null, string, CSSProperties] => {
	const mediaURL = content.file?.url ? getEncryptedMediaURL(content.file.url) : getMediaURL(content.url)
	const fileDetails = (): FileDetails => ({
		url: mediaURL ?? "",
		filename: ensureString(content.filename ?? content.body) || "file",
		mimetype: ensureString(content.info?.mimetype) || undefined,
		size: typeof content.info?.size === "number" ? content.info.size : undefined,
		width: typeof content.info?.w === "number" ? content.info.w : undefined,
		height: typeof content.info?.h === "number" ? content.info.h : undefined,
		encrypted: !!content.file?.url,
		sender: origin?.sender,
		timestamp: origin?.timestamp,
	})
	const thumbnailURL = content.info?.thumbnail_file?.url
		? getEncryptedMediaURL(content.info.thumbnail_file.url) : getMediaURL(content.info?.thumbnail_url)
	const [errored, setErrored] = useState(false)
	const openLightbox = use(LightboxContext)
	const openModal = use(ModalContext)
	if (content.msgtype === "m.image" || content.msgtype === "m.sticker" || evtType === "m.sticker") {
		const style = calculateMediaSize(content.info?.w, content.info?.h, containerSize)
		return [<img
			onLoad={onLoad}
			onError={() => {
				setErrored(true)
				onLoad?.()
			}}
			loading="lazy"
			style={style.media}
			src={mediaURL}
			alt={ensureString(content.filename ?? content.body)}
			title={ensureString(content.filename ?? content.body)}
			onClick={() => openLightbox({
				src: mediaURL ?? "",
				alt: ensureString(content.filename ?? content.body),
				file: fileDetails(),
			})}
			className={errored ? "errored" : undefined}
		/>, "image-container", style.container]
	} else if (content.msgtype === "m.video") {
		const style = calculateMediaSize(content.info?.w, content.info?.h, containerSize ?? defaultVideoContainerSize)
		const controls = !content.info?.["fi.mau.hide_controls"]
		const loop = !!content.info?.["fi.mau.loop"]
		const muted = !!content.info?.["fi.mau.no_audio"]
		const autoplay = autoplayGifs && !!content.info?.["fi.mau.autoplay"]
		let onMouseOver: React.MouseEventHandler<HTMLVideoElement> | undefined
		let onMouseOut: React.MouseEventHandler<HTMLVideoElement> | undefined
		if (!autoplay && !controls && muted) {
			onMouseOver = (event: React.MouseEvent<HTMLVideoElement>) => event.currentTarget.play()
			onMouseOut = (event: React.MouseEvent<HTMLVideoElement>) => {
				event.currentTarget.pause()
				event.currentTarget.currentTime = 0
			}
		}
		return [<video
			autoPlay={autoplay && muted}
			controls={controls || !muted}
			style={style.media}
			loop={loop}
			muted={muted}
			poster={thumbnailURL}
			onMouseOver={onMouseOver}
			onMouseOut={onMouseOut}
			preload={autoplay ? "auto" : "none"}
		>
			<source src={mediaURL} type={ensureString(content.info?.mimetype)}/>
		</video>, "video-container", style.container]
	} else if (content.msgtype === "m.audio") {
		return [<audio controls src={mediaURL} preload="none"/>, "audio-container", {}]
	} else if (content.msgtype === "m.file") {
		const details = fileDetails()
		const meta = [describeType(details), details.size !== undefined ? formatSize(details.size) : null]
			.filter(Boolean).join(" · ")
		return [<a
			className="file-card"
			href={mediaURL}
			target="_blank"
			rel="noopener noreferrer"
			download={ensureString(content.filename ?? content.body)}
			// Asks first: the prompt says what the file is and does the download itself.
			// externallinks.ts leaves links marked this way alone.
			data-download-prompt=""
			onClick={evt => {
				evt.preventDefault()
				evt.stopPropagation()
				openModal({
					dimmed: true,
					boxed: true,
					content: <DownloadPrompt details={details} onClose={() => window.closeModal()}/>,
				})
			}}
		>
			{/* The prompt's icon at chat size, so the file reads as a file to click. */}
			<FileTypeIcon details={details}/>
			<span className="file-card-text">
				<span className="file-card-name">{details.filename}</span>
				{meta && <span className="file-card-meta">{meta}</span>}
			</span>
			<DownloadIcon className="file-card-download"/>
		</a>, "file-container", {}]
	}
	return [null, "unknown-container", {}]
}
