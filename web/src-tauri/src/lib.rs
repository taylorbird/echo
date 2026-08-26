use std::net::{SocketAddr, TcpStream};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::{ShellExt, process::CommandChild};

struct BackendProcess(Mutex<Option<CommandChild>>);

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

      // Spawn the gomuks backend as a sidecar
      let sidecar = app.shell().sidecar("gomuks").expect("failed to create sidecar");
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
        std::thread::spawn(move || {
          if !wait_for_backend(BACKEND_STARTUP_TIMEOUT) {
            log::error!("gomuks backend didn't start listening in time, opening window anyway");
          }
          let builder_handle = handle.clone();
          let _ = handle.run_on_main_thread(move || {
            match WebviewWindowBuilder::from_config(&builder_handle, &window_config) {
              Ok(builder) => {
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
