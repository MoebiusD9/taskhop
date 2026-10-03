import { defineStore } from 'pinia'
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { getDb } from '../lib/db'
import { DEFAULT_SHORTCUT } from '../lib/shortcut'
import { applyTheme, cachedTheme, type Theme } from '../lib/theme'
import type { ParsedTask } from '../types'

/**
 * Settings kept in SQLite. Launch-at-startup lives in the OS and the Gemini key
 * in the OS keychain (via Rust), so neither is stored here.
 */
interface StoredSettings {
  shortcut: string
  pinned: boolean
  aiQuickAdd: boolean
  /** Opt-in: send up to 20 past task titles with AI requests. */
  useHistory: boolean
  theme: Theme
}

const DEFAULTS: StoredSettings = {
  shortcut: DEFAULT_SHORTCUT,
  pinned: true,
  aiQuickAdd: false,
  useHistory: false,
  theme: 'system',
}

export const useSettingsStore = defineStore('settings', () => {
  const shortcut = ref(DEFAULTS.shortcut)
  const pinned = ref(DEFAULTS.pinned)
  const aiQuickAdd = ref(DEFAULTS.aiQuickAdd)
  const useHistory = ref(DEFAULTS.useHistory)
  const theme = ref<Theme>(cachedTheme())
  /** Whether a Gemini key is in the keychain. The key itself never reaches the webview. */
  const hasKey = ref(false)
  const autostart = ref(false)
  /** Shown in Settings when the saved shortcut couldn't be registered at startup. */
  const shortcutError = ref<string | null>(null)

  async function save<K extends keyof StoredSettings>(key: K, value: StoredSettings[K]) {
    const db = await getDb()
    await db.execute(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [key, JSON.stringify(value)],
    )
  }

  /** Loads saved settings and applies them to the window and the OS. */
  async function init() {
    try {
      const db = await getDb()
      const rows = await db.select<{ key: string; value: string }[]>('SELECT key, value FROM settings')
      const saved = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)])) as Partial<StoredSettings>
      shortcut.value = saved.shortcut ?? DEFAULTS.shortcut
      pinned.value = saved.pinned ?? DEFAULTS.pinned
      aiQuickAdd.value = saved.aiQuickAdd ?? DEFAULTS.aiQuickAdd
      useHistory.value = saved.useHistory ?? DEFAULTS.useHistory
      theme.value = saved.theme ?? DEFAULTS.theme
      applyTheme(theme.value)
    } catch (err) {
      console.error('Could not load settings', err)
    }

    await getCurrentWindow().setAlwaysOnTop(pinned.value)

    try {
      await invoke('set_global_shortcut', { shortcut: shortcut.value })
      shortcutError.value = null
    } catch (err) {
      shortcutError.value = String(err)
    }

    hasKey.value = await invoke<boolean>('has_gemini_key')
    autostart.value = await invoke<boolean>('get_autostart')
    // The tray menu can change this too; Rust tells us whenever it does.
    await listen<boolean>('autostart-changed', (e) => {
      autostart.value = e.payload
    })
  }

  async function setPinned(value: boolean) {
    pinned.value = value
    await getCurrentWindow().setAlwaysOnTop(value)
    await save('pinned', value)
  }

  /** Throws if the OS refuses the shortcut; the previous one is restored. */
  async function setShortcut(next: string) {
    try {
      await invoke('set_global_shortcut', { shortcut: next })
    } catch (err) {
      await resumeShortcut()
      throw err
    }
    shortcut.value = next
    shortcutError.value = null
    await save('shortcut', next)
  }

  /** Disables the global shortcut while a new one is being recorded. */
  function pauseShortcut() {
    return invoke('set_global_shortcut', { shortcut: null })
  }

  async function resumeShortcut() {
    try {
      await invoke('set_global_shortcut', { shortcut: shortcut.value })
    } catch (err) {
      shortcutError.value = String(err)
    }
  }

  async function setAutostart(value: boolean) {
    autostart.value = await invoke<boolean>('set_autostart', { enabled: value })
  }

  async function setAiQuickAdd(value: boolean) {
    aiQuickAdd.value = value
    await save('aiQuickAdd', value)
  }

  async function setTheme(value: Theme) {
    theme.value = value
    applyTheme(value)
    await save('theme', value)
  }

  async function setUseHistory(value: boolean) {
    useHistory.value = value
    await save('useHistory', value)
  }

  async function saveKey(key: string) {
    await invoke('set_gemini_key', { key })
    hasKey.value = true
  }

  async function removeKey() {
    await invoke('remove_gemini_key')
    hasKey.value = false
  }

  /** Parses a sample sentence. Uses `key` if given, otherwise the saved key. */
  function testKey(key?: string) {
    return invoke<ParsedTask>('test_gemini_key', { key: key || null })
  }

  return {
    shortcut, pinned, aiQuickAdd, useHistory, theme, hasKey, autostart, shortcutError,
    init, setPinned, setShortcut, pauseShortcut, resumeShortcut, setAutostart,
    setAiQuickAdd, setUseHistory, setTheme, saveKey, removeKey, testKey,
  }
})
