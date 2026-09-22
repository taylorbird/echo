// gomuks - A Matrix client written in Go.
// Copyright (C) 2025 Tulir Asokan
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
import { CSSProperties } from "react"
import "./Loading.css"

/*
 * The pieces every wait in the app is built from.
 *
 * Skeletons are aria-hidden: they are the shape of content that has not arrived, and a
 * screen reader announcing a row of empty boxes is worse than it announcing nothing. The
 * hairline wait is the opposite — it is the one that has something to say, so it is the
 * one that gets role="status".
 */

export const SkeletonLine = ({ width = "100%", height = ".625rem" }: { width?: string, height?: string }) =>
	<div className="sk sk-line" style={{ width, height }} aria-hidden="true" />

export const SkeletonName = ({ width = "100%" }: { width?: string }) =>
	<div className="sk sk-name" style={{ width, height: ".75rem" }} aria-hidden="true" />

export const SkeletonCircle = ({ size }: { size: string }) =>
	<div className="sk sk-avatar" style={{ width: size, height: size }} aria-hidden="true" />

export const SkeletonBlock = ({ className, style }: { className?: string, style?: CSSProperties }) =>
	<div className={className ? `sk sk-block ${className}` : "sk sk-block"} style={style} aria-hidden="true" />

export const SkeletonEdge = () => <div className="sk sk-edge" aria-hidden="true" />

/* A list row that has not arrived: the avatar lane plus the name beside it. */
export const SkeletonRow = ({ width = "100%" }: { width?: string }) => <div className="sk-row" aria-hidden="true">
	<SkeletonCircle size="1.5rem" />
	<SkeletonName width={width} />
</div>

interface HairlineWaitProps {
	label: string
	compact?: boolean
}

export const HairlineWait = ({ label, compact }: HairlineWaitProps) =>
	<div className={compact ? "hairline-wait compact" : "hairline-wait"} role="status">
		<span>{label}</span>
		<div className="hairline-wait-rule" />
	</div>
