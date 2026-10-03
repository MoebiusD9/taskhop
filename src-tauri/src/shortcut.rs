use tauri::{plugin::TauriPlugin, AppHandle, Wry};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::window;

/// The plugin, with one handler for whichever shortcut is registered:
/// it shows or hides the widget.
pub fn plugin() -> TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                window::toggle_main(app);
            }
        })
        .build()
}

/// Replaces the global shortcut, e.g. "CommandOrControl+Alt+KeyT".
/// `None` unregisters it (used while the user records a new one).
/// The frontend calls this at startup with the saved shortcut.
#[tauri::command]
pub fn set_global_shortcut(app: AppHandle, shortcut: Option<String>) -> Result<(), String> {
    // Parse before unregistering, so a bad value can't leave the app without a shortcut.
    let parsed = match &shortcut {
        Some(text) => Some(
            text.parse::<Shortcut>()
                .map_err(|e| format!("Invalid shortcut \"{text}\": {e}"))?,
        ),
        None => None,
    };

    let manager = app.global_shortcut();
    manager.unregister_all().map_err(|e| e.to_string())?;
    if let Some(parsed) = parsed {
        manager.register(parsed).map_err(|e| {
            format!("Could not register the shortcut (another app may be using it): {e}")
        })?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::Shortcut;

    #[test]
    fn parses_shortcuts_produced_by_the_settings_recorder() {
        for text in [
            "CommandOrControl+Alt+KeyT",
            "CommandOrControl+Control+Shift+Digit1",
            "Super+Alt+ArrowUp",
            "Alt+Shift+Backquote",
            "CommandOrControl+F5",
        ] {
            assert!(text.parse::<Shortcut>().is_ok(), "failed to parse {text}");
        }
        assert!("Alt+NotAKey".parse::<Shortcut>().is_err());
    }
}
