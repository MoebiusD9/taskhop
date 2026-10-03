use std::{
    fs,
    path::{Path, PathBuf},
};

use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_sql::{Migration, MigrationKind};

const FILE_NAME: &str = "taskhop.db";
/// The file's name before the app was renamed; copied over once (see `prepare`).
const LEGACY_FILE_NAME: &str = "taskify.db";

/// Where the database lives:
/// - dev builds (`pnpm tauri dev`): the project's own `data` folder,
///   e.g. C:\laragon\www\taskify\data\taskhop.db
/// - release builds: the app's config folder
///   (%APPDATA%\io.github.moebiusd9.todowidget), because an installed app has
///   no project folder.
fn project_data_dir() -> Option<PathBuf> {
    if cfg!(debug_assertions) {
        // CARGO_MANIFEST_DIR is src-tauri, filled in at compile time; its parent is the project.
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .map(|project| project.join("data"))
    } else {
        None
    }
}

/// The connection URL. The migrations are registered under it (lib.rs) and the
/// frontend opens exactly this URL (it asks for it via the `db_url` command).
/// An absolute path is used as is; a relative one lands in the config folder.
pub fn url() -> String {
    match project_data_dir() {
        Some(dir) => format!("sqlite:{}", dir.join(FILE_NAME).display()),
        None => format!("sqlite:{FILE_NAME}"),
    }
}

/// Full path of the database file.
pub fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = match project_data_dir() {
        Some(dir) => dir,
        None => app.path().app_config_dir().map_err(|e| e.to_string())?,
    };
    Ok(dir.join(FILE_NAME))
}

/// Makes sure the dev database folder exists, and the first time after the
/// rename copies data/taskify.db to data/taskhop.db so no tasks are lost.
/// The old file stays in place as a backup.
fn prepare() -> Result<(), String> {
    let Some(dir) = project_data_dir() else {
        return Ok(()); // release build: the SQL plugin manages the config folder
    };
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;

    if !dir.join(FILE_NAME).exists() && dir.join(LEGACY_FILE_NAME).exists() {
        // SQLite keeps recent writes in the -wal file, so copy it (and -shm) too.
        for suffix in ["", "-wal", "-shm"] {
            let from = dir.join(format!("{LEGACY_FILE_NAME}{suffix}"));
            if from.exists() {
                fs::copy(&from, dir.join(format!("{FILE_NAME}{suffix}")))
                    .map_err(|e| format!("Could not copy {}: {e}", from.display()))?;
            }
        }
    }
    Ok(())
}

/// Called by the frontend before opening the database (src/lib/db.ts).
#[tauri::command]
pub fn db_url() -> Result<String, String> {
    prepare()?;
    Ok(url())
}

/// Shown in Settings so the user knows where their data lives.
#[tauri::command]
pub fn data_folder(app: AppHandle) -> Result<String, String> {
    let path = db_path(&app)?;
    let dir = path.parent().unwrap_or(path.as_path());
    Ok(dir.display().to_string())
}

/// Opens Explorer / Finder with the database file selected.
#[tauri::command]
pub fn open_data_folder(app: AppHandle) -> Result<(), String> {
    let path = db_path(&app)?;
    app.opener().reveal_item_in_dir(path).map_err(|e| e.to_string())
}

/// Schema history, applied in order the first time the frontend opens the database.
/// Never edit a migration that has already run on a machine; add a new one with
/// the next version number instead.
pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_tasks",
            sql: r#"
            CREATE TABLE tasks (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                title          TEXT    NOT NULL CHECK (length(trim(title)) > 0),
                notes          TEXT,
                scheduled_date TEXT    NOT NULL
                               CHECK (scheduled_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
                status         TEXT    NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'done', 'dropped')),
                sort_order     INTEGER NOT NULL DEFAULT 0,
                created_at     TEXT    NOT NULL,
                completed_at   TEXT
            );
            CREATE INDEX idx_tasks_date_status ON tasks (scheduled_date, status);
        "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_settings",
            // Simple key/value store; values are JSON text (e.g. 'true', '"Ctrl+Alt+KeyT"').
            sql: r#"
            CREATE TABLE settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        "#,
            kind: MigrationKind::Up,
        },
    ]
}
