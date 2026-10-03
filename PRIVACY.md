# Privacy notice

Taskhop is a free, open-source desktop app made by MoebiusD9.
Last updated: October 3, 2026.

## The short version

- Taskhop has **no accounts, no analytics, no tracking and no servers**.
  The developer never receives any of your data.
- Your tasks and settings stay **on your computer**.
- The optional **AI quick add** sends what you type to **Google**, using your
  own API key. It is off by default.

## What Taskhop stores on your computer

| What | Where |
|---|---|
| Tasks and settings | A SQLite file, `taskhop.db`, in `%APPDATA%\io.github.moebiusd9.todowidget` (Windows) or `~/Library/Application Support/io.github.moebiusd9.todowidget` (macOS) |
| Gemini API key (if you add one) | Your operating system's keychain: Windows Credential Manager or the macOS Keychain. Never in a file. |
| Window size and position | The same app folder |

You can see the folder in **Settings → Data → Open data folder**, back it up
with **Export**, and delete everything by uninstalling Taskhop and deleting
that folder. **Remove** in Settings deletes the API key from the keychain.

"Launch at startup" adds an entry to your system's startup items (the
Windows registry or a macOS LaunchAgent). It is off by default.

## What is sent over the internet

Only one thing: **AI quick add**, if you turn it on and add your own Gemini
API key. Each request goes directly from your computer to Google's Gemini API
(`generativelanguage.googleapis.com`) and contains:

- the text you typed in the add box;
- today's date, weekday and your timezone, so "tomorrow" or "friday" can be
  worked out;
- only if you also turn on **Use my task history**: up to 20 titles of your
  past tasks, each with the weekday it was scheduled for and whether it was
  done or dropped.

Task **notes are never sent**. Taskhop asks Google not to store the request
(`store: false`).

Google's handling of these requests is governed by Google's own terms and
privacy policy, not by Taskhop, including the
[Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms)
and the [Google Privacy Policy](https://policies.google.com/privacy). In
particular, Google's terms say that on the **free tier**, Google may use what
you send to improve its products, and that people may review it. Google also
requires Gemini API users to be **18 or older** and limits where the API is
available. If you turn AI on, don't put sensitive information in your tasks.

When AI is off, there is no key, or you are offline, Taskhop makes no network
requests at all. (On Windows, the installer may download Microsoft's WebView2
runtime if your system doesn't already have it.)

## Children

Taskhop is not directed at children under 13, and the AI feature requires
users to be 18 or older under Google's terms.

## Changes and contact

Changes to this notice are published with the source code, at
<https://github.com/MoebiusD9/taskhop>. Questions: open an issue there.
