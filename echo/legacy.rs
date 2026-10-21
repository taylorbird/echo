//! echo: echo-gomuks shipped under this same bundle ID, so an install that
//! updated from it still carries its files: the gomuks database and config,
//! its media cache and its logs. Nothing here reads them. They are removed at
//! start-up, off the main thread; a missing file is the normal case after the
//! first run. Sable's own files in these folders have other names
//! (credentials/, session.json, sable-tiles/, sable-video/, …).

use std::{fs, path::Path};

use tauri::{AppHandle, Manager as _, Runtime};

const DATA_FILES: &[&str] = &["gomuks.db", "gomuks.db-shm", "gomuks.db-wal", "config.yaml"];
const CACHE_DIRS: &[&str] = &["media", "tmp"];

pub fn remove_gomuks_leftovers<R: Runtime>(app: &AppHandle<R>) {
    let paths = app.path();
    let data = paths.app_data_dir().ok();
    let cache = paths.app_cache_dir().ok();
    let logs = paths.app_log_dir().ok();
    std::thread::spawn(move || {
        if let Some(dir) = data {
            for name in DATA_FILES {
                let _ = fs::remove_file(dir.join(name));
            }
        }
        if let Some(dir) = cache {
            for name in CACHE_DIRS {
                let _ = fs::remove_dir_all(dir.join(name));
            }
        }
        if let Some(dir) = logs {
            remove_gomuks_logs(&dir);
        }
    });
}

// gomuks wrote gomuks-<timestamp>.log files; anything else in the folder stays.
fn remove_gomuks_logs(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with("gomuks-") && name.ends_with(".log") {
            let _ = fs::remove_file(entry.path());
        }
    }
}
