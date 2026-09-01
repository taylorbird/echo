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
import type { ContentURI, RoomType } from "../../types"
import { Preference, anyContext, anyGlobalContext, globalDeviceSpecific, roomSpecific } from "./types.ts"

export const codeBlockStyles = [
	"auto", "abap", "algol_nu", "algol", "arduino", "autumn", "average", "base16-snazzy", "borland", "bw",
	"catppuccin-frappe", "catppuccin-latte", "catppuccin-macchiato", "catppuccin-mocha", "colorful", "doom-one2",
	"doom-one", "dracula", "emacs", "friendly", "fruity", "github-dark", "github", "gruvbox-light", "gruvbox",
	"hrdark", "hr_high_contrast", "igor", "lovelace", "manni", "modus-operandi", "modus-vivendi", "monokailight",
	"monokai", "murphy", "native", "nord", "onedark", "onesenterprise", "paraiso-dark", "paraiso-light", "pastie",
	"perldoc", "pygments", "rainbow_dash", "rose-pine-dawn", "rose-pine-moon", "rose-pine", "rrt", "solarized-dark256",
	"solarized-dark", "solarized-light", "swapoff", "tango", "tokyonight-day", "tokyonight-moon", "tokyonight-night",
	"tokyonight-storm", "trac", "vim", "vs", "vulcan", "witchhazel", "xcode-dark", "xcode",
] as const
export const mapProviders = ["leaflet", "google", "none"] as const
export const gifProviders = ["giphy", "tenor"] as const

export type CodeBlockStyle = typeof codeBlockStyles[number]
export type MapProvider = typeof mapProviders[number]
export type GIFProvider = typeof gifProviders[number]

/*
 * Two things are declared per preference beyond its value:
 *
 * `category` decides which group it lands in in the settings list. Definitions stay
 * in their original order here; the settings view does the grouping, so the order
 * on screen is the category order, not this one.
 *
 * `allowedContexts` decides which of the four scopes the settings matrix offers.
 * The test applied is "would a reasonable person plausibly want this set differently
 * in one specific room?" — app-wide chrome (themes, fonts, the favicon, the room
 * list) says no and is global-only, while everything about how one room reads
 * (previews, receipts, hidden events, emoji packs) keeps its room scopes.
 */
/* eslint-disable max-len */
export const preferences = {
	send_read_receipts: new Preference<boolean>({
		displayName: "Send read receipts",
		description: "Should read receipts be sent to other users? If disabled, read receipts will use the `m.read.private` type, which only syncs to your own devices.",
		category: "chat",
		allowedContexts: anyContext,
		defaultValue: true,
	}),
	send_typing_notifications: new Preference<boolean>({
		displayName: "Send typing notifications",
		description: "Should typing notifications be sent to other users?",
		category: "chat",
		allowedContexts: anyContext,
		defaultValue: true,
	}),
	send_bundled_url_previews: new Preference<boolean>({
		displayName: "Send bundled URL previews",
		description: "Should the composer offer fetching URL previews to bundle in outgoing messages?",
		category: "media",
		allowedContexts: anyContext,
		defaultValue: true,
	}),
	display_read_receipts: new Preference<boolean>({
		displayName: "Display read receipts",
		description: "Should read receipts be rendered in the timeline?",
		category: "chat",
		allowedContexts: anyContext,
		defaultValue: true,
	}),
	show_media_previews: new Preference<boolean>({
		displayName: "Show image and video previews",
		description: "If disabled, images and videos will only be visible after clicking and will not be downloaded automatically. This will also disable images in URL previews.",
		category: "media",
		allowedContexts: anyContext,
		defaultValue: true,
	}),
	show_inline_images: new Preference<boolean>({
		displayName: "Show inline images",
		description: "If disabled, custom emojis and other inline images will not be rendered and the alt attribute will be shown instead.",
		category: "media",
		allowedContexts: anyContext,
		defaultValue: true,
	}),
	show_invite_avatars: new Preference<boolean>({
		displayName: "Show avatars in invites",
		description: "If disabled, the avatar of the room or inviter will not be shown in the invite view.",
		category: "chat",
		allowedContexts: anyGlobalContext,
		defaultValue: false,
	}),
	code_block_line_wrap: new Preference<boolean>({
		displayName: "Code block line wrap",
		// Global-only for the same reason as the theme below: code blocks are styled once
		// for the whole client, and splitting the two would put a theme picker with no
		// room column next to a wrap toggle with one.
		description: "Whether to wrap long lines in code blocks instead of scrolling horizontally.",
		category: "appearance",
		allowedContexts: anyGlobalContext,
		defaultValue: false,
	}),
	code_block_theme: new Preference<CodeBlockStyle>({
		displayName: "Code block theme",
		description: "The syntax highlighting theme to use for code blocks.",
		category: "appearance",
		allowedContexts: anyGlobalContext,
		defaultValue: "auto",
		allowedValues: codeBlockStyles,
	}),
	pointer_cursor: new Preference<boolean>({
		displayName: "Use pointer cursor",
		// Per-device makes sense (mouse vs touch); per-room does not — the cursor does not
		// stop at the timeline's edge.
		description: "Whether to use a pointer cursor for clickable elements.",
		category: "appearance",
		allowedContexts: anyGlobalContext,
		defaultValue: false,
	}),
	ignore_reduce_motion: new Preference<boolean>({
		displayName: "Ignore reduce motion",
		description: "Whether to play animations even when the system asks for reduced motion. Device-specific, since the system setting it overrides is itself per-device.",
		category: "appearance",
		allowedContexts: globalDeviceSpecific,
		defaultValue: false,
	}),
	uniform_room_list_color: new Preference<boolean>({
		displayName: "Uniform room list color",
		// The room list is one list. A per-room override would only ever have recolored the
		// room you happened to have open.
		description: "Color every room name in the sidebar the same accent color instead of giving each room its own color.",
		category: "appearance",
		allowedContexts: anyGlobalContext,
		// On by default: thirty differently-coloured names spends a lot of signal on
		// something that carries no meaning, and it competes with the unread markers —
		// the one thing in that list colour should be saying.
		defaultValue: true,
	}),
	room_list_color: new Preference<string>({
		displayName: "Room list color",
		description: "The accent color for room names in the sidebar, when they all share one color.",
		category: "appearance",
		allowedContexts: anyGlobalContext,
		// Ferra's peach, which is what uniform mode was hardcoded to before this
		// preference existed — so nothing looks different until it is changed.
		defaultValue: "#fecdb2",
	}),
	custom_css: new Preference<string>({
		displayName: "Custom CSS",
		description: "Arbitrary custom CSS to apply to the client.",
		category: "appearance",
		allowedContexts: anyGlobalContext,
		defaultValue: "",
	}),
	show_hidden_events: new Preference<boolean>({
		displayName: "Show hidden events",
		description: "Whether hidden events should be visible in the room timeline.",
		category: "chat",
		allowedContexts: anyContext,
		defaultValue: false,
	}),
	show_redacted_events: new Preference<boolean>({
		displayName: "Show redacted event placeholders",
		description: "Whether redacted events should leave a placeholder behind in the room timeline.",
		category: "chat",
		allowedContexts: anyContext,
		defaultValue: true,
	}),
	show_membership_events: new Preference<boolean>({
		displayName: "Show membership events",
		description: "Whether any membership events should be visible in the room timeline.",
		category: "chat",
		allowedContexts: anyContext,
		defaultValue: true,
	}),
	show_profile_changes: new Preference<boolean>({
		displayName: "Show profile change events",
		description: "Whether profile changes should be visible in the room timeline.",
		category: "chat",
		allowedContexts: anyContext,
		defaultValue: true,
	}),
	render_url_previews: new Preference<boolean>({
		displayName: "Render URL previews",
		description: "Whether to render MSC4095 URL previews in the room timeline.",
		category: "media",
		allowedContexts: anyContext,
		defaultValue: true,
	}),
	auto_load_encrypted_url_previews: new Preference<boolean>({
		displayName: "Auto-load URL previews in encrypted rooms",
		description: "Whether to automatically fetch previews for links in recent messages in encrypted rooms."
			+ " Fetching a preview reveals the URL to your homeserver."
			+ " When disabled, encrypted rooms show a click-to-load button instead.",
		category: "media",
		allowedContexts: anyContext,
		defaultValue: false,
	}),
	small_replies: new Preference<boolean>({
		displayName: "Compact reply style",
		// A reading style you pick once, not something you'd want to change as you move
		// between rooms.
		description: "Whether to use a Discord-like compact style for replies instead of the traditional style.",
		category: "chat",
		allowedContexts: anyGlobalContext,
		defaultValue: false,
	}),
	small_threads: new Preference<boolean>({
		displayName: "Compact thread messages",
		// Kept room-scoped, unlike the reply style: how much room threads deserve in the
		// main timeline genuinely differs between a thread-heavy room and everywhere else.
		description: "Whether thread messages should only be shown as a single line in the main timeline.",
		category: "chat",
		allowedContexts: anyContext,
		defaultValue: true,
	}),
	show_date_separators: new Preference<boolean>({
		displayName: "Show date separators",
		description: "Whether messages in different days should have a date separator between them in the room timeline.",
		category: "chat",
		allowedContexts: anyGlobalContext,
		defaultValue: true,
	}),
	show_room_emoji_packs: new Preference<boolean>({
		displayName: "Show room emoji packs",
		// Room-scoped is the whole point: the packs come from a specific room.
		description: "Whether to show custom emoji packs provided by the room. If disabled, only your personal packs are shown in all rooms.",
		category: "input",
		allowedContexts: anyContext,
		defaultValue: true,
	}),
	upload_dialog: new Preference<boolean>({
		displayName: "Show upload dialog",
		description: "Whether to show the dialog that allows adjusting the media before upload (re-encoding, resizing, etc)",
		category: "media",
		allowedContexts: anyGlobalContext,
		defaultValue: true,
	}),
	map_provider: new Preference<MapProvider>({
		displayName: "Map provider",
		description: "The map provider to use for location messages.",
		category: "media",
		allowedValues: mapProviders,
		allowedContexts: anyGlobalContext,
		defaultValue: "leaflet",
	}),
	leaflet_tile_template: new Preference<string>({
		displayName: "Leaflet tile URL template",
		description: "When using Leaflet for maps, the URL template for map tile images.",
		category: "media",
		allowedContexts: anyGlobalContext,
		defaultValue: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
	}),
	element_call_base_url: new Preference<string>({
		displayName: "Element call base URL",
		// Kept room-scoped: a room run by an org that hosts its own Element Call
		// deployment is a real case, even if a rare one.
		description: "The widget base URL for Element calls.",
		category: "advanced",
		allowedContexts: anyContext,
		defaultValue: "",
	}),
	gif_provider: new Preference<GIFProvider>({
		displayName: "GIF provider",
		description: "The service to use to search for GIFs",
		category: "media",
		allowedValues: gifProviders,
		allowedContexts: anyGlobalContext,
		defaultValue: "giphy",
	}),
	// TODO implement
	// reupload_gifs: new Preference<boolean>({
	// 	displayName: "Reupload GIFs",
	// 	description: "Should GIFs be reuploaded to your server's media repo instead of using the proxy?",
	// 	category: "media",
	// 	allowedContexts: anyContext,
	// 	defaultValue: false,
	// }),
	message_context_menu: new Preference<boolean>({
		displayName: "Right-click menu on messages",
		description: "Show a context menu when right-clicking on messages.",
		category: "input",
		allowedContexts: anyGlobalContext,
		defaultValue: true,
	}),
	ctrl_enter_send: new Preference<boolean>({
		displayName: "Use Ctrl+Enter to send",
		// Keybinds are muscle memory. One that changed depending on which room was open
		// would be worse than either setting.
		description: "Disable sending on enter and use Ctrl+Enter for sending instead",
		category: "input",
		allowedContexts: anyGlobalContext,
		defaultValue: false,
	}),
	ctrl_arrow_reply: new Preference<boolean>({
		displayName: "Use Ctrl+Arrow to reply",
		description: "Should Ctrl+Arrow Up/Down change the message you're replying to?",
		category: "input",
		allowedContexts: anyGlobalContext,
		defaultValue: true,
	}),
	custom_notification_sound: new Preference<ContentURI>({
		displayName: "Custom notification sound",
		// Room-scoped stays: a distinct sound for one room is the main reason to set this.
		description: "The mxc:// URI to a custom notification sound.",
		category: "notifications",
		allowedContexts: anyContext,
		defaultValue: "",
	}),
	room_window_title: new Preference<string>({
		displayName: "In-room window title",
		description: "The title to use for the window when viewing a room. $room will be replaced with the room name",
		category: "advanced",
		allowedContexts: anyContext,
		defaultValue: "$room - gomuks web",
	}),
	window_title: new Preference<string>({
		displayName: "Default window title",
		description: "The title to use for the window when not in a room.",
		category: "advanced",
		allowedContexts: anyGlobalContext,
		defaultValue: "gomuks web",
	}),
	favicon: new Preference<string>({
		displayName: "Favicon",
		description: "The URL to use for the favicon.",
		category: "appearance",
		allowedContexts: anyGlobalContext,
		defaultValue: "gomuks.png",
	}),
	room_view_type: new Preference<RoomType | null>({
		displayName: "Room type override",
		description: "Use a specific view for this room instead of the default based on its type.",
		category: "advanced",
		allowedValues: [null, "", "m.space", "org.matrix.msc3417.call", "fi.mau.msc2545.image_pack"] as const,
		valueLabels: ["None", "Timeline", "Space view", "Element Call", "Image pack editor"] as const,
		allowedContexts: roomSpecific,
		defaultValue: null,
	}),
	low_bandwidth: new Preference<boolean>({
		displayName: "Low bandwidth mode",
		description: "Whether to enable bandwidth saving features. Refresh to apply changes.",
		category: "advanced",
		allowedContexts: globalDeviceSpecific,
		defaultValue: false,
		hidden: window.gomuksDesktop || window.gomuksWebWasm,
	}),
	web_push: new Preference<boolean>({
		displayName: "Web push notifications",
		description: "Whether to enable web push for background notifications. Refresh to apply changes.",
		category: "notifications",
		allowedContexts: globalDeviceSpecific,
		defaultValue: false,
		hidden: window.gomuksAndroid || window.gomuksDesktop || window.gomuksWebWasm,
	}),
} as const

export const existingPreferenceKeys = new Set(Object.keys(preferences))

export type Preferences = {
	-readonly [name in keyof typeof preferences]?: typeof preferences[name]["defaultValue"]
}

export function isValidPreferenceKey(key: unknown): key is keyof Preferences {
	return typeof key === "string" && existingPreferenceKeys.has(key)
}
