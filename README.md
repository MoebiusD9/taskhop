# Taskhop

A small always-on-top to-do widget for Windows and macOS: plan **Today** and
**Tomorrow**, and catch **Skipped** tasks. Built with Tauri 2, Vue 3,
TypeScript, Pinia, Tailwind CSS and SQLite.

## Development

Prerequisites: Node 22+, pnpm, Rust (stable), and on Windows the
"Build Tools for Visual Studio" C++ workload (MSVC + Windows SDK).

```bash
pnpm install
pnpm tauri dev
```

Rust unit tests (stop the dev app first):

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

## Where data lives

| Build | Database |
|---|---|
| Dev (`pnpm tauri dev`) | `data/taskhop.db` in this project (git-ignored) |
| Installed (Windows) | `%APPDATA%\io.github.moebiusd9.todowidget\taskhop.db` |
| Installed (macOS) | `~/Library/Application Support/io.github.moebiusd9.todowidget/taskhop.db` |

Settings → Data shows the path and can **Export** a backup or **Import** one
(import replaces all tasks and settings; the previous database is kept as
`taskhop-before-import.db`). Use this to move tasks between the dev and the
installed app.

The Gemini API key is stored in the OS keychain (Windows Credential Manager /
macOS Keychain), never in files.

## AI quick add

1. Set the model ID in `src-tauri/src/ai.rs` (`GEMINI_MODEL`).
2. In Settings, paste your Gemini API key, **Save**, then **Test**.
3. Turn on **AI quick add**. Optionally turn on **Use my task history**, which
   sends up to 20 past task titles (never notes) with each request and enables
   suggestions while typing.

Without a key, offline, or on any error, tasks are added exactly as typed.

## Building a Windows installer

On Windows, quit the dev app first (only one Taskhop instance can run), then:

```bash
pnpm tauri build
```

Output: `src-tauri/target/release/bundle/nsis/Taskhop_<version>_x64-setup.exe`.
It installs for the current user without admin rights.

The installer is not code-signed, so SmartScreen shows "Windows protected your
PC": choose **More info → Run anyway**.

If "Launch at startup" was turned on in the dev build, turn it off and on again
in the installed app so Windows points to the installed copy.

## Building the macOS app

Must be done on a Mac (Rust cannot build macOS apps from Windows):

```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
pnpm install
pnpm tauri build --target universal-apple-darwin
```

Output: `src-tauri/target/universal-apple-darwin/release/bundle/dmg/Taskhop_<version>_universal.dmg`
(runs on Intel and Apple Silicon).

The app is ad-hoc signed but not notarized, so open it the first time with
right-click **Taskhop.app → Open → Open**. It runs as a menu-bar app (no Dock
icon); the global shortcut is Cmd+Option+T.

## Releasing a new version (free checklist)

1. Bump `version` in both `package.json` and `src-tauri/tauri.conf.json`.
   Installing a new version over the old one keeps users' data.
2. Check dependencies for known vulnerabilities:
   `pnpm audit` and `cargo audit` (install once with `cargo install cargo-audit`).
3. Regenerate the license notices: `pnpm notices`.
4. Build the installers (see above) from a clean checkout of the repository.
5. Create a GitHub Release and attach the installers plus their SHA-256
   checksums, so people can check they got the real file:
   - Windows (PowerShell): `Get-FileHash .\Taskhop_0.1.0_x64-setup.exe`
   - macOS: `shasum -a 256 Taskhop_0.1.0_universal.dmg`
6. In the repository settings, enable **Private vulnerability reporting**
   (Settings → Code security) so `SECURITY.md` works.

### Removing the "unknown publisher" warnings without paying

- **Windows:** [SignPath Foundation](https://signpath.org) offers free code
  signing for open-source projects (you apply, and builds are signed in CI).
  Publishing in the **Microsoft Store** is another route: the Store signs the
  app, and Microsoft currently doesn't charge individual developers for an
  account. Check both sites for their current terms.
- **macOS:** notarization requires the paid Apple Developer Program; without
  it, users open the app once with right-click → Open.

## License and privacy

- Taskhop is released under the [MIT License](LICENSE). It is provided "as is",
  without warranty of any kind.
- [Privacy notice](PRIVACY.md): no accounts, no analytics, data stays on your
  computer; the optional AI feature sends what you type to Google.
- [Third-party notices](THIRD_PARTY_NOTICES.md) list the open-source components
  Taskhop includes and their licenses.
- [Security policy](SECURITY.md): report vulnerabilities privately.
- Taskhop is not affiliated with or endorsed by Google. Gemini is a trademark
  of Google LLC.
