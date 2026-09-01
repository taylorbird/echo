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

/*
 * Mirrors the CSS: the system preference is honoured unless the "Ignore reduce
 * motion" preference has set the attribute on <html>. A media query can't be
 * un-matched from CSS, so the escape hatch is the absence of that attribute,
 * and anything gating on this from JS has to check it the same way.
 *
 * Shared rather than copied per call site: it encodes a rule about how this app
 * treats the preference, and two drifting copies of that rule is how half the
 * UI ends up ignoring the escape hatch.
 */
export const prefersReducedMotion = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches
	&& !document.documentElement.hasAttribute("data-ignore-reduce-motion")

export default prefersReducedMotion
