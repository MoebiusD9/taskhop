use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

/// The public repository. Change this if the repository is renamed or moved.
const REPO_URL: &str = "https://github.com/MoebiusD9/taskhop";

/// Opens one of the project's pages in the default browser (Settings → About).
/// Only this fixed list can be opened, so the webview can't use the command to
/// open arbitrary URLs.
#[tauri::command]
pub fn open_project_page(app: AppHandle, page: String) -> Result<(), String> {
    let path = match page.as_str() {
        "home" => "",
        "license" => "/blob/main/LICENSE",
        "privacy" => "/blob/main/PRIVACY.md",
        "notices" => "/blob/main/THIRD_PARTY_NOTICES.md",
        "security" => "/blob/main/SECURITY.md",
        "releases" => "/releases",
        _ => return Err(format!("Unknown page \"{page}\".")),
    };
    app.opener()
        .open_url(format!("{REPO_URL}{path}"), None::<&str>)
        .map_err(|e| e.to_string())
}
