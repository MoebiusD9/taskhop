//! Export / Import of the task database (Settings → Data).
//!
//! Export: Rust asks where to save; the frontend then writes the file with
//! SQLite's `VACUUM INTO`, which makes a clean, consistent single-file copy.
//! Import: Rust asks which file and confirms; the frontend checks the file and
//! closes its connection; `replace_database` then swaps the file in.

use std::{
    ffi::OsString,
    fs,
    io::Read,
    path::{Path, PathBuf},
};

use chrono::Local;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

use crate::{db, window};

const FILTER_NAME: &str = "Taskhop backup";
const BEFORE_IMPORT: &str = "taskhop-before-import.db";

/// Asks where to save a backup. `None` means the user cancelled.
/// (`async` so the blocking dialog doesn't run on the main thread.)
#[tauri::command]
pub async fn pick_export_path(app: AppHandle) -> Result<Option<String>, String> {
    let mut dialog = app
        .dialog()
        .file()
        .set_title("Export tasks")
        .set_file_name(format!("taskhop-backup-{}.db", Local::now().format("%Y-%m-%d")))
        .add_filter(FILTER_NAME, &["db"]);
    // Attach to the widget so the dialog isn't hidden behind an always-on-top window.
    if let Some(main) = app.get_webview_window(window::MAIN) {
        dialog = dialog.set_parent(&main);
    }

    let Some(picked) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path = picked.into_path().map_err(|e| e.to_string())?;

    if same_file(&path, &db::db_path(&app)?) {
        return Err("That is the database Taskhop is using. Choose another file.".into());
    }
    // VACUUM INTO won't overwrite a file; the save dialog already asked about replacing it.
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Could not replace {}: {e}", path.display()))?;
    }
    Ok(Some(path.display().to_string()))
}

/// Asks which backup to import and confirms that it replaces everything.
/// `None` means the user cancelled.
#[tauri::command]
pub async fn pick_import_file(app: AppHandle) -> Result<Option<String>, String> {
    let main = app.get_webview_window(window::MAIN);

    let mut dialog = app
        .dialog()
        .file()
        .set_title("Import tasks")
        .add_filter(FILTER_NAME, &["db"]);
    if let Some(main) = &main {
        dialog = dialog.set_parent(main);
    }
    let Some(picked) = dialog.blocking_pick_file() else {
        return Ok(None);
    };
    let path = picked.into_path().map_err(|e| e.to_string())?;

    if !is_sqlite_file(&path) {
        return Err("That file is not a Taskhop backup.".into());
    }
    if same_file(&path, &db::db_path(&app)?) {
        return Err("That is the database Taskhop is already using.".into());
    }

    let mut confirm = app
        .dialog()
        .message(format!(
            "Importing replaces all your current tasks and settings with the ones in this file. \
             Your current database is kept as {BEFORE_IMPORT} in the data folder."
        ))
        .title("Import tasks")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom("Import".into(), "Cancel".into()));
    if let Some(main) = &main {
        confirm = confirm.parent(main);
    }
    if !confirm.blocking_show() {
        return Ok(None);
    }
    Ok(Some(path.display().to_string()))
}

/// Swaps the chosen file in as the database. The frontend closes its database
/// connection before calling this and reloads afterwards.
#[tauri::command]
pub fn replace_database(app: AppHandle, source: String) -> Result<(), String> {
    let source = PathBuf::from(source);
    if !is_sqlite_file(&source) {
        return Err("That file is not a Taskhop backup.".into());
    }
    let target = db::db_path(&app)?;
    let dir = target.parent().ok_or("Invalid database path.")?;
    let fail = |what: &str, e: std::io::Error| format!("Could not {what}: {e}");

    // 1. Keep the current database (and its journal files) as a backup.
    let backup = dir.join(BEFORE_IMPORT);
    for suffix in ["", "-wal", "-shm"] {
        let (from, to) = (with_suffix(&target, suffix), with_suffix(&backup, suffix));
        if from.exists() {
            fs::copy(&from, &to).map_err(|e| fail("back up the current database", e))?;
        } else if to.exists() {
            fs::remove_file(&to).map_err(|e| fail("remove an old backup file", e))?;
        }
    }

    // 2. Copy the backup in, then delete journal files that belonged to the old
    //    database; SQLite would otherwise replay them into the new one.
    fs::copy(&source, &target).map_err(|e| fail("copy the backup in", e))?;
    for suffix in ["-wal", "-shm"] {
        let leftover = with_suffix(&target, suffix);
        if leftover.exists() {
            fs::remove_file(&leftover).map_err(|e| fail("remove old journal files", e))?;
        }
    }
    Ok(())
}

/// Every SQLite database starts with these 16 bytes.
fn is_sqlite_file(path: &Path) -> bool {
    let mut header = [0u8; 16];
    fs::File::open(path)
        .and_then(|mut file| file.read_exact(&mut header))
        .map(|()| &header == b"SQLite format 3\0")
        .unwrap_or(false)
}

/// "taskhop.db" + "-wal" -> "taskhop.db-wal"
fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut name = OsString::from(path.as_os_str());
    name.push(suffix);
    PathBuf::from(name)
}

fn same_file(a: &Path, b: &Path) -> bool {
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adds_suffix_to_file_name() {
        let path = Path::new("data").join("taskhop.db");
        assert_eq!(with_suffix(&path, "-wal"), Path::new("data").join("taskhop.db-wal"));
    }

    #[test]
    fn detects_sqlite_files() {
        let dir = std::env::temp_dir();
        let good = dir.join("taskhop-test-good.db");
        let bad = dir.join("taskhop-test-bad.db");
        fs::write(&good, b"SQLite format 3\0rest of the file").unwrap();
        fs::write(&bad, b"not a database").unwrap();
        assert!(is_sqlite_file(&good));
        assert!(!is_sqlite_file(&bad));
        assert!(!is_sqlite_file(&dir.join("taskhop-test-missing.db")));
        let _ = (fs::remove_file(good), fs::remove_file(bad));
    }
}
