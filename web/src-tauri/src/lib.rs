use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::{ShellExt, process::CommandChild};

struct BackendProcess(Mutex<Option<CommandChild>>);

// Where the sidecar keeps its config, database, cache and logs.
//
// Left alone it picks these itself from platform convention, keyed on the name "gomuks"
// (pkg/gomuks/gomuks.go). That costs us twice. The directories are named after the upstream
// project rather than this app, so they collide with a real gomuks install and outlive an
// uninstall of echo. And a `tauri dev` run shares both the SQLite database and port 29325 with
// the installed app, so debugging contends with the live session on the same data.
//
// Passing GOMUKS_*_HOME pins all four to app-owned paths and gives debug builds a profile of
// their own. It needs no change to the Go code, which keeps this fork's divergence from
// upstream at nothing.
struct GomuksDirs {
  config: PathBuf,
  data: PathBuf,
  cache: PathBuf,
  logs: PathBuf,
}

// What the sidecar called a directory before it was app-owned. Go used <platform base>/gomuks
// and tauri resolves <platform base>/<bundle identifier>, so the old name is always a sibling.
fn legacy_sibling(app_owned: &Path) -> PathBuf {
  app_owned
    .parent()
    .map(|base| base.join("gomuks"))
    .unwrap_or_else(|| PathBuf::from("gomuks"))
}

// Debug builds get their own profile, so `tauri dev` can never touch the installed app's data.
fn per_profile(app_owned: PathBuf) -> PathBuf {
  if !cfg!(debug_assertions) {
    return app_owned;
  }
  match app_owned.file_name().and_then(|name| name.to_str()) {
    Some(name) => app_owned.with_file_name(format!("{name}-dev")),
    None => app_owned,
  }
}

// Moves a pre-rename directory to its app-owned name, once, on the first launch that finds one.
//
// A rename within the same parent is atomic, so this cannot half-migrate and leave the database
// split across two locations. If it fails anyway, carry on using the old directory rather than
// starting empty: an update that appears to have logged the user out is far worse than one that
// quietly postpones a tidy-up. Debug builds never migrate — a dev profile starts clean by design.
fn adopt_or_migrate(app_owned: PathBuf) -> PathBuf {
  if cfg!(debug_assertions) || app_owned.exists() {
    return app_owned;
  }
  let legacy = legacy_sibling(&app_owned);
  if !legacy.is_dir() {
    return app_owned;
  }
  match std::fs::rename(&legacy, &app_owned) {
    Ok(()) => {
      log::info!("migrated {} -> {}", legacy.display(), app_owned.display());
      app_owned
    }
    Err(err) => {
      log::error!(
        "failed to migrate {} -> {} ({err}); continuing to use the old location",
        legacy.display(),
        app_owned.display()
      );
      legacy
    }
  }
}

// --- Backend authentication -------------------------------------------------------------
//
// gomuks gates its HTTP API on a username and password, and the first time it runs without them
// it asks on stdin (pkg/gomuks/config.go, PromptInput -> readline). A tauri sidecar is given
// pipes, not a terminal, so on any machine with no pre-existing gomuks config that prompt fails
// with EOF and the backend exits 9 before it ever binds its port. Verified 2026-08-27: the app is
// unusable for anyone who has not previously run gomuks by hand in a shell.
//
// So we write the credentials ourselves, and then never ask anyone for them. The password is
// random and thrown away on the spot: nothing can log in with it, and nothing needs to, because
// the app mints its own session token the same way the server does and hands it to the webview.
//
// To switch this off and let the backend accept everything unauthenticated, set
//   disable_auth_because_i_want_my_account_to_be_hacked: true
// under `web:` in config.yaml. That name is upstream's, and the warning in it is fair: the
// backend listens on 127.0.0.1:29325, so anything else running on the machine — another user
// account, a page served from another localhost port — could then drive the already-logged-in
// Matrix session and export the room keys via POST /_gomuks/keys/export.
const BACKEND_USERNAME: &str = "echo";

// Written only when there is no config at all. An existing config is never rewritten: it is the
// user's file, it holds their token key and log configuration, and a partial rewrite that lost
// any of that would be far worse than the prompt we are avoiding.
fn ensure_backend_config(config_dir: &Path) -> std::io::Result<()> {
  let config_path = config_dir.join("config.yaml");
  if config_path.exists() {
    return Ok(());
  }
  std::fs::create_dir_all(config_dir)?;

  use rand::Rng;
  let password: String = rand::rng()
    .sample_iter(rand::distr::Alphanumeric)
    .take(48)
    .map(char::from)
    .collect();
  // Cost 12 to match what gomuks itself uses when it prompts.
  let hash = bcrypt::hash(&password, 12)
    .map_err(|err| std::io::Error::other(format!("failed to hash backend password: {err}")))?;
  // `password` is dropped here and never stored. The token below is how we authenticate.

  // Deliberately minimal: gomuks fills in every other default on first load (including the
  // token_key we sign with) and writes the complete file back out itself.
  let config = format!(
    "web:\n    username: {BACKEND_USERNAME}\n    password_hash: {hash}\n    insecure_cookies: true\n"
  );
  std::fs::write(&config_path, config)?;
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(&config_path, std::fs::Permissions::from_mode(0o600))?;
  }
  log::info!("wrote a fresh backend config to {}", config_path.display());
  Ok(())
}

// Pulls one scalar out of the `web:` block of gomuks' config.yaml.
//
// Hand-rolled rather than pulling in a YAML parser for two string lookups. The file is written by
// gomuks itself (yaml.v3, block style, consistent indentation), so this stays deliberately strict
// and simply gives up on anything it does not recognise — a miss costs a login prompt, not a
// failure, so being conservative is the right trade.
fn read_web_config_value(config: &str, key: &str) -> Option<String> {
  let mut in_web = false;
  for line in config.lines() {
    if !line.starts_with([' ', '\t']) {
      // A new top-level key ends the web block.
      in_web = line.trim_end().starts_with("web:");
      continue;
    }
    if !in_web {
      continue;
    }
    let trimmed = line.trim();
    if let Some(value) = trimmed.strip_prefix(key).and_then(|r| r.strip_prefix(':')) {
      let value = value.trim().trim_matches(['"', '\'']);
      if !value.is_empty() {
        return Some(value.to_string());
      }
    }
  }
  None
}

// Mints a session token the backend will accept, mirroring signToken in pkg/gomuks/server.go:
// base64url(compact JSON of {username, expiry}) + "." + base64url(HMAC-SHA256 of that JSON).
//
// The JSON has to match Go's encoding/json byte for byte or the HMAC will not agree: compact, no
// spaces, fields in struct order, and image_only omitted while false (it is `omitempty`).
//
// This reads the config only after the backend has started, because on a fresh install gomuks
// generates token_key on its first load and writes it back — it does not exist before then.
fn sign_backend_token(username: &str, token_key: &str, expiry_secs: u64) -> Option<String> {
  use base64::Engine;
  use hmac::{Hmac, Mac};

  // Built by hand rather than via a serde struct so the byte layout is visible at the point it
  // has to be right: compact, fields in the order Go declares them, and image_only left out
  // entirely because it is `omitempty` and false here.
  let payload = format!(
    "{{\"username\":{},\"expiry\":{expiry_secs}}}",
    serde_json::to_string(username).ok()?
  );

  let mut mac = Hmac::<sha2::Sha256>::new_from_slice(token_key.as_bytes()).ok()?;
  mac.update(payload.as_bytes());
  let engine = base64::engine::general_purpose::URL_SAFE_NO_PAD;
  Some(format!(
    "{}.{}",
    engine.encode(payload.as_bytes()),
    engine.encode(mac.finalize().into_bytes())
  ))
}

fn mint_backend_token(config_dir: &Path) -> Option<String> {
  let config = std::fs::read_to_string(config_dir.join("config.yaml")).ok()?;
  let username = read_web_config_value(&config, "username")?;
  let token_key = read_web_config_value(&config, "token_key")?;
  // The server issues seven days; a day is plenty when every launch mints a fresh one.
  let expiry = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).ok()?.as_secs()
    + 24 * 60 * 60;
  sign_backend_token(&username, &token_key, expiry)
}

// Runs in the page before any of its own scripts do, so the very first request the frontend makes
// is already authenticated and the login form never appears. The document is served from the
// backend origin, so this cookie is same-origin with the API it authenticates.
//
// The server's own cookie is HttpOnly and this one cannot be; that costs nothing here, because
// script that could read it is already running inside the authenticated session.
fn auth_cookie_script(token: &str) -> String {
  format!(
    "try {{ document.cookie = 'gomuks_auth=' + {} + '; path=/; SameSite=Lax; max-age=86400' }} \
     catch (e) {{ console.warn('failed to seed auth cookie', e) }}",
    serde_json::to_string(token).unwrap_or_else(|_| "''".to_string())
  )
}

fn gomuks_dirs(app: &tauri::AppHandle) -> tauri::Result<GomuksDirs> {
  let path = app.path();
  let config = adopt_or_migrate(per_profile(path.app_config_dir()?));
  // On macOS the sidecar deliberately keeps data in the config directory (gomuks.go sets
  // DataDir = ConfigDir for darwin), so resolving the two separately here would split
  // config.yaml from gomuks.db across two folders.
  let data = if cfg!(target_os = "macos") {
    config.clone()
  } else {
    adopt_or_migrate(per_profile(path.app_data_dir()?))
  };
  Ok(GomuksDirs {
    config,
    data,
    cache: adopt_or_migrate(per_profile(path.app_cache_dir()?)),
    logs: adopt_or_migrate(per_profile(path.app_log_dir()?)),
  })
}

// Where the sidecar listens. Production loads the window from here rather than from the
// bundled dist: the Go server embeds and serves the very same frontend, so the document
// ends up same-origin with the API. That's what makes the gomuks_auth cookie (SameSite=Lax)
// and the CORS-free /_gomuks endpoints usable at all, and it's also where the server
// injects the frontend etag meta tag.
const BACKEND_ORIGIN: &str = "http://localhost:29325";
const BACKEND_ADDR: &str = "127.0.0.1:29325";
const BACKEND_STARTUP_TIMEOUT: Duration = Duration::from_secs(15);

// The sidecar takes a moment to bind its port. Opening the window before then used to fail
// as ECONNREFUSED on /_gomuks/auth, which the frontend reported as an auth failure.
// Any accepted TCP connection means the HTTP server is listening.
fn wait_for_backend(timeout: Duration) -> bool {
  let addr: SocketAddr = BACKEND_ADDR.parse().expect("invalid backend address");
  let deadline = Instant::now() + timeout;
  loop {
    if TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok() {
      return true;
    }
    if Instant::now() >= deadline {
      return false;
    }
    std::thread::sleep(Duration::from_millis(100));
  }
}

static OG_FETCH_COUNTER: AtomicU64 = AtomicU64::new(0);

// Runs inside the hidden preview webview on every navigation (including Cloudflare
// interstitials). Publishes collected meta tags through the URL fragment, since
// document.title changes don't propagate to the native window title in wry.
const OG_COLLECTOR_SCRIPT: &str = r#"
(function() {
  if (window.__ogCollectorInstalled) return;
  window.__ogCollectorInstalled = true;
  function collect() {
    const tags = {};
    for (const el of document.querySelectorAll("meta[property], meta[name]")) {
      const key = el.getAttribute("property") || el.getAttribute("name");
      const content = el.getAttribute("content");
      if (key && content && !(key in tags)
          && (key.startsWith("og:") || key.startsWith("twitter:") || key === "description")) {
        tags[key] = content;
      }
    }
    return tags;
  }
  let attempts = 0;
  const timer = setInterval(function() {
    attempts++;
    const tags = collect();
    // Interstitial/challenge pages have no og tags; keep polling until the real page renders
    if (tags["og:title"] || tags["og:image"] || attempts > 30) {
      if (!tags["og:title"] && document.title && !/just a moment|attention required/i.test(document.title)) {
        tags["og:title"] = document.title;
      }
      tags["__final_url"] = window.location.href;
      clearInterval(timer);
      try {
        window.location.hash = "__OGRESULT__=" + encodeURIComponent(JSON.stringify(tags));
      } catch (e) {}
    }
  }, 500);
})();
"#;

// Fetches OpenGraph tags by loading the page in a hidden webview. Unlike a plain HTTP
// client, the real WebKit engine passes Cloudflare's TLS/JS fingerprinting, which is
// the whole reason this exists: the homeserver's scraper is blocked by such sites.
#[tauri::command]
async fn fetch_og_tags(app: tauri::AppHandle, url: String) -> Result<serde_json::Value, String> {
  let parsed: tauri::Url = url.parse().map_err(|e| format!("invalid url: {e}"))?;
  match parsed.scheme() {
    "http" | "https" => {}
    _ => return Err("only http(s) URLs are supported".into()),
  }
  let label = format!("og-fetch-{}", OG_FETCH_COUNTER.fetch_add(1, Ordering::Relaxed));
  let webview = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed))
    .title("Loading preview")
    .visible(false)
    .focused(false)
    .initialization_script(OG_COLLECTOR_SCRIPT)
    .build()
    .map_err(|e| format!("failed to create preview webview: {e}"))?;
  let poll_target = webview.clone();
  let result = tauri::async_runtime::spawn_blocking(move || {
    for _ in 0..80 {
      std::thread::sleep(Duration::from_millis(300));
      let Ok(current) = poll_target.url() else { continue };
      let Some(fragment) = current.fragment() else { continue };
      let Some(encoded) = fragment.strip_prefix("__OGRESULT__=") else { continue };
      let decoded = percent_encoding::percent_decode_str(encoded).decode_utf8_lossy();
      return serde_json::from_str::<serde_json::Value>(&decoded)
        .map_err(|e| format!("failed to parse og tags: {e}"));
    }
    Err("timed out waiting for page metadata".to_string())
  })
  .await
  .map_err(|e| e.to_string())?;
  let _ = webview.close();
  result
}

// Relaunches the app after the updater has staged a new bundle.
//
// Killing the sidecar first is load-bearing, not cleanup: the Go backend owns port 29325 and
// serves the frontend that's embedded in *its* binary. If the old sidecar outlived the restart,
// wait_for_backend would connect to it immediately and the new window would be handed the OLD
// embedded frontend — the update would appear to do nothing. RunEvent::Exit also kills the child,
// but app.restart() doesn't guarantee that handler runs, so do it explicitly here.
#[tauri::command]
fn restart_for_update(app: tauri::AppHandle, state: tauri::State<BackendProcess>) {
  let child = state.0.lock().unwrap().take();
  if let Some(child) = child {
    log::info!("Stopping gomuks backend before restarting for update");
    let _ = child.kill();
  }
  app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    // Lets the frontend hand external links to the system browser. Without it,
    // target="_blank" links in messages are silently dropped by the webview.
    .plugin(tauri_plugin_opener::init())
    // Self-updates from the GitHub release feed (see plugins.updater in tauri.conf.json).
    // The frontend only ever calls this in release builds; see web/src/util/updater.ts.
    .plugin(tauri_plugin_updater::Builder::new().build())
    .invoke_handler(tauri::generate_handler![fetch_og_tags, restart_for_update])
    .manage(BackendProcess(Mutex::new(None)))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Spawn the gomuks backend as a sidecar, pointed at app-owned storage (see GomuksDirs).
      let dirs = gomuks_dirs(app.handle())?;
      log::info!("gomuks storage: config={} logs={}", dirs.config.display(), dirs.logs.display());
      // Must happen before the spawn: without credentials on disk the backend tries to prompt
      // for them on a stdin it does not have, and exits before binding its port.
      if let Err(err) = ensure_backend_config(&dirs.config) {
        log::error!("failed to write backend config: {err}");
      }
      let sidecar = app
        .shell()
        .sidecar("gomuks")
        .expect("failed to create sidecar")
        .env("GOMUKS_CONFIG_HOME", &dirs.config)
        .env("GOMUKS_DATA_HOME", &dirs.data)
        .env("GOMUKS_CACHE_HOME", &dirs.cache)
        .env("GOMUKS_LOGS_HOME", &dirs.logs);
      let (_rx, child) = sidecar.spawn().expect("failed to spawn gomuks backend");
      log::info!("gomuks backend started");

      // Store the child process so we can kill it on exit
      let state = app.state::<BackendProcess>();
      *state.0.lock().unwrap() = Some(child);

      // windows[0] has "create": false so the window can be built here instead, once the
      // backend is reachable. Cloning the config keeps every window setting (transparent,
      // overlay titlebar, vibrancy effects, size) identical to what tauri.conf.json declares.
      let mut window_config = app
        .config()
        .app
        .windows
        .first()
        .expect("no window configured in tauri.conf.json")
        .clone();

      if cfg!(debug_assertions) {
        // Dev keeps the configured devUrl (the Vite dev server), whose proxy forwards /_gomuks.
        WebviewWindowBuilder::from_config(app.handle(), &window_config)?.build()?;
      } else {
        window_config.url =
          WebviewUrl::External(BACKEND_ORIGIN.parse().expect("invalid backend origin"));
        let handle = app.handle().clone();
        let config_dir = dirs.config.clone();
        std::thread::spawn(move || {
          if !wait_for_backend(BACKEND_STARTUP_TIMEOUT) {
            log::error!("gomuks backend didn't start listening in time, opening window anyway");
          }
          // Only now: on a fresh install the backend generates token_key during its first load
          // and writes it back, so before this point there is nothing to sign with. If anything
          // here fails we simply open the window without a token and the user gets the login
          // form — degraded, not broken.
          let auth_script = mint_backend_token(&config_dir).map(|token| auth_cookie_script(&token));
          if auth_script.is_none() {
            log::warn!("could not mint a backend token; the login form will be shown");
          }
          let builder_handle = handle.clone();
          let _ = handle.run_on_main_thread(move || {
            match WebviewWindowBuilder::from_config(&builder_handle, &window_config) {
              Ok(builder) => {
                let builder = match auth_script {
                  Some(script) => builder.initialization_script(&script),
                  None => builder,
                };
                if let Err(err) = builder.build() {
                  log::error!("failed to create main window: {err}");
                }
              }
              Err(err) => log::error!("failed to read window config: {err}"),
            }
          });
        });
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    if let RunEvent::Exit = event {
      // Kill the backend process when the app exits
      let state = app_handle.state::<BackendProcess>();
      let child = state.0.lock().unwrap().take();
      if let Some(child) = child {
        log::info!("Stopping gomuks backend");
        let _ = child.kill();
      }
    }
  });
}

#[cfg(test)]
mod tests {
  use super::*;

  // Pinned against an independent implementation of the same construction. If gomuks ever
  // changes tokenData or signToken (pkg/gomuks/server.go), this is what will notice: the
  // symptom in the app is only that the login form reappears, which is easy to misread.
  #[test]
  fn signs_a_token_the_backend_would_accept() {
    assert_eq!(
      sign_backend_token("echo", "testkey", 1700000000).unwrap(),
      "eyJ1c2VybmFtZSI6ImVjaG8iLCJleHBpcnkiOjE3MDAwMDAwMDB9.\
       VpAAUBvK9dGQ36GZxWfzCzrkxy99gOymvtTV-SnEAj4"
    );
  }

  #[test]
  fn reads_scalars_from_the_web_block_only() {
    let config = "\
web:\n    username: tbird\n    token_key: secret123\nmatrix:\n    username: not-this-one\n";
    assert_eq!(read_web_config_value(config, "username").as_deref(), Some("tbird"));
    assert_eq!(read_web_config_value(config, "token_key").as_deref(), Some("secret123"));
    assert_eq!(read_web_config_value(config, "listen_address"), None);
  }

  #[test]
  fn ignores_a_blank_or_missing_token_key() {
    assert_eq!(read_web_config_value("web:\n    token_key:\n", "token_key"), None);
    assert_eq!(read_web_config_value("web:\n    username: x\n", "token_key"), None);
  }

  // The whole point is that both fields end up non-empty, because that is exactly the condition
  // gomuks checks before it decides to prompt on a stdin the sidecar does not have.
  #[test]
  fn writes_credentials_that_stop_the_backend_prompting() {
    let dir = std::env::temp_dir().join("echo-backend-config-test");
    let _ = std::fs::remove_dir_all(&dir);
    ensure_backend_config(&dir).expect("should write a config");

    let written = std::fs::read_to_string(dir.join("config.yaml")).unwrap();
    assert_eq!(read_web_config_value(&written, "username").as_deref(), Some(BACKEND_USERNAME));
    let hash = read_web_config_value(&written, "password_hash").expect("hash present");
    assert!(hash.starts_with("$2"), "not a bcrypt hash: {hash}");

    // An existing config is never rewritten.
    std::fs::write(dir.join("config.yaml"), "web:\n    username: preexisting\n").unwrap();
    ensure_backend_config(&dir).expect("should be a no-op");
    let after = std::fs::read_to_string(dir.join("config.yaml")).unwrap();
    assert_eq!(read_web_config_value(&after, "username").as_deref(), Some("preexisting"));
  }
}
