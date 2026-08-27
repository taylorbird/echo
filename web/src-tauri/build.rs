// The production window loads the sidecar origin (http://localhost:29325), which tauri's ACL
// treats as a *remote* origin. Remote origins have every app-defined command denied unless a
// capability explicitly grants it — see the check in tauri's webview/mod.rs:
//
//   "Check ACL on plugin commands, when the app defined its ACL manifest, or when the request
//    comes from a non-local (remote) origin. This ensures remote content can never reach custom
//    commands unless an explicit `remote` capability has been configured for them."
//
// That is why restart_for_update and fetch_og_tags silently did nothing in release builds while
// working fine in dev, where devUrl is a local origin: the invoke was rejected before reaching
// Rust and the frontend's .catch() logged it to a console nobody was reading.
//
// Declaring the commands here generates allow-/deny- permissions (allow-restart-for-update,
// allow-fetch-og-tags) for capabilities/default.json to reference.
//
// Careful: declaring an app manifest makes ALL app commands ACL-checked, local origins included.
// Any command added later must be listed here AND granted in the capability, or it will stop
// working in dev too — where this class of bug is invisible.
fn main() {
  tauri_build::try_build(
    tauri_build::Attributes::new().app_manifest(
      tauri_build::AppManifest::new().commands(&["fetch_og_tags", "restart_for_update"]),
    ),
  )
  .expect("failed to run tauri-build");
}
