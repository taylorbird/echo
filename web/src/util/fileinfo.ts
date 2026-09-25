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
// What the app knows about a file before anyone downloads it. Everything but the
// URL and name is optional: a file message carries most of it in its event, an
// avatar opened in the lightbox carries almost none.
export interface FileDetails {
	url: string
	filename: string
	mimetype?: string
	size?: number
	width?: number
	height?: number
	encrypted?: boolean
	sender?: string
	timestamp?: number
}

const imageExtensions = /\.(png|jpe?g|gif|webp|heic|avif|bmp|tiff?)$/i

export const isImageFile = (details: FileDetails) =>
	details.mimetype?.startsWith("image/") || imageExtensions.test(details.filename)

export function formatSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} bytes`
	}
	const units = ["KB", "MB", "GB"]
	let value = bytes / 1024
	let unit = 0
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024
		unit++
	}
	return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

const friendlyTypes: Record<string, string> = {
	"application/pdf": "PDF document",
	"application/zip": "ZIP archive",
	"text/plain": "Text file",
	"image/png": "PNG image",
	"image/jpeg": "JPEG image",
	"image/gif": "GIF image",
	"image/webp": "WebP image",
	"video/mp4": "MP4 video",
	"audio/mpeg": "MP3 audio",
}

export function describeType(details: FileDetails): string | undefined {
	const mime = details.mimetype?.split(";")[0].trim()
	if (mime && friendlyTypes[mime]) {
		return friendlyTypes[mime]
	}
	const ext = details.filename.match(/\.([a-z0-9]{1,5})$/i)?.[1]
	if (ext) {
		return `${ext.toUpperCase()} file`
	}
	return mime
}

export type FileCategory = "pdf" | "image" | "video" | "audio" | "archive" | "sheet" | "doc" | "code" | "other"

const extensionCategories: Record<string, FileCategory> = {
	pdf: "pdf",
	zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive", dmg: "archive",
	xls: "sheet", xlsx: "sheet", csv: "sheet", numbers: "sheet", ods: "sheet",
	doc: "doc", docx: "doc", txt: "doc", md: "doc", rtf: "doc", pages: "doc", odt: "doc",
	js: "code", ts: "code", json: "code", py: "code", go: "code", rs: "code", html: "code", sh: "code",
}

export function fileCategory(details: FileDetails): FileCategory {
	const ext = fileExtension(details)?.toLowerCase()
	if (ext && extensionCategories[ext]) {
		return extensionCategories[ext]
	}
	const family = details.mimetype?.split("/")[0]
	if (family === "image" || family === "video" || family === "audio") {
		return family
	}
	if (isImageFile(details)) {
		return "image"
	}
	return "other"
}

export function fileExtension(details: FileDetails): string | undefined {
	return details.filename.match(/\.([a-z0-9]{1,5})$/i)?.[1]
}
