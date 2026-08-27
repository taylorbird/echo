# Tauri ACL: App Commands and Remote Origins

## The Remote Origin Rule

**Tauri treats `http://` URLs (including `http://localhost`) as REMOTE origins.**

When a window loads a remote origin, every app-defined command (`#[tauri::command]`) is **ACL-checked** and **denied by default** unless a capability explicitly names it. Local origins (like `tauri://localhost`) bypass this check entirely.

This distinction cost us three bugs in production (0.3.0–0.3.5):
- `restart_for_update` — the auto-update "Restart" button did nothing in prod (worked in dev)
- `fetch_og_tags` — URL previews in the click-tier webview were dead in prod (worked in dev)
- External links opened via `plugin:shell|open` — silent `ForbiddenUrl` error swallowed to console

All three were **silent failures** — no error toast, no log, just nothing happening. They only showed up because a user tested the app.

## Declaring Commands: build.rs AppManifest

For a command to be accessible from the webview, it must be declared in `build.rs` via `tauri_build::AppManifest`:

```rust
let app_manifest = tauri_build::AppManifest::new()
    .commands(&[
        "restart_for_update",
        "fetch_og_tags",
    ]);

// Write to generated file (used by tauri CLI)
app_manifest.build();
```

This generates **allow-<kebab-command>** identifiers:
- `restart_for_update` → `allow-restart-for-update`
- `fetch_og_tags` → `allow-fetch-og-tags`

These identifiers are used in capabilities/default.json to grant the commands.

## Granting Commands: capabilities/default.json

The `remote` block must explicitly list the commands that remote origins are allowed to call:

```json
{
  "capabilities": [
    {
      "remote": {
        "urls": ["http://localhost:29325"],
        "allow": [
          "allow-restart-for-update",
          "allow-fetch-og-tags",
          "opener:allow-open-url",
          "updater:default"
        ]
      }
    }
  ]
}
```

**The `remote.urls` entry itself is mandatory.** Without it, ALL IPC to remote origins is silently denied — even if the commands are listed in `allow`. This is a Tauri safety net: a window loading an unexpected origin (typo, misconfiguration) won't accidentally grant IPC.

## The Breaking Change: Local Origins Also Get Checked

**Declaring an app manifest in build.rs makes ALL app commands ACL-checked, including in dev.**

Before: app commands in dev had no ACL (local origin exemption).
After: app commands in dev require capability entries, just like prod.

This is actually a win for debugging — a command that fails in dev fails the same way in prod, so you catch ACL mistakes early. But it means:

**Any new `#[tauri::command]` must be added to BOTH build.rs and capabilities/default.json or it breaks in BOTH dev and prod.**

## Plugin Permissions: Split Command vs. Scope

Some plugins split their permissions into multiple parts:

### opener (URL opening)
- `opener:allow-open-url` — grants the **command** itself
- `opener:allow-default-urls` — grants the **URL scope** (http:/*, https:/*, mailto:*, tel:*)

Without the scope, calls fail silently with `ForbiddenUrl` error. Both must be in capabilities/default.json.

### shell (process spawning)
- `shell:allow-spawn` — grants spawning a child process
- `shell:allow-kill` — grants killing a process

Declared the same way in capabilities. Note: the sidecar is spawned from Rust code, not IPC, so shell permissions don't apply to sidecar spawning — they only gate IPC calls from the webview.

## Debugging Remote-Origin Denials

Silent failures in prod are the symptom. Diagnose via:

1. Check browser console for `ForbiddenUrl` or other error messages (likely swallowed).
2. Verify the command is listed in capabilities/default.json `remote.allow`.
3. Verify the `remote.urls` block exists and matches the origin (including protocol and port).
4. Check build.rs — is the command listed in `AppManifest::new().commands(&[...])`?
5. Run a test rebuild to regenerate capabilities: `cargo build` (in src-tauri) or `npx tauri build`.

## How It Works: Source Code Reference

The check happens in `tauri webview/mod.rs:1819` (tauri 2.x):

```rust
// Pseudo-code from the actual source
if is_remote_origin(window.url()) && !capability_allows(command) {
    return Err(ForbiddenUrl);
}
```

A window is considered remote if its origin is not `tauri://localhost`, `tauri://*`, or the value of `scheme_allowlist` in tauri.conf.json.

## Consequences for echo

- Production window loads `http://localhost:29325` (same-origin with the sidecar, not static dist).
- This origin is remote, so all commands are ACL-checked.
- `remote.urls` entry and command declarations are not optional; they're the difference between working and silently-failing-forever.
- Any new feature that uses a `#[tauri::command]` must update both build.rs and capabilities/default.json.
