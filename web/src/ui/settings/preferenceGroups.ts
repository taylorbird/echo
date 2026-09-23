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
import {
	Preference,
	PreferenceCategory,
	Preferences,
	preferenceCategories,
	preferences,
} from "@/api/types/preferences"

// Kept out of SettingsDeck.tsx so that file only exports components (fast refresh).

const customUIPrefs = new Set([
	"custom_css",
] as (keyof Preferences)[])

export const categoryLabels: Record<PreferenceCategory, string> = {
	appearance: "Appearance",
	chat: "Chat",
	media: "Media",
	input: "Input",
	notifications: "Notifications",
	advanced: "Advanced",
}

/*
 * The flat alphabet-soup list was the actual problem with this table: thirty-odd
 * unrelated switches with no shape to them. Grouping is computed once at module
 * level rather than per render — `hidden` is decided by platform globals at import
 * time and the custom-UI set is a constant, so nothing here can change later.
 * Categories with nothing left to show drop out entirely.
 */
export const visiblePreferences = (Object.entries(preferences) as [keyof Preferences, Preference][])
	.filter(([key, pref]) => !pref.hidden && !customUIPrefs.has(key))
export const preferencesByCategory = preferenceCategories
	.map(category => [category, visiblePreferences.filter(([, pref]) => pref.category === category)] as const)
	.filter(([, prefs]) => prefs.length > 0)

export type PreferenceGroups = readonly (readonly [PreferenceCategory, [keyof Preferences, Preference][]])[]
