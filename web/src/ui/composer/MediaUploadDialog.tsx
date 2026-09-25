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
import React, { JSX, use, useEffect, useRef, useState } from "react"
import type { MediaEncodingOptions } from "@/api/types"
import { ModalCloseContext } from "@/ui/modal"
import { formatSize } from "@/util/fileinfo.ts"
import { isMobileDevice } from "@/util/ismobile.ts"
import FileTypeIcon from "../FileTypeIcon.tsx"
import Toggle from "../util/Toggle.tsx"
import "./MediaUploadDialog.css"

export type UploadFileFunc = (file: Blob, filename: string, encodingOpts?: MediaEncodingOptions) => void

export interface MediaUploadDialogProps {
	file: File
	blobURL: string
	doUploadFile: UploadFileFunc
	isEncrypted: boolean
	isVoice?: boolean
	position?: { index: number, total: number }
}

const imageReencTargets = ["image/webp", "image/jpeg", "image/png", "image/gif"]
const nonEncodableSources = ["image/bmp", "image/tiff", "image/heif", "image/heic"]
const imageReencSources = [...imageReencTargets, ...nonEncodableSources]
const videoReencTargets = ["video/webm", "video/mp4", "image/webp+anim"]
const voiceMimeType = "audio/ogg; codecs=opus"
const voiceReencTargets = [voiceMimeType]
const audioReencTargets = [...voiceReencTargets, "audio/mpeg", "audio/mp4"]

interface dimensions {
	width: number
	height: number
}

const MediaUploadDialog = ({
	file, blobURL, doUploadFile, isEncrypted, isVoice, position,
}: MediaUploadDialogProps) => {
	const videoRef = useRef<HTMLVideoElement>(null)
	const [name, setName] = useState(file.name)
	const needsVoiceReenc = isVoice && file.type !== voiceMimeType
	const initialReencTarget = nonEncodableSources.includes(file.type)
		? "image/jpeg"
		: needsVoiceReenc
			? voiceMimeType
			: ""
	const [reencTarget, setReencTarget] = useState(initialReencTarget)
	const [jpegQuality, setJPEGQuality] = useState(80)
	const [resizeSlider, setResizeSlider] = useState(100)
	const [origDimensions, setOrigDimensions] = useState<dimensions | null>(null)
	const [encrypt, setEncrypt] = useState(isEncrypted)
	const [sendAsFile, setSendAsFile] = useState(false)
	const closeModal = use(ModalCloseContext)
	let previewContent: JSX.Element | null = null
	let reencTargets: string[] | null = null
	let resizedWidth: number | undefined = undefined
	let resizedHeight: number | undefined = undefined
	if (origDimensions) {
		resizedWidth = Math.floor(origDimensions.width * (resizeSlider / 100))
		resizedHeight = Math.floor(origDimensions.height * (resizeSlider / 100))
	}
	useEffect(() => {
		if (file.type.startsWith("image/")) {
			createImageBitmap(file).then(res => {
				setOrigDimensions({ width: res.width, height: res.height })
				res.close()
			})
		}
	}, [file, blobURL])
	let isFile = false
	if (file.type.startsWith("image/")) {
		previewContent = <img src={blobURL} alt={file.name} />
		if (imageReencSources.includes(file.type)) {
			reencTargets = imageReencTargets
		}
	} else if (file.type.startsWith("video/")) {
		const videoMetaLoaded = () => {
			if (videoRef.current) {
				setOrigDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight })
			}
		}
		previewContent = <video controls onLoadedMetadata={videoMetaLoaded} ref={videoRef}>
			<source src={blobURL} type={file.type} />
		</video>
		reencTargets = videoReencTargets
	} else if (file.type.startsWith("audio/")) {
		reencTargets = isVoice ? voiceReencTargets : audioReencTargets
		previewContent = <audio controls>
			<source src={blobURL} type={file.type} />
		</audio>
	} else {
		isFile = true
	}
	const submit = (evt: React.FormEvent) => {
		evt.preventDefault()
		doUploadFile(file, name, {
			encode_to: reencTarget || undefined,
			quality: reencTarget === "image/jpeg" ? jpegQuality : undefined,
			resize_width: resizeSlider !== 100 ? resizedWidth : undefined,
			resize_height: resizeSlider !== 100 ? resizedHeight : undefined,
			resize_percent: resizeSlider,
			_encrypt: encrypt,
			voice_message: isVoice,
			force_file: sendAsFile,
		})
		closeModal()
	}
	const fileTypeLabel = file.type || "Unknown type"
	return <form className="media-upload-modal" onSubmit={submit}>
		<h3>
			Upload file
			{position && <span className="upload-position"> {position.index} of {position.total}</span>}
		</h3>
		<div className="upload-body">
			{/* The preview is capped (MediaUploadDialog.css) so a large image no
			    longer pushes the options and buttons off the bottom of the box. */}
			<div className="attachment-preview">
				{previewContent ?? <FileTypeIcon details={{ url: blobURL, filename: name, mimetype: file.type }}/>}
			</div>
			<div className="upload-options">
				<label htmlFor="input-file-name" className="upload-label">File name</label>
				<input
					autoFocus={!isMobileDevice}
					type="text"
					value={name}
					id="input-file-name"
					className="upload-name"
					onChange={evt => setName(evt.target.value)}
				/>
				<dl className="upload-facts">
					<dt>Type</dt>
					<dd>{fileTypeLabel}</dd>
					<dt>Size</dt>
					<dd>{formatSize(file.size)}</dd>
					{origDimensions && <>
						<dt>Dimensions</dt>
						<dd>{resizedWidth} × {resizedHeight}</dd>
					</>}
				</dl>

				<div className="upload-switches">
					<label className="upload-switch" htmlFor="checkbox-send-as-file">
						<span>Send as file</span>
						<Toggle
							checked={sendAsFile || isFile}
							id="checkbox-send-as-file"
							disabled={isFile}
							onChange={evt => setSendAsFile(evt.target.checked)}
						/>
					</label>
					<label className="upload-switch" htmlFor="checkbox-encrypt">
						<span>Encrypt</span>
						<Toggle
							checked={encrypt}
							id="checkbox-encrypt"
							onChange={evt => setEncrypt(evt.target.checked)}
						/>
					</label>
				</div>

				{reencTargets ? <>
					<label htmlFor="select-reenc-type" className="upload-label">Re-encode</label>
					<select value={reencTarget} id="select-reenc-type" className="upload-select" onChange={evt => {
						setReencTarget(evt.target.value)
						setResizeSlider(100)
					}}>
						{!needsVoiceReenc && <option value="">No re-encoding</option>}
						{reencTargets.map(target => <option key={target} value={target}>{target}</option>)}
					</select>

					<label htmlFor="slider-resize" className="upload-label">Resize</label>
					<div className="upload-range">
						<input
							type="range"
							min={1}
							max={100}
							value={resizeSlider}
							id="slider-resize"
							onWheel={evt => setResizeSlider(prev =>
								Math.min(100, Math.max(1, prev - Math.sign(evt.deltaY))))}
							onChange={evt => {
								setResizeSlider(parseInt(evt.target.value))
								if (reencTarget === "") {
									setReencTarget(reencTargets?.includes(file.type) ? file.type : "image/jpeg")
								}
							}}
						/>
						<span>{resizeSlider}%</span>
					</div>
				</> : null}

				{(reencTarget === "image/jpeg" || reencTarget === "image/webp") && <>
					<label htmlFor="slider-reenc-quality" className="upload-label">Quality</label>
					<div className="upload-range">
						<input
							type="range"
							min={1}
							max={reencTarget === "image/webp" ? 101 : 100}
							id="slider-reenc-quality"
							value={jpegQuality}
							onChange={evt => setJPEGQuality(parseInt(evt.target.value))}
						/>
						<span>{jpegQuality === 101 ? "Lossless" : `${jpegQuality}%`}</span>
					</div>
				</>}
			</div>
		</div>
		<div className="confirm-buttons">
			<button className="upload-cancel" type="button" onClick={closeModal}>Cancel</button>
			<button className="upload-confirm" type="submit">Upload</button>
		</div>
	</form>
}

export default MediaUploadDialog
