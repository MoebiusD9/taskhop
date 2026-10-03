use tauri::{menu::CheckMenuItem, AppHandle, Emitter, Manager, Wry};
use tauri_plugin_autostart::ManagerExt;

/// Passed to the app when the OS launches it at login (see lib.rs).
pub const LAUNCH_ARG: &str = "--autostarted";

/// The tray's "Launch at startup" item, kept in Tauri's state so it can be
/// re-checked from anywhere (e.g. when the toggle is flipped in Settings).
pub struct TrayItem(pub CheckMenuItem<Wry>);

pub fn launched_at_login() -> bool {
    std::env::args().any(|arg| arg == LAUNCH_ARG)
}

pub fn is_enabled(app: &AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

pub fn set_enabled(app: &AppHandle, enabled: bool) -> Result<bool, String> {
    let launcher = app.autolaunch();
    let result = if enabled {
        launcher.enable()
    } else {
        launcher.disable()
    };
    // Sync the UI even on failure, so both show what the OS actually has.
    let actual = sync(app);
    result.map_err(|e| e.to_string())?;
    Ok(actual)
}

/// Updates the tray checkmark and tells the frontend the real current state.
fn sync(app: &AppHandle) -> bool {
    let enabled = is_enabled(app);
    if let Some(item) = app.try_state::<TrayItem>() {
        let _ = item.0.set_checked(enabled);
    }
    let _ = app.emit("autostart-changed", enabled);
    enabled
}

// `#[tauri::command]` turns a Rust function into something the frontend can
// call with `invoke('get_autostart')`. Arguments and return values are
// converted to and from JSON automatically.

#[tauri::command]
pub fn get_autostart(app: AppHandle) -> bool {
    is_enabled(&app)
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    set_enabled(&app, enabled)
}
