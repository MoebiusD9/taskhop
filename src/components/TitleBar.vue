<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useSettingsStore } from '../stores/settings'

defineProps<{ settingsOpen: boolean }>()
defineEmits<{ 'toggle-settings': [] }>()

const appWindow = getCurrentWindow()
const settings = useSettingsStore()
const { pinned } = storeToRefs(settings)
const setPinned = settings.setPinned

const btn =
  'grid size-7 place-items-center rounded-md text-ink-2 hover:bg-wash hover:text-ink ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hop'
</script>

<template>
  <!-- data-tauri-drag-region makes this element (but not its buttons) drag the window. -->
  <header
    data-tauri-drag-region
    class="flex h-10 shrink-0 items-center gap-1 border-b border-line pl-3 pr-1.5 select-none"
  >
    <!-- Logo: a task (filled dot) hops to tomorrow (open dot). Colors follow the theme. -->
    <svg data-tauri-drag-region viewBox="0 0 64 64" class="size-4.5 shrink-0" aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="16" fill="var(--hop)" />
      <circle cx="20" cy="42" r="8" fill="var(--on-hop)" />
      <circle cx="44" cy="42" r="6.5" fill="none" stroke="var(--on-hop)" stroke-width="5" />
      <path d="M21 29 Q32 11 43 29" fill="none" stroke="var(--on-hop)" stroke-width="5.5" stroke-linecap="round" />
    </svg>
    <span data-tauri-drag-region class="ml-1 flex-1 text-sm font-semibold">Taskhop</span>

    <button
      type="button"
      class="cursor-pointer"
      :class="[btn, settingsOpen && 'text-hop']"
      :aria-pressed="settingsOpen"
      aria-label="Settings"
      title="Settings"
      @click="$emit('toggle-settings')"
    >
      <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>

    <button
      type="button"
      class="cursor-pointer"
      :class="[btn, pinned && 'text-hop']"
      :aria-pressed="pinned"
      :aria-label="pinned ? 'Unpin (stop staying on top)' : 'Pin (keep on top)'"
      :title="pinned ? 'Unpin' : 'Keep on top'"
      @click="setPinned(!pinned)"
    >
      <svg viewBox="0 0 24 24" class="size-4" :fill="pinned ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 17v5" />
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
      </svg>
    </button>

    <button type="button" class="cursor-pointer" :class="btn" aria-label="Hide to tray" title="Hide to tray" @click="appWindow.hide()">
      <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  </header>
</template>
