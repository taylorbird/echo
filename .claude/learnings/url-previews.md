# URL Previews

## Architecture (as built, 2026-08-06)
Received-message previews are three-tiered in `web/src/ui/urlpreview/FetchedURLPreview.tsx`:
1. Embedded previews in the event (`m.url_previews` / `com.beeper.linkpreviews`) render directly.
2. Otherwise the homeserver's `/preview_url` API is called via `_gomuks/url_preview` — automatic for messages <48h old (`AUTO_LOAD_PREVIEW_MAX_AGE` in `TimelineEvent.tsx`), click-to-load chip for older.
3. If the homeserver fails, the chip triggers `fetch_og_tags` (Tauri command in `web/src-tauri/src/lib.rs`): a hidden WebKit window loads the page and harvests OG tags from the live DOM. Deliberately click-only — auto mode would execute arbitrary posted URLs' JS on the local machine.

Encrypted rooms never auto-load unless the `auto_load_encrypted_url_previews` preference is on (fetching leaks URLs to the homeserver).

## Gotchas discovered
- **gomuks/Beeper senders embed `"com.beeper.linkpreviews": []` (empty array) on plain messages.** Truthiness checks on the previews field wrongly take the "sender embedded previews" branch and render nothing — must check `.length`.
- **Cloudflare-guarded sites (printables.com) block preview scrapes by TLS fingerprint, not just IP/UA.** curl and Node fetch get 403 even with browser UA from a residential IP; the DigitalOcean-hosted homeserver gets blocked too (Synapse surfaces it as `M_NOT_FOUND`). Blocking is intermittent — a preview can exist in Synapse's ~1h cache from a lucky scrape, then vanish. Only a real browser engine passes reliably, hence the hidden-webview tier.
- **wry/Tauri does NOT sync `document.title` to the native window title**, so polling `WebviewWindow::title()` can't be used as a JS→Rust channel. The collector script publishes via `location.hash` (`__OGRESULT__=` + percent-encoded JSON) and Rust polls `webview.url()` instead.
- **macOS may throttle JS timers in invisible windows.** The collector's setInterval worked fine hidden in testing, but if `fetch_og_tags` starts timing out, make the fetch window visible-but-offscreen.
- `og:image` from the webview tier is a direct https URL, not mxc — `URLPreview.tsx` branches on the `mxc://` prefix.
