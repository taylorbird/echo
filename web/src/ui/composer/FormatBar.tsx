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
import React, { RefObject } from "react"
import { FormatKind, applyFormat } from "./formatting.ts"
import BoldIcon from "@/icons/modern/bold.svg?react"
import CodeIcon from "@/icons/modern/code.svg?react"
import ItalicIcon from "@/icons/modern/italic.svg?react"
import LinkIcon from "@/icons/modern/link.svg?react"
import StrikeIcon from "@/icons/modern/strikethrough.svg?react"
import "./FormatBar.css"

// The tooltip shows the markdown each button writes, so the syntax can be
// picked up along the way.
interface FormatButton {
	kind: FormatKind
	label: string
	markdown: string
	Icon: React.FC<React.SVGProps<SVGSVGElement>>
}

const buttons: FormatButton[] = [
	{ kind: "bold", label: "Bold", markdown: "**text**", Icon: BoldIcon },
	{ kind: "italic", label: "Italic", markdown: "_text_", Icon: ItalicIcon },
	{ kind: "strike", label: "Strikethrough", markdown: "~~text~~", Icon: StrikeIcon },
	{ kind: "code", label: "Code", markdown: "`text`", Icon: CodeIcon },
	{ kind: "link", label: "Link", markdown: "[text](url)", Icon: LinkIcon },
]

interface FormatBarProps {
	textInput: RefObject<HTMLTextAreaElement | null>
}

// Shown above the composer while text in it is selected.
const FormatBar = ({ textInput }: FormatBarProps) => <div className="format-bar" role="toolbar" aria-label="Formatting">
	{buttons.map(({ kind, label, markdown, Icon }) => <button
		key={kind}
		type="button"
		title={`${label}: ${markdown}`}
		aria-label={label}
		// mousedown, not click: by click time the textarea has lost focus, and with
		// it the selection this button is meant to format.
		onMouseDown={evt => {
			evt.preventDefault()
			if (textInput.current) {
				applyFormat(textInput.current, kind)
			}
		}}
	>
		<Icon/>
	</button>)}
</div>

export default FormatBar
