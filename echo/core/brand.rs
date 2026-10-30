// echo: the name the core gives servers for this app. Included from
// crates/sable-core/src/lib.rs with a `#[path]` line; Sable's sign-in,
// registration, pusher and media code use it in place of its own "Sable".
//
// Servers show it to people: the OAuth consent page and session lists
// ("echo on macOS"), the new device's name, the push registration's fallback
// name, and the User-Agent avatar hosts see. The core can't tell an echo build
// from plain Sable, so an unbranded `mise run tauri dev` says "echo" here too.

pub(crate) const APP_NAME: &str = "echo";
