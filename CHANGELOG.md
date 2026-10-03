# Changelog

All notable changes to Taskhop are listed here, newest first.

## 0.1.0 — first release 🎉

Taskhop is a tiny to-do widget that stays on top of your screen. Plan **today**
and **tomorrow**, and never lose track of the tasks you **skipped**.
Free, open source, and your data stays on your computer.

### What's inside

- **Three lists, zero setup.** Today, Tomorrow, and Skipped. Unfinished tasks
  from earlier days land in Skipped automatically, where you can move them to
  today or drop them.
- **Always within reach.** A small window that stays on top (pin it or unpin
  it), hides to the tray, and comes back with **Ctrl+Alt+T**
  (**Cmd+Option+T** on Mac). You can change the shortcut.
- **Fast to use.** Type and press Enter to add. Check off, edit inline, drag to
  reorder, and move tasks between Today and Tomorrow in one click. Everything
  works from the keyboard.
- **Light and dark mode.** Follows your system, or pick one in Settings.
- **Launch at startup** (optional). Starts quietly in the tray.
- **Backups.** Export your tasks to a file and import them anywhere.

### Optional: AI quick add

Type naturally, like `fix login bug tomorrow` or `review PR on friday`, and
Taskhop turns it into a clean task on the right day.

- Off by default. Uses **your own** Google Gemini API key, stored in your
  system's keychain.
- Only what you type is sent to Google. Turning on **Use my task history**
  also sends up to 20 past task titles (never notes) for smarter suggestions
  while you type.
- No key, offline, or slow connection? Your task is simply added as typed.

Google's terms apply to AI requests, and Google requires API users to be 18+.
See the [privacy notice](PRIVACY.md) for details.

### Download

| System | File |
|---|---|
| Windows 10/11 (64-bit) | `Taskhop_0.1.0_x64-setup.exe` |
| macOS 11+ (Intel and Apple Silicon) | `Taskhop_0.1.0_universal.dmg` |

**First launch:** Taskhop isn't code-signed yet, so your system will warn you
the first time:

- **Windows:** "Windows protected your PC" → **More info** → **Run anyway**.
- **macOS:** right-click **Taskhop.app** → **Open** → **Open**.

**Verify your download** (optional): compare the file's SHA-256 checksum,
listed on the GitHub release, using `Get-FileHash` (Windows PowerShell) or
`shasum -a 256` (macOS). Only download Taskhop from the
[Releases page](https://github.com/MoebiusD9/taskhop/releases).

### Good to know

- Tasks scheduled further ahead than tomorrow appear in Today on their day.
- Not included (on purpose, to keep it small): accounts, sync, mobile apps,
  reminders, recurring tasks, and subtasks.

### Feedback

Found a bug or have an idea? [Open an issue](https://github.com/MoebiusD9/taskhop/issues).
Security problems: please report them privately (see [SECURITY.md](SECURITY.md)).

Taskhop is free and open source under the [MIT License](LICENSE), provided as
is, without warranty. Not affiliated with Google.
