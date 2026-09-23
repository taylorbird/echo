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
import { RoomAlias, RoomID, UserID } from "@/api/types"

export const escapeHTML = (input: string) => input
	.replaceAll("&", "&amp;")
	.replaceAll("<", "&lt;")
	.replaceAll(">", "&gt;")
	.replaceAll(`"`, "&quot;")
	.replaceAll("'", "&#039;")

export const escapeMarkdown = (input: string) => input
	.replace(/([\\`*_[\]()])/g, "\\$1")
	.replaceAll("<", "&lt;")
	.replaceAll(">", "&gt;")

export const escapeMarkdownAndURI = (input: string) => {
	return escapeMarkdown(encodeURIComponent(input))
}

export const makeMentionMarkdown = (displayname: string, userID: UserID) =>
	`[${escapeMarkdown(displayname).replace("\n", " ")}](https://matrix.to/#/${escapeMarkdownAndURI(userID)}) `

// A mention as the composer shows it: "@Name" in the textarea, with the user it points at kept
// alongside. The Markdown link only replaces it at send time, so nobody has to read a matrix.to URL
// while they're typing.
export interface ComposerMention {
	label: string
	userID: UserID
}

export const mentionLabel = (displayname: string) => "@" + displayname.replace(/\n/g, " ")

export const addMention = (mentions: ComposerMention[] | undefined, mention: ComposerMention) =>
	[...(mentions ?? []).filter(m => m.label !== mention.label), mention]

// Longest label first, so "@Ann" can't take the front off "@Anna". A replaced label leaves no "@"
// behind (the link text drops it and the URL encodes it), so a shorter label can't match inside it.
// A label that is no longer in the text (deleted, or passed over while arrowing through the
// autocompleter) simply matches nothing.
export function applyMentions(text: string, mentions: ComposerMention[] | undefined): string {
	for (const { label, userID } of [...(mentions ?? [])].sort((a, b) => b.label.length - a.label.length)) {
		text = text.replaceAll(label, makeMentionMarkdown(label.slice(1), userID).trimEnd())
	}
	return text
}

export const makeRoomMentionMarkdown = (roomName: string, roomIDOrAlias: RoomID | RoomAlias, via?: string[]) => {
	let query = ""
	if (via?.length && roomIDOrAlias.startsWith("!")) {
		query = "?" + new URLSearchParams(via.map(item => ["via", item])).toString()
	}
	const url = `https://matrix.to/#/${escapeMarkdownAndURI(roomIDOrAlias)}${query}`
	roomName = escapeMarkdown(roomName).replace("\n", " ")
	return `[${roomName}](${url})`
}
