<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { useSettingsStore } from '../stores/settings'
import { formatShortDate } from '../lib/dates'
import { exportDatabase, importDatabase } from '../lib/backup'
import { DEFAULT_SHORTCUT, isMac, shortcutFromEvent, shortcutLabels } from '../lib/shortcut'
import ToggleSwitch from './ToggleSwitch.vue'
import type { Theme } from '../lib/theme'

defineEmits<{ close: [] }>()

const settings = useSettingsStore()

// ---- Appearance -------------------------------------------------------------

const themeOptions: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]
const themeButtons = ref<HTMLButtonElement[]>([])

// Arrow keys move the selection, following the WAI-ARIA radio group pattern.
function onThemeKey(e: KeyboardEvent, index: number) {
  const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  e.preventDefault()
  const next = (index + step + themeOptions.length) % themeOptions.length
  settings.setTheme(themeOptions[next].value)
  themeButtons.value[next]?.focus()
}

// ---- Launch at startup ---------------------------------------------------

const autostartError = ref<string | null>(null)

async function setAutostart(value: boolean) {
  try {
    await settings.setAutostart(value)
    autostartError.value = null
  } catch (err) {
    autostartError.value = String(err)
  }
}

// ---- AI quick add -----------------------------------------------------------

const keychainName = isMac ? 'the macOS Keychain' : 'Windows Credential Manager'
const keyInput = ref('')
const keyBusy = ref(false)
const keyMessage = ref<{ ok: boolean; text: string } | null>(null)

async function runKeyAction(action: () => Promise<string>) {
  keyBusy.value = true
  try {
    keyMessage.value = { ok: true, text: await action() }
  } catch (err) {
    keyMessage.value = { ok: false, text: String(err) }
  } finally {
    keyBusy.value = false
  }
}

const saveKey = () =>
  runKeyAction(async () => {
    await settings.saveKey(keyInput.value)
    keyInput.value = ''
    return `Saved to ${keychainName}.`
  })

const removeKey = () =>
  runKeyAction(async () => {
    await settings.removeKey()
    return 'Key removed.'
  })

// Tests the key in the field if one was typed, otherwise the saved key.
const testKey = () =>
  runKeyAction(async () => {
    const result = await settings.testKey(keyInput.value.trim())
    return `It works: “review PR on friday” → “${result.title}”, ${formatShortDate(result.scheduled_date)}.`
  })

// ---- Data folder ---------------------------------------------------------------

// ---- About ---------------------------------------------------------------------

const version = ref('')
getVersion().then((v) => (version.value = v))

/** Opens a fixed project page on GitHub (see src-tauri/src/links.rs). */
function openPage(page: 'home' | 'license' | 'privacy' | 'notices' | 'security' | 'releases') {
  invoke('open_project_page', { page }).catch((err) => console.warn('Could not open page', err))
}

const aboutLinks = [
  { page: 'home', label: 'Source code' },
  { page: 'releases', label: 'Updates' },
  { page: 'license', label: 'License' },
  { page: 'privacy', label: 'Privacy' },
  { page: 'notices', label: 'Third-party notices' },
  { page: 'security', label: 'Report a security issue' },
] as const

const dataFolder = ref('')
const dataBusy = ref(false)
const dataMessage = ref<{ ok: boolean; text: string } | null>(null)

onMounted(async () => {
  try {
    dataFolder.value = await invoke<string>('data_folder')
  } catch (err) {
    dataMessage.value = { ok: false, text: String(err) }
  }
})

/** Runs a Data action; a returned string is shown as a success message. */
async function runDataAction(action: () => Promise<string | null>) {
  dataBusy.value = true
  try {
    const text = await action()
    dataMessage.value = text ? { ok: true, text } : null
  } catch (err) {
    dataMessage.value = { ok: false, text: err instanceof Error ? err.message : String(err) }
  } finally {
    dataBusy.value = false
  }
}

const openDataFolder = () =>
  runDataAction(async () => {
    await invoke('open_data_folder')
    return null
  })

const exportData = () =>
  runDataAction(async () => {
    const path = await exportDatabase()
    return path ? `Exported to ${path}` : null
  })

// On success the window reloads with the imported tasks, so there's no message to show.
const importData = () =>
  runDataAction(async () => {
    await importDatabase()
    return null
  })

// ---- Global shortcut -----------------------------------------------------

const recording = ref(false)
const shortcutError = ref<string | null>(null)
const recordButton = ref<HTMLButtonElement>()
const labels = computed(() => shortcutLabels(settings.shortcut))
const error = computed(() => shortcutError.value ?? settings.shortcutError)

async function startRecording() {
  shortcutError.value = null
  // Turn the current shortcut off so pressing it doesn't hide the window mid-recording.
  await settings.pauseShortcut()
  recording.value = true
  window.addEventListener('keydown', onRecordKey, true)
}

async function stopRecording() {
  if (!recording.value) return
  recording.value = false
  window.removeEventListener('keydown', onRecordKey, true)
}

async function onRecordKey(e: KeyboardEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    await stopRecording()
    await settings.resumeShortcut()
    return
  }
  const next = shortcutFromEvent(e)
  if (!next) return // keep waiting for a full combination
  await stopRecording()
  await applyShortcut(next)
  recordButton.value?.focus()
}

async function applyShortcut(next: string) {
  try {
    await settings.setShortcut(next)
    shortcutError.value = null
  } catch (err) {
    shortcutError.value = String(err)
  }
}

onUnmounted(async () => {
  if (recording.value) {
    await stopRecording()
    await settings.resumeShortcut()
  }
})

const kbd =
  'rounded border border-line-strong bg-field px-1.5 py-0.5 font-mono text-xs'
const secondaryBtn =
  'cursor-pointer rounded-md border border-line-strong px-2.5 py-1 text-xs font-medium hover:bg-wash ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hop ' +
  'disabled:cursor-not-allowed disabled:opacity-50'
</script>

<template>
  <main class="flex-1 overflow-y-auto px-4 py-3">
    <div class="mb-3 flex items-center justify-between">
      <h1 class="text-base font-semibold">Settings</h1>
      <button type="button" class="cursor-pointer" :class="secondaryBtn" @click="$emit('close')">Done</button>
    </div>

    <section class="space-y-3 border-t border-line py-3" aria-labelledby="general-heading">
      <h2 id="general-heading" class="text-xs font-semibold tracking-wide text-ink-2 uppercase">
        General
      </h2>
      <div class="flex items-center justify-between gap-3">
        <span id="appearance-label" class="text-sm font-medium">Appearance</span>
        <div role="radiogroup" aria-labelledby="appearance-label" class="flex rounded-md border border-line-strong p-0.5">
          <button
            v-for="(option, i) in themeOptions"
            :key="option.value"
            ref="themeButtons"
            type="button"
            role="radio"
            :aria-checked="settings.theme === option.value"
            :tabindex="settings.theme === option.value ? 0 : -1"
            class="cursor-pointer rounded px-2 py-0.5 text-xs focus-visible:outline-2 focus-visible:outline-hop"
            :class="settings.theme === option.value ? 'bg-wash font-medium text-ink' : 'text-ink-2 hover:text-ink'"
            @click="settings.setTheme(option.value)"
            @keydown="onThemeKey($event, i)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
      <ToggleSwitch
        label="Launch at startup"
        description="Starts hidden in the tray when you log in."
        :checked="settings.autostart"
        @change="setAutostart"
      />
      <div v-auto-animate="{ duration: 150 }">
        <p v-if="autostartError" role="alert" class="text-xs text-hop">{{ autostartError }}</p>
      </div>
      <ToggleSwitch
        label="Keep on top"
        description="Same as the pin button in the header."
        :checked="settings.pinned"
        @change="settings.setPinned"
      />
    </section>

    <section class="space-y-2 border-t border-line py-3" aria-labelledby="shortcut-heading">
      <h2 id="shortcut-heading" class="text-xs font-semibold tracking-wide text-ink-2 uppercase">
        Global shortcut
      </h2>
      <p class="text-xs text-ink-2">Shows or hides Taskhop from any app.</p>

      <div v-auto-animate="{ duration: 150 }" class="flex flex-wrap items-center gap-2">
        <span v-if="recording" class="text-sm text-hop" aria-live="polite">
          Press the new shortcut… <span class="text-xs text-ink-2">(Esc to cancel)</span>
        </span>
        <span v-else class="flex items-center gap-1" :aria-label="`Current shortcut: ${labels.join(' + ')}`">
          <kbd v-for="(label, i) in labels" :key="i" :class="kbd">{{ label }}</kbd>
        </span>
      </div>

      <div class="flex gap-2">
        <button ref="recordButton" type="button" :class="secondaryBtn" :disabled="recording" @click="startRecording">
          Change…
        </button>
        <button
          type="button"
          :class="secondaryBtn"
          :disabled="recording || settings.shortcut === DEFAULT_SHORTCUT"
          @click="applyShortcut(DEFAULT_SHORTCUT)"
        >
          Reset to default
        </button>
      </div>
      <div v-auto-animate="{ duration: 150 }">
        <p v-if="error" role="alert" class="text-xs text-hop">{{ error }}</p>
      </div>
    </section>

    <section class="space-y-3 border-t border-line py-3" aria-labelledby="ai-heading">
      <h2 id="ai-heading" class="text-xs font-semibold tracking-wide text-ink-2 uppercase">
        AI quick add
      </h2>
      <ToggleSwitch
        label="AI quick add"
        :description="settings.hasKey
          ? 'Reads dates like “tomorrow” or “friday”. Only the text you type is sent to Google Gemini.'
          : 'Needs a Gemini API key (below). Until then, tasks are added as typed.'"
        :checked="settings.aiQuickAdd"
        @change="settings.setAiQuickAdd"
      />
      <ToggleSwitch
        label="Use my task history"
        description="Sends up to 20 of your past task titles (never notes) to Google Gemini with each request, so results match your wording and habits. Also shows suggestions while you type."
        :checked="settings.useHistory"
        :disabled="!settings.aiQuickAdd"
        @change="settings.setUseHistory"
      />

      <p class="text-xs text-ink-2">
        Uses your own Gemini API key. Google's terms and privacy policy apply to what is sent; on
        the free tier Google may use it to improve its products. Google requires API users to be 18
        or older.
        <button type="button" class="cursor-pointer text-hop underline-offset-2 hover:underline" @click="openPage('privacy')">
          Privacy notice
        </button>
      </p>

      <div class="space-y-1.5">
        <label for="gemini-key" class="text-sm font-medium">Gemini API key</label>
        <input
          id="gemini-key"
          v-model="keyInput"
          type="password"
          autocomplete="off"
          spellcheck="false"
          :placeholder="settings.hasKey ? '•••••••• saved in system keychain' : 'Paste your API key'"
          class="w-full rounded-md border border-line-strong bg-field px-2.5 py-1.5 text-sm placeholder:text-ink-3
                 focus:border-hop focus:outline-2 focus:outline-hop/30"
          @keydown.enter.prevent="keyInput.trim() && saveKey()"
        />
        <div class="flex gap-2">
          <button type="button" :class="secondaryBtn" :disabled="keyBusy || !keyInput.trim()" @click="saveKey">
            Save
          </button>
          <button type="button" :class="secondaryBtn" :disabled="keyBusy || !settings.hasKey" @click="removeKey">
            Remove
          </button>
          <button
            type="button"
            :class="secondaryBtn"
            :disabled="keyBusy || (!keyInput.trim() && !settings.hasKey)"
            @click="testKey"
          >
            {{ keyBusy ? 'Working…' : 'Test' }}
          </button>
        </div>
        <div v-auto-animate="{ duration: 150 }" aria-live="polite">
          <p
            v-if="keyMessage"
            :key="keyMessage.text"
            class="text-xs"
            :class="keyMessage.ok ? 'text-ink' : 'text-hop'"
          >
            {{ keyMessage.text }}
          </p>
        </div>
      </div>
    </section>

    <section class="space-y-2 border-t border-line py-3" aria-labelledby="data-heading">
      <h2 id="data-heading" class="text-xs font-semibold tracking-wide text-ink-2 uppercase">
        Data
      </h2>
      <p class="text-xs text-ink-2">Your tasks are stored in taskhop.db in:</p>
      <p v-if="dataFolder" class="font-mono text-xs break-all select-text">{{ dataFolder }}</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" :class="secondaryBtn" :disabled="dataBusy" @click="openDataFolder">
          Open data folder
        </button>
        <button type="button" :class="secondaryBtn" :disabled="dataBusy" @click="exportData">Export…</button>
        <button type="button" :class="secondaryBtn" :disabled="dataBusy" @click="importData">Import…</button>
      </div>
      <p class="text-xs text-ink-2">
        Export saves a backup file. Import replaces all tasks and settings with a backup.
      </p>
      <div v-auto-animate="{ duration: 150 }" aria-live="polite">
        <p
          v-if="dataMessage"
          :key="dataMessage.text"
          class="text-xs break-all"
          :class="dataMessage.ok ? 'text-ink' : 'text-hop'"
        >
          {{ dataMessage.text }}
        </p>
      </div>
    </section>

    <section class="space-y-2 border-t border-line py-3" aria-labelledby="about-heading">
      <h2 id="about-heading" class="text-xs font-semibold tracking-wide text-ink-2 uppercase">About</h2>
      <p class="text-sm">
        <span class="font-medium">Taskhop</span>
        <span v-if="version" class="text-ink-2"> {{ version }}</span>
      </p>
      <p class="text-xs text-ink-2">
        Made by MoebiusD9. Free and open source under the MIT License. Provided as is, without
        warranty of any kind. Not affiliated with Google; Gemini is a trademark of Google LLC.
      </p>
      <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <button
          v-for="link in aboutLinks"
          :key="link.page"
          type="button"
          class="cursor-pointer rounded text-hop underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-hop"
          @click="openPage(link.page)"
        >
          {{ link.label }}
        </button>
      </div>
    </section>
  </main>
</template>
