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
export enum PreferenceContext {
	Config = "config",
	Account = "account",
	Device = "device",
	RoomAccount = "room_account",
	RoomDevice = "room_device",
}

export function preferenceContextToInt(context: PreferenceContext): number {
	switch (context) {
	case PreferenceContext.Config:
		return 0
	case PreferenceContext.Account:
		return 1
	case PreferenceContext.Device:
		return 2
	case PreferenceContext.RoomAccount:
		return 3
	case PreferenceContext.RoomDevice:
		return 4
	}
}

export const anyContext = [
	PreferenceContext.RoomDevice,
	PreferenceContext.RoomAccount,
	PreferenceContext.Device,
	PreferenceContext.Account,
	PreferenceContext.Config,
] as const

export const anyGlobalContext = [
	PreferenceContext.Device,
	PreferenceContext.Account,
	PreferenceContext.Config,
] as const

export const deviceSpecific = [
	PreferenceContext.RoomDevice,
	PreferenceContext.Device,
] as const

export const globalDeviceSpecific = [
	PreferenceContext.Device,
	PreferenceContext.Config,
] as const

export const roomSpecific = [
	PreferenceContext.RoomAccount,
	PreferenceContext.RoomDevice,
] as const

/*
 * Semantic grouping for the settings list, in the order the groups are rendered.
 * A preference without a category falls through to "advanced", which is the
 * group for the low-level knobs nobody looks for by name.
 */
export const preferenceCategories = [
	"appearance", "chat", "media", "input", "notifications", "advanced",
] as const

export type PreferenceCategory = typeof preferenceCategories[number]

export type PreferenceValueType =
	| boolean
	| number
	| string
	| number[]
	| string[]
	| Record<string, unknown>
	| Record<string, unknown>[]
	| null;

interface PreferenceFields<T extends PreferenceValueType = PreferenceValueType> {
	displayName: string
	allowedContexts: readonly PreferenceContext[]
	defaultValue: T
	description: string
	category?: PreferenceCategory
	allowedValues?: readonly T[]
	valueLabels?: readonly string[]
	hidden?: boolean
}

export class Preference<T extends PreferenceValueType = PreferenceValueType> {
	public readonly displayName: string
	public readonly allowedContexts: readonly PreferenceContext[]
	public readonly defaultValue: T
	public readonly description?: string
	public readonly category: PreferenceCategory
	public readonly allowedValues?: readonly T[]
	public readonly valueLabels?: readonly string[]
	public readonly hidden: boolean

	constructor(fields: PreferenceFields<T>) {
		this.displayName = fields.displayName
		this.allowedContexts = fields.allowedContexts
		this.defaultValue = fields.defaultValue
		this.description = fields.description ?? ""
		this.category = fields.category ?? "advanced"
		this.allowedValues = fields.allowedValues
		this.valueLabels = fields.valueLabels
		this.hidden = fields.hidden ?? false
	}
}
