use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

use crate::{autostart, window};

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "Show/Hide", true, None::<&str>)?;
    let launch_at_startup = CheckMenuItem::with_id(
        app,
        "autostart",
        "Launch at startup",
        true,
        autostart::is_enabled(app),
        None::<&str>,
    )?;
    let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Taskhop", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&toggle, &launch_at_startup, &settings, &separator, &quit],
    )?;

    // Hand Tauri a copy of the item so autostart.rs can update its checkmark later.
    app.manage(autostart::TrayItem(launch_at_startup.clone()));

    // macOS menu bars use single-colour "template" icons that the system tints
    // for light and dark menus. Windows shows the full-colour app icon.
    #[cfg(target_os = "macos")]
    let (icon, is_template) = (tauri::include_image!("icons/tray-template.png"), true);
    #[cfg(not(target_os = "macos"))]
    let (icon, is_template) = (
        app.default_window_icon()
            .cloned()
            .expect("app icon missing: run `pnpm tauri icon app-icon.svg`"),
        false,
    );

    TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .icon_as_template(is_template)
        .tooltip("Taskhop")
        .menu(&menu)
        // macOS convention: left click opens the menu. On Windows it toggles the window.
        .show_menu_on_left_click(cfg!(target_os = "macos"))
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => window::toggle_main(app),
            "autostart" => {
                // The OS setting is the source of truth; set_enabled re-syncs the checkmark.
                let _ = autostart::set_enabled(app, !autostart::is_enabled(app));
            }
            "settings" => {
                window::show_main(app);
                let _ = app.emit("open-settings", ());
            }
            "quit" => {
                let _ = app.save_window_state(StateFlags::SIZE | StateFlags::POSITION);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if cfg!(target_os = "macos") {
                return;
            }
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                window::toggle_main(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}
