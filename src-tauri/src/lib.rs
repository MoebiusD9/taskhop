mod ai;
mod autostart;
mod backup;
mod db;
mod links;
mod shortcut;
mod tray;
mod window;

use tauri::WindowEvent;
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_window_state::StateFlags;

pub fn run() {
    tauri::Builder::default()
        // Registered first: if Taskhop is already running, the new process
        // hands over to the existing one (which shows its window) and exits.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            window::show_main(app);
        }))
        // Restores the window's size and position; we decide visibility ourselves.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION)
                .build(),
        )
        // SQLite for the frontend. Pending migrations run when the database is opened.
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db::url(), db::migrations())
                .build(),
        )
        // Launch at login: a LaunchAgent on macOS, the registry Run key on Windows.
        // Off until the user turns it on; the OS starts us with --autostarted.
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![autostart::LAUNCH_ARG]),
        ))
        .plugin(shortcut::plugin())
        // Lets Rust open Explorer / Finder (used by "Open data folder").
        .plugin(tauri_plugin_opener::init())
        // Native file and confirm dialogs for Export / Import.
        .plugin(tauri_plugin_dialog::init())
        // Rust functions the frontend may call with invoke().
        .invoke_handler(tauri::generate_handler![
            ai::parse_task,
            ai::suggest_tasks,
            ai::has_gemini_key,
            ai::set_gemini_key,
            ai::remove_gemini_key,
            ai::test_gemini_key,
            autostart::get_autostart,
            autostart::set_autostart,
            backup::pick_export_path,
            backup::pick_import_file,
            backup::replace_database,
            db::data_folder,
            db::db_url,
            db::open_data_folder,
            links::open_project_page,
            shortcut::set_global_shortcut,
        ])
        .setup(|app| {
            // macOS: run as a menu-bar app with no Dock icon.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            tray::create(app.handle())?;
            // Started at login: stay quietly in the tray.
            if !autostart::launched_at_login() {
                window::show_main(app.handle());
            }
            Ok(())
        })
        // Closing the window (Alt+F4, Cmd+W) hides it to the tray instead.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Taskhop");
}
