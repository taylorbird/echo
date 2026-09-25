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
import { FileDetails, fileCategory, fileExtension } from "@/util/fileinfo.ts"
import "./FileTypeIcon.css"

// A page with a folded corner, tinted by what kind of file it is, with the
// extension on a label across its foot.
const FileTypeIcon = ({ details }: { details: FileDetails }) => {
	const category = fileCategory(details)
	const label = (fileExtension(details) ?? details.mimetype?.split("/")[1] ?? "file").toUpperCase().slice(0, 4)
	return <svg className={`file-type-icon ${category}`} viewBox="0 0 48 60" aria-hidden="true">
		<path className="page" d="M8 2h22l14 14v36a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6z"/>
		<path className="fold" d="M30 2v10a4 4 0 0 0 4 4h10z"/>
		<rect className="label" x="2" y="36" width="42" height="14" rx="2"/>
		<text x="23" y="46.5" textAnchor="middle">{label}</text>
	</svg>
}

export default FileTypeIcon
