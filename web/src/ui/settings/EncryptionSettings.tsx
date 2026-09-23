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
import { JSX, use, useEffect, useMemo, useState } from "react"
import { RoomStateStore } from "@/api/statestore"
import { DeviceID, GetOwnDevicesResponse, OwnDevice, ProfileDevice } from "@/api/types"
import ClientContext from "../ClientContext.ts"
import { SkeletonCircle, SkeletonLine, SkeletonName } from "../loading"
import KeyExportView from "./KeyExportView.tsx"
import EncryptedOffIcon from "@/icons/encrypted-off.svg?react"
import EncryptedQuestionIcon from "@/icons/encrypted-question.svg?react"
import EncryptedIcon from "@/icons/encrypted.svg?react"
import DevicesIcon from "@/icons/modern/layers.svg?react"

const deltaFormatter = new Intl.RelativeTimeFormat("en-GB")
const timeFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "medium" })

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 4 * WEEK
const YEAR = MONTH * 12

function pickUnit(x: number): Intl.RelativeTimeFormatUnit {
	x = Math.abs(x)
	if (x < MINUTE) {
		return "second"
	} else if (x < HOUR) {
		return "minute"
	} else if (x < DAY) {
		return "hour"
	} else if (x < WEEK) {
		return "day"
	} else if (x < MONTH) {
		return "week"
	} else if (x < YEAR) {
		return "month"
	}
	return "year"
}

function roundToUnit(x: number, unit: Intl.RelativeTimeFormatUnit) {
	switch (unit) {
	case "second":
		return Math.round(x / 1000)
	case "minute":
		return Math.round(x / MINUTE)
	case "hour":
		return Math.round(x / HOUR)
	case "day":
		return Math.round(x / DAY)
	case "week":
		return Math.round(x / WEEK)
	case "month":
		return Math.round(x / MONTH)
	case "year":
		return Math.round(x / YEAR)
	default:
		throw new Error(`Unknown unit: ${unit}`)
	}
}

interface DeviceInfoProps {
	dev: OwnDevice
	enc?: ProfileDevice
	isCurrent: boolean
}

/*
 * The shield says whether the device is cross-signed, and the title says it in words, so
 * the colour is never the only signal.
 */
const DeviceInfo = ({ dev, enc, isCurrent }: DeviceInfoProps) => {
	let icon: JSX.Element
	let trustLabel: string
	if (!enc) {
		icon = <EncryptedOffIcon className="encryption-shield" />
		trustLabel = "No encryption keys"
	} else if (enc.trust_state === "cross-signed-verified" || enc.trust_state === "cross-signed-tofu") {
		icon = <EncryptedIcon color="var(--primary-color)" className="encryption-shield" />
		trustLabel = "Verified"
	} else {
		icon = <EncryptedQuestionIcon color="var(--error-color)" className="encryption-shield" />
		trustLabel = "Not verified"
	}
	const lastSeen = new Date(dev.last_seen_ts)
	const sinceLastSeen = Date.now() - dev.last_seen_ts
	const unit = pickUnit(sinceLastSeen)

	return <div className={`device-info${isCurrent ? " current" : ""}`}>
		<span className="device-shield" title={trustLabel}>{icon}</span>
		<div className="device-name">{dev.display_name || dev.device_id}</div>
		<div className="metadata">
			<code className="device-id">{dev.device_id}</code>
			<span className="last-seen" title={dev.last_seen_ts ? timeFormatter.format(lastSeen) : undefined}>
				{isCurrent
					? "This device"
					: dev.last_seen_ts
						? `Last seen ${deltaFormatter.format(-roundToUnit(sinceLastSeen, unit), unit)}`
						: "Never seen"}
			</span>
			{dev.last_seen_ip && <span className="last-seen-ip">{dev.last_seen_ip}</span>}
		</div>
	</div>
}

const DevicesInfo = ({ info }: { info: GetOwnDevicesResponse }) => {
	const deviceMap = useMemo(() => {
		info.devices.sort((a, b) => {
			if (a.device_id === info.current_device.device_id) {
				return -1
			}
			if (b.device_id === info.current_device.device_id) {
				return 1
			}
			return b.last_seen_ts - a.last_seen_ts
		})
		const map = new Map<DeviceID, ProfileDevice>()
		for (const dev of info.encryption.devices) {
			map.set(dev.device_id, dev)
		}
		return map
	}, [info])
	return <>
		<div className="cross-signing-key">
			<span className="field-label">Cross-signing master key</span>
			<code>{info.encryption.master_key || "Not set up"}</code>
		</div>
		<div className="device-list">
			{info.devices.map(dev => <DeviceInfo
				key={dev.device_id}
				isCurrent={dev.device_id === info.current_device.device_id}
				dev={dev}
				enc={deviceMap.get(dev.device_id)}
			/>)}
		</div>
	</>
}

/* Placeholder rows in the device list's own geometry, so nothing shifts when it lands. */
const DevicesSkeleton = () => <div className="device-list" aria-hidden="true">
	{[62, 48, 55].map(width => <div className="device-info skeleton" key={width}>
		<SkeletonCircle size="1.25rem" />
		<SkeletonName width={`${width}%`} />
		<SkeletonLine width={`${width - 18}%`} />
	</div>)}
</div>

interface EncryptionSettingsProps {
	room?: RoomStateStore
}

const EncryptionSettings = ({ room }: EncryptionSettingsProps) => {
	const client = use(ClientContext)!
	const [info, setInfo] = useState<GetOwnDevicesResponse | null>(null)
	const [error, setError] = useState<string | null>(null)
	useEffect(() => {
		client.rpc.getOwnDevices()
			.then(setInfo, err => setError(`${err}`))
	}, [client])

	return <>
		<section className="settings-section encryption-devices">
			<header>
				<DevicesIcon/>
				<h3>Your devices</h3>
			</header>
			{error
				? <p className="section-note error">Couldn't load your devices: {error}</p>
				: info === null ? <DevicesSkeleton /> : <DevicesInfo info={info} />}
		</section>
		<KeyExportView room={room} />
	</>
}

export default EncryptionSettings
