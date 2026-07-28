use std::sync::Mutex;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::{ShellExt, process::CommandChild};

struct BackendProcess(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    // Lets the frontend hand external links to the system browser. Without it,
    // target="_blank" links in messages are silently dropped by the webview.
    .plugin(tauri_plugin_opener::init())
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
